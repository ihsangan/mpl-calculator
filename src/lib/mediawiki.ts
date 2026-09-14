import type { Match } from "@/types"

export interface ParsedMatch {
  id: string
  teamA: string
  teamB: string
  scoreA: number
  scoreB: number
}

export interface MatchScoreChange {
  id: string
  teamA: string
  teamB: string
  oldScore: string
  newScore: string
}

export interface MergeResult {
  mergedMatches: Match[]
  updatedCount: number
  changes: MatchScoreChange[]
}

export interface MediaWikiSyncResult {
  matches: ParsedMatch[]
  timestamp: string
  title: string
}

export interface LeagueWikiConfig {
  id: string
  name: string
  title: string
}

export const API_BASE_URL = "https://liquipedia.net/mobilelegends/api.php"

export const LEAGUES_WIKI_CONFIG: Record<string, LeagueWikiConfig> = {
  ID: {
    id: "ID",
    name: "Indonesia",
    title: "MPL/Indonesia/Season_18/Regular_Season",
  },
  PH: {
    id: "PH",
    name: "Philippines",
    title: "MPL/Philippines/Season_18/Regular_Season",
  },
  MY: {
    id: "MY",
    name: "Malaysia",
    title: "MPL/Malaysia/Season_18/Regular_Season",
  },
}

export const TEAM_MAP: Record<string, string> = {
  // --- INDONESIA (ID) ---
  "team liquid id": "TLID",
  "liquid id": "TLID",
  liquid: "TLID",
  "onic esports": "ONIC",
  "dewa united esports": "DEWA",
  "dewa united": "DEWA",
  "alter ego": "AE",
  "alter ego esports": "AE",
  "bigetron by vitality": "BTR",
  bigetron: "BTR",
  "evos esports": "EVOS",
  "natus vincere": "NAVI",
  "geek fam id": "GEEK",
  "geek fam": "GEEK",
  "rrq hoshi": "RRQ",

  // --- PHILIPPINES (PH) ---
  "ap.bren": "APBR",
  apbren: "APBR",
  bren: "APBR",
  "aurora gaming ph": "RORA",
  "aurora ph": "RORA",
  aurora: "RORA",
  "team falcons ph": "FLCN",
  "falcons ph": "FLCN",
  falcons: "FLCN",
  flcp: "FLCN",
  "onic philippines": "ONIC",
  "onic ph": "ONIC",
  onph: "ONIC",
  "omega esports": "OMG",
  "smart omega": "OMG",
  omega: "OMG",
  "team liquid ph": "TLPH",
  "liquid ph": "TLPH",
  "twisted minds ph": "TWIS",
  "twisted minds": "TWIS",
  twisted: "TWIS",
  twph: "TWIS",
  "tnc pro team": "TNC",

  // --- MALAYSIA (MY) ---
  "ac esports": "AC",
  "bigetron my by vit": "BTRM",
  "bigetron my": "BTRM",
  "invictus gaming": "iG",
  invictus: "iG",
  ig: "iG",
  "team rey": "TR",
  rey: "TR",
  "team vamos": "VMS",
  vamos: "VMS",
  "rrq tora": "RRQ",
  rrqt: "RRQ",
  "selangor red giants": "SRG",
  "selangor red giant": "SRG",
  "team flash": "FL",
  flash: "FL",
}

/**
 * Normalize raw team name from Liquipedia to project team ID.
 */
export function normalizeTeam(name: string): string {
  const clean = name.trim().toLowerCase()
  return TEAM_MAP[clean] || name.trim().toUpperCase()
}

/**
 * Parse all matches, days, teams, and scores from Liquipedia wikitext.
 * Respects the Bo3 rule: only completed Bo3 matches (score reaches 2) are saved as played.
 */
export function parseScheduleFromWikitext(wikitext: string): ParsedMatch[] {
  // Find all Week sections (e.g. ==={{HiddenSort|RS: Week 1}}=== or === Week 1 ===)
  const weekRegex = /==+.*?Week\s*(\d+).*?==+([\s\S]*?)(?===+.*?Week|$)/gi
  const weeks = [...wikitext.matchAll(weekRegex)]
  const allMatches: ParsedMatch[] = []

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
 * Fetch wikitext content and revision timestamp for a league from Liquipedia MediaWiki.
 * Uses origin=* for anonymous CORS in browser environments.
 */
export async function fetchMediaWikiLeague(
  leagueId: string,
  signal?: AbortSignal
): Promise<MediaWikiSyncResult> {
  const normalizedLeagueId = leagueId.toUpperCase()
  const config = LEAGUES_WIKI_CONFIG[normalizedLeagueId]
  if (!config) {
    throw new Error(`Unsupported league ID: ${leagueId}`)
  }

  const encodedTitle = encodeURIComponent(config.title)
  const url = `${API_BASE_URL}?action=query&prop=revisions&titles=${encodedTitle}&rvprop=content|timestamp&rvslots=main&format=json&origin=*`

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${response.statusText}`)
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
    throw new Error(`Liquipedia API error: ${data.error.info}`)
  }

  const pages = data.query?.pages || {}
  const pageEntry = Object.values(pages)[0]

  if (!pageEntry || !pageEntry.revisions || pageEntry.revisions.length === 0) {
    throw new Error(`No revision data found for league ${config.name}`)
  }

  const rev = pageEntry.revisions[0]
  const wikitext = rev.slots?.main?.["*"] || rev["*"] || ""
  const timestamp = rev.timestamp || new Date().toISOString()
  const rawTitle = pageEntry.title || config.title

  const matches = parseScheduleFromWikitext(wikitext)
  if (matches.length === 0) {
    throw new Error(`Failed to parse any matches from Liquipedia for ${config.name}`)
  }

  return {
    matches,
    timestamp,
    title: rawTitle,
  }
}

/**
 * Merge live match scores into existing match list, preserving metadata such as date and postponed status.
 */
export function mergeMatchesWithLive(
  currentMatches: Match[],
  liveMatches: ParsedMatch[]
): MergeResult {
  const liveMap = new Map<string, ParsedMatch>()
  for (const m of liveMatches) {
    liveMap.set(m.id, m)
  }

  let updatedCount = 0
  const changes: MatchScoreChange[] = []

  const mergedMatches = currentMatches.map((existing) => {
    const live = liveMap.get(existing.id)
    if (!live) return existing

    const oldScore = `${existing.scoreA}-${existing.scoreB}`
    const newScore = `${live.scoreA}-${live.scoreB}`

    if (existing.scoreA !== live.scoreA || existing.scoreB !== live.scoreB) {
      updatedCount++
      changes.push({
        id: existing.id,
        teamA: existing.teamA,
        teamB: existing.teamB,
        oldScore,
        newScore,
      })

      return {
        ...existing,
        scoreA: live.scoreA,
        scoreB: live.scoreB,
      }
    }

    return existing
  })

  return {
    mergedMatches,
    updatedCount,
    changes,
  }
}
