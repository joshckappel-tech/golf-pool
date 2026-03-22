import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

interface RegisterRequest {
  email: string
  password: string
  name: string
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json()

    if (!body.email || !body.password || !body.name) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, name' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    if (body.password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Use KV database on Vercel, file-based locally
    let db: any
    try {
      if (process.env.KV_REST_API_URL) {
        db = await import('@/lib/db-kv')
      } else {
        db = await import('@/lib/db')
      }
    } catch (importErr) {
      console.error('Failed to import db module:', importErr)
      return NextResponse.json(
        { error: 'Database initialization failed. Please try again.' },
        { status: 503 }
      )
    }

    const existingUser = await db.getUserByEmail(body.email.toLowerCase())
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = crypto
      .pbkdf2Sync(body.password, salt, 10000, 64, 'sha256')
      .toString('hex')

    const userId = `user-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
    const user = {
      id: userId,
      email: body.email.toLowerCase(),
      name: body.name,
      passwordHash,
      salt,
      createdAt: new Date().toISOString(),
    }

    await db.saveUser(user)

    const sessionToken = crypto.randomBytes(32).toString('hex')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const session = {
      token: sessionToken,
      userId: user.id,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }

    await db.saveSession(session)

    return NextResponse.json(
      {
        token: sessionToken,
        user: { id: user.id, email: user.email, name: user.name },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
