'use server'

import { PrismaClient } from '@prisma/client'
import { auth } from "@/auth"
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// 1. Obtener lista de usuarios con sus departamentos
export async function getAllUsers() {
    const session = await auth();
    const currentUser = await prisma.user.findUnique({ where: { email: session?.user?.email! } });
    
    if (currentUser?.role !== 'SUPERADMIN') return { authorized: false, users: [] };

    const users = await prisma.user.findMany({
        orderBy: { fullName: 'asc' },
        include: {
            accessGrants: {
                include: { folder: true } // Para ver los nombres de los deptos asignados
            }
        }
    });

    // Limpiamos la data para el frontend
    const cleanUsers = users.map(u => ({
        id: u.id,
        name: u.fullName,
        email: u.email,
        role: u.role,
        // Convertimos la lista de permisos en una lista de nombres de deptos
        departments: u.accessGrants
            .filter(g => g.folder.type === 'DEPARTMENT')
            .map(g => ({ id: g.folder.id, name: g.folder.name }))
    }));

    return { authorized: true, users: cleanUsers };
}

// 2. Obtener lista de departamentos disponibles (para el selector)
export async function getAllDepartments() {
    return await prisma.folder.findMany({
        where: { type: 'DEPARTMENT', deletedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true }
    });
}

// 3. Crear Usuario Nuevo
export async function createUser(data: any) {
    try {
        const session = await auth();
        const admin = await prisma.user.findUnique({ where: { email: session?.user?.email! } });
        if (admin?.role !== 'SUPERADMIN') return { success: false, error: "No autorizado" };

        // Crear usuario
        const newUser = await prisma.user.create({
            data: {
                fullName: data.fullName,
                email: data.email,
                // En producción usarías bcrypt.hash(data.password)
                passwordHash: data.password, 
                role: data.role,
            }
        });

        // Crear su carpeta personal automática
        const personalFolder = await prisma.folder.create({
            data: {
                name: `Area Personal de ${newUser.fullName}`,
                type: 'PERSONAL',
                createdById: newUser.id
            }
        });
        
        await prisma.user.update({
            where: { id: newUser.id },
            data: { personalFolderId: personalFolder.id }
        });

        // Asignar Departamentos (Permisos)
        if (data.departmentIds && data.departmentIds.length > 0) {
            const permissions = data.departmentIds.map((folderId: string) => ({
                userId: newUser.id,
                folderId: folderId,
                accessType: 'WRITE' // Por defecto pueden editar en su depto
            }));
            
            await prisma.folderPermission.createMany({ data: permissions });
        }

        revalidatePath('/');
        return { success: true };

    } catch (e) {
        console.error(e);
        return { success: false, error: "Error al crear (¿El email ya existe?)" };
    }
}

// 4. Actualizar Usuario (Roles y Deptos)
export async function updateUser(userId: string, data: any) {
    try {
        const session = await auth();
        const admin = await prisma.user.findUnique({ where: { email: session?.user?.email! } });
        if (admin?.role !== 'SUPERADMIN') return { success: false };

        // Actualizar rol
        await prisma.user.update({
            where: { id: userId },
            data: { role: data.role }
        });

        // Actualizar Departamentos (Borrar viejos -> Poner nuevos)
        // Primero borramos permisos existentes a carpetas de tipo DEPARTMENT
        // (Para no borrar permisos especiales a carpetas sueltas si existieran)
        const userPermissions = await prisma.folderPermission.findMany({
            where: { userId: userId },
            include: { folder: true }
        });
        
        const deptPermsToDelete = userPermissions
            .filter(p => p.folder.type === 'DEPARTMENT')
            .map(p => p.id);

        await prisma.folderPermission.deleteMany({
            where: { id: { in: deptPermsToDelete } }
        });

        // Insertar los nuevos
        if (data.departmentIds && data.departmentIds.length > 0) {
            const newPerms = data.departmentIds.map((folderId: string) => ({
                userId: userId,
                folderId: folderId,
                accessType: 'WRITE'
            }));
            await prisma.folderPermission.createMany({ data: newPerms });
        }

        revalidatePath('/');
        return { success: true };

    } catch (e) {
        return { success: false, error: "Error al actualizar" };
    }
}