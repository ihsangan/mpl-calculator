import { useState, useMemo, useEffect } from "react"
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
import { Loader2 } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

// ─── Types ───────────────────────────────────────────────────────────────────

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
  week: number
  teamA: string
  teamB: string
  scoreA: number
  scoreB: number
  isPlayed: boolean
}

interface Probability {
  top2: string
  playoffs: string
  eliminated: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

  matches.forEach((m: Match) => {
    if (!m.isPlayed) return

    table[m.teamA].gameW += m.scoreA
    table[m.teamA].gameL += m.scoreB
    table[m.teamB].gameW += m.scoreB
    table[m.teamB].gameL += m.scoreA

    if (m.scoreA > m.scoreB) {
      table[m.teamA].matchW += 1
      table[m.teamB].matchL += 1
      table[m.teamA].pts += 1
    } else if (m.scoreB > m.scoreA) {
      table[m.teamB].matchW += 1
      table[m.teamA].matchL += 1
      table[m.teamB].pts += 1
    }
  })

  Object.values(table).forEach((team) => {
    team.diff = team.gameW - team.gameL
    const totalGames = team.gameW + team.gameL
    team.winrate =
      totalGames > 0 ? ((team.gameW / totalGames) * 100).toFixed(0) : "0"
  })

  return Object.values(table).sort((a, b) => {
    if (b.matchW !== a.matchW) return b.matchW - a.matchW
    if (b.diff !== a.diff) return b.diff - a.diff
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

  const standings = useMemo(() => calculateStandings(matches), [matches])

  useEffect(() => {
    // setIsSimulating(true)
    const id = setTimeout(() => {
      const ITERATIONS = 1000
      const stats: Record<
        string,
        { top2: number; playoffs: number; eliminated: number }
      > = {}
      TEAMS.forEach((t: { id: string }) => {
        stats[t.id] = { top2: 0, playoffs: 0, eliminated: 0 }
      })

      const played = matches.filter((m) => m.isPlayed)
      const unplayed = matches.filter((m) => !m.isPlayed)

      for (let i = 0; i < ITERATIONS; i++) {
        const sim = unplayed.map((m) => {
          const r =
            POSSIBLE_SCORES[Math.floor(Math.random() * POSSIBLE_SCORES.length)]
          return { ...m, scoreA: r.a, scoreB: r.b, isPlayed: true }
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
  }, [matches])

  const handleScoreChange = (matchId: string, value: string) => {
    setIsSimulating(true)
    setMatches((prev) =>
      prev.map((m) => {
        if (m.id !== matchId) return m
        if (value === "unplayed")
          return { ...m, isPlayed: false, scoreA: 0, scoreB: 0 }
        const [scoreA, scoreB] = value.split("-").map(Number)
        return { ...m, isPlayed: true, scoreA, scoreB }
      })
    )
  }

  const getMatchesByDay = (weekMatches: Match[]) => [
    { title: "Day 1", matches: weekMatches.slice(0, 2) },
    { title: "Day 2", matches: weekMatches.slice(2, 5) },
    { title: "Day 3", matches: weekMatches.slice(5, 8) },
  ]

  const weeks = [1, 2, 3, 4, 5, 6, 7, 8, 9]

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
                      <TableHead className="text-center">Match (W-L)</TableHead>
                      <TableHead className="text-center">Game (W-L)</TableHead>
                      <TableHead className="text-center">Winrate</TableHead>
                      <TableHead className="text-center">Diff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standings.map((team, idx) => (
                      <TableRow
                        key={team.id}
                        className={
                          idx < 6 ? "bg-emerald-50 dark:bg-emerald-950/20" : ""
                        }
                      >
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
                                src={
                                  TEAMS.find(
                                    (t: { id: string }) => t.id === team.id
                                  )?.logo
                                }
                                alt={team.name}
                                className="max-h-5 w-auto object-contain"
                              />
                            </div>
                            <span className="font-medium whitespace-nowrap">
                              {team.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-center tabular-nums">
                          {team.matchW}–{team.matchL}
                        </TableCell>
                        <TableCell className="py-2.5 text-center tabular-nums">
                          {team.gameW}–{team.gameL}
                        </TableCell>
                        <TableCell
                          className={`py-2.5 text-center tabular-nums ${getWinrateClass(team.winrate)}`}
                        >
                          {team.winrate}%
                        </TableCell>
                        <TableCell
                          className={`py-2.5 text-center tabular-nums ${getDiffClass(team.diff)}`}
                        >
                          {team.diff > 0 ? `+${team.diff}` : team.diff}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Probabilities */}
            <Card className="relative overflow-hidden">
              {isSimulating && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Calculating…
                  </span>
                </div>
              )}
              <CardHeader className="pb-3">
                <CardTitle>Playoff Probabilities</CardTitle>
                <CardDescription>
                  Monte Carlo simulation · 1.000 iterations
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right text-emerald-700 dark:text-emerald-500">
                        Top 1–2 (Upper)
                      </TableHead>
                      <TableHead className="text-right text-blue-700 dark:text-blue-500">
                        Top 3–6 (Lower)
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
                              {prob.top2}%
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-semibold text-blue-600 tabular-nums dark:text-blue-400">
                              {prob.playoffs}%
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-semibold text-red-600 tabular-nums dark:text-red-400">
                              {prob.eliminated}%
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT: Schedule Editor ── */}
          <div className="xl:col-span-5">
            <Card className="sticky top-8">
              <CardHeader className="pb-3">
                <CardTitle>Schedule</CardTitle>
                {/* Week selector */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {weeks.map((week) => {
                    const weekMatches = matches.filter((m) => m.week === week)
                    const isCompleted =
                      weekMatches.length > 0 &&
                      weekMatches.every((m) => m.isPlayed)
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
                  matches.filter((m) => m.week === selectedWeek)
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
                        const currentValue = match.isPlayed
                          ? `${match.scoreA}-${match.scoreB}`
                          : "unplayed"

                        return (
                          <div
                            key={match.id}
                            className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5"
                          >
                            {/* Team A – text only */}
                            <div className="flex min-w-0 flex-1 justify-end">
                              <span className="truncate text-sm font-semibold">
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
                                  className={`h-8 justify-center gap-1 text-center text-xs font-bold ${
                                    match.isPlayed
                                      ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-600/50 dark:bg-emerald-950/30 dark:text-emerald-400"
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
                              <span className="truncate text-sm font-semibold">
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
