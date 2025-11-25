'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { auth } from "@/auth"
import { logAction } from './audit' // ⬅️ IMPORTACIÓN CLAVE: Para registrar acciones (Punto 3)

const prisma = new PrismaClient()

export async function savePrompt(data: any) {
    try {
        const session = await auth()
        if (!session?.user?.email) return { success: false, error: 'No autorizado' }
    
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        })
        if (!user) return { success: false, error: 'Usuario no encontrado' }
    
        let finalFolderId = data.targetFolderId;
    
        if (!finalFolderId) {
            if (!user.personalFolderId) {
                 const newPersonal = await prisma.folder.create({
                    data: { name: `Area Personal de ${user.fullName}`, type: 'PERSONAL', createdById: user.id }
                 })
                 await prisma.user.update({ where: { id: user.id }, data: { personalFolderId: newPersonal.id } })
                 finalFolderId = newPersonal.id
            } else {
                 finalFolderId = user.personalFolderId
            }
        }
    
        // 🚨 FIX: La variable newPrompt es definida y usada en el mismo scope.
        const newPrompt = await prisma.prompt.create({
          data: {
            title: data.title || "Prompt sin título",
            currentObjective: data.type,
            currentContent: data.sections,
            baseInput: data.basePrompt,
            folderId: finalFolderId!,
            createdById: user.id,
          },
        });
        
        // ✅ REGISTRO DE AUDITORÍA (Punto 3)
        await logAction('CREATE_PROMPT', newPrompt.id, { 
            title: newPrompt.title, 
            folderId: finalFolderId
        });

        await prisma.promptVersion.create({
            data: {
                promptId: newPrompt.id,
                contentJson: data.sections,
                createdByUserId: user.id,
                changeNote: 'Creación inicial'
            }
        });
    
        revalidatePath('/')
        return { success: true, prompt: newPrompt }
    
      } catch (error) {
        console.error("Error guardando:", error)
        return { success: false, error: 'Error al guardar' }
      }
}

export async function getAvailableFolders() {
    const session = await auth()
    if (!session?.user?.email) return []
    
    // CORRECCIÓN: Incluimos accessGrants
    const user = await prisma.user.findUnique({ 
        where: { email: session.user.email },
        include: { accessGrants: true }
    })
    if (!user) return []

    const isAdmin = user.role === 'SUPERADMIN';

    // Obtenemos los IDs de las carpetas permitidas
    const allowedIds = user.accessGrants.map(g => g.folderId);

    // Consulta: Mis carpetas OR Carpetas donde tengo permiso OR Todas si soy Admin
    return await prisma.folder.findMany({
        where: {
            deletedAt: null,
            OR: [
                { createdById: user.id }, // Creadas por mí
                { id: { in: allowedIds } }, // Permiso explícito
                isAdmin ? { type: 'DEPARTMENT' } : {} // Si es admin, ve todos los deptos
            ]
        },
        orderBy: { name: 'asc' }
    })
}