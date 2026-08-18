import ID from "./schedule-id.json"
import PH from "./schedule-ph.json"
import MY from "./schedule-my.json"
import { ID_TEAMS, PH_TEAMS, MY_TEAMS } from "./teams"
import type { LeagueConfig, Match } from "./types"

export const ID_LEAGUE_NAME = ID.LEAGUE_NAME
export const ID_CURRENT_WEEK = ID.CURRENT_WEEK
export const ID_ALL_MATCHES = ID.ALL_MATCHES as Match[]
export const PH_LEAGUE_NAME = PH.LEAGUE_NAME
export const PH_CURRENT_WEEK = PH.CURRENT_WEEK
export const PH_ALL_MATCHES = PH.ALL_MATCHES as Match[]
export const MY_LEAGUE_NAME = MY.LEAGUE_NAME
export const MY_CURRENT_WEEK = MY.CURRENT_WEEK
export const MY_ALL_MATCHES = MY.ALL_MATCHES as Match[]

export const LEAGUES: Record<string, LeagueConfig> = {
  ID: {
    id: "ID",
    name: "Indonesia",
    leagueName: ID_LEAGUE_NAME,
    currentWeek: ID_CURRENT_WEEK,
    allMatches: ID_ALL_MATCHES,
    teams: ID_TEAMS,
  },
  PH: {
    id: "PH",
    name: "Philippines",
    leagueName: PH_LEAGUE_NAME,
    currentWeek: PH_CURRENT_WEEK,
    allMatches: PH_ALL_MATCHES,
    teams: PH_TEAMS,
  },
  MY: {
    id: "MY",
    name: "Malaysia",
    leagueName: MY_LEAGUE_NAME,
    currentWeek: MY_CURRENT_WEEK,
    allMatches: MY_ALL_MATCHES,
    teams: MY_TEAMS,
  },
}

export const LEAGUE_OPTIONS = Object.values(LEAGUES).map((league) => ({
  value: league.id,
  label: league.name,
}))
