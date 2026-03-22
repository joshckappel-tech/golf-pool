import { NextRequest, NextResponse } from 'next/server'

async function getDb() {
  if (process.env.KV_REST_API_URL) {
    return await import('@/lib/db-kv')
  }
  return await import('@/lib/db')
}

export async function GET() {
  try {
    const db = await getDb()
    const settings = await db.getSettings()
    return NextResponse.json(settings, { status: 200 })
  } catch (error) {
    console.error('GET /api/settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 })
    }

    const db = await getDb()
    const currentSettings = await db.getSettings()
    const updatedSettings = { ...currentSettings, ...body }

    if (!updatedSettings.submissionDeadline || !updatedSettings.tournamentName) {
      return NextResponse.json(
        { error: 'Missing required fields: submissionDeadline, tournamentName' },
        { status: 400 }
      )
    }

    await db.saveSettings(updatedSettings)

    return NextResponse.json(updatedSettings, { status: 200 })
  } catch (error) {
    console.error('POST /api/settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
