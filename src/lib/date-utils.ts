import type { Match } from "../types"
import { isMatchPlayed } from "./standings"

export type MatchStatus = "PLAYED" | "LIVE" | "TODAY" | "UPCOMING" | "UNKNOWN"

export interface TimeRemaining {
  totalMs: number
  days: number
  hours: number
  minutes: number
  seconds: number
  isPast: boolean
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
 * Calculate match status: PLAYED, LIVE, TODAY, UPCOMING
 */
export function getMatchStatus(match: Match): MatchStatus {
  if (isMatchPlayed(match)) {
    return "PLAYED"
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
    .sort(
      (a, b) =>
        new Date(a.date!).getTime() - new Date(b.date!).getTime()
    )

  // Prioritize match currently LIVE or in the future
  const nextFuture = withValidDates.find(
    (m) => new Date(m.date!).getTime() + 2.5 * 60 * 60 * 1000 > now
  )

  if (nextFuture) {
    return nextFuture
  }

  // Fallback to the first unplayed match in schedule order
  return unplayed[0] || null
}

/**
 * Calculate time remaining from now until target date
 */
export function getTimeRemaining(targetDateStr?: string): TimeRemaining {
  if (!targetDateStr) {
    return {
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
    }
  }

  const targetDate = new Date(targetDateStr)
  if (isNaN(targetDate.getTime())) {
    return {
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
    }
  }

  const now = new Date().getTime()
  const totalMs = targetDate.getTime() - now
  const isPast = totalMs <= 0

  if (isPast) {
    return {
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
    }
  }

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
