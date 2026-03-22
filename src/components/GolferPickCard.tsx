import { Golfer, TournamentGolfer } from '@/types'

interface GolferPickCardProps {
  golfer: Golfer
  tournamentGolfer?: TournamentGolfer
  isSelected?: boolean
  onSelect?: (golferId: string) => void
  group?: string
  compact?: boolean
}

export default function GolferPickCard({
  golfer,
  tournamentGolfer,
  isSelected = false,
  onSelect,
  group,
  compact = false,
}: GolferPickCardProps) {
  const handleClick = () => {
    if (onSelect) {
      onSelect(golfer.id)
    }
  }

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className={`p-3 rounded-lg border-2 transition-all ${
          isSelected
            ? 'border-[#c4a35a] bg-[#f5f1e8]'
            : 'border-gray-200 bg-white hover:border-[#1a472a]'
        }`}
      >
        <p className="font-semibold text-[#1a472a] text-sm line-clamp-2">
          {golfer.name}
        </p>
        {tournamentGolfer?.odds && (
          <p className="text-xs text-gray-600 mt-1">{tournamentGolfer.odds}</p>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      className={`relative p-4 rounded-lg border-2 transition-all transform hover:scale-105 ${
        isSelected
          ? 'border-[#c4a35a] bg-gradient-to-br from-[#f5f1e8] to-[#ede5d6] shadow-lg'
          : 'border-gray-300 bg-white hover:border-[#1a472a] shadow-sm'
      }`}
    >
      {/* Golfer Image */}
      {golfer.imageUrl && (
        <div className="w-full h-32 bg-gray-200 rounded-lg mb-3 overflow-hidden">
          <img
            src={golfer.imageUrl}
            alt={golfer.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 bg-[#c4a35a] text-[#1a472a] rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm">
          ✓
        </div>
      )}

      {/* Golfer Info */}
      <p className="font-bold text-[#1a472a] text-lg line-clamp-2">
        {golfer.name}
      </p>

      {/* Group and Odds */}
      <div className="mt-3 space-y-1">
        {group && (
          <p className="text-xs font-semibold text-white bg-[#1a472a] inline-block px-2 py-1 rounded">
            Group {group}
          </p>
        )}
        {tournamentGolfer && tournamentGolfer.odds && (
          <p className="text-sm text-gray-700 font-semibold">
            Odds: {tournamentGolfer.odds}
          </p>
        )}
        {tournamentGolfer && tournamentGolfer.currentScore !== null && (
          <div className="pt-2 border-t border-gray-200 mt-2">
            <p
              className={`text-sm font-bold ${
                tournamentGolfer.currentScore > 0
                  ? 'text-red-600'
                  : tournamentGolfer.currentScore < 0
                    ? 'text-green-600'
                    : 'text-gray-700'
              }`}
            >
              {tournamentGolfer.currentScore > 0 ? '+' : ''}
              {tournamentGolfer.currentScore}
            </p>
            {tournamentGolfer.currentPosition && (
              <p className="text-xs text-gray-600">
                Position: {tournamentGolfer.currentPosition}
              </p>
            )}
          </div>
        )}
      </div>

      {/* World Ranking */}
      {golfer.worldRanking && (
        <p className="text-xs text-gray-600 mt-2">
          World Ranking: #{golfer.worldRanking}
        </p>
      )}
    </button>
  )
}
