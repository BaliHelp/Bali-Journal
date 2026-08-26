import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth'
import { loginSchema } from '@/lib/validators'
import { isRateLimited, recordFailedAttempt, clearAttempts } from '@/lib/auth/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      )
    }

    const { email, password } = result.data

    // Rate-limit brute-force attempts per (ip, email) pair. Checked before
    // touching the DB/bcrypt so a lockout doesn't cost a hash comparison.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    const rateLimitKey = `${ip}:${email}`
    if (isRateLimited(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
        { status: 429 }
      )
    }

    // Find user
    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user || !user.password) {
      recordFailedAttempt(rateLimitKey)
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      )
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password)

    if (!isValid) {
      recordFailedAttempt(rateLimitKey)
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      )
    }

    clearAttempts(rateLimitKey)

    // Create session
    const token = await createSession(user.id)
    await setSessionCookie(token)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat login' },
      { status: 500 }
    )
  }
}
