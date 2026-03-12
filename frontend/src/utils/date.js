/**
 * NZ timezone date utilities
 * All dates fixed to Pacific/Auckland timezone
 */

const NZ_TZ = 'Pacific/Auckland'

/**
 * Get today's date string in YYYY-MM-DD format (NZ timezone)
 */
export function getTodayNZ() {
  return new Date().toLocaleDateString('en-CA', { timeZone: NZ_TZ })
}

/**
 * Get current NZ time as Date object
 */
export function getNowNZ() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: NZ_TZ }))
}

/**
 * Format a Date object to YYYY-MM-DD string in NZ timezone
 */
export function formatDateNZ(date) {
  return date.toLocaleDateString('en-CA', { timeZone: NZ_TZ })
}

/**
 * Get Monday of current week in NZ timezone (YYYY-MM-DD)
 */
export function getMondayNZ() {
  const now = getNowNZ()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  return formatDateNZ(monday)
}

/**
 * Get Sunday of current week in NZ timezone (YYYY-MM-DD)
 */
export function getSundayNZ() {
  const now = getNowNZ()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? 0 : 7)
  const sunday = new Date(now)
  sunday.setDate(diff)
  return formatDateNZ(sunday)
}
