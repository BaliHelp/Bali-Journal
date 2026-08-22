
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { myaiPing } from '@/lib/ai/myaiClient'

export const dynamic = 'force-dynamic'

export async function GET() {
    const start = Date.now()
    let dbStatus = 'disconnected'
    let aiStatus = 'disconnected'
    let latency = 0

    // 1. Check Database
    try {
        await db.$queryRaw`SELECT 1`
        dbStatus = 'connected'
    } catch (e) {
        console.error('Health Check - DB Error:', e)
        dbStatus = 'error'
    }

    // 2. Check MyAI OS Gateway
    try {
        await myaiPing()
        aiStatus = 'connected'
    } catch (e) {
        console.error('Health Check - AI Error:', e)
        aiStatus = 'error'
    }

    latency = Date.now() - start

    return NextResponse.json({
        status: dbStatus === 'connected' && aiStatus === 'connected' ? 'healthy' : 'degraded',
        database: dbStatus,
        ai: aiStatus,
        latency,
        timestamp: new Date().toISOString()
    })
}
