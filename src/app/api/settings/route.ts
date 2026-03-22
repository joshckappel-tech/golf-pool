import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    let db: any
    try {
      db = await import('@/lib/db')
    } catch (importErr) {
      console.error('Failed to import db module:', importErr)
      return NextResponse.json(
        { error: 'Database initialization failed' },
        { status: 503 }
      )
    }

    const settings = db.getSettings()
    return NextResponse.json(settings, { status: 200 })
  } catch (error) {
    console.error('GET /api/settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate that body has expected settings fields
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Invalid settings format' },
        { status: 400 }
      )
    }

    let db: any
    try {
      db = await import('@/lib/db')
    } catch (importErr) {
      console.error('Failed to import db module:', importErr)
      return NextResponse.json(
        { error: 'Database initialization failed' },
        { status: 503 }
      )
    }

    // Get current settings and merge with new data
    const currentSettings = db.getSettings()
    const updatedSettings = {
      ...currentSettings,
      ...body,
    }

    // Validate required fields
    if (!updatedSettings.submissionDeadline || !updatedSettings.tournamentName) {
      return NextResponse.json(
        { error: 'Missing required fields: submissionDeadline, tournamentName' },
        { status: 400 }
      )
    }

    // Save updated settings
    db.saveSettings(updatedSettings)

    return NextResponse.json(updatedSettings, { status: 200 })
  } catch (error) {
    console.error('POST /api/settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
