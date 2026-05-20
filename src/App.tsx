import { useState, useMemo, useEffect, useRef } from "react"
import { CURRENT_WEEK, TEAMS, ALL_MATCHES } from "./ID"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ThemeToggle } from "@/components/theme-toggle"
import { useTheme } from "@/components/theme-provider"

interface TeamRow {
  id: string
  name: string
  matchW: number
  matchL: number
  gameW: number
  gameL: number
  diff: number
  pts: number
  winrate: string
}

interface Match {
  id: string
  teamA: string
  teamB: string
  scoreA: number
  scoreB: number
}

// Extract week number from match ID (e.g., "w8m1" -> 8)
const getWeekFromId = (id: string): number => {
  const match = id.match(/w(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

// Check if match has been played (any non-zero score)
const isMatchPlayed = (match: Match): boolean => {
  return match.scoreA !== 0 || match.scoreB !== 0
}

// Sort matches by ID (e.g., w1m1, w1m2, ..., w9m8)
const sortMatchesById = (matches: Match[]): Match[] => {
  return [...matches].sort((a, b) => {
    const aWeek = getWeekFromId(a.id)
    const bWeek = getWeekFromId(b.id)
    if (aWeek !== bWeek) return aWeek - bWeek
    const aMatch = parseInt(a.id.match(/m(\d+)/)?.[1] || "0", 10)
    const bMatch = parseInt(b.id.match(/m(\d+)/)?.[1] || "0", 10)
    return aMatch - bMatch
  })
}

interface Probability {
  top2: string
  playoffs: string
  eliminated: string
}

const getTeamLogo = (teamId: string, isDarkMode: boolean): string => {
  const team = TEAMS.find((t) => t.id === teamId)
  if (!team) return ""

  // Use dark mode logo if available and dark mode is active
  if (isDarkMode && team.logoDark) {
    return team.logoDark
  }

  return team.logo
}

const calculateStandings = (matches: Match[]): TeamRow[] => {
  const table: Record<string, TeamRow> = {}

  TEAMS.forEach((t: { id: string; name: string }) => {
    table[t.id] = {
      id: t.id,
      name: t.name,
      matchW: 0,
      matchL: 0,
      gameW: 0,
      gameL: 0,
      diff: 0,
      pts: 0,
      winrate: "0",
    }
  })

  // Build H2H record: h2h[teamA][teamB] = wins of teamA against teamB
  const h2h: Record<string, Record<string, number>> = {}
  TEAMS.forEach((t: { id: string }) => {
    h2h[t.id] = {}
    TEAMS.forEach((t2: { id: string }) => {
      h2h[t.id][t2.id] = 0
    })
  })

  matches.forEach((m: Match) => {
    if (!isMatchPlayed(m)) return

    table[m.teamA].gameW += m.scoreA
    table[m.teamA].gameL += m.scoreB
    table[m.teamB].gameW += m.scoreB
    table[m.teamB].gameL += m.scoreA

    if (m.scoreA > m.scoreB) {
      table[m.teamA].matchW += 1
      table[m.teamB].matchL += 1
      table[m.teamA].pts += 1
      h2h[m.teamA][m.teamB] += 1
    } else if (m.scoreB > m.scoreA) {
      table[m.teamB].matchW += 1
      table[m.teamA].matchL += 1
      table[m.teamB].pts += 1
      h2h[m.teamB][m.teamA] += 1
    }
  })

  Object.values(table).forEach((team) => {
    team.diff = team.gameW - team.gameL
    const totalGames = team.gameW + team.gameL
    team.winrate =
      totalGames > 0 ? ((team.gameW / totalGames) * 100).toFixed(0) : "0"
  })

  return Object.values(table).sort((a, b) => {
    // 1. Match wins
    if (b.matchW !== a.matchW) return b.matchW - a.matchW
    // 2. Game difference
    if (b.diff !== a.diff) return b.diff - a.diff
    // 3. Head-to-head tiebreaker
    const aWinsVsB = h2h[a.id][b.id]
    const bWinsVsA = h2h[b.id][a.id]
    if (aWinsVsB !== bWinsVsA) return bWinsVsA - aWinsVsB
    // 4. Fallback: alphabetical
    return a.name.localeCompare(b.name)
  })
}

const getRankBadgeVariant = (idx: number) => {
  if (idx < 2) return "default" as const
  if (idx < 6) return "secondary" as const
  return "outline" as const
}

const getRankBadgeClass = (idx: number) => {
  if (idx < 2) return "bg-emerald-600 hover:bg-emerald-600 text-white border-0"
  if (idx < 6) return "bg-blue-600 hover:bg-blue-600 text-white border-0"
  return "text-muted-foreground"
}

const getWinrateClass = (winrate: string) => {
  const v = Number(winrate)
  if (v < 25) return "text-red-600 dark:text-red-400"
  if (v < 50) return "text-amber-600 dark:text-yellow-400"
  if (v < 75) return "text-blue-600  dark:text-blue-400"
  return "text-emerald-600 dark:text-emerald-400"
}

const getDiffClass = (diff: number) => {
  if (diff > 0) return "text-emerald-600 dark:text-emerald-400"
  if (diff < 0) return "text-red-600 dark:text-red-400"
  return "text-muted-foreground"
}

const formatProbability = (value: string): string => {
  const num = Number(value)
  return num === 100 ? "100" : value
}

const POSSIBLE_SCORES = [
  { a: 2, b: 0 },
  { a: 2, b: 1 },
  { a: 1, b: 2 },
  { a: 0, b: 2 },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function App() {
  const [matches, setMatches] = useState<Match[]>(ALL_MATCHES as Match[])
  const [selectedWeek, setSelectedWeek] = useState<number>(CURRENT_WEEK)
  const [isSimulating, setIsSimulating] = useState(true)
  const [probabilities, setProbabilities] = useState<
    Record<string, Probability>
  >({})
  const [iterations, setIterations] = useState(1000)
  const [iterationsInput, setIterationsInput] = useState("1000")
  const [simulateTrigger, setSimulateTrigger] = useState(0)
  const iterationsRef = useRef(1000)
  const { theme } = useTheme()
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")
  const initialMatchesRef = useRef<Match[]>(
    JSON.parse(JSON.stringify(ALL_MATCHES))
  )

  const standings = useMemo(() => calculateStandings(matches), [matches])

  // Check if there are score changes from initial state
  const hasScoreChanges = useMemo(() => {
    return matches.some((m, idx) => {
      const initial = initialMatchesRef.current[idx]
      return m.scoreA !== initial.scoreA || m.scoreB !== initial.scoreB
    })
  }, [matches])

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

    // Watch for class changes
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [theme])

  useEffect(() => {
    const id = setTimeout(() => {
      const ITERATIONS = iterationsRef.current
      const stats: Record<
        string,
        { top2: number; playoffs: number; eliminated: number }
      > = {}
      TEAMS.forEach((t: { id: string }) => {
        stats[t.id] = { top2: 0, playoffs: 0, eliminated: 0 }
      })

      const played = matches.filter((m) => isMatchPlayed(m))
      const unplayed = matches.filter((m) => !isMatchPlayed(m))

      for (let i = 0; i < ITERATIONS; i++) {
        const sim = unplayed.map((m) => {
          const r =
            POSSIBLE_SCORES[Math.floor(Math.random() * POSSIBLE_SCORES.length)]
          return { ...m, scoreA: r.a, scoreB: r.b }
        })
        const simStandings = calculateStandings([...played, ...sim])
        simStandings.forEach((team, index) => {
          const rank = index + 1
          if (rank <= 2) stats[team.id].top2++
          else if (rank <= 6) stats[team.id].playoffs++
          else stats[team.id].eliminated++
        })
      }

      const final: Record<string, Probability> = {}
      Object.keys(stats).forEach((id) => {
        final[id] = {
          top2: ((stats[id].top2 / ITERATIONS) * 100).toFixed(2),
          playoffs: ((stats[id].playoffs / ITERATIONS) * 100).toFixed(2),
          eliminated: ((stats[id].eliminated / ITERATIONS) * 100).toFixed(2),
        }
      })

      setProbabilities(final)
      setIsSimulating(false)
    }, 50)

    return () => clearTimeout(id)
  }, [matches, simulateTrigger])

  const handleSimulate = () => {
    const parsed = parseInt(iterationsInput, 10)
    const clamped = isNaN(parsed) || parsed < 1 ? 1 : Math.min(parsed, 100000)
    iterationsRef.current = clamped
    setIterations(clamped)
    setIterationsInput(String(clamped))
    setIsSimulating(true)
    setSimulateTrigger((n) => n + 1)
  }

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

  const handleResetToDefault = () => {
    setIsSimulating(true)
    setMatches(JSON.parse(JSON.stringify(initialMatchesRef.current)))
    setSelectedWeek(CURRENT_WEEK)
  }

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

  const handleSaveAsJSON = () => {
    const dataToSave = {
      matches: sortMatchesById(matches),
      selectedWeek,
      timestamp: new Date().toISOString(),
    }
    const jsonString = JSON.stringify(dataToSave, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `mpl-matches-${new Date().getTime()}.json`
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
        if (data.matches && Array.isArray(data.matches)) {
          setIsSimulating(true)
          setMatches(sortMatchesById(data.matches))
          if (data.selectedWeek) {
            setSelectedWeek(data.selectedWeek)
          }
        } else {
          alert("Invalid JSON format. Expected matches array.")
        }
      } catch (error) {
        alert(
          "Error loading JSON file: " +
            (error instanceof Error ? error.message : String(error))
        )
      }
    }
    reader.readAsText(file)
  }

  const getMatchesByDay = (weekMatches: Match[]) => [
    { title: "Day 1", matches: weekMatches.slice(0, 2) },
    { title: "Day 2", matches: weekMatches.slice(2, 5) },
    { title: "Day 3", matches: weekMatches.slice(5, 8) },
  ]

  const weeks = useMemo(() => {
    const weekSet = new Set(matches.map((m) => getWeekFromId(m.id)))
    return Array.from(weekSet).sort((a, b) => a - b)
  }, [matches])

  return (
    <div className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="mb-1 text-3xl font-bold tracking-tight md:text-4xl">
              MPL Indonesia Season 17
            </h1>
            <p className="text-muted-foreground">
              Standings and playoff probabilities calculator.
            </p>
          </div>
          <ThemeToggle />
        </div>
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
          {/* ── LEFT: Standings + Probabilities ── */}
          <div className="space-y-8 xl:col-span-7">
            {/* Standings */}
            <main role="main">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Current Standings</CardTitle>
                  <CardDescription>
                    <span className="inline-flex items-center gap-3 text-xs">
                      <span>
                        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
                        Top 2 – Upper Bracket
                      </span>
                      <span>
                        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />
                        Top 3–6 – Lower Bracket
                      </span>
                      <span>
                        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border bg-muted" />
                        Eliminated
                      </span>
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14 text-center">Rank</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-center">
                          Match (W-L)
                        </TableHead>
                        <TableHead className="text-center">
                          Game (W-L)
                        </TableHead>
                        <TableHead className="text-center">Winrate</TableHead>
                        <TableHead className="text-center">Diff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {standings.map((team, idx) => {
                        const prob = probabilities[team.id]
                        const eliminated = prob ? Number(prob.eliminated) : null
                        let rowBg = ""
                        if (eliminated === 0) {
                          // Qualified - 0% elimination probability
                          rowBg = "bg-emerald-50 dark:bg-emerald-950/20"
                        } else if (eliminated === 100) {
                          // Eliminated - 100% elimination probability
                          rowBg = "bg-red-50 dark:bg-red-950/20"
                        }
                        return (
                          <TableRow key={team.id} className={rowBg}>
                            <TableCell className="py-2.5 text-center">
                              <Badge
                                variant={getRankBadgeVariant(idx)}
                                className={`flex h-6 w-6 items-center justify-center rounded-full p-0 text-xs ${getRankBadgeClass(idx)}`}
                              >
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-3">
                                <div className="flex w-8 shrink-0 justify-center">
                                  <img
                                    src={getTeamLogo(
                                      team.id,
                                      resolvedTheme === "dark"
                                    )}
                                    alt={`Logo of ${team.name}`}
                                    className="max-h-5 w-auto object-contain"
                                  />
                                </div>
                                <span className="font-medium whitespace-nowrap">
                                  {team.name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-center font-medium tabular-nums">
                              {team.matchW}–{team.matchL}
                            </TableCell>
                            <TableCell className="py-2.5 text-center font-medium tabular-nums">
                              {team.gameW}–{team.gameL}
                            </TableCell>
                            <TableCell
                              className={`py-2.5 text-center font-medium tabular-nums ${getWinrateClass(team.winrate)}`}
                            >
                              {team.winrate}%
                            </TableCell>
                            <TableCell
                              className={`py-2.5 text-center font-medium tabular-nums ${getDiffClass(team.diff)}`}
                            >
                              {team.diff > 0 ? `+${team.diff}` : team.diff}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </main>

            {/* Probabilities */}
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Playoff Probabilities</CardTitle>
                    <CardDescription>
                      Monte Carlo simulation · {iterations.toLocaleString()}{" "}
                      iterations
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <input
                      type="number"
                      value={iterationsInput}
                      onChange={(e) => setIterationsInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSimulate()
                      }}
                      className="h-8 w-24 rounded-lg border border-input bg-transparent px-2.5 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      aria-label="Number of iterations"
                    />
                    <Button size="sm" onClick={handleSimulate} className="h-8">
                      Simulate
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isSimulating ? (
                  <div className="space-y-3 p-4">
                    {Array.from({ length: standings.length + 1 }).map(
                      (_, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-4"
                        >
                          {/* Mobile: 4 columns */}
                          <Skeleton className="h-6 w-20 md:hidden" />
                          <Skeleton className="h-6 w-16 md:hidden" />
                          <Skeleton className="h-6 w-16 md:hidden" />
                          <Skeleton className="h-6 w-16 md:hidden" />

                          {/* Desktop: 5 columns */}
                          <Skeleton className="hidden h-6 w-20 md:block" />
                          <Skeleton className="hidden h-6 w-16 md:block" />
                          <Skeleton className="hidden h-6 w-16 md:block" />
                          <Skeleton className="hidden h-6 w-16 md:block" />
                          <Skeleton className="hidden h-6 w-16 md:block" />
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right text-emerald-700 dark:text-emerald-500">
                          Top 1–2
                          <br />
                          (Upper)
                        </TableHead>
                        <TableHead className="text-right text-blue-700 dark:text-blue-500">
                          Top 3–6
                          <br />
                          (Lower)
                        </TableHead>
                        <TableHead className="text-right text-purple-700 dark:text-purple-500">
                          Playoffs
                        </TableHead>
                        <TableHead className="text-right text-red-700 dark:text-red-400">
                          Eliminated
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...standings]
                        .sort((a, b) => {
                          const pA = probabilities[a.id]
                            ? Number(probabilities[a.id].top2) +
                              Number(probabilities[a.id].playoffs)
                            : 0
                          const pB = probabilities[b.id]
                            ? Number(probabilities[b.id].top2) +
                              Number(probabilities[b.id].playoffs)
                            : 0
                          return pB - pA
                        })
                        .map((team) => {
                          const prob = probabilities[team.id] || {
                            top2: "0.00",
                            playoffs: "0.00",
                            eliminated: "0.00",
                          }
                          return (
                            <TableRow key={team.id}>
                              {/* Team name only, no logo */}
                              <TableCell className="py-2.5 font-medium">
                                {team.id}
                              </TableCell>
                              <TableCell className="py-2.5 text-right font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                                {formatProbability(prob.top2)}%
                              </TableCell>
                              <TableCell className="py-2.5 text-right font-semibold text-blue-600 tabular-nums dark:text-blue-400">
                                {formatProbability(prob.playoffs)}%
                              </TableCell>
                              <TableCell className="py-2.5 text-right font-semibold text-purple-600 tabular-nums dark:text-purple-400">
                                {formatProbability(
                                  (
                                    Number(prob.top2) + Number(prob.playoffs)
                                  ).toFixed(2)
                                )}
                                %
                              </TableCell>
                              <TableCell className="py-2.5 text-right font-semibold text-red-600 tabular-nums dark:text-red-400">
                                {formatProbability(prob.eliminated)}%
                              </TableCell>
                            </TableRow>
                          )
                        })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT: Schedule Editor ─�� */}
          <div className="xl:col-span-5">
            <Card className="sticky top-8">
              <CardHeader className="pb-3">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>Schedule</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveAsJSON}
                      className="h-8 text-xs"
                    >
                      Save as JSON
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
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
                      Load from JSON
                    </Button>
                    {!allMatchesUnplayed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleResetAllMatches}
                        className="h-8 text-xs"
                      >
                        Reset All
                      </Button>
                    )}
                    {hasScoreChanges && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleResetToDefault}
                        className="h-8 text-xs"
                      >
                        Reset Schedule
                      </Button>
                    )}
                  </div>
                </div>
                {/* Week selector */}
                <div className="flex flex-wrap gap-1.5">
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
                        "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 dark:bg-emerald-600/20 dark:text-emerald-400 dark:border-emerald-600/40 dark:hover:bg-emerald-600/30"
                    }

                    return (
                      <Button
                        key={week}
                        variant={variant}
                        size="sm"
                        className={`h-7 px-3 text-xs font-semibold ${extra}`}
                        onClick={() => setSelectedWeek(week)}
                      >
                        W{week}
                      </Button>
                    )
                  })}
                </div>
              </CardHeader>

              <Separator />

              <CardContent className="max-h-[700px] space-y-6 overflow-y-auto p-4">
                {getMatchesByDay(
                  matches.filter((m) => getWeekFromId(m.id) === selectedWeek)
                ).map((day) => (
                  <div key={day.title}>
                    {/* Day header */}
                    <div className="mb-3 flex items-center gap-3">
                      <Separator className="flex-1" />
                      <span className="shrink-0 text-xs font-bold tracking-widest text-muted-foreground uppercase">
                        {day.title}
                      </span>
                      <Separator className="flex-1" />
                    </div>

                    {/* Matches */}
                    <div className="space-y-2">
                      {day.matches.map((match) => {
                        const played = isMatchPlayed(match)
                        const currentValue = played
                          ? `${match.scoreA}-${match.scoreB}`
                          : "unplayed"
                        const teamAColor = played
                          ? match.scoreA > match.scoreB
                            ? "text-green-600 dark:text-green-510"
                            : "text-red-600 dark:text-red-500"
                          : ""
                        const teamBColor = played
                          ? match.scoreB > match.scoreA
                            ? "text-green-600 dark:text-green-510"
                            : "text-red-600 dark:text-red-500"
                          : ""

                        return (
                          <div
                            key={match.id}
                            className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5"
                          >
                            {/* Team A – text only */}
                            <div className="flex min-w-0 flex-1 justify-end">
                              <span
                                className={`truncate text-sm font-semibold ${teamAColor}`}
                              >
                                {match.teamA}
                              </span>
                            </div>

                            {/* Score selector */}
                            <div className="w-17 shrink-0">
                              <Select
                                value={currentValue}
                                onValueChange={(v) =>
                                  handleScoreChange(match.id, v)
                                }
                              >
                                <SelectTrigger
                                  aria-label={`Score for ${match.teamA} vs ${match.teamB}`}
                                  className={`h-8 justify-center gap-1 text-center text-xs font-bold ${
                                    played
                                      ? "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600/50 dark:bg-blue-950/30 dark:text-blue-400"
                                      : ""
                                  }`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unplayed">
                                    0 – 0
                                  </SelectItem>
                                  <SelectItem value="2-0">2 – 0</SelectItem>
                                  <SelectItem value="2-1">2 – 1</SelectItem>
                                  <SelectItem value="1-2">1 – 2</SelectItem>
                                  <SelectItem value="0-2">0 – 2</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Team B – text only */}
                            <div className="flex min-w-0 flex-1">
                              <span
                                className={`truncate text-sm font-semibold ${teamBColor}`}
                              >
                                {match.teamB}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
