import React from "react"
import type { Team, TeamRow, Probability } from "@/types"
import { getTeamLogo } from "@/lib/standings"
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
import { useSaveAsImage } from "@/hooks/use-save-as-image"
import { cn } from "cn"

interface RankScenariosCardProps {
  standings: TeamRow[]
  teams: Team[]
  probabilities: Record<string, Probability>
  isSimulating: boolean
  resolvedTheme: "light" | "dark"
  leagueName: string
  pointSystem?: "standard" | "three_point"
}

const getRankBadgeClass = (rank: number) => {
  if (rank <= 2) {
    return "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-600/30"
  }
  if (rank <= 6) {
    return "bg-blue-600/15 text-blue-700 dark:text-blue-400 border border-blue-600/30"
  }
  return "bg-muted text-muted-foreground border border-border"
}

export const RankScenariosCard: React.FC<RankScenariosCardProps> = ({
  standings,
  teams,
  probabilities,
  isSimulating,
  resolvedTheme,
  leagueName,
  pointSystem = "standard",
}) => {
  const { ref, save, isExporting } = useSaveAsImage(
    `rank-projections-${leagueName.replace(/\s+/g, "-").toLowerCase()}`
  )

  const totalTeams = standings.length || teams.length || 8

  return (
    <div ref={ref}>
      <Card className="relative overflow-hidden shadow-xs">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-xl">Final Rank Projections</CardTitle>
              <CardDescription>
                Best and worst possible finish in regular season standings
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2" data-capture-hide>
              <Button
                size="sm"
                variant="outline"
                onClick={save}
                disabled={isExporting}
                className="h-8 shrink-0 text-xs font-semibold"
              >
                {isExporting ? "Saving..." : "Save as Image"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-600" />
              Ranks 1–2 (Upper Bracket)
            </span>
            <span className="inline-flex items-center">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-blue-600" />
              Ranks 3–6 (Playoffs)
            </span>
            <span className="inline-flex items-center">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
              Ranks &gt;6 (Eliminated)
            </span>
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
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center font-semibold">
                      #
                    </TableHead>
                    <TableHead className="font-semibold">Team</TableHead>
                    <TableHead className="text-center font-semibold whitespace-nowrap">
                      {pointSystem === "three_point" ? "Pts" : "W-L"}
                    </TableHead>
                    <TableHead className="text-center font-semibold whitespace-nowrap">
                      Best
                    </TableHead>
                    <TableHead className="text-center font-semibold whitespace-nowrap">
                      Worst
                    </TableHead>
                    <TableHead className="hidden text-center font-semibold whitespace-nowrap sm:table-cell">
                      Possible Span
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((team, index) => {
                    const prob = probabilities[team.id]
                    const currentRank = index + 1
                    const bestRank = prob?.bestRank ?? currentRank
                    const worstRank = prob?.worstRank ?? currentRank

                    const logoUrl = getTeamLogo(
                      team.id,
                      resolvedTheme === "dark",
                      teams
                    )

                    // Percentage coordinates for visual range bar
                    const leftPct = ((bestRank - 1) / totalTeams) * 100
                    const widthPct = Math.max(
                      1,
                      ((worstRank - bestRank + 1) / totalTeams) * 100
                    )

                    return (
                      <TableRow key={team.id}>
                        <TableCell className="w-10 text-center font-mono text-xs text-muted-foreground">
                          {currentRank}
                        </TableCell>
                        <TableCell className="py-2.5 font-medium">
                          <div className="flex items-center gap-2">
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={team.name}
                                crossOrigin="anonymous"
                                className="h-5 w-5 shrink-0 object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-5 w-5 shrink-0 rounded bg-muted" />
                            )}
                            <span className="font-semibold">{team.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs whitespace-nowrap">
                          {pointSystem === "three_point"
                            ? team.pts
                            : `${team.matchW}-${team.matchL}`}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex h-5 min-w-6 items-center justify-center rounded px-1.5 font-mono text-xs font-bold",
                              getRankBadgeClass(bestRank)
                            )}
                          >
                            #{bestRank}
                          </span>
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex h-5 min-w-6 items-center justify-center rounded px-1.5 font-mono text-xs font-bold",
                              getRankBadgeClass(worstRank)
                            )}
                          >
                            #{worstRank}
                          </span>
                        </TableCell>
                        <TableCell className="hidden py-2.5 sm:table-cell">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-2xs font-mono text-muted-foreground">
                              {bestRank === worstRank
                                ? `Locked at #${bestRank}`
                                : `#${bestRank} – #${worstRank}`}
                            </span>
                            <div className="relative h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                              {/* Upper bracket zone indicator (first 2/total) */}
                              <div
                                className="absolute top-0 bottom-0 left-0 bg-emerald-500/20"
                                style={{
                                  width: `${(2 / totalTeams) * 100}%`,
                                }}
                              />
                              {/* Lower bracket zone indicator (ranks 3 to 6) */}
                              <div
                                className="absolute top-0 bottom-0 bg-blue-500/20"
                                style={{
                                  left: `${(2 / totalTeams) * 100}%`,
                                  width: `${(4 / totalTeams) * 100}%`,
                                }}
                              />
                              {/* Active rank range bar */}
                              <div
                                className={cn(
                                  "absolute top-0 bottom-0 rounded-full transition-all duration-300",
                                  worstRank <= 2
                                    ? "bg-emerald-500"
                                    : worstRank <= 6
                                      ? "bg-blue-500"
                                      : bestRank > 6
                                        ? "bg-destructive/60"
                                        : "bg-amber-500"
                                )}
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${Math.min(100 - leftPct, widthPct)}%`,
                                }}
                              />
                            </div>
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
