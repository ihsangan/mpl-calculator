import React from "react"
import { RefreshCw } from "lucide-react"
import { LEAGUE_OPTIONS } from "@/leagues"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  leagueName: string
  selectedLeague: string
  onLeagueChange: (leagueId: string) => void
  isSyncing?: boolean
  autoSyncInterval?: number
  lastSyncTime?: Date | null
  onSyncNow?: () => void
}

export const Header: React.FC<HeaderProps> = ({
  leagueName,
  selectedLeague,
  onLeagueChange,
  isSyncing = false,
  autoSyncInterval = 0,
  lastSyncTime = null,
  onSyncNow,
}) => {
  return (
    <header className="relative border-b pb-6">
      {/* Action controls pinned top-right */}
      <div className="absolute top-0 right-0 flex items-center gap-1.5 sm:gap-2">
        {onSyncNow && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSyncNow}
            disabled={isSyncing}
            title={
              lastSyncTime
                ? `Last synced: ${lastSyncTime.toLocaleTimeString()} (Liquipedia MediaWiki)`
                : "Sync live scores from Liquipedia MediaWiki"
            }
            className="h-8 gap-1.5 px-2.5 text-xs font-semibold"
          >
            <RefreshCw
              className={`size-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">
              {isSyncing ? "Syncing..." : "Live Sync"}
            </span>
            {autoSyncInterval > 0 ? (
              <span
                className="relative flex size-2"
                title={`Auto-sync active (every ${autoSyncInterval}s)`}
              >
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
            ) : null}
          </Button>
        )}
        <ThemeToggle />
      </div>

      <div className="space-y-4 pr-24 sm:pr-40">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
              MPL CALCULATOR
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            {leagueName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Interactive standings, scenario analyzer, and Monte Carlo playoff
            probability calculator.
          </p>
        </div>

        {/* League Selector */}
        <div
          aria-label="Select league"
          className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border bg-muted/50 p-1"
          role="group"
        >
          {LEAGUE_OPTIONS.map((option) => {
            const isActive = selectedLeague === option.value

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => onLeagueChange(option.value)}
                className={`flex min-w-max shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-left text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                  isActive
                    ? "bg-background font-semibold text-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
              >
                <span className="font-mono text-xs font-bold tracking-wider">
                  {option.value}
                </span>
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </header>
  )
}
