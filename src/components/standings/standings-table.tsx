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
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"

interface StandingsTableProps {
  standings: TeamRow[]
  teams: Team[]
  probabilities: Record<string, Probability>
  resolvedTheme: "light" | "dark"
}

const getRankBadgeClass = (idx: number) => {
  if (idx < 2) return "bg-emerald-600 hover:bg-emerald-600 text-white border-0"
  if (idx < 6) return "bg-blue-600 hover:bg-blue-600 text-white border-0"
  return "text-muted-foreground border-muted-foreground/30"
}

const getRankBadgeVariant = (idx: number) => {
  if (idx < 2) return "default" as const
  if (idx < 6) return "secondary" as const
  return "outline" as const
}

const getWinrateClass = (winrate: string) => {
  const v = Number(winrate)
  if (v < 25) return "text-red-600 dark:text-red-400"
  if (v < 50) return "text-amber-600 dark:text-amber-400"
  if (v < 75) return "text-blue-600 dark:text-blue-400"
  return "text-emerald-600 dark:text-emerald-400"
}

const getDiffClass = (diff: number) => {
  if (diff > 0) return "text-emerald-600 dark:text-emerald-400"
  if (diff < 0) return "text-red-600 dark:text-red-400"
  return "text-muted-foreground"
}

export const StandingsTable: React.FC<StandingsTableProps> = ({
  standings,
  teams,
  probabilities,
  resolvedTheme,
}) => {
  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Current Standings</CardTitle>
        <CardDescription>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <span className="inline-flex items-center">
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
              Top 1–2 (Upper Bracket)
            </span>
            <span className="inline-flex items-center">
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />
              Top 3–6 (Lower Bracket)
            </span>
            <span className="inline-flex items-center">
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border border-muted-foreground/30 bg-muted" />
              Eliminated
            </span>
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center font-semibold">#</TableHead>
                <TableHead className="font-semibold">Team</TableHead>
                <TableHead className="text-center font-semibold whitespace-nowrap">
                  Match (W-L)
                </TableHead>
                <TableHead className="text-center font-semibold whitespace-nowrap">
                  Game (W-L)
                </TableHead>
                <TableHead className="text-center font-semibold">Winrate</TableHead>
                <TableHead className="text-center font-semibold">Diff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map((team, idx) => {
                const prob = probabilities[team.id]
                const elimNum = prob ? Number(prob.eliminated) : null
                let rowBg = ""
                let statusBadge: React.ReactNode = null

                if (elimNum !== null && elimNum === 0) {
                  // Clinched Playoff spot
                  rowBg = "bg-emerald-500/10 dark:bg-emerald-950/25"
                  statusBadge = (
                    <span className="rounded bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      CLINCHED
                    </span>
                  )
                } else if (elimNum !== null && elimNum === 100) {
                  // Clinched Elimination
                  rowBg = "bg-destructive/10 dark:bg-destructive/20"
                  statusBadge = (
                    <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                      ELIMINATED
                    </span>
                  )
                }

                const logoUrl = getTeamLogo(
                  team.id,
                  resolvedTheme === "dark",
                  teams
                )

                return (
                  <TableRow key={team.id} className={rowBg}>
                    <TableCell className="py-3 text-center">
                      <Badge
                        variant={getRankBadgeVariant(idx)}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full p-0 text-xs font-bold ${getRankBadgeClass(
                          idx
                        )}`}
                      >
                        {idx + 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-6 w-8 shrink-0 items-center justify-center">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={`Logo of ${team.name}`}
                              className="max-h-6 max-w-8 object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <span className="font-mono text-xs font-semibold text-muted-foreground">
                              {team.id}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold whitespace-nowrap text-sm">
                            {team.name}
                          </span>
                          {statusBadge}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-center font-semibold tabular-nums text-sm">
                      {team.matchW}–{team.matchL}
                    </TableCell>
                    <TableCell className="py-3 text-center font-medium tabular-nums text-sm text-muted-foreground">
                      {team.gameW}–{team.gameL}
                    </TableCell>
                    <TableCell
                      className={`py-3 text-center font-bold tabular-nums text-sm ${getWinrateClass(
                        team.winrate
                      )}`}
                    >
                      {team.winrate}%
                    </TableCell>
                    <TableCell
                      className={`py-3 text-center font-bold tabular-nums text-sm ${getDiffClass(
                        team.diff
                      )}`}
                    >
                      {team.diff > 0 ? `+${team.diff}` : team.diff}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
