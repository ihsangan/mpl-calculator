#!/usr/bin/env node
/**
 * Liquipedia Match Schedule & Score Synchronizer (TypeScript Edition)
 * Fetches match results and revision timestamps from Liquipedia MediaWiki Revisions API
 * and synchronizes schedule and scores for MPL Indonesia (ID), Philippines (PH), and Malaysia (MY).
 */

import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_BASE_URL = "https://liquipedia.net/mobilelegends/api.php"
const DEFAULT_USER_AGENT =
  "MPL-Sync-Script/1.0 (https://mpl.isan.eu.org/; me@isan.eu.org)"

export interface LeagueConfig {
  name: string
  title: string
  file: string
  defaultLeagueName: string
}

export interface MatchData {
  id: string
  teamA: string
  teamB: string
  scoreA: number
  scoreB: number
}

export interface ScheduleJson {
  LEAGUE_NAME: string
  CURRENT_WEEK: number
  LAST_UPDATED: string
  ALL_MATCHES: MatchData[]
}

export interface PageInfo {
  wikitext: string
  timestamp: string
  rawTitle: string
}

export const LEAGUES_CONFIG: Record<string, LeagueConfig> = {
  id: {
    name: "Indonesia",
    title: "MPL/Indonesia/Season_18/Regular_Season",
    file: path.join(__dirname, "src", "schedule-id.json"),
    defaultLeagueName: "MPL Indonesia Season 18",
  },
  ph: {
    name: "Philippines",
    title: "MPL/Philippines/Season_18/Regular_Season",
    file: path.join(__dirname, "src", "schedule-ph.json"),
    defaultLeagueName: "MPL Philippines Season 18",
  },
  my: {
    name: "Malaysia",
    title: "MPL/Malaysia/Season_18/Regular_Season",
    file: path.join(__dirname, "src", "schedule-my.json"),
    defaultLeagueName: "MPL Malaysia Season 18",
  },
}

// Map Liquipedia team names to project team IDs across ID, PH, and MY
export const TEAM_MAP: Record<string, string> = {
  // --- INDONESIA (ID) ---
  "team liquid id": "TLID",
  tlid: "TLID",
  "liquid id": "TLID",
  liquid: "TLID",
  onic: "ONIC",
  "onic esports": "ONIC",
  "fnatic onic": "ONIC",
  "dewa united esports": "DEWA",
  "dewa united": "DEWA",
  dewa: "DEWA",
  "alter ego": "AE",
  "alter ego esports": "AE",
  ae: "AE",
  "bigetron by vitality": "BTR",
  "bigetron vitality": "BTR",
  "bigetron esports": "BTR",
  bigetron: "BTR",
  btr: "BTR",
  evos: "EVOS",
  "evos esports": "EVOS",
  "evos glory": "EVOS",
  "natus vincere": "NAVI",
  navi: "NAVI",
  "geek fam id": "GEEK",
  "geek fam": "GEEK",
  geek: "GEEK",
  "rrq hoshi": "RRQ",
  rrq: "RRQ",

  // --- PHILIPPINES (PH) ---
  "ap.bren": "APBR",
  apbren: "APBR",
  bren: "APBR",
  "aurora gaming ph": "RORA",
  "aurora gaming": "RORA",
  "aurora ph": "RORA",
  aurora: "RORA",
  rora: "RORA",
  "team falcons ph": "FLCN",
  "falcons ph": "FLCN",
  falcons: "FLCN",
  flcn: "FLCN",
  "onic philippines": "ONIC",
  "onic ph": "ONIC",
  "fnatic onic ph": "ONIC",
  onph: "ONIC",
  "omega esports": "OMG",
  "smart omega": "OMG",
  omega: "OMG",
  omg: "OMG",
  "team liquid ph": "TLPH",
  "liquid ph": "TLPH",
  tlph: "TLPH",
  "twisted minds ph": "TWIS",
  "twisted minds": "TWIS",
  twisted: "TWIS",
  twis: "TWIS",
  "tnc pro team": "TNC",
  tnc: "TNC",

  // --- MALAYSIA (MY) ---
  "ac esports": "AC",
  ac: "AC",
  "bigetron my by vit": "BTRM",
  "bigetron my": "BTRM",
  btrm: "BTRM",
  "invictus gaming": "iG",
  invictus: "iG",
  ig: "iG",
  "team rey": "TR",
  rey: "TR",
  tr: "TR",
  "team vamos": "VMS",
  vamos: "VMS",
  vms: "VMS",
  "rrq tora": "RRQ",
  rrqt: "RRQ",
  "selangor red giants": "SRG",
  "selangor red giant": "SRG",
  srg: "SRG",
  "team flash": "FL",
  flash: "FL",
  fl: "FL",
}

/**
 * Normalize raw team name from Liquipedia to project team ID.
 */
export function normalizeTeam(name: string): string {
  const clean = name.trim().toLowerCase()
  return TEAM_MAP[clean] || name.trim().toUpperCase()
}

/**
 * Normalize page title for consistent matching (spaces and underscores).
 */
export function normalizeTitle(title: string): string {
  return title.replace(/ /g, "_").trim().toLowerCase()
}

/**
 * Fetch wikitext content and revision timestamp for multiple page titles in a single HTTP request.
 */
export async function fetchPagesBatch(
  titles: string[],
  userAgent: string = DEFAULT_USER_AGENT
): Promise<Record<string, PageInfo>> {
  const titlesParam = titles.join("|")
  const encodedTitles = encodeURIComponent(titlesParam)
  const url = `${API_BASE_URL}?action=query&prop=revisions&titles=${encodedTitles}&rvprop=content|timestamp&rvslots=main&format=json`

  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      "Accept-Encoding": "gzip",
    },
  })

  if (!response.ok) {
    throw new Error(
      `HTTP Error ${response.status}: ${response.statusText}`
    )
  }

  const data = (await response.json()) as {
    error?: { info: string }
    query?: {
      pages?: Record<
        string,
        {
          title?: string
          revisions?: Array<{
            timestamp?: string
            slots?: { main?: { "*"?: string } }
            "*"?: string
          }>
        }
      >
    }
  }

  if (data.error) {
    throw new Error(`Liquipedia API Error: ${data.error.info}`)
  }

  const pages = data.query?.pages || {}
  const results: Record<string, PageInfo> = {}

  for (const [pid, pdata] of Object.entries(pages)) {
    if (pid === "-1") {
      console.warn(
        `Warning: Page '${pdata.title || ""}' not found on Liquipedia`
      )
      continue
    }

    const rawTitle = pdata.title || ""
    const revs = pdata.revisions || []
    if (revs.length === 0) continue

    const rev = revs[0]
    const timestamp = rev.timestamp || ""
    const content = rev.slots?.main?.["*"] || rev["*"] || ""

    results[normalizeTitle(rawTitle)] = {
      wikitext: content,
      timestamp,
      rawTitle,
    }
  }

  return results
}

/**
 * Parse all matches, days, teams, and scores from Liquipedia wikitext.
 */
export function parseScheduleFromWikitext(wikitext: string): MatchData[] {
  // Find all Week sections (e.g. ==={{HiddenSort|RS: Week 1}}=== or === Week 1 ===)
  const weekRegex = /==+.*?Week\s*(\d+).*?==+([\s\S]*?)(?===+.*?Week|$)/gi
  const weeks = [...wikitext.matchAll(weekRegex)]
  const allMatches: MatchData[] = []

  for (const [, weekStr, content] of weeks) {
    const weekNum = parseInt(weekStr, 10)

    // Map match indices to Day numbers (e.g. |M1header=Day 1|M3header=Day 2|M6header=Day 3)
    const headerRegex = /\|M(\d+)header=Day\s*(\d+)/gi
    const headers = [...content.matchAll(headerRegex)]
    const dayStarts: Record<number, number> = Object.fromEntries(
      headers.map((h) => [parseInt(h[1], 10), parseInt(h[2], 10)])
    )

    let currentDay = 1
    const dayMatchCount: Record<number, number> = {}

    // Split content by match templates: |M1={{Match ...
    const parts = content.split(/\|M(\d+)=\{\{Match/)
    for (let i = 1; i < parts.length; i += 2) {
      const mNum = parseInt(parts[i], 10)
      const mBody = parts[i + 1]

      if (dayStarts[mNum] !== undefined) {
        currentDay = dayStarts[mNum]
      }

      dayMatchCount[currentDay] = (dayMatchCount[currentDay] || 0) + 1
      const mInDay = dayMatchCount[currentDay]

      // Extract opponent teams
      const opp1Match = mBody.match(/opponent1=\{\{TeamOpponent\|([^|\n}]+)/)
      const opp2Match = mBody.match(/opponent2=\{\{TeamOpponent\|([^|\n}]+)/)

      const t1 = normalizeTeam(opp1Match ? opp1Match[1] : "")
      const t2 = normalizeTeam(opp2Match ? opp2Match[1] : "")

      // Extract map winners to compute scores
      const mapRegex = /\|map\d+=\{\{Map[\s\S]*?\}\}/g
      const maps = mBody.match(mapRegex) || []

      let score1 = 0
      let score2 = 0

      for (const mp of maps) {
        const winnerMatch = mp.match(/\|winner=([12])/)
        if (winnerMatch) {
          if (winnerMatch[1] === "1") score1++
          else if (winnerMatch[1] === "2") score2++
        }
      }

      // Only accept decided Bo3 matches where one team has reached 2 wins.
      // Incomplete/in-progress matches (e.g. 1-0, 0-1, 1-1) remain 0-0 (unplayed).
      if (Math.max(score1, score2) < 2) {
        score1 = 0
        score2 = 0
      }

      const matchId = `w${weekNum}d${currentDay}m${mInDay}`

      allMatches.push({
        id: matchId,
        teamA: t1,
        teamB: t2,
        scoreA: score1,
        scoreB: score2,
      })
    }
  }

  return allMatches
}

/**
 * Process wikitext and revision timestamp for a league and update its JSON file.
 */
export function processLeagueData(
  leagueKey: string,
  wikitext: string,
  revisionTimestamp: string,
  dryRun: boolean = false
): {
  isModified: boolean
  filePath: string
  updatedCount: number
  totalMatches: number
} {
  const config = LEAGUES_CONFIG[leagueKey.toLowerCase()]
  if (!config) {
    throw new Error(`Unknown league: ${leagueKey}`)
  }

  const targetFile = config.file
  const leagueName = config.name

  const parsedMatches = parseScheduleFromWikitext(wikitext)
  console.log(`\n[${leagueName.toUpperCase()}] Parsed ${parsedMatches.length} matches`)

  if (parsedMatches.length === 0) {
    throw new Error(`No matches could be parsed for ${leagueName}`)
  }

  // Load existing JSON file if present
  let existingData: ScheduleJson
  if (fs.existsSync(targetFile)) {
    existingData = JSON.parse(fs.readFileSync(targetFile, "utf-8"))
  } else {
    existingData = {
      LEAGUE_NAME: config.defaultLeagueName,
      CURRENT_WEEK: 1,
      LAST_UPDATED: "",
      ALL_MATCHES: [],
    }
  }

  const existingMatches = new Map<string, MatchData>()
  for (const m of existingData.ALL_MATCHES || []) {
    existingMatches.set(m.id, m)
  }

  let updatedCount = 0
  let matchupChangedCount = 0
  let playedCount = 0
  const finalMatches: MatchData[] = []

  console.log("=".repeat(65))
  console.log(
    `${"MATCH ID".padEnd(10)} ${"MATCHUP".padEnd(25)} ${"OLD".padEnd(10)} ${"NEW".padEnd(10)} STATUS`
  )
  console.log("=".repeat(65))

  for (const match of parsedMatches) {
    const mId = match.id
    const oldMatch = existingMatches.get(mId)

    const oldScore = oldMatch ? `${oldMatch.scoreA}-${oldMatch.scoreB}` : "N/A"
    const newScore = `${match.scoreA}-${match.scoreB}`

    const isPlayed = match.scoreA > 0 || match.scoreB > 0
    if (isPlayed) playedCount++

    const matchupChanged = Boolean(
      oldMatch &&
        (oldMatch.teamA !== match.teamA || oldMatch.teamB !== match.teamB)
    )
    const scoreChanged = Boolean(
      !oldMatch ||
        oldMatch.scoreA !== match.scoreA ||
        oldMatch.scoreB !== match.scoreB
    )

    let status = "UNCHANGED"
    if (matchupChanged) {
      matchupChangedCount++
      status = "MATCHUP CHANGED"
    } else if (scoreChanged) {
      updatedCount++
      status = oldMatch ? "SCORE UPDATED" : "NEW MATCH"
    }

    if (matchupChanged || scoreChanged || isPlayed) {
      const matchup = `${match.teamA} vs ${match.teamB}`
      console.log(
        `${mId.padEnd(10)} ${matchup.padEnd(25)} ${oldScore.padEnd(10)} ${newScore.padEnd(10)} ${status}`
      )
    }

    finalMatches.push(match)
  }

  console.log("=".repeat(65))

  // Determine current week (first week with unplayed matches, or maximum week)
  let currentWeek = 1
  for (const m of finalMatches) {
    if (m.scoreA === 0 && m.scoreB === 0) {
      const weekPart = m.id.split("d")[0].substring(1)
      currentWeek = parseInt(weekPart, 10)
      break
    }
  }

  // Use Liquipedia revision timestamp for LAST_UPDATED
  const lastUpdated =
    revisionTimestamp || new Date().toISOString().replace(/\.\d{3}Z$/, "Z")

  // Check if there are actual modifications compared to file on disk
  const isModified =
    updatedCount > 0 ||
    matchupChangedCount > 0 ||
    finalMatches.length !== (existingData.ALL_MATCHES || []).length ||
    existingData.CURRENT_WEEK !== currentWeek ||
    existingData.LAST_UPDATED !== lastUpdated

  const outputData: ScheduleJson = {
    LEAGUE_NAME: existingData.LEAGUE_NAME || config.defaultLeagueName,
    CURRENT_WEEK: currentWeek,
    LAST_UPDATED: lastUpdated,
    ALL_MATCHES: finalMatches,
  }

  if (!dryRun) {
    fs.writeFileSync(
      targetFile,
      JSON.stringify(outputData, null, 2) + "\n",
      "utf-8"
    )
    console.log(`[${leagueName.toUpperCase()}] Written to ${targetFile}`)
    console.log(`[${leagueName.toUpperCase()}] Current Week: Week ${currentWeek}`)
    console.log(`[${leagueName.toUpperCase()}] Last Updated: ${lastUpdated}`)
  } else {
    console.log(
      `[DRY RUN] [${leagueName.toUpperCase()}] No changes written to ${targetFile}`
    )
  }

  console.log(
    `[${leagueName.toUpperCase()}] Played: ${playedCount}/${finalMatches.length} | Updates: ${updatedCount + matchupChangedCount}`
  )

  return {
    isModified,
    filePath: targetFile,
    updatedCount: updatedCount + matchupChangedCount,
    totalMatches: finalMatches.length,
  }
}

/**
 * Stage modified JSON files, commit, and push to remote.
 */
export function gitCommitAndPush(changedFiles: string[]): void {
  if (changedFiles.length === 0) {
    console.log("\nNo files modified. Skipping git commit & push.")
    return
  }

  console.log("\n" + "=".repeat(65))
  console.log("GIT COMMIT & PUSH")
  console.log("=".repeat(65))

  const relPaths = changedFiles.map((p) => path.relative(__dirname, p))
  console.log(`Staging files: ${relPaths.join(", ")}`)

  try {
    const addRes = spawnSync("git", ["add", ...changedFiles], {
      cwd: __dirname,
      stdio: "inherit",
    })
    if (addRes.status !== 0) {
      console.error("Git add failed")
      return
    }

    const commitMsg = `chore(data): sync league schedule and scores from Liquipedia\n\nUpdated: ${relPaths.join(", ")}`
    console.log("Committing changes...")
    const commitRes = spawnSync("git", ["commit", "-m", commitMsg], {
      cwd: __dirname,
      encoding: "utf-8",
    })

    if (commitRes.status !== 0) {
      if (
        commitRes.stdout?.includes("nothing to commit") ||
        commitRes.stderr?.includes("nothing to commit")
      ) {
        console.log("Working tree clean (no new changes to commit).")
        return
      }
      console.error(`Commit error:\n${commitRes.stderr || commitRes.stdout}`)
      return
    }

    console.log(commitRes.stdout?.trim())

    console.log("Pushing to remote...")
    const pushRes = spawnSync("git", ["push"], {
      cwd: __dirname,
      stdio: "inherit",
    })

    if (pushRes.status === 0) {
      console.log("Git push successful! 🚀")
    } else {
      console.error("Git push failed!")
    }
  } catch (error) {
    console.error(`Git operation failed: ${error}`)
  }
}

export async function main() {
  const rawArgs = process.argv.slice(2).filter((a) => a !== "--")
  const { values: args } = parseArgs({
    args: rawArgs,
    options: {
      league: {
        type: "string",
        short: "l",
        default: "all",
      },
      push: {
        type: "boolean",
        default: false,
      },
      "dry-run": {
        type: "boolean",
        default: false,
      },
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
    },
    allowPositionals: true,
  })

  if (args.help) {
    console.log(`
Usage: node sync.ts [options]

Options:
  -l, --league <id|ph|my|all>  League to sync (default: all)
  --push                      Automatically git commit and push modified JSON files
  --dry-run                   Fetch and parse without writing to files
  -h, --help                  Show help
`)
    return
  }

  const leagueArg = (args.league || "all").toLowerCase()
  const leaguesToSync =
    leagueArg === "all" ? ["id", "ph", "my"] : [leagueArg]

  // Collect page titles to fetch in a single batch request
  const titles = leaguesToSync.map((k) => {
    const cfg = LEAGUES_CONFIG[k]
    if (!cfg) {
      throw new Error(
        `Unknown league '${k}'. Supported: ${Object.keys(LEAGUES_CONFIG).join(", ")}`
      )
    }
    return cfg.title
  })

  console.log(
    `Fetching ${titles.length} league page(s) from Liquipedia in 1 request...`
  )
  const batchData = await fetchPagesBatch(titles, DEFAULT_USER_AGENT)
  console.log(
    `Successfully received data for ${Object.keys(batchData).length} page(s)`
  )

  const changedFiles: string[] = []

  for (const league of leaguesToSync) {
    const cfg = LEAGUES_CONFIG[league]
    const titleKey = normalizeTitle(cfg.title)
    const pageInfo = batchData[titleKey]

    if (!pageInfo) {
      console.error(
        `Error: Missing API data for league '${league}' (title: ${cfg.title})`
      )
      continue
    }

    try {
      const result = processLeagueData(
        league,
        pageInfo.wikitext,
        pageInfo.timestamp,
        Boolean(args["dry-run"])
      )
      if (result.isModified && !args["dry-run"]) {
        changedFiles.push(result.filePath)
      }
    } catch (error) {
      console.error(`\nError processing league '${league}': ${error}`)
    }
  }

  if (args.push && !args["dry-run"]) {
    gitCommitAndPush(changedFiles)
  }
}

// Execute main if run directly
main().catch((err) => {
  console.error(`\nFatal Error: ${err.message || err}`)
  process.exit(1)
})
