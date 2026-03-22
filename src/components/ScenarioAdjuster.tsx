'use client'

import { useState } from 'react'
import { Golfer, TournamentGolfer } from '@/types'
import { Plus, Minus, RotateCcw } from 'lucide-react'

interface ScenarioAdjusterProps {
  golfers: (Golfer & { tournamentGolfer: TournamentGolfer })[]
  onCalculate: (adjustments: Record<string, number>) => Promise<void>
  loading?: boolean
}

export default function ScenarioAdjuster({
  golfers,
  onCalculate,
  loading = false,
}: ScenarioAdjusterProps) {
  const [adjustments, setAdjustments] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState(false)

  const updateAdjustment = (golferId: string, value: string) => {
    const numValue = parseInt(value) || 0
    if (numValue === 0) {
      const { [golferId]: _, ...rest } = adjustments
      setAdjustments(rest)
    } else {
      setAdjustments((prev) => ({ ...prev, [golferId]: numValue }))
    }
  }

  const handleCalculate = async () => {
    setSubmitted(true)
    await onCalculate(adjustments)
  }

  const handleReset = () => {
    setAdjustments({})
    setSubmitted(false)
  }

  const hasAdjustments = Object.keys(adjustments).length > 0

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">How it works:</span> Adjust golfer positions
          to see how it would affect the leaderboard. Enter a new position number for
          each golfer you want to move, then click Calculate to see the results.
        </p>
      </div>

      {/* Golfers List */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Adjust Positions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {golfers.map((g) => {
            const adjustment = adjustments[g.id]
            const currentPos = g.tournamentGolfer.currentPosition
            const isAdjusted = adjustment !== undefined

            return (
              <div
                key={g.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isAdjusted
                    ? 'border-[#c4a35a] bg-[#f5f1e8]'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="space-y-3">
                  {/* Golfer Name */}
                  <div>
                    <p className="font-semibold text-gray-900">{g.name}</p>
                    <p className="text-xs text-gray-600">
                      Current position: {currentPos || '—'}
                    </p>
                  </div>

                  {/* Current Stats */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-600">Score</p>
                      <p
                        className={`font-bold ${
                          g.tournamentGolfer.currentScore
                            ? g.tournamentGolfer.currentScore > 0
                              ? 'text-red-600'
                              : 'text-green-600'
                            : 'text-gray-700'
                        }`}
                      >
                        {g.tournamentGolfer.currentScore
                          ? g.tournamentGolfer.currentScore > 0
                            ? `+${g.tournamentGolfer.currentScore}`
                            : g.tournamentGolfer.currentScore
                          : 'E'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Thru</p>
                      <p className="font-bold text-gray-900">
                        {g.tournamentGolfer.thru || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Status</p>
                      <p className="font-bold text-gray-900">
                        {g.tournamentGolfer.isWithdrawn
                          ? 'WD'
                          : g.tournamentGolfer.isCut
                            ? 'CUT'
                            : 'Live'}
                      </p>
                    </div>
                  </div>

                  {/* Adjustment Input */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      New Position
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() =>
                          updateAdjustment(
                            g.id,
                            Math.max(1, (adjustment || 999) - 1).toString()
                          )
                        }
                        disabled={loading}
                        className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                      >
                        <Minus className="w-4 h-4 text-gray-600" />
                      </button>
                      <input
                        type="number"
                        value={adjustment || ''}
                        onChange={(e) =>
                          updateAdjustment(g.id, e.target.value)
                        }
                        placeholder={currentPos || '—'}
                        disabled={loading}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-center font-semibold focus:outline-none focus:ring-2 focus:ring-[#1a472a] disabled:opacity-50"
                      />
                      <button
                        onClick={() =>
                          updateAdjustment(
                            g.id,
                            ((adjustment || 0) + 1).toString()
                          )
                        }
                        disabled={loading}
                        className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  {/* Earnings Estimate */}
                  {isAdjusted && (
                    <div className="pt-2 border-t border-gray-300 text-xs">
                      <p className="text-gray-600 mb-1">Projected earnings:</p>
                      <p className="font-bold text-[#c4a35a]">
                        ${g.tournamentGolfer.projectedEarnings.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleCalculate}
          disabled={!hasAdjustments || loading}
          className="flex-1 bg-[#1a472a] text-white font-bold py-3 rounded-lg hover:bg-[#0f2818] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Calculating...' : 'Calculate Scenario'}
        </button>
        {hasAdjustments && (
          <button
            onClick={handleReset}
            disabled={loading}
            className="px-6 bg-gray-200 text-gray-900 font-semibold rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors flex items-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Results Indicator */}
      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-900">
            <span className="font-semibold">✓ Scenario calculated!</span> View the
            adjusted leaderboard on the right to see how these position changes would
            affect the pool results.
          </p>
        </div>
      )}
    </div>
  )
}
