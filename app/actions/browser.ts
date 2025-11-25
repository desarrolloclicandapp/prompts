'use server'

import { PrismaClient } from '@prisma/client'
import { auth } from "@/auth"
import { revalidatePath } from 'next/cache'
import { logAction } from './audit';

const prisma = new PrismaClient()

// FUNCIÓN DE AYUDA: Verifica Admin (para mover/borrar)
const checkAdminAuth = async () => {
    const session = await auth();
    const admin = await prisma.user.findUnique({ where: { email: session?.user?.email! } });
    if (admin?.role !== 'SUPERADMIN') throw new Error("Acceso denegado. Se requiere rol de administrador.");
    return admin;
};


export async function getFolderContent(folderId?: string) {
    try {
        const session = await auth()
        if (!session?.user?.email) return { error: "No autorizado" }

        // 1. Buscamos al usuario Y SUS PERMISOS
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { accessGrants: true } 
        })
        if (!user) return { error: "Usuario no encontrado" }

        const isAdmin = user.role === 'SUPERADMIN';
        let targetFolderId = folderId;

        // --- INICIALIZACIÓN (Soluciona errores de alcance) ---
        let currentFolder: any = null;
        let subFolders: any[] = [];
        let files: any[] = [];
        
        // --- CASO ESPECIAL: VISTA DE ESPACIOS PRIVADOS DE TODOS LOS USUARIOS (Solo Admin - Punto 4) ---
        if (folderId === 'SUPER_PERSONAL_ROOT') {
            if (!isAdmin) return { error: "Acceso denegado" };

            const allPersonalFolders = await prisma.folder.findMany({
                where: { type: 'PERSONAL', deletedAt: null, isActive: true },
                include: { createdBy: { select: { fullName: true } } },
                orderBy: { name: 'asc' }
            });

            const formattedFolders = allPersonalFolders.map(f => ({
                id: f.id,
                name: `👤 ${f.createdBy?.fullName || 'Usuario'} | ${f.name}`,
                type: 'folder',
                kind: 'folder',
                meta: f
            }));

            return {
                success: true,
                data: {
                    // Retornamos el objeto currentFolder directamente aquí para la UI
                    currentFolder: { id: 'SUPER_PERSONAL_ROOT', name: 'Espacios Personales de Todos', parentId: null },
                    subFolders: formattedFolders,
                    files: []
                }
            };
        }
        // --- CASO ADMIN GLOBAL (DEPARTAMENTOS) ---
        if (folderId === 'ADMIN_ROOT') {
            if (!isAdmin) return { error: "Acceso denegado" }
            subFolders = await prisma.folder.findMany({
                where: { type: 'DEPARTMENT', deletedAt: null },
                orderBy: { name: 'asc' }
            });
            
            return {
                success: true,
                data: {
                    currentFolder: { id: 'ADMIN_ROOT', name: 'Gestión Global', parentId: null },
                    subFolders: subFolders,
                    files: []
                }
            }
        }

        // --- ENRUTAMIENTO NORMAL (Mi Espacio / Depto) ---

        if (!targetFolderId || targetFolderId === 'PERSONAL_ROOT') {
            if (!user.personalFolderId) {
                 const newPersonal = await prisma.folder.create({
                    data: { name: `Area Personal de ${user.fullName}`, type: 'PERSONAL', createdById: user.id }
                 })
                 await prisma.user.update({ where: { id: user.id }, data: { personalFolderId: newPersonal.id } })
                 targetFolderId = newPersonal.id
            } else {
                 targetFolderId = user.personalFolderId
            }
        } 
        
        // OBTENCIÓN DE DATOS Y VALIDACIÓN
        currentFolder = await prisma.folder.findUnique({
            where: { id: targetFolderId! },
            include: { parent: true }
        });
        
        if (!currentFolder) return { error: "Carpeta no encontrada" }

        // VALIDACIÓN DE PERMISOS
        const isOwner = currentFolder.createdById === user.id;
        const hasPermission = user.accessGrants.some(grant => grant.folderId === currentFolder.id);

        if (!isAdmin && !isOwner && !hasPermission && currentFolder.type !== 'PERSONAL') {
            if (currentFolder.type === 'DEPARTMENT' && !hasPermission) {
                return { error: "No tienes acceso a este departamento" }
            }
        }

        // Obtener contenido
        subFolders = await prisma.folder.findMany({
            where: { parentId: targetFolderId!, deletedAt: null, isActive: true },
            orderBy: { name: 'asc' }
        })

        files = await prisma.prompt.findMany({
            where: { folderId: targetFolderId!, deletedAt: null },
            orderBy: { title: 'asc' },
            include: { createdBy: true }
        })

        return { success: true, data: { currentFolder, subFolders, files } }

    } catch (error) {
        console.error("Error:", error)
        return { error: "Error interno" }
    }
}

// ----------------------------------------------------
// ACCIONES CRUD (Punto 2 y 3)
// ----------------------------------------------------

export async function createSubFolder(name: string, parentId: string) {
    try {
        const user = await checkAdminAuth();
        
        const newFolder = await prisma.folder.create({
            data: { name, type: 'PROJECT', parentId, createdById: user.id }
        });
        
        await logAction('CREATE_FOLDER', newFolder.id, { name: name, parentId: parentId }); 
        revalidatePath('/');
        return { success: true };
    } catch (e) {
        return { success: false, error: 'Error al crear carpeta' };
    }
}

export async function createDepartment(name: string) {
    try {
        const admin = await checkAdminAuth();

        const newDept = await prisma.folder.create({
            data: { name: name, type: 'DEPARTMENT', allowedDept: name, createdById: admin.id }
        });

        await logAction('CREATE_DEPARTMENT', newDept.id, { name: name });
        revalidatePath('/');
        return { success: true };
    } catch (e) { return { success: false, error: 'Error creando depto.' }; }
}


export async function renameItem(id: string, newName: string, type: 'folder' | 'file', currentName: string) {
    try {
        const admin = await checkAdminAuth();
        if (type === 'folder') {
            await prisma.folder.update({ where: { id }, data: { name: newName } });
        } else {
            await prisma.prompt.update({ where: { id }, data: { title: newName } });
        }
        
        await logAction('RENAME_ITEM', id, { itemType: type, oldName: currentName, newName: newName });
        
        revalidatePath('/');
        return { success: true, error: null };
    } catch (e) { 
        console.error(e);
        return { success: false, error: 'Error al renombrar' }; 
    }
}

export async function moveItem(id: string, newParentId: string, type: 'folder' | 'file', destinationName: string) {
    try {
        const admin = await checkAdminAuth();
        
        if (type === 'folder') {
            await prisma.folder.update({ where: { id }, data: { parentId: newParentId } });
        } else {
            await prisma.prompt.update({ where: { id }, data: { folderId: newParentId } });
        }
        
        await logAction('MOVE_ITEM', id, { itemType: type, destination: destinationName });
        revalidatePath('/');
        return { success: true, error: null };
    } catch (e) { 
        console.error(e);
        return { success: false, error: 'Error al mover' }; 
    }
}

export async function deleteItem(id: string, type: 'folder' | 'file') {
    try {
        const session = await auth()
        if (!session?.user?.email) return { success: false, error: "No autorizado" }

        const user = await prisma.user.findUnique({ where: { email: session.user.email } })
        if (!user) return { success: false, error: "Usuario no encontrado" }

        const isAdmin = user.role === 'SUPERADMIN';
        let entityName = "";

        if (type === 'folder') {
            const folder = await prisma.folder.findUnique({ where: { id } })
            if (!folder) return { success: false, error: "Carpeta no existe" }

            if (!isAdmin && folder.createdById !== user.id) {
                return { success: false, error: "No tienes permiso para borrar esto" }
            }
            entityName = folder.name;
            await prisma.folder.update({ where: { id }, data: { deletedAt: new Date() } });
        } 
        else {
            const prompt = await prisma.prompt.findUnique({ where: { id } })
            if (!prompt) return { success: false, error: "Archivo no existe" }

            if (!isAdmin && prompt.createdById !== user.id) {
                return { success: false, error: "No tienes permiso para borrar esto" }
            }
            entityName = prompt.title;
            await prisma.prompt.update({ where: { id }, data: { deletedAt: new Date() } });
        }

        await logAction('SOFT_DELETE_ITEM', id, { itemType: type, name: entityName });
        revalidatePath('/')
        return { success: true, error: null }

    } catch (e) {
        console.error("Error borrando:", e)
        return { success: false, error: "Error interno al borrar" }
    }
}

export async function toggleFolderStatus(folderId: string, currentStatus: boolean) {
    try {
        const admin = await checkAdminAuth();
        
        const newStatus = !currentStatus;
        const folder = await prisma.folder.update({
            where: { id: folderId },
            data: { 
                isActive: newStatus,
                deletedAt: !newStatus ? new Date() : null // Desactiva/Activa Soft Delete
            }
        });
        
        await logAction(newStatus ? 'ACTIVATE_FOLDER' : 'DEACTIVATE_FOLDER', folderId, { name: folder.name, type: folder.type });
        revalidatePath('/');
        return { success: true, error: null };

    } catch (e) {
        console.error("Error toggling folder status:", e);
        return { success: false, error: "Error interno al cambiar el estado." };
    }
}