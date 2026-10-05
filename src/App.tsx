import { useState, useMemo, useEffect, useRef } from "react"
import { LEAGUES } from "./leagues"
import type { Match } from "./types"
import {
  calculateStandings,
  getWeekFromId,
  isMatchPlayed,
} from "./lib/standings"
import { calculateTeamElos } from "./lib/elo"
import { useSimulation } from "./hooks/use-simulation"
import { useLiquipediaSync } from "./hooks/use-liquipedia-sync"
import type { SimulationMode } from "./lib/simulation"
import { useTheme } from "./components/theme-provider"
import { Header } from "./components/header"
import { Footer } from "./components/footer"
import { StandingsTable } from "./components/standings/standings-table"
import { ProbabilitiesCard } from "./components/probabilities/probabilities-card"
import { RankScenariosCard } from "./components/probabilities/rank-scenarios-card"
import { ScheduleEditor } from "./components/schedule/schedule-editor"
import { NextMatchCard } from "./components/schedule/next-match-card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./components/ui/alert-dialog"

// Parse league ID from URL pathname (e.g. "/ph" → "PH")
const getLeagueFromUrl = (): string | null => {
  const slug = window.location.pathname.replace(/^\/+|\/+$/g, "").toUpperCase()
  return slug && LEAGUES[slug] ? slug : null
}

export default function App() {
  const [selectedLeague, setSelectedLeague] = useState<string>(() => {
    const fromUrl = getLeagueFromUrl()
    if (fromUrl) return fromUrl

    // No valid league in URL — fall back to localStorage or default
    const saved = localStorage.getItem("mpl-league")
    return saved && LEAGUES[saved] ? saved : "ID"
  })
  const currentLeague = LEAGUES[selectedLeague] ?? LEAGUES.ID

  const [matches, setMatches] = useState<Match[]>(() =>
    JSON.parse(JSON.stringify(currentLeague.allMatches))
  )
  const [selectedWeek, setSelectedWeek] = useState<number | "ALL">(() => {
    const savedLeague = localStorage.getItem("mpl-league")
    // Only restore saved week if the URL league matches the localStorage league
    if (savedLeague === selectedLeague) {
      const savedWeek = localStorage.getItem("mpl-week")
      if (savedWeek === "ALL") return "ALL"
      const parsed = savedWeek ? parseInt(savedWeek, 10) : NaN
      if (!isNaN(parsed) && parsed >= 1) return parsed
    }
    return currentLeague.currentWeek
  })

  const [iterations, setIterations] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const urlIter = params.get("iteration") || params.get("i")
    if (urlIter) {
      const parsed = parseInt(urlIter, 10)
      if (!isNaN(parsed) && parsed > 0) {
        // URL-supplied iterations are capped at 10,000
        return Math.min(parsed, 10000)
      }
    }
    return 1000
  })
  const [iterationsInput, setIterationsInput] = useState(iterations.toString())
  const [highIterationsPrompt, setHighIterationsPrompt] = useState<
    number | null
  >(null)
  const confirmHighIterationsRef = useRef<HTMLButtonElement>(null)
  const [simulationMode, setSimulationMode] =
    useState<SimulationMode>("uniform")

  // Calculate dynamic ELO ratings for all teams
  const teamElos = useMemo(
    () => calculateTeamElos(matches, currentLeague.teams),
    [matches, currentLeague.teams]
  )

  // Web Worker-powered Monte Carlo simulation with debouncing and cancellation
  const { probabilities, isSimulating, triggerSimulation } = useSimulation({
    matches,
    teams: currentLeague.teams,
    iterations,
    mode: simulationMode,
    pointSystem: currentLeague.pointSystem,
  })

  // Sync URL pathname on initial load (replace if missing or wrong)
  useEffect(() => {
    const expectedPath = `/${selectedLeague.toLowerCase()}`
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState(null, "", expectedPath)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const fromUrl = getLeagueFromUrl()
      if (fromUrl && fromUrl !== selectedLeague) {
        const league = LEAGUES[fromUrl]
        if (!league) return
        setSelectedLeague(fromUrl)
        setMatches(JSON.parse(JSON.stringify(league.allMatches)))
        setSelectedWeek(league.currentWeek)
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [selectedLeague])

  const { theme } = useTheme()
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")

  // Calculate current standings
  const standings = useMemo(
    () =>
      calculateStandings(
        matches,
        currentLeague.teams,
        currentLeague.pointSystem
      ),
    [matches, currentLeague.teams, currentLeague.pointSystem]
  )

  // Check if scores differ from official league schedule baseline
  const hasScoreChanges = useMemo(() => {
    const initial = currentLeague.allMatches
    if (matches.length !== initial.length) return true
    return matches.some((m, idx) => {
      const initMatch = initial[idx]
      if (!initMatch) return true
      return m.scoreA !== initMatch.scoreA || m.scoreB !== initMatch.scoreB
    })
  }, [matches, currentLeague.allMatches])

  // Liquipedia MediaWiki live sync & auto-refresh
  const {
    isSyncing,
    syncStatus,
    lastSyncTime,
    syncMessage,
    autoSyncInterval,
    pendingUpdate,
    syncNow,
    setAutoSyncInterval,
    applyPendingUpdate,
    dismissPendingUpdate,
  } = useLiquipediaSync({
    leagueId: selectedLeague,
    matches,
    hasScoreChanges,
    onUpdateMatches: setMatches,
  })

  // Check if all matches are unplayed
  const allMatchesUnplayed = useMemo(() => {
    return matches.every((m) => !isMatchPlayed(m))
  }, [matches])

  // Persist selected league and week to localStorage
  useEffect(() => {
    localStorage.setItem("mpl-league", selectedLeague)
  }, [selectedLeague])

  useEffect(() => {
    localStorage.setItem("mpl-week", String(selectedWeek))
  }, [selectedWeek])

  // Detect dark mode from HTML class and theme setting
  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains("dark")
      setResolvedTheme(isDark ? "dark" : "light")
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [theme])

  // Handle switching league
  const handleLeagueChange = (leagueId: string) => {
    const league = LEAGUES[leagueId]
    if (!league) return
    setSelectedLeague(leagueId)
    setMatches(JSON.parse(JSON.stringify(league.allMatches)))
    setSelectedWeek(league.currentWeek)
    // Push new URL so browser history tracks league switches
    window.history.pushState(null, "", `/${leagueId.toLowerCase()}`)
  }

  // Handle manual trigger for simulation iterations
  const handleSimulate = () => {
    const parsed = parseInt(iterationsInput, 10)
    const clamped =
      isNaN(parsed) || parsed < 100 ? 100 : Math.min(parsed, 1000000)
    // Above 100K requires confirmation (heavy computation)
    if (clamped > 100000) {
      setHighIterationsPrompt(clamped)
      return
    }
    setIterations(clamped)
    setIterationsInput(String(clamped))
    triggerSimulation()
  }

  // Confirm: run with the requested high iteration count
  const handleConfirmHighIterations = () => {
    if (highIterationsPrompt === null) return
    setIterations(highIterationsPrompt)
    setIterationsInput(String(highIterationsPrompt))
    setHighIterationsPrompt(null)
    triggerSimulation()
  }

  // Reject: fall back to 100K and run
  const handleRejectHighIterations = () => {
    setIterations(100000)
    setIterationsInput(String(100000))
    setHighIterationsPrompt(null)
    triggerSimulation()
  }

  // Handle individual match score changes
  const handleScoreChange = (matchId: string, value: string) => {
    setMatches((prev) =>
      prev.map((m) => {
        if (m.id !== matchId) return m
        if (value === "unplayed") return { ...m, scoreA: 0, scoreB: 0 }
        const [scoreA, scoreB] = value.split("-").map(Number)
        return { ...m, scoreA, scoreB }
      })
    )
  }

  // Reset matches to league default fixtures
  const handleResetToDefault = () => {
    setMatches(JSON.parse(JSON.stringify(currentLeague.allMatches)))
    setSelectedWeek(currentLeague.currentWeek)
  }

  // Reset all matches to unplayed (0-0)
  const handleResetAllMatches = () => {
    const resetMatches = matches.map((m) => ({
      ...m,
      scoreA: 0,
      scoreB: 0,
    }))
    setMatches(resetMatches)
    setSelectedWeek(1)
  }

  // Reset only the scores belonging to the currently selected week.
  const handleResetSelectedWeek = () => {
    if (selectedWeek === "ALL") return

    setMatches((prev) =>
      prev.map((match) =>
        getWeekFromId(match.id) === selectedWeek
          ? { ...match, scoreA: 0, scoreB: 0 }
          : match
      )
    )
  }

  // Handle imported matches safely
  const handleLoadMatches = (
    importedMatches: Match[],
    week?: number | "ALL"
  ) => {
    setMatches(importedMatches)
    if (week !== undefined) {
      setSelectedWeek(week)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
        {/* Header with League Switcher & Theme Toggle */}
        <Header
          leagueName={currentLeague.leagueName}
          selectedLeague={selectedLeague}
          onLeagueChange={handleLeagueChange}
          isSyncing={isSyncing}
          autoSyncInterval={autoSyncInterval}
          lastSyncTime={lastSyncTime}
          onSyncNow={() => syncNow(hasScoreChanges)}
        />

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
          {/* Left Column: Standings & Probabilities */}
          <div className="space-y-8 xl:col-span-7">
            <StandingsTable
              standings={standings}
              teams={currentLeague.teams}
              probabilities={probabilities}
              resolvedTheme={resolvedTheme}
              leagueName={currentLeague.leagueName}
              pointSystem={currentLeague.pointSystem}
            />

            <ProbabilitiesCard
              standings={standings}
              teams={currentLeague.teams}
              probabilities={probabilities}
              isSimulating={isSimulating}
              iterations={iterations}
              iterationsInput={iterationsInput}
              simulationMode={simulationMode}
              teamElos={teamElos}
              onSimulationModeChange={setSimulationMode}
              onIterationsInputChange={setIterationsInput}
              onSimulate={handleSimulate}
              resolvedTheme={resolvedTheme}
              leagueName={currentLeague.leagueName}
            />

            <RankScenariosCard
              standings={standings}
              teams={currentLeague.teams}
              probabilities={probabilities}
              isSimulating={isSimulating}
              resolvedTheme={resolvedTheme}
              leagueName={currentLeague.leagueName}
              pointSystem={currentLeague.pointSystem}
            />
          </div>

          {/* Right Column: Next Match Countdown & Interactive Schedule Editor */}
          <div className="space-y-6 xl:col-span-5">
            <NextMatchCard
              matches={matches}
              teams={currentLeague.teams}
              resolvedTheme={resolvedTheme}
            />

            <ScheduleEditor
              leagueId={selectedLeague}
              matches={matches}
              teams={currentLeague.teams}
              selectedWeek={selectedWeek}
              hasScoreChanges={hasScoreChanges}
              allMatchesUnplayed={allMatchesUnplayed}
              resolvedTheme={resolvedTheme}
              isSyncing={isSyncing}
              syncStatus={syncStatus}
              syncMessage={syncMessage}
              lastSyncTime={lastSyncTime}
              autoSyncInterval={autoSyncInterval}
              pendingUpdate={pendingUpdate}
              iterations={iterations}
              onWeekChange={setSelectedWeek}
              onScoreChange={handleScoreChange}
              onResetToDefault={handleResetToDefault}
              onResetAll={handleResetAllMatches}
              onResetWeek={handleResetSelectedWeek}
              onLoadMatches={handleLoadMatches}
              onLoadIterations={(val) => {
                // Imported files carry arbitrary values; apply the same
                // 100–1,000,000 bounds and confirmation gate as manual input.
                const raw = Number(val)
                const clamped = Number.isFinite(raw)
                  ? Math.max(100, Math.min(Math.floor(raw), 1000000))
                  : 1000
                if (clamped > 100000) {
                  setHighIterationsPrompt(clamped)
                  return
                }
                setIterations(clamped)
                setIterationsInput(String(clamped))
              }}
              onSyncNow={syncNow}
              onAutoSyncIntervalChange={setAutoSyncInterval}
              onApplyPendingUpdate={applyPendingUpdate}
              onDismissPendingUpdate={dismissPendingUpdate}
            />
          </div>
        </div>

        {/* Attribution Footer */}
        <Footer />

        {/* High iteration count confirmation */}
        <AlertDialog
          open={highIterationsPrompt !== null}
          onOpenChange={(open) => {
            if (!open) setHighIterationsPrompt(null)
          }}
        >
          <AlertDialogContent
            size="sm"
            // Focus "Continue" instead of Radix's default (the Cancel
            // button), so a repeated Enter confirms the high iteration
            // count rather than silently falling back to 100k.
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              confirmHighIterationsRef.current?.focus()
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Run heavy simulation?</AlertDialogTitle>
              <AlertDialogDescription>
                {highIterationsPrompt?.toLocaleString()} iterations is a heavy
                computation and may take a while. Continue, or use 100,000
                iterations instead?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleRejectHighIterations}>
                Use 100,000
              </AlertDialogCancel>
              <AlertDialogAction
                ref={confirmHighIterationsRef}
                onClick={handleConfirmHighIterations}
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
