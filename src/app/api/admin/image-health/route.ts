import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getImageGeneratorHealth } from '@/lib/images/image-service'

/**
 * Surfaces GENERATOR_POOL's real health to the Admin Dashboard - see
 * getImageGeneratorHealth() for why this exists: the Gemini->Pollinations
 * fallback is a silent safety net by design, which also means a real
 * outage (confirmed: Google AI Studio monthly spend cap hit 2026-09-05)
 * can run for days before anyone notices via image quality alone.
 */
export async function GET() {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const health = await getImageGeneratorHealth()
    return NextResponse.json(health)
}
