import React, { useState, useMemo } from "react"
import {
  RefreshCw,
  Check,
  AlertCircle,
  TriangleAlert,
  ChevronDown,
} from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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
  iterations: number
  onWeekChange: (week: number | "ALL") => void
  onScoreChange: (matchId: string, value: string) => void
  onResetToDefault: () => void
  onResetAll: () => void
  onResetWeek: () => void
  onLoadMatches: (importedMatches: Match[], week?: number | "ALL") => void
  onLoadIterations?: (iterations: number) => void
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
  iterations,
  onWeekChange,
  onScoreChange,
  onResetToDefault,
  onResetAll,
  onResetWeek,
  onLoadMatches,
  onLoadIterations,
  onSyncNow,
  onAutoSyncIntervalChange,
  onApplyPendingUpdate,
  onDismissPendingUpdate,
}) => {
  // Multi-select team filter: empty Set = all teams (no filtering)
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set())
  const [importError, setImportError] = useState<string | null>(null)
  const [importMismatch, setImportMismatch] = useState<{
    data: ExportData
    fileLeague: string
  } | null>(null)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)

  const weeks = useMemo(() => {
    const weekSet = new Set(matches.map((m) => getWeekFromId(m.id)))
    return Array.from(weekSet).sort((a, b) => a - b)
  }, [matches])

  const canResetSelectedWeek =
    selectedWeek !== "ALL" &&
    matches.some(
      (match) =>
        getWeekFromId(match.id) === selectedWeek && isMatchPlayed(match)
    )

  const toggleTeam = (teamId: string) => {
    setSelectedTeams((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) {
        next.delete(teamId)
      } else {
        next.add(teamId)
      }
      return next
    })
  }

  const clearTeamFilter = () => setSelectedTeams(new Set())

  const handleSaveAsJSON = () => {
    const dataToSave: ExportData = {
      leagueId,
      matches: sortMatchesById(matches),
      selectedWeek,
      timestamp: new Date().toISOString(),
      iterations,
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

  const applyImport = (data: ExportData) => {
    onLoadMatches(sortMatchesById(data.matches), data.selectedWeek)
    if (data.iterations && onLoadIterations) {
      onLoadIterations(data.iterations)
    }
    setImportError(null)
  }

  const handleLoadFromJSON = (file: File) => {
    setImportError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)
        if (!data || !Array.isArray(data.matches)) {
          setImportError(
            "Invalid JSON format. Expected an object with a 'matches' array."
          )
          return
        }

        // Validate league ID match; if mismatched, confirm via dialog
        if (data.leagueId && data.leagueId !== leagueId) {
          setImportMismatch({ data: data as ExportData, fileLeague: data.leagueId })
          return
        }

        applyImport(data as ExportData)
      } catch (error) {
        setImportError(
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

    if (selectedTeams.size > 0) {
      list = list.filter(
        (m) => selectedTeams.has(m.teamA) || selectedTeams.has(m.teamB)
      )
    }
    return list
  }, [matches, selectedWeek, selectedTeams])

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
    // With unsaved edits, open the confirm dialog; otherwise sync directly
    if (hasScoreChanges) {
      setSyncDialogOpen(true)
    } else {
      onSyncNow(false)
    }
  }

  return (
    <Card className="sticky top-6 shadow-xs">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xl">Schedule Editor</CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            {onSyncNow && (
              <>
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
                <AlertDialog
                  open={syncDialogOpen}
                  onOpenChange={setSyncDialogOpen}
                >
                  <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Overwrite scenario?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You have custom score modifications in your scenario.
                        Syncing will overwrite them with live scores from
                        Liquipedia.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Scenario</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          onSyncNow(true)
                          setSyncDialogOpen(false)
                        }}
                      >
                        Overwrite
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
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
            {canResetSelectedWeek && (
              <Button
                size="sm"
                variant="outline"
                onClick={onResetWeek}
                className="h-7 text-xs font-semibold text-destructive hover:bg-destructive/10"
              >
                Reset W{selectedWeek}
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
                  Liquipedia has {pendingUpdate.updatedCount} new match
                  update(s)
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  Your current scenario has custom score changes.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  className="h-6 bg-amber-600 px-2.5 text-[11px] font-semibold text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-black dark:hover:bg-amber-400"
                  onClick={onApplyPendingUpdate}
                >
                  Apply Updates
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 border-amber-500/40 px-2.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-500/20 dark:text-amber-200"
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
                ? "border border-destructive/20 bg-destructive/10 text-destructive"
                : "border border-border/40 bg-muted/40 text-muted-foreground"
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

        {/* Import Error Alert */}
        {importError && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Import failed</AlertTitle>
            <AlertDescription>{importError}</AlertDescription>
          </Alert>
        )}

        {/* Team Filter & Auto-Sync Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Filter Team:
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-44 justify-between gap-1.5 text-xs font-normal"
                >
                  <span className="line-clamp-1 flex-1 text-left">
                    {selectedTeams.size === 0
                      ? "All Teams"
                      : `${selectedTeams.size} team${selectedTeams.size > 1 ? "s" : ""} selected`}
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-44">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>
                    {selectedTeams.size === 0
                      ? "Showing all teams"
                      : `${selectedTeams.size} selected`}
                  </span>
                  {selectedTeams.size > 0 && (
                    <button
                      type="button"
                      onClick={clearTeamFilter}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {teams.map((t) => (
                  <DropdownMenuCheckboxItem
                    key={t.id}
                    checked={selectedTeams.has(t.id)}
                    onCheckedChange={() => toggleTeam(t.id)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {t.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {onAutoSyncIntervalChange && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Auto-Sync:
              </span>
              <div className="w-28">
                <Select
                  value={String(autoSyncInterval)}
                  onValueChange={(val) =>
                    onAutoSyncIntervalChange(parseInt(val, 10))
                  }
                >
                  <SelectTrigger
                    className="h-7 text-xs"
                    aria-label="Auto-sync interval"
                  >
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
      {/* Import league-mismatch confirmation */}
      <AlertDialog
        open={importMismatch !== null}
        onOpenChange={(open) => {
          if (!open) setImportMismatch(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Different league file</AlertDialogTitle>
            <AlertDialogDescription>
              This file is from league '{importMismatch?.fileLeague}', but the
              current league is '{leagueId}'. Importing may cause mismatches.
              Do you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (importMismatch) applyImport(importMismatch.data)
                setImportMismatch(null)
              }}
            >
              Import Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
