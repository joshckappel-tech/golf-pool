import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getTournament, getEntry } from '@/lib/db'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key, {})
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entryId, tournamentId } = body

    if (!entryId || !tournamentId) {
      return NextResponse.json(
        { error: 'Missing entryId or tournamentId' },
        { status: 400 }
      )
    }

    const entry = getEntry(entryId)
    if (!entry) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      )
    }

    const tournament = getTournament(tournamentId)
    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // Create Stripe checkout session
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tournament.name} - Golf Pool Entry`,
              description: `Entry fee for ${tournament.name}`,
            },
            unit_amount: tournament.entryFee * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/entry?session_id={CHECKOUT_SESSION_ID}&entryId=${entryId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/entry?entryId=${entryId}`,
      customer_email: entry.entrantEmail,
      metadata: {
        entryId,
        tournamentId,
      },
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
