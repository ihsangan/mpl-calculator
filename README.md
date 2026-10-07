# MPL Calculator

Standings calculator and playoff probability simulator for [Mobile Legends: Bang Bang](https://www.mobilelegends.com/) Professional League (MPL) Season 18 and MCC Season 8.

Supports **MPL Indonesia**, **MPL Philippines**, **MPL Malaysia**, and **MCC (EECA)**.

**Live site:** [mpl.isan.eu.org](https://mpl.isan.eu.org/)

## Features

- **Live Standings Table** — Auto-calculated standings with W/L record, game differential, and win rate. Includes UPPER / CLINCHED / ELIMINATED badges: a team shows UPPER once its Top 2 (Upper Bracket) probability hits 100%, CLINCHED once it is guaranteed at least a playoff spot, and ELIMINATED once it can no longer qualify.
- **Dual-Model Playoff Probability Simulator** — Monte Carlo simulation engine with two distinct calculation methods:
  - **Standard (50:50)** — Equal odds model for unplayed matches.
  - **ELO-Weighted** — Dynamic team ELO rating calculated from season match performance (base 1500, K=32, 1.2x clean sweep multiplier) with game-by-game Bernoulli Bo3 sampling. Includes interactive ELO rating badges and formula tooltips.
- **Web Worker Architecture** — Simulations execute on a dedicated background thread with automatic debouncing and request cancellation, preventing UI thread blocking even at 1,000,000 iterations (runs above 100,000 ask for confirmation first).
- **Next Match Countdown & Live Badges** — Hero card showing the upcoming match with a live countdown timer (Days, Hours, Minutes, Seconds) and dynamic status badges (`LIVE MATCH`, `TODAY`, `NEXT MATCH`).
- **Interactive Schedule Editor** — Modify match scores to explore "what-if" scenarios. Filter by week or view all matches at once. Displays scheduled match times in the user's local timezone and day dates in group headers. Import/export schedule data as JSON.
- **Multi-League Support** — Switch between MPL ID, PH, MY, and MCC. Each league is accessible via URL (`/id`, `/ph`, `/my`, `/mcc`) with state persisted in localStorage.
- **Tiebreaker System** — Standings are resolved using official MPL tiebreakers: 1. Match wins → 2. Game differential → 3. Head-to-head match wins → 4. Head-to-head game differential.
- **Save as Image** — Export standings and probability tables as PNG images with compact, mobile-friendly rendering.
- **Dark / Light Theme** — System-aware theme toggle with smooth transitions.
- **Liquipedia Auto-Sync** — Automated sync script fetches match schedules, dates, and scores from [Liquipedia](https://liquipedia.net/mobilelegends/) via the OpenAPI v3 and updates local JSON data files.

## Tech Stack

| Layer        | Technology                                     |
| :----------- | :--------------------------------------------- |
| Framework    | React 19 + TypeScript                          |
| Build        | Vite 7                                         |
| Styling      | Tailwind CSS 4                                 |
| UI           | shadcn/ui (Radix UI primitives)                |
| Concurrency  | Web Worker (`simulation.worker.ts`)            |
| Image Export | html2canvas-pro (lazy-loaded)                  |
| Data Sync    | Liquipedia OpenAPI v3 (`liquipedia.ts`)        |
| CI/CD        | GitHub Actions (CI on push/PR + scheduled sync) |
| Deployment   | Cloudflare Pages                               |

## Project Structure

```
├── src/
│   ├── App.tsx                    # Main application with routing and state
│   ├── leagues.ts                 # League configuration (ID, PH, MY, MCC)
│   ├── teams.ts                   # Team definitions with logos
│   ├── schedule-{id,ph,my,mcc}.json # Match schedule, dates, and score data
│   ├── components/
│   │   ├── header.tsx             # League selector and theme toggle
│   │   ├── footer.tsx             # Liquipedia attribution
│   │   ├── standings/             # Standings table component
│   │   ├── probabilities/         # Playoff odds simulator component with ELO controls
│   │   ├── schedule/              # Schedule editor, match cards, and next match countdown
│   │   └── ui/                    # shadcn/ui base components
│   ├── hooks/
│   │   ├── use-simulation.ts      # Web Worker simulation hook (debouncing + cancellation)
│   │   └── use-save-as-image.ts   # Image export hook (html2canvas-pro)
│   ├── lib/
│   │   ├── standings.ts           # Standings calculation engine & tiebreakers
│   │   ├── simulation.ts          # Monte Carlo simulation engine (Standard & ELO)
│   │   ├── elo.ts                 # Dynamic ELO calculation & Bo3 Bernoulli simulation
│   │   └── date-utils.ts          # Localized date/time & live countdown utilities
│   ├── workers/
│   │   └── simulation.worker.ts   # Background Web Worker for Monte Carlo computation
│   └── types/
│       └── index.ts               # Shared TypeScript interfaces
├── liquipedia.ts                  # Liquipedia OpenAPI sync script
├── sync-mediawiki.ts / .py        # Legacy MediaWiki sync (local dev fallback)
└── .github/workflows/
    ├── ci.yml                     # Type check, lint, and build on push/PR
    └── sync.yml                   # Scheduled Liquipedia data sync
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

# Production build with sourcemaps (opt-in; not shipped by default)
BUILD_SOURCEMAP=true pnpm build
```

## Data Sync

Match schedules, dates, and scores are sourced directly from the official [Liquipedia OpenAPI v3](https://api.liquipedia.net/) (JSON API) and stored in `src/schedule-{id,ph,my,mcc}.json`. The sync script fetches configured leagues in a single batch request using `OR` conditions, normalizes team names, extracts match timestamps, and updates the JSON files with the latest results.

### Environment Variable

Set your Liquipedia API key in a `.env` file:

```env
LIQUIPEDIA_API_KEY=your_api_key_here
```

### Manual Sync

```bash
# Sync all leagues
pnpm sync

# Sync a specific league
pnpm sync --league id
pnpm sync --league ph
pnpm sync --league my
pnpm sync --league mcc

# Sync with custom API key
pnpm sync --apikey your_api_key_here

# Run silently without console output
pnpm sync --silent

# Preview without writing files
pnpm sync --dry-run

# Sync from a local response JSON file
pnpm sync --file match.json --league id

# Sync and auto commit + push
pnpm sync --push
```

> `--file` requires an explicit `--league <id|ph|my|mcc>`, because a saved API
> response contains the matches of a single league page.

### Legacy MediaWiki Sync (local development fallback)

`sync-mediawiki.ts` and `sync-mediawiki.py` are kept for local development when
you do not have access to the Liquipedia **LPDB / OpenAPI v3** (for example, no
API key). They scrape the public MediaWiki `api.php` endpoint instead, which
needs no credentials. They are not wired into any npm script or CI workflow —
run them directly with `node sync-mediawiki.ts`. The CLI (`liquipedia.ts`) is
the supported path for normal development and for CI.

Note that `src/lib/mediawiki.ts` is a *separate* browser-side implementation
used by the in-app "Live Sync" button; it also talks to `api.php` and has its
own `TEAM_MAP`.

### Automated Sync (GitHub Actions)

A [workflow](.github/workflows/sync.yml) runs on a cron schedule during match days (Fridays, Saturdays, and Sundays) and can also be triggered manually via `workflow_dispatch`.

Make sure to add `LIQUIPEDIA_API_KEY` to your repository secrets (**Settings → Secrets and variables → Actions → Repository secrets**).

### Continuous Integration

A [CI workflow](.github/workflows/ci.yml) runs `pnpm typecheck`, `pnpm lint`, and
`pnpm build` on every push to `main`/`dev` and on every pull request. There is no
test runner, so these three commands are the verification gate.

### Sync Rules

- Only **completed Bo3 matches** (where one team has reached 2 wins) are recorded. In-progress matches (`1-0`, `0-1`, `1-1`) remain `0-0` until decided.
- Match date and time are parsed in ISO UTC format and stored on each match object.
- `LAST_UPDATED` is set to the latest match timestamp, or current UTC time.
- `CURRENT_WEEK` is auto-detected as the first week containing unplayed matches. Once every match is played, it falls back to the final week of the schedule.
- Live sync verifies that a match ID still refers to the same fixture before applying a score. IDs are positional (`w{week}d{day}m{index}`), so if upstream reorders or reschedules matches the sync reports a conflict and applies nothing, rather than crediting a score to the wrong teams.

## License

Data provided by [Liquipedia](https://liquipedia.net/commons/Liquipedia:Copyrights) under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
