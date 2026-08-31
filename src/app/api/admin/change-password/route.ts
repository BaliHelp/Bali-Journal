import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hashPassword, verifyPassword } from '@/lib/auth/session'

// Lets the logged-in admin/editor change their own login password from the
// dashboard - previously the only way to do this was a direct DB write.
export async function PATCH(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { currentPassword, newPassword } = await request.json()

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Password saat ini dan password baru wajib diisi' }, { status: 400 })
        }
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return NextResponse.json({ error: 'Password baru minimal 8 karakter' }, { status: 400 })
        }

        const user = await db.user.findUnique({ where: { id: session.id }, select: { password: true } })
        if (!user || !user.password) {
            return NextResponse.json({ error: 'Akun ini tidak memiliki password (login via OAuth)' }, { status: 400 })
        }

        const isValid = await verifyPassword(currentPassword, user.password)
        if (!isValid) {
            return NextResponse.json({ error: 'Password saat ini salah' }, { status: 400 })
        }

        const hashed = await hashPassword(newPassword)
        await db.user.update({ where: { id: session.id }, data: { password: hashed } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Change password error:', error)
        return NextResponse.json({ error: 'Gagal mengganti password' }, { status: 500 })
    }
}
