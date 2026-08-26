import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/**
 * Guard for /api/advertiser/* routes - confirms the session belongs to an
 * ADVERTISER user AND resolves their Advertiser profile row in one call,
 * since every advertiser route needs both (ownership checks use advertiser.id).
 */
export async function requireAdvertiser() {
    const session = await getSession()
    if (!session || session.role !== 'ADVERTISER') return null

    const advertiser = await db.advertiser.findUnique({ where: { userId: session.id } })
    if (!advertiser) return null

    return { user: session, advertiser }
}
