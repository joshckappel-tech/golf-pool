import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getEntry, saveEntry } from '@/lib/db'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key, {})
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature') || ''

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      )
    }

    let event: Stripe.Event

    try {
      const stripe = getStripe()
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      const entryId = session.metadata?.entryId

      if (!entryId) {
        console.error('No entryId in webhook metadata')
        return NextResponse.json(
          { error: 'No entry ID in webhook data' },
          { status: 400 }
        )
      }

      const entry = getEntry(entryId)

      if (!entry) {
        console.error(`Entry ${entryId} not found`)
        return NextResponse.json(
          { error: 'Entry not found' },
          { status: 404 }
        )
      }

      // Mark entry as paid
      entry.isPaid = true
      entry.stripePaymentId = session.payment_intent as string

      saveEntry(entry)

      console.log(`Entry ${entryId} marked as paid`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}
