import React from "react"
import { LEAGUE_OPTIONS } from "@/leagues"
import { ThemeToggle } from "@/components/theme-toggle"

interface HeaderProps {
  leagueName: string
  selectedLeague: string
  onLeagueChange: (leagueId: string) => void
}

export const Header: React.FC<HeaderProps> = ({
  leagueName,
  selectedLeague,
  onLeagueChange,
}) => {
  return (
    <header className="relative border-b pb-6">
      {/* Theme toggle – always pinned top-right */}
      <div className="absolute right-0 top-0">
        <ThemeToggle />
      </div>

      <div className="space-y-4 pr-12">
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
            Interactive standings, scenario analyzer, and Monte Carlo playoff probability calculator.
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
                className={`flex min-w-max shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-left text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "bg-background text-foreground shadow-xs font-semibold"
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
