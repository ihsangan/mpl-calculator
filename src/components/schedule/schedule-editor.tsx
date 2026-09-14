import React, { useState, useMemo } from "react"
import { RefreshCw, Check, AlertCircle } from "lucide-react"
import type { Match, Team, ExportData } from "@/types"
import type { MergeResult } from "@/lib/mediawiki"
import { cn } from "@/lib/utils"
import {
  getDayFromId,
  getMatchNumberFromId,
  getWeekFromId,
  isMatchPlayed,
  sortMatchesById,
} from "@/lib/standings"
import { getGroupDateLabel } from "@/lib/date-utils"
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
  selectedWeek: number | "ALL"
  hasScoreChanges: boolean
  allMatchesUnplayed: boolean
  resolvedTheme: "light" | "dark"
  isSyncing?: boolean
  syncStatus?: "idle" | "syncing" | "success" | "error"
  syncMessage?: string | null
  lastSyncTime?: Date | null
  autoSyncInterval?: number
  pendingUpdate?: MergeResult | null
  onWeekChange: (week: number | "ALL") => void
  onScoreChange: (matchId: string, value: string) => void
  onResetToDefault: () => void
  onResetAll: () => void
  onLoadMatches: (importedMatches: Match[], week?: number | "ALL") => void
  onSyncNow?: (forceOverwrite?: boolean) => void
  onAutoSyncIntervalChange?: (interval: number) => void
  onApplyPendingUpdate?: () => void
  onDismissPendingUpdate?: () => void
}

export const ScheduleEditor: React.FC<ScheduleEditorProps> = ({
  leagueId,
  matches,
  teams,
  selectedWeek,
  hasScoreChanges,
  allMatchesUnplayed,
  resolvedTheme,
  isSyncing = false,
  syncStatus = "idle",
  syncMessage = null,
  lastSyncTime = null,
  autoSyncInterval = 0,
  pendingUpdate = null,
  onWeekChange,
  onScoreChange,
  onResetToDefault,
  onResetAll,
  onLoadMatches,
  onSyncNow,
  onAutoSyncIntervalChange,
  onApplyPendingUpdate,
  onDismissPendingUpdate,
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
    let list =
      selectedWeek === "ALL"
        ? matches
        : matches.filter((m) => getWeekFromId(m.id) === selectedWeek)

    if (teamFilter !== "ALL") {
      list = list.filter((m) => m.teamA === teamFilter || m.teamB === teamFilter)
    }
    return list
  }, [matches, selectedWeek, teamFilter])

  const groupedMatches = useMemo(() => {
    if (selectedWeek === "ALL") {
      // Group by Week and Day: "Week X Day Y"
      const groups: Record<
        string,
        { week: number; day: number; matches: Match[] }
      > = {}

      filteredMatches.forEach((match) => {
        const week = getWeekFromId(match.id)
        const day = getDayFromId(match.id)
        const groupKey = `${week}-${day}`

        if (!groups[groupKey]) {
          groups[groupKey] = { week, day, matches: [] }
        }
        groups[groupKey].matches.push(match)
      })

      return Object.values(groups)
        .sort((a, b) => {
          if (a.week !== b.week) return a.week - b.week
          return a.day - b.day
        })
        .map((g) => ({
          key: `w${g.week}d${g.day}`,
          title: `Week ${g.week} Day ${g.day}`,
          matches: g.matches.sort(
            (a, b) => getMatchNumberFromId(a.id) - getMatchNumberFromId(b.id)
          ),
        }))
    }

    // Specific week selected: Group by Day ("Day Y")
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
        key: `d${day}`,
        title: `Day ${day}`,
        matches: dayMatches.sort(
          (a, b) => getMatchNumberFromId(a.id) - getMatchNumberFromId(b.id)
        ),
      }))
  }, [filteredMatches, selectedWeek])

  const handleSyncClick = () => {
    if (!onSyncNow) return
    if (
      hasScoreChanges &&
      !window.confirm(
        "You have custom score modifications in your scenario. Do you want to overwrite them with live scores from Liquipedia?"
      )
    ) {
      return
    }
    onSyncNow(hasScoreChanges)
  }

  return (
    <Card className="sticky top-6 shadow-xs">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xl">Schedule Editor</CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            {onSyncNow && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isSyncing}
                onClick={handleSyncClick}
                className="h-7 gap-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                title={
                  lastSyncTime
                    ? `Last synced: ${lastSyncTime.toLocaleTimeString()}`
                    : "Sync scores with Liquipedia MediaWiki"
                }
              >
                <RefreshCw
                  className={cn("size-3", isSyncing && "animate-spin")}
                  aria-hidden="true"
                />
                <span>{isSyncing ? "Syncing..." : "Sync Liquipedia"}</span>
              </Button>
            )}
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

        {/* Pending Update from Liquipedia Conflict Banner */}
        {pendingUpdate && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">
                  Liquipedia has {pendingUpdate.updatedCount} new match update(s)
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  Your current scenario has custom score changes.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  className="h-6 px-2.5 text-[11px] font-semibold bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-black dark:hover:bg-amber-400"
                  onClick={onApplyPendingUpdate}
                >
                  Apply Updates
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2.5 text-[11px] font-semibold border-amber-500/40 text-amber-900 hover:bg-amber-500/20 dark:text-amber-200"
                  onClick={onDismissPendingUpdate}
                >
                  Keep Scenario
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Sync Status Banner */}
        {syncMessage && !pendingUpdate && (
          <div
            className={cn(
              "flex items-center justify-between rounded-md px-2.5 py-1 text-[11px]",
              syncStatus === "error"
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-muted/40 text-muted-foreground border border-border/40"
            )}
          >
            <div className="flex items-center gap-1.5 truncate">
              {syncStatus === "error" ? (
                <AlertCircle className="size-3 shrink-0" />
              ) : (
                <Check className="size-3 shrink-0 text-emerald-500" />
              )}
              <span className="truncate">{syncMessage}</span>
            </div>
            {lastSyncTime && (
              <span className="shrink-0 font-mono text-[10px] opacity-75">
                {lastSyncTime.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        )}

        {/* Team Filter & Auto-Sync Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Filter Team:
            </span>
            <div className="w-36">
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

          {onAutoSyncIntervalChange && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Auto-Sync:
              </span>
              <div className="w-28">
                <Select
                  value={String(autoSyncInterval)}
                  onValueChange={(val) => onAutoSyncIntervalChange(parseInt(val, 10))}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Off</SelectItem>
                    <SelectItem value="60">Every 1m</SelectItem>
                    <SelectItem value="300">Every 5m</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Week Selector */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Button
            variant={selectedWeek === "ALL" ? "default" : "outline"}
            size="sm"
            className="h-7 px-3 text-xs font-bold"
            onClick={() => onWeekChange("ALL")}
          >
            Show All
          </Button>

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
        {groupedMatches.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No matches found with selected filter.
          </div>
        ) : (
          groupedMatches.map((group) => {
            const dateLabel = getGroupDateLabel(group.matches, matches)

            return (
              <div key={group.key} className="space-y-2.5">
                {/* Day / Week-Day header with Date */}
                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="shrink-0 font-mono text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                    {group.title} {dateLabel ? `• ${dateLabel}` : ""}
                  </span>
                  <Separator className="flex-1" />
                </div>

                {/* Match Items */}
                <div className="space-y-2">
                  {group.matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      teams={teams}
                      resolvedTheme={resolvedTheme}
                      onScoreChange={onScoreChange}
                      allMatches={matches}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
