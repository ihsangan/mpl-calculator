import { useState, useMemo, useEffect } from "react"
import { LEAGUES } from "./leagues"
import type { Match, Probability } from "./types"
import { calculateStandings, isMatchPlayed } from "./lib/standings"
import { runMonteCarloSimulation } from "./lib/simulation"
import { useTheme } from "./components/theme-provider"
import { Header } from "./components/header"
import { StandingsTable } from "./components/standings/standings-table"
import { ProbabilitiesCard } from "./components/probabilities/probabilities-card"
import { ScheduleEditor } from "./components/schedule/schedule-editor"

export default function App() {
  const [selectedLeague, setSelectedLeague] = useState<string>("ID")
  const currentLeague = LEAGUES[selectedLeague] ?? LEAGUES.ID

  const [matches, setMatches] = useState<Match[]>(() =>
    JSON.parse(JSON.stringify(currentLeague.allMatches))
  )
  const [selectedWeek, setSelectedWeek] = useState<number>(currentLeague.currentWeek)
  const [isSimulating, setIsSimulating] = useState(false)
  const [probabilities, setProbabilities] = useState<Record<string, Probability>>(() =>
    runMonteCarloSimulation(currentLeague.allMatches, currentLeague.teams, 1000)
  )
  const [iterations, setIterations] = useState(1000)
  const [iterationsInput, setIterationsInput] = useState("1000")
  const [simulateTrigger, setSimulateTrigger] = useState(0)

  const { theme } = useTheme()
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")

  // Calculate current standings
  const standings = useMemo(
    () => calculateStandings(matches, currentLeague.teams),
    [matches, currentLeague.teams]
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

  // Check if all matches are unplayed
  const allMatchesUnplayed = useMemo(() => {
    return matches.every((m) => !isMatchPlayed(m))
  }, [matches])

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

  // Run simulation whenever matches or simulation trigger changes
  useEffect(() => {
    let isCancelled = false
    const timer = setTimeout(() => {
      const results = runMonteCarloSimulation(
        matches,
        currentLeague.teams,
        iterations
      )
      if (!isCancelled) {
        setProbabilities(results)
        setIsSimulating(false)
      }
    }, 40)

    return () => {
      isCancelled = true
      clearTimeout(timer)
    }
  }, [matches, simulateTrigger, currentLeague, iterations])

  // Handle switching league
  const handleLeagueChange = (leagueId: string) => {
    const league = LEAGUES[leagueId]
    if (!league) return
    setIsSimulating(true)
    setSelectedLeague(leagueId)
    setMatches(JSON.parse(JSON.stringify(league.allMatches)))
    setSelectedWeek(league.currentWeek)
    setProbabilities({})
    setSimulateTrigger((n) => n + 1)
  }

  // Handle manual trigger for simulation iterations
  const handleSimulate = () => {
    const parsed = parseInt(iterationsInput, 10)
    const clamped = isNaN(parsed) || parsed < 50 ? 50 : Math.min(parsed, 50000)
    setIsSimulating(true)
    setIterations(clamped)
    setIterationsInput(String(clamped))
    setSimulateTrigger((n) => n + 1)
  }

  // Handle individual match score changes
  const handleScoreChange = (matchId: string, value: string) => {
    setIsSimulating(true)
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
    setIsSimulating(true)
    setMatches(JSON.parse(JSON.stringify(currentLeague.allMatches)))
    setSelectedWeek(currentLeague.currentWeek)
  }

  // Reset all matches to unplayed (0-0)
  const handleResetAllMatches = () => {
    setIsSimulating(true)
    const resetMatches = matches.map((m) => ({
      ...m,
      scoreA: 0,
      scoreB: 0,
    }))
    setMatches(resetMatches)
    setSelectedWeek(1)
  }

  // Handle imported matches safely
  const handleLoadMatches = (importedMatches: Match[], week?: number) => {
    setIsSimulating(true)
    setMatches(importedMatches)
    if (week) {
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
        />

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
          {/* Left Column: Standings & Probabilities */}
          <div className="space-y-8 xl:col-span-7">
            <StandingsTable
              standings={standings}
              teams={currentLeague.teams}
              probabilities={probabilities}
              resolvedTheme={resolvedTheme}
            />

            <ProbabilitiesCard
              standings={standings}
              teams={currentLeague.teams}
              probabilities={probabilities}
              isSimulating={isSimulating}
              iterations={iterations}
              iterationsInput={iterationsInput}
              onIterationsInputChange={setIterationsInput}
              onSimulate={handleSimulate}
              resolvedTheme={resolvedTheme}
            />
          </div>

          {/* Right Column: Interactive Schedule Editor */}
          <div className="xl:col-span-5">
            <ScheduleEditor
              leagueId={selectedLeague}
              matches={matches}
              teams={currentLeague.teams}
              selectedWeek={selectedWeek}
              hasScoreChanges={hasScoreChanges}
              allMatchesUnplayed={allMatchesUnplayed}
              resolvedTheme={resolvedTheme}
              onWeekChange={setSelectedWeek}
              onScoreChange={handleScoreChange}
              onResetToDefault={handleResetToDefault}
              onResetAll={handleResetAllMatches}
              onLoadMatches={handleLoadMatches}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
