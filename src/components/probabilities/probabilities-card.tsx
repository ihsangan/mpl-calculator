import React from "react"
import type { Team, TeamRow, Probability } from "@/types"
import { formatProbability, getTeamLogo } from "@/lib/standings"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface ProbabilitiesCardProps {
  standings: TeamRow[]
  teams: Team[]
  probabilities: Record<string, Probability>
  isSimulating: boolean
  iterations: number
  iterationsInput: string
  onIterationsInputChange: (value: string) => void
  onSimulate: () => void
  resolvedTheme: "light" | "dark"
}

export const ProbabilitiesCard: React.FC<ProbabilitiesCardProps> = ({
  standings,
  teams,
  probabilities,
  isSimulating,
  iterations,
  iterationsInput,
  onIterationsInputChange,
  onSimulate,
  resolvedTheme,
}) => {
  const sortedByPlayoffs = React.useMemo(() => {
    return [...standings].sort((a, b) => {
      const pA = probabilities[a.id] ? Number(probabilities[a.id].totalPlayoffs) : 0
      const pB = probabilities[b.id] ? Number(probabilities[b.id].totalPlayoffs) : 0
      if (pB !== pA) return pB - pA
      const top2A = probabilities[a.id] ? Number(probabilities[a.id].top2) : 0
      const top2B = probabilities[b.id] ? Number(probabilities[b.id].top2) : 0
      return top2B - top2A
    })
  }, [standings, probabilities])

  return (
    <Card className="relative overflow-hidden shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-xl">Playoff Probabilities</CardTitle>
            <CardDescription>
              Monte Carlo simulation · {iterations.toLocaleString()} iterations
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              type="number"
              min="100"
              max="50000"
              value={iterationsInput}
              onChange={(e) => onIterationsInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSimulate()
              }}
              className="h-8 w-24 rounded-lg border border-input bg-transparent px-2.5 text-xs font-semibold tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
              aria-label="Number of simulation iterations"
            />
            <Button
              size="sm"
              onClick={onSimulate}
              disabled={isSimulating}
              className="h-8 text-xs font-semibold"
            >
              {isSimulating ? "Simulating..." : "Simulate"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isSimulating ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: standings.length + 1 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 py-1.5"
              >
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="hidden h-5 w-24 md:block" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Team</TableHead>
                  <TableHead className="text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    Top 1–2 (Upper)
                  </TableHead>
                  <TableHead className="text-right font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    Top 3–6 (Lower)
                  </TableHead>
                  <TableHead className="text-right font-semibold text-foreground whitespace-nowrap">
                    Playoffs (Total)
                  </TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground whitespace-nowrap">
                    Eliminated
                  </TableHead>
                  <TableHead className="w-28 text-center font-semibold whitespace-nowrap">
                    Odds Bar
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedByPlayoffs.map((team) => {
                  const prob = probabilities[team.id] || {
                    top2: "0.00",
                    playoffs: "0.00",
                    totalPlayoffs: "0.00",
                    eliminated: "0.00",
                  }

                  const top2Val = Number(prob.top2)
                  const lowerVal = Number(prob.playoffs)
                  const elimVal = Number(prob.eliminated)

                  const logoUrl = getTeamLogo(
                    team.id,
                    resolvedTheme === "dark",
                    teams
                  )

                  return (
                    <TableRow key={team.id}>
                      <TableCell className="py-2.5 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="flex h-5 w-6 shrink-0 items-center justify-center">
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={`Logo of ${team.name}`}
                                className="max-h-5 max-w-6 object-contain"
                              />
                            ) : null}
                          </div>
                          <span className="font-bold text-sm">{team.id}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-semibold text-emerald-600 tabular-nums dark:text-emerald-400 text-sm">
                        {formatProbability(prob.top2)}%
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-semibold text-blue-600 tabular-nums dark:text-blue-400 text-sm">
                        {formatProbability(prob.playoffs)}%
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-bold text-foreground tabular-nums text-sm">
                        {formatProbability(prob.totalPlayoffs)}%
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-medium text-muted-foreground tabular-nums text-sm">
                        {formatProbability(prob.eliminated)}%
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div
                          className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                          title={`Upper: ${top2Val}% | Lower: ${lowerVal}% | Eliminated: ${elimVal}%`}
                        >
                          <div
                            style={{ width: `${top2Val}%` }}
                            className="bg-emerald-500 transition-all duration-300"
                          />
                          <div
                            style={{ width: `${lowerVal}%` }}
                            className="bg-blue-500 transition-all duration-300"
                          />
                          <div
                            style={{ width: `${elimVal}%` }}
                            className="bg-muted-foreground/30 transition-all duration-300"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
