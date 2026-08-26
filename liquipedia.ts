#!/usr/bin/env node
/**
 * Liquipedia OpenAPI Match Schedule & Score Synchronizer
 * Fetches match results via the official Liquipedia OpenAPI v3 (JSON API)
 * and synchronizes schedule and scores for MPL Indonesia (ID), Philippines (PH), and Malaysia (MY).
 */

import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_ENDPOINT = "https://api.liquipedia.net/api/v3/match"
const DEFAULT_USER_AGENT =
  "MPL-Sync-Script/1.0 (https://mpl.isan.eu.org/; me@isan.eu.org)"

export interface LeagueConfig {
  name: string
  page: string
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

// Liquipedia OpenAPI v3 match object typing
export interface ApiMatch {
  match2id?: string
  match2bracketid?: string
  match2bracketdata?: {
    header?: string
    inheritedheader?: string
    title?: string
    matchIndex?: number
    type?: string
  }
  finished?: number
  pagename?: string
  match2opponents?: Array<{
    id?: number
    type?: string
    name?: string
    score?: number
    status?: string
    placement?: number
    teamtemplate?: {
      name?: string
      shortname?: string
      bracketname?: string
      page?: string
    }
  }>
  match2games?: Array<{
    winner?: string
    date?: string
    status?: string
    extradata?: {
      timestamp?: number
      dateexact?: boolean
    }
  }>
}

export interface ApiResponse {
  result?: ApiMatch[]
  error?: string
  message?: string
}

export const LEAGUES_CONFIG: Record<string, LeagueConfig> = {
  id: {
    name: "Indonesia",
    page: "MPL/Indonesia/Season_18/Regular_Season",
    file: path.join(__dirname, "src", "schedule-id.json"),
    defaultLeagueName: "MPL Indonesia Season 18",
  },
  ph: {
    name: "Philippines",
    page: "MPL/Philippines/Season_18/Regular_Season",
    file: path.join(__dirname, "src", "schedule-ph.json"),
    defaultLeagueName: "MPL Philippines Season 18",
  },
  my: {
    name: "Malaysia",
    page: "MPL/Malaysia/Season_18/Regular_Season",
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
 * Sleep helper for rate-limiting delays.
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Normalize raw team name from Liquipedia to project team ID.
 */
export function normalizeTeam(name?: string, shortname?: string): string {
  if (shortname) {
    const cleanShort = shortname.trim().toLowerCase()
    if (TEAM_MAP[cleanShort]) return TEAM_MAP[cleanShort]
  }
  if (name) {
    const cleanName = name.trim().toLowerCase()
    if (TEAM_MAP[cleanName]) return TEAM_MAP[cleanName]
  }
  return (shortname || name || "").trim().toUpperCase()
}

/**
 * Extract week number from match object / bracket data.
 * Checks bracketindex, title, next, match2id, or match2bracketid.
 */
export function extractWeekNumber(
  bdata?: ApiMatch["match2bracketdata"],
  match2id?: string,
  bracketId?: string
): number {
  if (bdata) {
    if (typeof bdata.bracketindex === "number") {
      return bdata.bracketindex + 1
    }
    if (bdata.title) {
      const tMatch = bdata.title.match(/Week\s*(\d+)/i)
      if (tMatch) return parseInt(tMatch[1], 10)
    }
    if (bdata.next) {
      const nMatch = bdata.next.match(/W(\d+)/i)
      if (nMatch) return parseInt(nMatch[1], 10)
    }
  }
  const idStr = bracketId || match2id || ""
  const bMatch = idStr.match(/W(\d+)/i)
  if (bMatch) return parseInt(bMatch[1], 10)

  return 1
}

/**
 * Extract day number from inheritedheader or header.
 */
export function extractDayNumber(
  inheritedHeader?: string,
  header?: string
): number {
  const text = inheritedHeader || header || ""
  const dMatch = text.match(/Day\s*(\d+)/i)
  return dMatch ? parseInt(dMatch[1], 10) : 1
}

/**
 * Fetch matches for a league using Liquipedia OpenAPI v3.
 */
export async function fetchLeagueMatches(
  pageName: string,
  apiKey: string,
  userAgent: string = DEFAULT_USER_AGENT
): Promise<ApiMatch[]> {
  const params = new URLSearchParams({
    wiki: "mobilelegends",
    conditions: `[[pagename::${pageName}]]`,
    query: "match2bracketdata,match2opponents,match2games,date",
    limit: "100",
  })

  const url = `${API_ENDPOINT}?${params.toString()}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Apikey ${apiKey}`,
      "User-Agent": userAgent,
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(
      `Liquipedia API HTTP ${response.status}: ${response.statusText} ${errorText}`
    )
  }

  const data = (await response.json()) as ApiResponse

  if (data.error || data.message) {
    throw new Error(`Liquipedia API Error: ${data.error || data.message}`)
  }

  return data.result || []
}

/**
 * Parse OpenAPI match results into standard MatchData array.
 */
export function parseApiMatches(apiMatches: ApiMatch[]): MatchData[] {
  const dayMatchCount: Record<string, number> = {}
  const parsedMatches: MatchData[] = []

  for (const m of apiMatches) {
    const bdata = m.match2bracketdata || {}
    const weekNum = extractWeekNumber(bdata, m.match2id, m.match2bracketid)
    const dayNum = extractDayNumber(bdata.inheritedheader, bdata.header)

    const dayKey = `w${weekNum}d${dayNum}`
    dayMatchCount[dayKey] = (dayMatchCount[dayKey] || 0) + 1
    const mInDay = dayMatchCount[dayKey]

    const opps = m.match2opponents || []
    const opp1 = opps[0] || {}
    const opp2 = opps[1] || {}

    const teamA = normalizeTeam(opp1.name, opp1.teamtemplate?.shortname)
    const teamB = normalizeTeam(opp2.name, opp2.teamtemplate?.shortname)

    let scoreA =
      typeof opp1.score === "number"
        ? opp1.score
        : parseInt(String(opp1.score || 0), 10) || 0
    let scoreB =
      typeof opp2.score === "number"
        ? opp2.score
        : parseInt(String(opp2.score || 0), 10) || 0

    // Count map winners from match2games if available
    const games = m.match2games || []
    if (games.length > 0) {
      let s1 = 0
      let s2 = 0
      for (const g of games) {
        if (g.winner === "1") s1++
        else if (g.winner === "2") s2++
      }
      if (s1 > 0 || s2 > 0) {
        scoreA = s1
        scoreB = s2
      }
    }

    // Only accept decided Bo3 matches where one team has reached 2 wins.
    // Incomplete/in-progress matches (e.g. 1-0, 0-1, 1-1) remain 0-0 (unplayed).
    if (Math.max(scoreA, scoreB) < 2) {
      scoreA = 0
      scoreB = 0
    }

    const matchId = `w${weekNum}d${dayNum}m${mInDay}`

    parsedMatches.push({
      id: matchId,
      teamA,
      teamB,
      scoreA,
      scoreB,
    })
  }

  return parsedMatches
}

/**
 * Process API matches for a league and update its JSON file.
 */
export function processLeagueMatches(
  leagueKey: string,
  apiMatches: ApiMatch[],
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

  const parsedMatches = parseApiMatches(apiMatches)
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

  // Find latest played match timestamp if available or fallback to current UTC time
  let latestMatchTimestamp = ""
  for (const m of apiMatches) {
    for (const g of m.match2games || []) {
      if (g.winner && g.date) {
        // e.g. "2026-08-14 08:00:00" -> ISO string
        const parsedDate = new Date(g.date.replace(" ", "T") + "Z")
        if (!isNaN(parsedDate.getTime())) {
          const iso = parsedDate.toISOString().replace(/\.\d{3}Z$/, "Z")
          if (!latestMatchTimestamp || iso > latestMatchTimestamp) {
            latestMatchTimestamp = iso
          }
        }
      }
    }
  }

  const lastUpdated =
    latestMatchTimestamp ||
    existingData.LAST_UPDATED ||
    new Date().toISOString().replace(/\.\d{3}Z$/, "Z")

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

    const commitMsg = `chore(data): sync league schedule and scores from Liquipedia OpenAPI\n\nUpdated: ${relPaths.join(", ")}`
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
      file: {
        type: "string",
        short: "f",
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
Usage: node liquipedia.ts [options]

Options:
  -l, --league <id|ph|my|all>  League to sync (default: all)
  -f, --file <path>           Use local JSON response file (e.g. match.json) instead of API request
  --push                      Automatically git commit and push modified JSON files
  --dry-run                   Fetch and parse without writing to files
  -h, --help                  Show help
`)
    return
  }

  const leagueArg = (args.league || "all").toLowerCase()
  const leaguesToSync =
    leagueArg === "all" ? ["id", "ph", "my"] : [leagueArg]

  const apiKey = process.env.LIQUIPEDIA_API_KEY || ""
  const changedFiles: string[] = []

  // Check if a local file was provided (e.g. match.json)
  if (args.file) {
    const filePath = path.resolve(args.file)
    console.log(`Reading match data from local file: ${filePath}`)
    const fileContent = fs.readFileSync(filePath, "utf-8")
    const data = JSON.parse(fileContent) as ApiResponse
    const matches = data.result || []

    const targetLeague = leaguesToSync[0] || "id"
    const result = processLeagueMatches(
      targetLeague,
      matches,
      Boolean(args["dry-run"])
    )
    if (result.isModified && !args["dry-run"]) {
      changedFiles.push(result.filePath)
    }
  } else {
    if (!apiKey) {
      console.error(
        "Error: LIQUIPEDIA_API_KEY environment variable is required."
      )
      console.error(
        "Please set LIQUIPEDIA_API_KEY in your .env file or environment."
      )
      console.error("Tip: To test with a local response file, use: node liquipedia.ts --file match.json")
      process.exit(1)
    }

    for (let i = 0; i < leaguesToSync.length; i++) {
      const league = leaguesToSync[i]
      const cfg = LEAGUES_CONFIG[league]
      if (!cfg) {
        console.error(
          `Error: Unknown league '${league}'. Supported: ${Object.keys(LEAGUES_CONFIG).join(", ")}`
        )
        continue
      }

      if (i > 0) {
        console.log("\nWaiting 1 second before next request...")
        await sleep(1000)
      }

      try {
        console.log(
          `\n[${cfg.name.toUpperCase()}] Fetching matches for ${cfg.page} via Liquipedia OpenAPI...`
        )
        const apiMatches = await fetchLeagueMatches(cfg.page, apiKey, DEFAULT_USER_AGENT)
        const result = processLeagueMatches(
          league,
          apiMatches,
          Boolean(args["dry-run"])
        )
        if (result.isModified && !args["dry-run"]) {
          changedFiles.push(result.filePath)
        }
      } catch (error) {
        console.error(`\nError processing league '${league}': ${error}`)
      }
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
