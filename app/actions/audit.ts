// app/actions/audit.ts
'use server'

import { PrismaClient } from '@prisma/client'
import { auth } from "@/auth"

const prisma = new PrismaClient()

// FUNCIÓN CENTRAL DE REGISTRO (Punto 3)
export async function logAction(action: string, entityId: string | null, details: any) {
    try {
        const session = await auth();
        if (!session?.user?.id) return;

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: action,
                entityId: entityId,
                details: details || {}
            }
        });
    } catch (e) {
        console.error("AUDIT LOGGING FAILED:", e);
    }
}

// OBTENER REGISTROS (Punto 3)
export async function getAuditLogs() {
    const session = await auth();
    const user = await prisma.user.findUnique({ where: { email: session?.user?.email! } });
    if (user?.role !== 'SUPERADMIN') return [];

    return await prisma.auditLog.findMany({
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { fullName: true, email: true } } },
        take: 200 
    });
}