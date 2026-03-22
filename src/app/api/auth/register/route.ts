import { NextRequest, NextResponse } from 'next/server'
import { crypto } from 'node:crypto'
import { getUserByEmail, saveUser, saveSession } from '@/lib/db'

interface RegisterRequest {
  email: string
  password: string
  name: string
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json()

    // Validate input
    if (!body.email || !body.password || !body.name) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, name' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check for duplicate email
    const existingUser = getUserByEmail(body.email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    // Validate password length
    if (body.password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Generate salt and hash password
    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = crypto
      .pbkdf2Sync(body.password, salt, 10000, 64, 'sha256')
      .toString('hex')

    // Create user
    const userId = `user-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
    const user = {
      id: userId,
      email: body.email.toLowerCase(),
      name: body.name,
      passwordHash,
      salt,
      createdAt: new Date().toISOString(),
    }

    saveUser(user)

    // Create session token
    const sessionToken = crypto.randomBytes(32).toString('hex')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

    const session = {
      token: sessionToken,
      userId: user.id,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }

    saveSession(session)

    return NextResponse.json(
      {
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
