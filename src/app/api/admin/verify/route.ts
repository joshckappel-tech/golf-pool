import { NextRequest, NextResponse } from 'next/server'
import { getSettings } from '@/lib/db'

interface VerifyRequest {
  password: string
  username?: string
  type?: 'pool' | 'admin'
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

    const settings = getSettings()
    const requestType = body.type || 'admin'

    if (requestType === 'pool') {
      // Verify pool entry password
      const poolPassword = process.env.POOL_PASSWORD || settings.poolPassword || 'golf2026'
      const isValid = body.password === poolPassword
      return NextResponse.json({ valid: isValid }, { status: 200 })
    } else {
      // Verify admin credentials
      const adminUsername = process.env.ADMIN_USERNAME || settings.adminUsername || 'admin'
      const adminPassword = process.env.ADMIN_PASSWORD || settings.adminPassword || 'golfpool2026'
      const isValid = (body.username === adminUsername) && (body.password === adminPassword)
      return NextResponse.json({ valid: isValid }, { status: 200 })
    }
  } catch (error) {
    console.error('Admin verify error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
