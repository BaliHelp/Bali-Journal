import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSession, setSessionCookie } from '@/lib/auth'
import { getSession } from '@/lib/auth/session'
import { advertiserRegisterSchema, advertiserProfileSchema } from '@/lib/validators'

/**
 * Ensures the caller has an Advertiser profile - the single entry point for
 * "become an advertiser", used by both a fresh visitor (no session: creates
 * a new account + profile together) and an already-logged-in account (any
 * role: just attaches a profile to it). There is deliberately no separate
 * advertiser-only signup/login system - advertiser status lives on this one
 * Advertiser row, not on the account's role.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session = await getSession()

    if (session) {
      const existing = await db.advertiser.findUnique({ where: { userId: session.id } })
      if (existing) {
        // Idempotent - a returning advertiser hitting this again (e.g. the
        // /ads order flow re-checking) just gets their existing profile back.
        return NextResponse.json({ user: session, advertiser: existing })
      }

      const result = advertiserProfileSchema.safeParse(body)
      if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
      }

      const advertiser = await db.advertiser.create({
        data: { ...result.data, userId: session.id },
      })

      return NextResponse.json({ user: session, advertiser })
    }

    const result = advertiserRegisterSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { email, password, name, advertiserType, companyName, phone } = result.data

    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar - silakan login terlebih dahulu' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(password)

    // role stays the normal default ('USER') - advertiser status is
    // determined by the Advertiser relation, not a dedicated role.
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        advertiser: {
          create: { advertiserType, companyName, phone },
        },
      },
      include: { advertiser: true },
    })

    const token = await createSession(user.id)
    await setSessionCookie(token)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      advertiser: user.advertiser,
    })
  } catch (error) {
    console.error('Advertiser register error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat registrasi' },
      { status: 500 }
    )
  }
}
