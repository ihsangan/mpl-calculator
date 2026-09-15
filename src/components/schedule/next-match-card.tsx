import React, { useState, useEffect } from "react"
import type { Match, Team } from "@/types"
import { getTeamLogo, getWeekFromId, getDayFromId } from "@/lib/standings"
import {
  formatMatchDate,
  getNextUpcomingMatch,
  getTimeRemaining,
  getMatchStatus,
} from "@/lib/date-utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Radio, Calendar } from "lucide-react"

interface NextMatchCardProps {
  matches: Match[]
  teams: Team[]
  resolvedTheme: "light" | "dark"
}

export const NextMatchCard: React.FC<NextMatchCardProps> = ({
  matches,
  teams,
  resolvedTheme,
}) => {
  const nextMatch = getNextUpcomingMatch(matches)

  const [timeRemaining, setTimeRemaining] = useState(() =>
    getTimeRemaining(nextMatch?.date)
  )

  // Live countdown timer ticking every 1 second
  useEffect(() => {
    if (!nextMatch?.date) return

    const updateTimer = () => {
      setTimeRemaining(getTimeRemaining(nextMatch.date))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [nextMatch?.date])

  if (!nextMatch) {
    return (
      <Card className="border-border/60 bg-muted/20">
        <CardContent className="flex items-center justify-center p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">
            🎉 All regular season matches have been completed!
          </p>
        </CardContent>
      </Card>
    )
  }

  const teamALogo = getTeamLogo(
    nextMatch.teamA,
    resolvedTheme === "dark",
    teams
  )
  const teamBLogo = getTeamLogo(
    nextMatch.teamB,
    resolvedTheme === "dark",
    teams
  )
  const teamAName =
    teams.find((t) => t.id === nextMatch.teamA)?.name || nextMatch.teamA
  const teamBName =
    teams.find((t) => t.id === nextMatch.teamB)?.name || nextMatch.teamB

  const weekNum = getWeekFromId(nextMatch.id)
  const dayNum = getDayFromId(nextMatch.id)
  const formattedDate = formatMatchDate(nextMatch.date)
  const status = getMatchStatus(nextMatch, matches)

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-linear-to-br from-primary/5 via-card to-background shadow-xs">
      <CardContent className="p-4 sm:p-5">
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            {status === "LIVE" ? (
              <Badge
                variant="destructive"
                className="text-2xs animate-pulse gap-1.5 px-2 py-0.5 font-bold"
              >
                <Radio className="h-3 w-3" />
                LIVE MATCH
              </Badge>
            ) : status === "TODAY" ? (
              <Badge
                variant="default"
                className="text-2xs gap-1.5 px-2 py-0.5 font-bold"
              >
                <Clock className="h-3 w-3" />
                TODAY
              </Badge>
            ) : status === "POSTPONED" ? (
              <Badge
                variant="outline"
                className="text-2xs gap-1.5 border-amber-500/50 bg-amber-500/10 px-2 py-0.5 font-bold text-amber-600 dark:text-amber-400"
              >
                <Clock className="h-3 w-3" />
                RESCHEDULED
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="text-2xs gap-1.5 px-2 py-0.5 font-semibold"
              >
                <Clock className="h-3 w-3 text-muted-foreground" />
                NEXT MATCH
              </Badge>
            )}

            <span className="text-xs font-semibold text-muted-foreground">
              Week {weekNum} · Day {dayNum}
            </span>
          </div>

          {status === "POSTPONED" ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Calendar className="h-3 w-3" />
              <span>Date & Time TBD</span>
            </div>
          ) : formattedDate ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formattedDate}</span>
            </div>
          ) : null}
        </div>

        {/* Matchup & Live Countdown */}
        <div className="mt-4 grid grid-cols-1 items-center gap-4 sm:grid-cols-3">
          {/* Team A */}
          <div className="flex items-center justify-center gap-3 sm:justify-end">
            <div className="text-center sm:text-right">
              <p className="text-sm font-bold text-foreground sm:text-base">
                {nextMatch.teamA}
              </p>
              <p className="hidden max-w-[120px] truncate text-xs text-muted-foreground sm:block">
                {teamAName}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card p-1.5 shadow-2xs sm:h-12 sm:w-12">
              {teamALogo ? (
                <img
                  src={teamALogo}
                  alt={nextMatch.teamA}
                  className="max-h-full max-w-full object-contain"
                  crossOrigin="anonymous"
                />
              ) : null}
            </div>
          </div>

          {/* Countdown Display */}
          <div className="flex flex-col items-center justify-center">
            {status === "POSTPONED" ? (
              <div className="text-center">
                <p className="text-xs font-bold tracking-wider text-amber-600 uppercase dark:text-amber-400">
                  Postponed (TBD)
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  Schedule to be announced
                </p>
              </div>
            ) : status === "LIVE" ? (
              <div className="text-center">
                <p className="animate-pulse text-xs font-bold tracking-wider text-rose-500 uppercase">
                  Match in Progress
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-muted-foreground">
                  Bo3 Series
                </p>
              </div>
            ) : !timeRemaining.isPast ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {timeRemaining.days > 0 && (
                  <div className="flex flex-col items-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card font-mono text-sm font-bold text-foreground shadow-2xs sm:h-10 sm:w-10 sm:text-base">
                      {timeRemaining.days}
                    </div>
                    <span className="text-3xs mt-1 font-semibold text-muted-foreground uppercase">
                      Days
                    </span>
                  </div>
                )}
                <div className="flex flex-col items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card font-mono text-sm font-bold text-foreground shadow-2xs sm:h-10 sm:w-10 sm:text-base">
                    {String(timeRemaining.hours).padStart(2, "0")}
                  </div>
                  <span className="text-3xs mt-1 font-semibold text-muted-foreground uppercase">
                    Hours
                  </span>
                </div>
                <span className="pb-4 font-bold text-muted-foreground">:</span>
                <div className="flex flex-col items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card font-mono text-sm font-bold text-foreground shadow-2xs sm:h-10 sm:w-10 sm:text-base">
                    {String(timeRemaining.minutes).padStart(2, "0")}
                  </div>
                  <span className="text-3xs mt-1 font-semibold text-muted-foreground uppercase">
                    Mins
                  </span>
                </div>
                <span className="pb-4 font-bold text-muted-foreground">:</span>
                <div className="flex flex-col items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card font-mono text-sm font-bold text-primary shadow-2xs sm:h-10 sm:w-10 sm:text-base">
                    {String(timeRemaining.seconds).padStart(2, "0")}
                  </div>
                  <span className="text-3xs mt-1 font-semibold text-muted-foreground uppercase">
                    Secs
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-xs font-semibold text-muted-foreground">
                  Starting Soon
                </span>
              </div>
            )}
          </div>

          {/* Team B */}
          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card p-1.5 shadow-2xs sm:h-12 sm:w-12">
              {teamBLogo ? (
                <img
                  src={teamBLogo}
                  alt={nextMatch.teamB}
                  className="max-h-full max-w-full object-contain"
                  crossOrigin="anonymous"
                />
              ) : null}
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm font-bold text-foreground sm:text-base">
                {nextMatch.teamB}
              </p>
              <p className="hidden max-w-[120px] truncate text-xs text-muted-foreground sm:block">
                {teamBName}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
