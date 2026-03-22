import { NextRequest, NextResponse } from 'next/server'

interface VerifyRequest {
  password: string
  username?: string
  type?: 'pool' | 'admin'
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyRequest = await request.json()

    if (!body.password) {
      return NextResponse.json({ error: 'Missing password field' }, { status: 400 })
    }

    let settings: any = {}
    try {
      let db: any
      if (process.env.KV_REST_API_URL) {
        db = await import('@/lib/db-kv')
      } else {
        db = await import('@/lib/db')
      }
      settings = await db.getSettings()
    } catch (e) {
      console.log('Could not load settings, using defaults')
    }

    const requestType = body.type || 'admin'

    if (requestType === 'pool') {
      const poolPassword = process.env.POOL_PASSWORD || settings.poolPassword || 'golf2026'
      const isValid = body.password === poolPassword
      return NextResponse.json({ valid: isValid }, { status: 200 })
    } else {
      const adminUsername = process.env.ADMIN_USERNAME || settings.adminUsername || 'admin'
      const adminPassword = process.env.ADMIN_PASSWORD || settings.adminPassword || 'golfpool2026'
      const isValid = (body.username === adminUsername) && (body.password === adminPassword)
      return NextResponse.json({ valid: isValid }, { status: 200 })
    }
  } catch (error) {
    console.error('Admin verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
