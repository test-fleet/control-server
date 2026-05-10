/**
 * Builds a cron expression anchored to the creation time so that firing
 * intervals stay consistent. E.g. created at 3:33 with a 10-minute frequency
 * produces "3/10 * * * *", firing at :03, :13, :23, :33, :43, :53 every hour.
 *
 * @param {number} frequencyMinutes - Interval in minutes (1, 5, 10, 15, 30, 60, 180, 360, 720, 1440)
 * @param {Date}   [createdAt]      - Anchor time (defaults to now)
 * @returns {string} cron expression
 */
function buildCronSchedule(frequencyMinutes, createdAt = new Date()) {
  const now = new Date(createdAt)
  const minute = now.getMinutes()
  const hour = now.getHours()

  if (frequencyMinutes === 1) return '* * * * *'

  if (frequencyMinutes < 60) {
    const anchor = minute % frequencyMinutes
    return `${anchor}/${frequencyMinutes} * * * *`
  }

  if (frequencyMinutes === 60) {
    return `${minute} * * * *`
  }

  if (frequencyMinutes === 1440) {
    return `${minute} ${hour} * * *`
  }

  // 3h, 6h, 12h — anchor to creation hour
  const hourFreq = Math.floor(frequencyMinutes / 60)
  const anchorHour = hour % hourFreq
  return `${minute} ${anchorHour}/${hourFreq} * * *`
}

/**
 * Parses a cron expression produced by buildCronSchedule back into a
 * frequency value in minutes.
 *
 * @param {string} cron
 * @returns {number} frequency in minutes, or 5 as a safe default
 */
function detectFrequency(cron) {
  if (!cron) return 5
  const trimmed = cron.trim()
  if (trimmed === '* * * * *') return 1

  const parts = trimmed.split(' ')
  const minPart = parts[0]
  const hourPart = parts[1]

  // Sub-hour: "anchor/freq * * * *"
  if (minPart.includes('/') && hourPart === '*') {
    return parseInt(minPart.split('/')[1])
  }

  // Hourly: "minute * * * *"
  if (!minPart.includes('/') && hourPart === '*') {
    return 60
  }

  // Multi-hour: "minute anchor/hourFreq * * *"
  if (hourPart && hourPart.includes('/')) {
    return parseInt(hourPart.split('/')[1]) * 60
  }

  // Daily: "minute hour * * *"
  return 1440
}

module.exports = { buildCronSchedule, detectFrequency }
