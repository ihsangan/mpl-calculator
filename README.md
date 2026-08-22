# MPL Calculator

Standings calculator and playoff probability simulator for [Mobile Legends: Bang Bang](https://www.mobilelegends.com/) Professional League (MPL) Season 18.

Supports **MPL Indonesia**, **MPL Philippines**, and **MPL Malaysia**.

**Live site:** [mpl.isan.eu.org](https://mpl.isan.eu.org/)

## Features

- **Live Standings Table** — Auto-calculated standings with W/L record, game differential, and win rate. Includes CLINCHED / ELIMINATED badges.
- **Playoff Probability Simulator** — Monte Carlo simulation engine that calculates each team's odds of finishing Top 2 (upper bracket), Top 6 (playoffs), or eliminated. Configurable iteration count.
- **Interactive Schedule Editor** — Modify match scores to explore "what-if" scenarios. Filter by week or view all matches at once. Import/export schedule data as JSON.
- **Multi-League Support** — Switch between MPL ID, PH, and MY. Each league is accessible via URL (`/id`, `/ph`, `/my`) with state persisted in localStorage.
- **Tiebreaker System** — Standings are resolved using official MPL tiebreakers: 1. Match wins → 2. Game differential → 3. Head-to-head match wins → 4. Head-to-head game differential.
- **Save as Image** — Export standings and probability tables as PNG images with compact, mobile-friendly rendering.
- **Dark / Light Theme** — System-aware theme toggle with smooth transitions.
- **Liquipedia Auto-Sync** — Automated sync script fetches match schedules and scores from [Liquipedia](https://liquipedia.net/mobilelegends/) via the MediaWiki API and updates local JSON data files.

## Tech Stack

| Layer        | Technology                                   |
| :----------- | :------------------------------------------- |
| Framework    | React 19 + TypeScript                        |
| Build        | Vite 7                                       |
| Styling      | Tailwind CSS 4                               |
| UI           | shadcn/ui (Radix UI primitives)              |
| Image Export | html2canvas-pro (lazy-loaded)                |
| Data Sync    | Custom sync script (TypeScript / Python)     |
| CI/CD        | GitHub Actions (scheduled cron + manual)     |
| Deployment   | Cloudflare Pages                             |

## Project Structure

```
├── src/
│   ├── App.tsx                    # Main application with routing and state
│   ├── leagues.ts                 # League configuration (ID, PH, MY)
│   ├── teams.ts                   # Team definitions with logos
│   ├── schedule-{id,ph,my}.json   # Match schedule and score data
│   ├── components/
│   │   ├── header.tsx             # League selector and theme toggle
│   │   ├── footer.tsx             # Liquipedia attribution
│   │   ├── standings/             # Standings table component
│   │   ├── probabilities/         # Playoff odds simulator component
│   │   ├── schedule/              # Schedule editor and match cards
│   │   └── ui/                    # shadcn/ui base components
│   ├── hooks/
│   │   └── use-save-as-image.ts   # Image export hook (html2canvas-pro)
│   ├── lib/
│   │   ├── standings.ts           # Standings calculation engine
│   │   └── simulation.ts          # Monte Carlo simulation engine
│   └── types/
│       └── index.ts               # Shared TypeScript interfaces
├── sync.ts                        # Liquipedia sync script (TypeScript)
├── sync.py                        # Liquipedia sync script (Python)
└── .github/workflows/sync.yml    # Scheduled GitHub Actions workflow
```

## Getting Started

### Prerequisites

- **Node.js** ≥ 22
- **pnpm** ≥ 9

### Install & Run

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint

# Production build
pnpm build
```

## Data Sync

Match schedules and scores are sourced from [Liquipedia](https://liquipedia.net/mobilelegends/) and stored in `src/schedule-{id,ph,my}.json`. The sync script fetches all three leagues in a single batched API request, parses the MediaWiki wikitext, and updates the JSON files with the latest results.

### Manual Sync

```bash
# Sync all leagues
pnpm sync

# Sync a specific league
pnpm sync --league id
pnpm sync --league ph
pnpm sync --league my

# Preview without writing files
pnpm sync --dry-run

# Sync and auto commit + push
pnpm sync --push
```

### Automated Sync (GitHub Actions)

A [workflow](.github/workflows/sync.yml) runs on a cron schedule during match days (Fridays, Saturdays, and Sundays) and can also be triggered manually via `workflow_dispatch`.

### Sync Rules

- Only **completed Bo3 matches** (where one team has reached 2 wins) are recorded. In-progress matches (`1-0`, `0-1`, `1-1`) remain `0-0` until decided.
- `LAST_UPDATED` is set to the Liquipedia page revision timestamp, not the sync execution time.
- `CURRENT_WEEK` is auto-detected as the first week containing unplayed matches.

## License

Data provided by [Liquipedia](https://liquipedia.net/commons/Liquipedia:Copyrights) under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
