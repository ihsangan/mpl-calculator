import React, { useState, useMemo } from "react"
import type { Match, Team, ExportData } from "@/types"
import {
  getDayFromId,
  getMatchNumberFromId,
  getWeekFromId,
  isMatchPlayed,
  sortMatchesById,
} from "@/lib/standings"
import { MatchCard } from "./match-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ScheduleEditorProps {
  leagueId: string
  matches: Match[]
  teams: Team[]
  selectedWeek: number
  hasScoreChanges: boolean
  allMatchesUnplayed: boolean
  resolvedTheme: "light" | "dark"
  onWeekChange: (week: number) => void
  onScoreChange: (matchId: string, value: string) => void
  onResetToDefault: () => void
  onResetAll: () => void
  onLoadMatches: (importedMatches: Match[], week?: number) => void
}

export const ScheduleEditor: React.FC<ScheduleEditorProps> = ({
  leagueId,
  matches,
  teams,
  selectedWeek,
  hasScoreChanges,
  allMatchesUnplayed,
  resolvedTheme,
  onWeekChange,
  onScoreChange,
  onResetToDefault,
  onResetAll,
  onLoadMatches,
}) => {
  const [teamFilter, setTeamFilter] = useState<string>("ALL")

  const weeks = useMemo(() => {
    const weekSet = new Set(matches.map((m) => getWeekFromId(m.id)))
    return Array.from(weekSet).sort((a, b) => a - b)
  }, [matches])

  const handleSaveAsJSON = () => {
    const dataToSave: ExportData = {
      leagueId,
      matches: sortMatchesById(matches),
      selectedWeek,
      timestamp: new Date().toISOString(),
    }
    const jsonString = JSON.stringify(dataToSave, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `mpl-${leagueId.toLowerCase()}-matches-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleLoadFromJSON = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)
        if (!data || !Array.isArray(data.matches)) {
          alert("Invalid JSON format. Expected an object with a 'matches' array.")
          return
        }

        // Validate league ID match or ask confirmation
        if (data.leagueId && data.leagueId !== leagueId) {
          const proceed = window.confirm(
            `This file is from league '${data.leagueId}', but current league is '${leagueId}'. Importing may cause mismatches. Do you want to proceed?`
          )
          if (!proceed) return
        }

        onLoadMatches(sortMatchesById(data.matches), data.selectedWeek)
      } catch (error) {
        alert(
          "Error loading JSON file: " +
            (error instanceof Error ? error.message : String(error))
        )
      }
    }
    reader.readAsText(file)
  }

  const filteredMatches = useMemo(() => {
    let list = matches.filter((m) => getWeekFromId(m.id) === selectedWeek)
    if (teamFilter !== "ALL") {
      list = list.filter((m) => m.teamA === teamFilter || m.teamB === teamFilter)
    }
    return list
  }, [matches, selectedWeek, teamFilter])

  const daysWithMatches = useMemo(() => {
    const matchesByDay: Record<number, Match[]> = {}

    filteredMatches.forEach((match) => {
      const day = getDayFromId(match.id)
      if (!matchesByDay[day]) {
        matchesByDay[day] = []
      }
      matchesByDay[day].push(match)
    })

    return Object.entries(matchesByDay)
      .sort(([dayA], [dayB]) => parseInt(dayA, 10) - parseInt(dayB, 10))
      .map(([day, dayMatches]) => ({
        title: `Day ${day}`,
        matches: dayMatches.sort(
          (a, b) => getMatchNumberFromId(a.id) - getMatchNumberFromId(b.id)
        ),
      }))
  }, [filteredMatches])

  return (
    <Card className="sticky top-6 shadow-xs">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xl">Schedule Editor</CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveAsJSON}
              className="h-7 text-xs font-semibold"
            >
              Export JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs font-semibold"
              onClick={() => {
                const input = document.createElement("input")
                input.type = "file"
                input.accept = ".json"
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (file) {
                    handleLoadFromJSON(file)
                  }
                }
                input.click()
              }}
            >
              Import JSON
            </Button>
            {!allMatchesUnplayed && (
              <Button
                size="sm"
                variant="outline"
                onClick={onResetAll}
                className="h-7 text-xs font-semibold text-destructive hover:bg-destructive/10"
              >
                Reset All
              </Button>
            )}
            {hasScoreChanges && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onResetToDefault}
                className="h-7 text-xs font-semibold"
              >
                Reset Changes
              </Button>
            )}
          </div>
        </div>

        {/* Team Filter & Quick Controls */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs font-medium text-muted-foreground">
            Filter Team:
          </span>
          <div className="w-40">
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Week Selector */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {weeks.map((week) => {
            const weekMatches = matches.filter(
              (m) => getWeekFromId(m.id) === week
            )
            const isCompleted =
              weekMatches.length > 0 &&
              weekMatches.every((m) => isMatchPlayed(m))
            const isSelected = selectedWeek === week

            let variant: "default" | "secondary" | "outline" = "outline"
            let extra = ""
            if (isSelected) {
              variant = "default"
            } else if (isCompleted) {
              variant = "secondary"
              extra =
                "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20 dark:text-emerald-400"
            }

            return (
              <Button
                key={week}
                variant={variant}
                size="sm"
                className={`h-7 px-3 text-xs font-bold ${extra}`}
                onClick={() => onWeekChange(week)}
              >
                W{week}
              </Button>
            )
          })}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="max-h-[640px] space-y-5 overflow-y-auto p-4">
        {daysWithMatches.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No matches found for this week with selected filter.
          </div>
        ) : (
          daysWithMatches.map((day) => (
            <div key={day.title} className="space-y-2.5">
              {/* Day header */}
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="shrink-0 font-mono text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                  {day.title}
                </span>
                <Separator className="flex-1" />
              </div>

              {/* Match Items */}
              <div className="space-y-2">
                {day.matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    teams={teams}
                    resolvedTheme={resolvedTheme}
                    onScoreChange={onScoreChange}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
