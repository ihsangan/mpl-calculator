import ID from "./schedule-id.json"
import PH from "./schedule-ph.json"
import MY from "./schedule-my.json"
import { ID_TEAMS, PH_TEAMS, MY_TEAMS } from "./teams"
import type { LeagueConfig, Match } from "./types"

export const LEAGUES: Record<string, LeagueConfig> = {
  ID: {
    id: "ID",
    name: "Indonesia",
    leagueName: ID.LEAGUE_NAME,
    currentWeek: ID.CURRENT_WEEK,
    allMatches: ID.ALL_MATCHES as Match[],
    teams: ID_TEAMS,
  },
  PH: {
    id: "PH",
    name: "Philippines",
    leagueName: PH.LEAGUE_NAME,
    currentWeek: PH.CURRENT_WEEK,
    allMatches: PH.ALL_MATCHES as Match[],
    teams: PH_TEAMS,
  },
  MY: {
    id: "MY",
    name: "Malaysia",
    leagueName: MY.LEAGUE_NAME,
    currentWeek: MY.CURRENT_WEEK,
    allMatches: MY.ALL_MATCHES as Match[],
    teams: MY_TEAMS,
  },
}

export const LEAGUE_OPTIONS = Object.values(LEAGUES).map((league) => ({
  value: league.id,
  label: league.name,
}))
