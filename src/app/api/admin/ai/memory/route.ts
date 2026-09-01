import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/**
 * Lists agent memories (src/lib/ai/memory.ts, table agent_memories) for the
 * new AI Center "Agent Memory" panel - this data has existed and been
 * actively written to since the legal-risk pipeline shipped, but there was
 * NO way for anyone to see or manage it until now. Plain SELECT (no vector
 * search needed for a listing view) - raw SQL because `embedding` is
 * declared Unsupported("vector") in schema.prisma, so it isn't reachable
 * through Prisma Client's normal query API at all, not even to just leave
 * it unselected implicitly the way a normal column would be.
 */
export async function GET(request: NextRequest) {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const agentKey = searchParams.get('agentKey')
    const category = searchParams.get('category')
    const q = searchParams.get('q')?.trim()
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 500)

    const conditions: string[] = []
    const params: unknown[] = []

    if (agentKey) {
        params.push(agentKey)
        conditions.push(`"agentKey" = $${params.length}`)
    }
    if (category) {
        params.push(category)
        conditions.push(`category = $${params.length}`)
    }
    if (q) {
        params.push(`%${q}%`)
        conditions.push(`content ILIKE $${params.length}`)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(limit)

    const memories = await db.$queryRawUnsafe<Array<{
        id: string
        agentKey: string
        category: string | null
        content: string
        metadata: Record<string, unknown> | null
        createdAt: Date
    }>>(
        `SELECT id, "agentKey", category, content, metadata, "createdAt"
         FROM agent_memories
         ${where}
         ORDER BY "createdAt" DESC
         LIMIT $${params.length}`,
        ...params,
    )

    const [{ count }] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT count(*)::bigint as count FROM agent_memories`
    )

    const byAgent = await db.$queryRawUnsafe<Array<{ agentKey: string; count: bigint }>>(
        `SELECT "agentKey", count(*)::bigint as count FROM agent_memories GROUP BY "agentKey"`
    )

    return NextResponse.json({
        memories,
        total: Number(count),
        byAgent: byAgent.map((r) => ({ agentKey: r.agentKey, count: Number(r.count) })),
    })
}
