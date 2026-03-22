import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Password reset: user provides email + new password
// For simplicity (no email service), this uses a pool-password-gated reset
// User must know the pool password to reset their account password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, newPassword, poolPassword } = body

    if (!email || !newPassword || !poolPassword) {
      return NextResponse.json(
        { error: 'Missing required fields: email, newPassword, poolPassword' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
        { status: 400 }
      )
    }

    let db: any
    try {
      if (process.env.KV_REST_API_URL) {
        db = await import('@/lib/db-kv')
      } else {
        db = await import('@/lib/db')
      }
    } catch (importErr) {
      return NextResponse.json({ error: 'Database initialization failed' }, { status: 503 })
    }

    // Verify pool password for security
    const settings = await db.getSettings()
    const correctPoolPw = settings.poolPassword || 'golf2026'
    if (poolPassword !== correctPoolPw) {
      return NextResponse.json(
        { error: 'Invalid pool password. Contact the pool commissioner for help.' },
        { status: 403 }
      )
    }

    // Find user by email
    const user = await db.getUserByEmail(email.toLowerCase())
    if (!user) {
      return NextResponse.json(
        { error: 'No account found with that email address' },
        { status: 404 }
      )
    }

    // Generate new password hash
    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = crypto
      .pbkdf2Sync(newPassword, salt, 10000, 64, 'sha256')
      .toString('hex')

    // Update user
    user.salt = salt
    user.passwordHash = passwordHash
    await db.saveUser(user)

    return NextResponse.json(
      { message: 'Password reset successfully. You can now log in with your new password.' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
