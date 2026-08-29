import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/**
 * Guard for /api/advertiser/* routes - resolves the session's Advertiser
 * profile row, if any. Deliberately does NOT require session.role ===
 * 'ADVERTISER': "is an advertiser" is determined purely by having an
 * Advertiser row (any account - USER, ADMIN, EDITOR - can also have one),
 * so a single account never needs two separate logins/roles to be both a
 * reader and an advertiser.
 */
export async function requireAdvertiser() {
    const session = await getSession()
    if (!session) return null

    const advertiser = await db.advertiser.findUnique({ where: { userId: session.id } })
    if (!advertiser) return null

    return { user: session, advertiser }
}
