import { NextRequest, NextResponse } from 'next/server'
import { getSettings, saveSettings } from '@/lib/db'

export async function GET() {
  try {
    const settings = getSettings()
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

    // Get current settings and merge with new data
    const currentSettings = getSettings()
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
    saveSettings(updatedSettings)

    return NextResponse.json(updatedSettings, { status: 200 })
  } catch (error) {
    console.error('POST /api/settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
