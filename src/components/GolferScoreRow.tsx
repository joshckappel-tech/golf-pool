import { TournamentGolfer, Golfer } from '@/types'
import { ChevronRight } from 'lucide-react'

interface GolferScoreRowProps {
  golfer: Golfer
  tournamentGolfer: TournamentGolfer
  position?: number
  showEarnings?: boolean
  compact?: boolean
}

export default function GolferScoreRow({
  golfer,
  tournamentGolfer,
  position,
  showEarnings = false,
  compact = false,
}: GolferScoreRowProps) {
  const scoreColor = tournamentGolfer.currentScore
    ? tournamentGolfer.currentScore > 0
      ? 'text-red-600'
      : tournamentGolfer.currentScore < 0
        ? 'text-green-600'
        : 'text-gray-700'
    : 'text-gray-500'

  const scoreLabel = tournamentGolfer.currentScore
    ? tournamentGolfer.currentScore > 0
      ? `+${tournamentGolfer.currentScore}`
      : `${tournamentGolfer.currentScore}`
    : 'E'

  if (compact) {
    return (
      <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-200 text-sm">
        <div className="flex-1">
          <p className="font-semibold text-gray-900">{golfer.name}</p>
        </div>
        <div className="flex items-center space-x-3">
          {tournamentGolfer.currentPosition && (
            <span className="text-gray-600 font-medium">
              {tournamentGolfer.currentPosition}
            </span>
          )}
          <span className={`font-bold ${scoreColor}`}>{scoreLabel}</span>
          {tournamentGolfer.thru && (
            <span className="text-gray-500 text-xs">{tournamentGolfer.thru}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center flex-1 min-w-0">
        {/* Position Badge (if provided) */}
        {position && (
          <div className="w-8 h-8 rounded-full bg-[#1a472a] text-white text-sm font-bold flex items-center justify-center mr-3 flex-shrink-0">
            {position}
          </div>
        )}

        {/* Golfer Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{golfer.name}</p>
          {golfer.worldRanking && (
            <p className="text-xs text-gray-500">#{golfer.worldRanking} World</p>
          )}
        </div>
      </div>

      {/* Score and Position */}
      <div className="flex items-center space-x-6 ml-4">
        {tournamentGolfer.currentPosition && (
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Pos</p>
            <p className="font-bold text-gray-900">
              {tournamentGolfer.currentPosition}
            </p>
          </div>
        )}

        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Score</p>
          <p className={`text-lg font-bold ${scoreColor}`}>{scoreLabel}</p>
        </div>

        {tournamentGolfer.thru && (
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Thru</p>
            <p className="font-bold text-gray-900">{tournamentGolfer.thru}</p>
          </div>
        )}

        {showEarnings && (
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Earnings</p>
            <p className="font-bold text-[#c4a35a]">
              ${tournamentGolfer.projectedEarnings.toLocaleString()}
            </p>
          </div>
        )}

        {/* Status Indicators */}
        {(tournamentGolfer.isWithdrawn || tournamentGolfer.isCut) && (
          <div className="flex items-center space-x-1">
            {tournamentGolfer.isWithdrawn && (
              <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded">
                WD
              </span>
            )}
            {tournamentGolfer.isCut && (
              <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded">
                CUT
              </span>
            )}
          </div>
        )}

        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </div>
  )
}
