'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import EntryForm from '@/components/EntryForm'
import PayoutDisplay from '@/components/PayoutDisplay'
import { Golfer, TournamentGolfer, Entry } from '@/types'

export default function EntryPage() {
  const [submitting, setSubmitting] = useState(false)

  // Mock golfers data
  const mockGolfers: (Golfer & { tournamentGolfer?: TournamentGolfer })[] = [
    {
      id: '1',
      name: 'Scottie Scheffler',
      worldRanking: 1,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-1',
        tournamentId: 'masters-2026',
        golferId: '1',
        group: 'A',
        odds: '5/1',
        currentScore: -15,
        currentPosition: '1',
        thru: 'F',
        projectedEarnings: 4500000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
    {
      id: '2',
      name: 'Rory McIlroy',
      worldRanking: 2,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-2',
        tournamentId: 'masters-2026',
        golferId: '2',
        group: 'A',
        odds: '8/1',
        currentScore: -12,
        currentPosition: '2',
        thru: 'F',
        projectedEarnings: 2500000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
    {
      id: '3',
      name: 'Xander Schauffele',
      worldRanking: 3,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-3',
        tournamentId: 'masters-2026',
        golferId: '3',
        group: 'B',
        odds: '10/1',
        currentScore: -13,
        currentPosition: '2',
        thru: 'F',
        projectedEarnings: 2500000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
    {
      id: '4',
      name: 'Jon Rahm',
      worldRanking: 4,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-4',
        tournamentId: 'masters-2026',
        golferId: '4',
        group: 'B',
        odds: '12/1',
        currentScore: -8,
        currentPosition: 'T5',
        thru: 'F',
        projectedEarnings: 500000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
    {
      id: '5',
      name: 'Collin Morikawa',
      worldRanking: 5,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-5',
        tournamentId: 'masters-2026',
        golferId: '5',
        group: 'C',
        odds: '15/1',
        currentScore: -10,
        currentPosition: '3',
        thru: 'F',
        projectedEarnings: 1500000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
    {
      id: '6',
      name: 'Justin Thomas',
      worldRanking: 6,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-6',
        tournamentId: 'masters-2026',
        golferId: '6',
        group: 'C',
        odds: '18/1',
        currentScore: -11,
        currentPosition: 'T4',
        thru: 'F',
        projectedEarnings: 750000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
    {
      id: '7',
      name: 'Sam Burns',
      worldRanking: 7,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-7',
        tournamentId: 'masters-2026',
        golferId: '7',
        group: 'D',
        odds: '20/1',
        currentScore: -9,
        currentPosition: 'T8',
        thru: 'F',
        projectedEarnings: 300000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
    {
      id: '8',
      name: 'Brooks Koepka',
      worldRanking: 8,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-8',
        tournamentId: 'masters-2026',
        golferId: '8',
        group: 'D',
        odds: '25/1',
        currentScore: -3,
        currentPosition: 'T20',
        thru: 'F',
        projectedEarnings: 80000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
    {
      id: '9',
      name: 'Jordan Spieth',
      worldRanking: 10,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-9',
        tournamentId: 'masters-2026',
        golferId: '9',
        group: 'field',
        odds: '30/1',
        currentScore: -5,
        currentPosition: 'T12',
        thru: 'F',
        projectedEarnings: 150000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
    {
      id: '10',
      name: 'Patrick Cantlay',
      worldRanking: 9,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-10',
        tournamentId: 'masters-2026',
        golferId: '10',
        group: 'field',
        odds: '40/1',
        currentScore: -9,
        currentPosition: 'T8',
        thru: 'F',
        projectedEarnings: 300000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
  ]

  const golfersByGroup = {
    A: mockGolfers.filter((g) => g.tournamentGolfer?.group === 'A'),
    B: mockGolfers.filter((g) => g.tournamentGolfer?.group === 'B'),
    C: mockGolfers.filter((g) => g.tournamentGolfer?.group === 'C'),
    D: mockGolfers.filter((g) => g.tournamentGolfer?.group === 'D'),
    field: mockGolfers.filter((g) => g.tournamentGolfer?.group === 'field'),
  }

  const payoutPlaces = [
    { place: 1, amount: 2000 },
    { place: 2, amount: 1500 },
    { place: 3, amount: 1000 },
    { place: 4, amount: 800 },
    { place: 5, amount: 600 },
    { place: 6, amount: 400 },
    { place: 7, amount: 300 },
    { place: 8, amount: 200 },
  ]

  const handleSubmit = async (entry: Partial<Entry>) => {
    setSubmitting(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      console.log('Entry submitted:', entry)
      // Would redirect to payment page or show success message
      alert('Entry submitted! Redirecting to payment...')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Header />
      <main className="flex-1 bg-gradient-to-b from-gray-50 to-white">
        <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Enter the Pool</h1>
            <p className="text-lg text-gray-600">
              2026 Masters Tournament • $50 Entry Fee
            </p>
          </div>

          {/* Entry Form */}
          <EntryForm
            golfersByGroup={golfersByGroup}
            onSubmit={handleSubmit}
            loading={submitting}
          />
        </div>

        {/* Payout Display Modal / Sidebar - shown separately on desktop */}
        <div className="lg:hidden px-4 sm:px-6 py-12 max-w-7xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Prize Structure</h2>
            <PayoutDisplay
              places={payoutPlaces}
              totalPool={1200}
              entryCount={24}
              entryFee={50}
              adminCut={0}
            />
          </div>
        </div>
      </main>
    </>
  )
}
