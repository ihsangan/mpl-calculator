import React from "react"
import type { Team, TeamRow, Probability } from "@/types"
import type { SimulationMode } from "@/lib/simulation"
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
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useSaveAsImage } from "@/hooks/use-save-as-image"
import { Info } from "lucide-react"

interface ProbabilitiesCardProps {
  standings: TeamRow[]
  teams: Team[]
  probabilities: Record<string, Probability>
  isSimulating: boolean
  iterations: number
  iterationsInput: string
  simulationMode: SimulationMode
  teamElos?: Record<string, number>
  onSimulationModeChange: (mode: SimulationMode) => void
  onIterationsInputChange: (value: string) => void
  onSimulate: () => void
  resolvedTheme: "light" | "dark"
  leagueName: string
}

export const ProbabilitiesCard: React.FC<ProbabilitiesCardProps> = ({
  standings,
  teams,
  probabilities,
  isSimulating,
  iterations,
  iterationsInput,
  simulationMode,
  teamElos,
  onSimulationModeChange,
  onIterationsInputChange,
  onSimulate,
  resolvedTheme,
  leagueName,
}) => {
  const { ref, save, isExporting } = useSaveAsImage(
    `probabilities-${leagueName.replace(/\s+/g, "-").toLowerCase()}`,
    { width: 580 }
  )

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
    <div ref={ref}>
      <Card className="relative overflow-hidden shadow-xs">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-xl">Playoff Probabilities</CardTitle>
              <CardDescription>
                Monte Carlo simulation · {iterations.toLocaleString()} iterations ·{" "}
                {simulationMode === "elo" ? "ELO Weighted" : "Standard (50:50)"}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2" data-capture-hide>
              <input
                type="number"
                min="100"
                max="100000"
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
                disabled={isSimulating || isExporting}
                className="h-8 text-xs font-semibold"
              >
                {isSimulating ? "Simulating..." : "Simulate"}
              </Button>
              {!isSimulating && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={save}
                  disabled={isExporting}
                  className="h-8 text-xs font-semibold"
                >
                  {isExporting ? "Saving..." : "Save as Image"}
                </Button>
              )}
            </div>
          </div>

          {/* Simulation Model Tabs */}
          <div className="flex items-center gap-1.5 pt-1" data-capture-hide>
            <div className="flex rounded-lg border border-border/80 bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => onSimulationModeChange("uniform")}
                className={`rounded-md px-3 py-1 font-semibold transition-all ${
                  simulationMode === "uniform"
                    ? "bg-card text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Standard (50:50)
              </button>
              <button
                type="button"
                onClick={() => onSimulationModeChange("elo")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition-all ${
                  simulationMode === "elo"
                    ? "bg-card text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>ELO Weighted</span>
                {simulationMode === "elo" && (
                  <Badge variant="secondary" className="px-1 py-0 text-3xs font-mono">
                    Dynamic
                  </Badge>
                )}
              </button>
            </div>

            {simulationMode === "elo" && (
              <div
                className="flex items-center gap-1 text-2xs text-muted-foreground cursor-help"
                title="ELO rating updates dynamically based on played matches, clean sweeps (2-0 vs 2-1), and opponent ratings."
              >
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Elo-based Bo3 Bernoulli model</span>
              </div>
            )}
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
                    <TableHead className="h-auto py-2.5 align-bottom font-semibold">
                      <span>Team</span>
                      <span className="block text-[11px] font-normal leading-tight opacity-0 select-none" aria-hidden="true">&nbsp;</span>
                    </TableHead>
                    <TableHead className="h-auto py-2.5 text-right align-bottom font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      <span>Top 1–2</span>
                      <span className="block text-[11px] font-normal leading-tight opacity-80">(Upper)</span>
                    </TableHead>
                    <TableHead className="h-auto py-2.5 text-right align-bottom font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      <span>Top 3–6</span>
                      <span className="block text-[11px] font-normal leading-tight opacity-80">(Lower)</span>
                    </TableHead>
                    <TableHead className="h-auto py-2.5 text-right align-bottom font-semibold text-foreground whitespace-nowrap">
                      <span>Playoffs</span>
                      <span className="block text-[11px] font-normal leading-tight text-muted-foreground opacity-80">(Total)</span>
                    </TableHead>
                    <TableHead className="h-auto py-2.5 text-right align-bottom font-semibold text-muted-foreground whitespace-nowrap">
                      <span>Eliminated</span>
                      <span className="block text-[11px] font-normal leading-tight opacity-0 select-none" aria-hidden="true">&nbsp;</span>
                    </TableHead>
                    <TableHead className="h-auto w-28 text-center align-bottom font-semibold whitespace-nowrap">
                      <span>Odds Bar</span>
                      <span className="block text-[11px] font-normal leading-tight opacity-0 select-none" aria-hidden="true">&nbsp;</span>
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

                    const teamElo = teamElos?.[team.id] ?? 1500

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
                                  crossOrigin="anonymous"
                                />
                              ) : null}
                            </div>
                            <span className="font-bold text-sm">{team.id}</span>
                            {simulationMode === "elo" && (
                              <Badge
                                variant="outline"
                                className="px-1.5 py-0 text-3xs font-mono font-semibold text-muted-foreground cursor-help"
                                title={`ELO Rating: ${teamElo} · Calculated dynamically from season match results, sweeps, and opponent strength.`}
                              >
                                {teamElo}
                              </Badge>
                            )}
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
    </div>
  )
}
