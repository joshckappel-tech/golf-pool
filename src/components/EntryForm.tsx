'use client'

import { useState, useMemo } from 'react'
import { Golfer, TournamentGolfer, Entry } from '@/types'
import GolferPickCard from './GolferPickCard'
import { ChevronRight, ChevronLeft, Search } from 'lucide-react'

interface EntryFormProps {
  golfersByGroup: {
    A: (Golfer & { tournamentGolfer?: TournamentGolfer })[]
    B: (Golfer & { tournamentGolfer?: TournamentGolfer })[]
    C: (Golfer & { tournamentGolfer?: TournamentGolfer })[]
    D: (Golfer & { tournamentGolfer?: TournamentGolfer })[]
    field: (Golfer & { tournamentGolfer?: TournamentGolfer })[]
  }
  onSubmit: (entry: Partial<Entry>) => Promise<void>
  loading?: boolean
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export default function EntryForm({
  golfersByGroup,
  onSubmit,
  loading = false,
}: EntryFormProps) {
  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [picks, setPicks] = useState<{
    groupA?: string
    groupB?: string
    groupC?: string
    groupD?: string
    wildCard1?: string
    wildCard2?: string
  }>({})
  const [tiebreaker, setTiebreaker] = useState('')
  const [fieldSearch, setFieldSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filteredField = useMemo(() => {
    if (!fieldSearch) return golfersByGroup.field
    return golfersByGroup.field.filter((g) =>
      g.name.toLowerCase().includes(fieldSearch.toLowerCase())
    )
  }, [golfersByGroup.field, fieldSearch])

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim() && email.includes('@')
      case 2:
        return !!picks.groupA
      case 3:
        return !!picks.groupB
      case 4:
        return !!picks.groupC
      case 5:
        return !!picks.groupD
      case 6:
        return !!(picks.wildCard1 && picks.wildCard2)
      case 7:
        return !!tiebreaker
      case 8:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (canProceed() && step < 8) {
      setStep((step + 1) as Step)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await onSubmit({
        entrantName: name,
        entrantEmail: email,
        pickGroupA: picks.groupA,
        pickGroupB: picks.groupB,
        pickGroupC: picks.groupC,
        pickGroupD: picks.groupD,
        wildCard1: picks.wildCard1,
        wildCard2: picks.wildCard2,
        tiebreaker: parseInt(tiebreaker),
      })
    } finally {
      setSubmitting(false)
    }
  }

  const getStepTitle = (s: Step) => {
    switch (s) {
      case 1:
        return 'Your Information'
      case 2:
        return 'Select Group A Golfer'
      case 3:
        return 'Select Group B Golfer'
      case 4:
        return 'Select Group C Golfer'
      case 5:
        return 'Select Group D Golfer'
      case 6:
        return 'Select Wild Cards'
      case 7:
        return 'Tiebreaker'
      case 8:
        return 'Review & Pay'
      default:
        return ''
    }
  }

  const getPickName = (golferId?: string) => {
    if (!golferId) return 'Not selected'
    const allGolfers = [
      ...golfersByGroup.A,
      ...golfersByGroup.B,
      ...golfersByGroup.C,
      ...golfersByGroup.D,
      ...golfersByGroup.field,
    ]
    const golfer = allGolfers.find((g) => g.id === golferId)
    return golfer?.name || 'Not selected'
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Form */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg border border-gray-200 shadow-md">
          {/* Progress Bar */}
          <div className="h-2 bg-gray-200">
            <div
              className="h-full bg-[#1a472a] transition-all duration-300"
              style={{ width: `${(step / 8) * 100}%` }}
            />
          </div>

          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-[#1a472a] text-white">
            <p className="text-sm font-semibold text-[#c4a35a]">
              Step {step} of 8
            </p>
            <h2 className="text-2xl font-bold mt-1">{getStepTitle(step)}</h2>
          </div>

          {/* Content */}
          <div className="px-6 py-6 min-h-96">
            {/* Step 1: Name & Email */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a472a]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a472a]"
                  />
                </div>
              </div>
            )}

            {/* Step 2-5: Group Selection */}
            {[2, 3, 4, 5].includes(step) && (
              <div className="space-y-4">
                <p className="text-gray-600 mb-6">
                  Click to select your golfer for this group
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {golfersByGroup[
                    ['A', 'B', 'C', 'D'][step - 2] as keyof typeof golfersByGroup
                  ].map((golfer) => (
                    <GolferPickCard
                      key={golfer.id}
                      golfer={golfer}
                      tournamentGolfer={golfer.tournamentGolfer}
                      isSelected={
                        picks[
                          (['groupA', 'groupB', 'groupC', 'groupD'][
                            step - 2
                          ] as 'groupA' | 'groupB' | 'groupC' | 'groupD')
                        ] === golfer.id
                      }
                      onSelect={(id) => {
                        const key = [
                          'groupA',
                          'groupB',
                          'groupC',
                          'groupD',
                        ][step - 2] as
                          | 'groupA'
                          | 'groupB'
                          | 'groupC'
                          | 'groupD'
                        setPicks((prev) => ({ ...prev, [key]: id }))
                      }}
                      group={['A', 'B', 'C', 'D'][step - 2]}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Step 6: Wild Cards */}
            {step === 6 && (
              <div className="space-y-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search golfers..."
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a472a]"
                  />
                </div>

                {picks.wildCard1 ? (
                  <div className="mb-6 p-4 bg-[#f5f1e8] rounded-lg border border-[#c4a35a]">
                    <p className="text-sm text-gray-700 font-semibold">
                      Wild Card 1 (2x):
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {getPickName(picks.wildCard1)}
                    </p>
                    <button
                      onClick={() =>
                        setPicks((prev) => ({ ...prev, wildCard1: undefined }))
                      }
                      className="text-sm text-blue-600 hover:underline mt-2"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 mb-4">
                    Select your first wild card:
                  </p>
                )}

                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
                    picks.wildCard1 ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {filteredField.map((golfer) => (
                    <GolferPickCard
                      key={golfer.id}
                      golfer={golfer}
                      tournamentGolfer={golfer.tournamentGolfer}
                      isSelected={picks.wildCard1 === golfer.id}
                      onSelect={(id) => {
                        if (!picks.wildCard1) {
                          setPicks((prev) => ({ ...prev, wildCard1: id }))
                        }
                      }}
                      compact
                    />
                  ))}
                </div>

                {picks.wildCard1 && picks.wildCard2 ? (
                  <div className="mt-6 p-4 bg-[#f5f1e8] rounded-lg border border-[#c4a35a]">
                    <p className="text-sm text-gray-700 font-semibold">
                      Wild Card 2 (2x):
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {getPickName(picks.wildCard2)}
                    </p>
                    <button
                      onClick={() =>
                        setPicks((prev) => ({ ...prev, wildCard2: undefined }))
                      }
                      className="text-sm text-blue-600 hover:underline mt-2"
                    >
                      Change
                    </button>
                  </div>
                ) : picks.wildCard1 ? (
                  <div className="mt-6 pt-6 border-t border-gray-300">
                    <p className="text-sm text-gray-600 mb-4">
                      Now select your second wild card:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredField
                        .filter((g) => g.id !== picks.wildCard1)
                        .map((golfer) => (
                          <GolferPickCard
                            key={golfer.id}
                            golfer={golfer}
                            tournamentGolfer={golfer.tournamentGolfer}
                            isSelected={picks.wildCard2 === golfer.id}
                            onSelect={(id) => {
                              setPicks((prev) => ({ ...prev, wildCard2: id }))
                            }}
                            compact
                          />
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Step 7: Tiebreaker */}
            {step === 7 && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">Tiebreaker:</span> If multiple
                    entries tie on total earnings, the entry closest to the actual
                    winning score wins the tiebreaker prize.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    What will the winning score (to par) be?
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-semibold text-gray-700">
                      {tiebreaker ? (parseInt(tiebreaker) > 0 ? '+' : '') : ''}
                    </span>
                    <input
                      type="number"
                      value={tiebreaker}
                      onChange={(e) => setTiebreaker(e.target.value)}
                      placeholder="e.g., -13, 0, +5"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#1a472a]"
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Enter negative for under par, positive for over par, or 0 for
                    even par
                  </p>
                </div>
              </div>
            )}

            {/* Step 8: Review */}
            {step === 8 && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-green-900">
                    <span className="font-semibold">✓ All set!</span> Review your
                    picks below and click Pay to complete your entry.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 uppercase font-semibold">
                      Name
                    </p>
                    <p className="font-bold text-gray-900">{name}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 uppercase font-semibold">
                      Email
                    </p>
                    <p className="font-bold text-gray-900">{email}</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-bold text-gray-900 mb-3">Your Picks</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-[#f5f1e8] rounded-lg">
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        Group A
                      </p>
                      <p className="font-semibold text-gray-900">
                        {getPickName(picks.groupA)}
                      </p>
                    </div>
                    <div className="p-3 bg-[#f5f1e8] rounded-lg">
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        Group B
                      </p>
                      <p className="font-semibold text-gray-900">
                        {getPickName(picks.groupB)}
                      </p>
                    </div>
                    <div className="p-3 bg-[#f5f1e8] rounded-lg">
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        Group C
                      </p>
                      <p className="font-semibold text-gray-900">
                        {getPickName(picks.groupC)}
                      </p>
                    </div>
                    <div className="p-3 bg-[#f5f1e8] rounded-lg">
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        Group D
                      </p>
                      <p className="font-semibold text-gray-900">
                        {getPickName(picks.groupD)}
                      </p>
                    </div>
                    <div className="p-3 bg-[#c4a35a] text-white rounded-lg">
                      <p className="text-xs font-semibold opacity-90">
                        WILD CARD 1 (2x)
                      </p>
                      <p className="font-semibold">{getPickName(picks.wildCard1)}</p>
                    </div>
                    <div className="p-3 bg-[#c4a35a] text-white rounded-lg">
                      <p className="text-xs font-semibold opacity-90">
                        WILD CARD 2 (2x)
                      </p>
                      <p className="font-semibold">{getPickName(picks.wildCard2)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 uppercase font-semibold">
                    Tiebreaker
                  </p>
                  <p className="font-bold text-gray-900 text-lg">
                    {parseInt(tiebreaker) > 0 ? '+' : ''}
                    {tiebreaker}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer / Navigation */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            <button
              onClick={handleBack}
              disabled={step === 1 || loading}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back</span>
            </button>

            {step === 8 ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-[#c4a35a] text-[#1a472a] px-6 py-2 font-bold rounded-lg hover:bg-[#b8935a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Processing...' : 'Pay with Stripe'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canProceed() || loading}
                className="flex items-center space-x-2 px-4 py-2 bg-[#1a472a] text-white hover:bg-[#0f2818] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar: Picks Summary */}
      <div className="lg:col-span-1">
        <div className="sticky top-4 bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden">
          <div className="bg-[#1a472a] text-white px-4 py-3">
            <h3 className="font-bold">Your Picks Summary</h3>
          </div>

          <div className="p-4 space-y-3">
            {/* Step Indicator */}
            <div className="mb-4">
              <p className="text-xs text-gray-600 uppercase font-semibold">
                Progress
              </p>
              <p className="text-2xl font-bold text-[#1a472a]">
                {step}
                <span className="text-gray-400">/8</span>
              </p>
            </div>

            {/* Summary Items */}
            {name && (
              <div className="p-2 bg-gray-50 rounded text-xs">
                <p className="text-gray-600">Name:</p>
                <p className="font-semibold text-gray-900">{name}</p>
              </div>
            )}

            {picks.groupA && (
              <div className="p-2 bg-gray-50 rounded text-xs">
                <p className="text-gray-600">Group A:</p>
                <p className="font-semibold text-gray-900 truncate">
                  {getPickName(picks.groupA)}
                </p>
              </div>
            )}

            {picks.groupB && (
              <div className="p-2 bg-gray-50 rounded text-xs">
                <p className="text-gray-600">Group B:</p>
                <p className="font-semibold text-gray-900 truncate">
                  {getPickName(picks.groupB)}
                </p>
              </div>
            )}

            {picks.groupC && (
              <div className="p-2 bg-gray-50 rounded text-xs">
                <p className="text-gray-600">Group C:</p>
                <p className="font-semibold text-gray-900 truncate">
                  {getPickName(picks.groupC)}
                </p>
              </div>
            )}

            {picks.groupD && (
              <div className="p-2 bg-gray-50 rounded text-xs">
                <p className="text-gray-600">Group D:</p>
                <p className="font-semibold text-gray-900 truncate">
                  {getPickName(picks.groupD)}
                </p>
              </div>
            )}

            {picks.wildCard1 && (
              <div className="p-2 bg-[#c4a35a] text-white rounded text-xs">
                <p className="opacity-90">WC1 (2x):</p>
                <p className="font-semibold truncate">
                  {getPickName(picks.wildCard1)}
                </p>
              </div>
            )}

            {picks.wildCard2 && (
              <div className="p-2 bg-[#c4a35a] text-white rounded text-xs">
                <p className="opacity-90">WC2 (2x):</p>
                <p className="font-semibold truncate">
                  {getPickName(picks.wildCard2)}
                </p>
              </div>
            )}

            {tiebreaker && (
              <div className="p-2 bg-gray-50 rounded text-xs">
                <p className="text-gray-600">Tiebreaker:</p>
                <p className="font-semibold text-gray-900">
                  {parseInt(tiebreaker) > 0 ? '+' : ''}
                  {tiebreaker}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
