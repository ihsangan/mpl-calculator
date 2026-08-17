import React from "react"
import type { Match, Team } from "@/types"
import { isMatchPlayed, getScheduleTeamName, getTeamLogo } from "@/lib/standings"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface MatchCardProps {
  match: Match
  teams: Team[]
  resolvedTheme: "light" | "dark"
  onScoreChange: (matchId: string, value: string) => void
}

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  teams,
  resolvedTheme,
  onScoreChange,
}) => {
  const played = isMatchPlayed(match)
  const currentValue = played ? `${match.scoreA}-${match.scoreB}` : "unplayed"

  const teamALogo = getTeamLogo(match.teamA, resolvedTheme === "dark", teams)
  const teamBLogo = getTeamLogo(match.teamB, resolvedTheme === "dark", teams)

  const teamAWon = played && match.scoreA > match.scoreB
  const teamBWon = played && match.scoreB > match.scoreA

  const teamAColor = played
    ? teamAWon
      ? "text-emerald-600 dark:text-emerald-400 font-bold"
      : "text-muted-foreground line-through opacity-75"
    : "text-foreground font-semibold"

  const teamBColor = played
    ? teamBWon
      ? "text-emerald-600 dark:text-emerald-400 font-bold"
      : "text-muted-foreground line-through opacity-75"
    : "text-foreground font-semibold"

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border p-2 sm:px-3 sm:py-2.5 transition-colors ${
        played
          ? "bg-card/80 border-border/80 shadow-2xs"
          : "bg-muted/30 border-dashed border-border/60 hover:bg-muted/50"
      }`}
    >
      {/* Team A */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className={`truncate text-xs sm:text-sm text-right ${teamAColor}`}>
          {getScheduleTeamName(match.teamA)}
        </span>
        <div className="flex h-5 w-6 shrink-0 items-center justify-center">
          {teamALogo ? (
            <img
              src={teamALogo}
              alt={match.teamA}
              className="max-h-5 max-w-6 object-contain"
              crossOrigin="anonymous"
            />
          ) : null}
        </div>
      </div>

      {/* Score Select */}
      <div className="w-[78px] shrink-0">
        <Select
          value={currentValue}
          onValueChange={(v) => onScoreChange(match.id, v)}
        >
          <SelectTrigger
            aria-label={`Score for ${getScheduleTeamName(
              match.teamA
            )} vs ${getScheduleTeamName(match.teamB)}`}
            className={`h-8 justify-center px-1 text-center font-mono text-xs font-bold transition-all ${
              played
                ? "border-primary/30 bg-primary/5 text-primary shadow-2xs dark:bg-primary/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="center">
            <SelectItem value="unplayed">0 – 0</SelectItem>
            <SelectItem value="2-0">2 – 0</SelectItem>
            <SelectItem value="2-1">2 – 1</SelectItem>
            <SelectItem value="1-2">1 – 2</SelectItem>
            <SelectItem value="0-2">0 – 2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Team B */}
      <div className="flex min-w-0 flex-1 items-center justify-start gap-2">
        <div className="flex h-5 w-6 shrink-0 items-center justify-center">
          {teamBLogo ? (
            <img
              src={teamBLogo}
              alt={match.teamB}
              className="max-h-5 max-w-6 object-contain"
              crossOrigin="anonymous"
            />
          ) : null}
        </div>
        <span className={`truncate text-xs sm:text-sm text-left ${teamBColor}`}>
          {getScheduleTeamName(match.teamB)}
        </span>
      </div>
    </div>
  )
}
