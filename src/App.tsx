import { useState, useMemo, useEffect } from "react"
import { LEAGUES } from "./leagues"
import type { Match } from "./types"
import { calculateStandings, isMatchPlayed } from "./lib/standings"
import { useSimulation } from "./hooks/use-simulation"
import { useTheme } from "./components/theme-provider"
import { Header } from "./components/header"
import { Footer } from "./components/footer"
import { StandingsTable } from "./components/standings/standings-table"
import { ProbabilitiesCard } from "./components/probabilities/probabilities-card"
import { ScheduleEditor } from "./components/schedule/schedule-editor"

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

  const [iterations, setIterations] = useState(1000)
  const [iterationsInput, setIterationsInput] = useState("1000")

  // Web Worker-powered Monte Carlo simulation with debouncing and cancellation
  const { probabilities, isSimulating, triggerSimulation } = useSimulation({
    matches,
    teams: currentLeague.teams,
    iterations,
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
      isNaN(parsed) || parsed < 100 ? 100 : Math.min(parsed, 100000)
    setIterations(clamped)
    setIterationsInput(String(clamped))
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
              leagueName={currentLeague.leagueName}
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

        {/* Attribution Footer */}
        <Footer />
      </div>
    </div>
  )
}
