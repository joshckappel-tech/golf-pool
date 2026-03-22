import { NextRequest, NextResponse } from 'next/server'

interface VerifyRequest {
  password: string
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyRequest = await request.json()

    if (!body.password) {
      return NextResponse.json(
        { error: 'Missing password field' },
        { status: 400 }
      )
    }

    // Get admin password from environment variable or use default
    const adminPassword = process.env.ADMIN_PASSWORD || 'golfpool2026'

    // Compare passwords
    const isValid = body.password === adminPassword

    return NextResponse.json(
      { valid: isValid },
      { status: 200 }
    )
  } catch (error) {
    console.error('Admin verify error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
