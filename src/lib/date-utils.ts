import type { Match } from "../types"
import { isMatchPlayed, getWeekFromId } from "./standings"

export type MatchStatus =
  "PLAYED" | "LIVE" | "TODAY" | "UPCOMING" | "POSTPONED" | "UNKNOWN"

export interface TimeRemaining {
  totalMs: number
  days: number
  hours: number
  minutes: number
  seconds: number
  isPast: boolean
}

/**
 * Check if a match has been postponed / rescheduled without confirmed schedule.
 */
export function isMatchPostponed(match: Match, allMatches?: Match[]): boolean {
  if (isMatchPlayed(match)) {
    return false
  }
  if (match.postponed) {
    return true
  }
  if (!match.date) {
    return false
  }

  // Detect outlier dates in the same week (> 7 days from median date of that week)
  if (allMatches && allMatches.length > 0) {
    const week = getWeekFromId(match.id)
    const weekMatches = allMatches.filter(
      (m) => getWeekFromId(m.id) === week && m.date
    )
    if (weekMatches.length > 0) {
      const sortedTimes = weekMatches
        .map((m) => new Date(m.date!).getTime())
        .sort((a, b) => a - b)
      const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)]
      const matchTime = new Date(match.date).getTime()
      const diffDays = Math.abs(matchTime - medianTime) / (1000 * 60 * 60 * 24)
      if (diffDays > 7) {
        return true
      }
    }
  }

  return false
}

/**
 * Pick date string for a day group header, skipping postponed matches
 */
export function getGroupDateLabel(
  groupMatches: Match[],
  allMatches?: Match[]
): string | null {
  if (!groupMatches || groupMatches.length === 0) return null

  const regularMatches = groupMatches.filter(
    (m) =>
      !isMatchPostponed(m, allMatches) &&
      m.date &&
      !isNaN(new Date(m.date).getTime())
  )

  const targetMatch =
    regularMatches[0] ||
    groupMatches.find((m) => m.date && !isNaN(new Date(m.date).getTime()))

  if (!targetMatch?.date) return null

  const date = new Date(targetMatch.date)
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

/**
 * Format match date into localized friendly string (e.g. "Jum, 14 Agu • 15:00" or "Fri, 14 Aug • 15:00")
 */
export function formatMatchDate(dateStr?: string): string {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ""

  const weekday = date.toLocaleDateString(undefined, { weekday: "short" })
  const day = date.toLocaleDateString(undefined, { day: "numeric" })
  const month = date.toLocaleDateString(undefined, { month: "short" })
  const time = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  return `${weekday}, ${day} ${month} • ${time}`
}

/**
 * Format only the time portion of a match (e.g. "15:00")
 */
export function formatMatchTime(dateStr?: string): string {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ""

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/**
 * Calculate match status: PLAYED, LIVE, TODAY, UPCOMING, POSTPONED
 */
export function getMatchStatus(
  match: Match,
  allMatches?: Match[]
): MatchStatus {
  if (isMatchPlayed(match)) {
    return "PLAYED"
  }

  if (isMatchPostponed(match, allMatches)) {
    return "POSTPONED"
  }

  if (!match.date) {
    return "UNKNOWN"
  }

  const matchDate = new Date(match.date)
  if (isNaN(matchDate.getTime())) {
    return "UNKNOWN"
  }

  const now = new Date()
  const diffMs = now.getTime() - matchDate.getTime()

  // Match started up to 2.5 hours ago and is still not marked as completed
  if (diffMs >= 0 && diffMs <= 2.5 * 60 * 60 * 1000) {
    return "LIVE"
  }

  // Check if today in local timezone
  const isSameDay =
    matchDate.getFullYear() === now.getFullYear() &&
    matchDate.getMonth() === now.getMonth() &&
    matchDate.getDate() === now.getDate()

  if (isSameDay) {
    return "TODAY"
  }

  if (matchDate.getTime() > now.getTime()) {
    return "UPCOMING"
  }

  return "UPCOMING"
}

/**
 * Find the closest next upcoming unplayed match
 */
export function getNextUpcomingMatch(matches: Match[]): Match | null {
  const unplayed = matches.filter((m) => !isMatchPlayed(m))
  if (unplayed.length === 0) return null

  const now = new Date().getTime()

  // Find unplayed matches with future or active live dates
  const withValidDates = unplayed
    .filter((m) => m.date && !isNaN(new Date(m.date).getTime()))
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())

  // Prioritize non-postponed match currently LIVE or in the future
  const nextFuture = withValidDates.find(
    (m) =>
      !isMatchPostponed(m, matches) &&
      new Date(m.date!).getTime() + 2.5 * 60 * 60 * 1000 > now
  )

  if (nextFuture) {
    return nextFuture
  }

  // Fallback: any future match (even if postponed)
  const anyFuture = withValidDates.find(
    (m) => new Date(m.date!).getTime() + 2.5 * 60 * 60 * 1000 > now
  )
  if (anyFuture) {
    return anyFuture
  }

  // Fallback to the first unplayed match in schedule order
  return unplayed[0] || null
}

/**
 * Calculate time remaining from now until target date
 */
export function getTimeRemaining(targetDateStr?: string): TimeRemaining {
  const PAST: TimeRemaining = {
    totalMs: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast: true,
  }

  if (!targetDateStr) return PAST

  const targetDate = new Date(targetDateStr)
  if (isNaN(targetDate.getTime())) return PAST

  const now = new Date().getTime()
  const totalMs = targetDate.getTime() - now

  if (totalMs <= 0) return PAST

  const seconds = Math.floor((totalMs / 1000) % 60)
  const minutes = Math.floor((totalMs / (1000 * 60)) % 60)
  const hours = Math.floor((totalMs / (1000 * 60 * 60)) % 24)
  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24))

  return {
    totalMs,
    days,
    hours,
    minutes,
    seconds,
    isPast: false,
  }
}
