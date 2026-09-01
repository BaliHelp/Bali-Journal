import { SITE_URL } from '@/lib/site-config'

/**
 * Schedules a ONE-TIME delayed HTTP call via Upstash QStash - not a
 * recurring cron. Used to give a single HIGH-risk article exactly one
 * automatic re-check some time later, without polling/scanning every
 * article on a schedule (which would mean a periodic DB query hitting
 * this project's single pooled connection regardless of whether anything
 * actually needs checking).
 *
 * Requires QSTASH_TOKEN. If it's not set, this silently no-ops (logs a
 * warning) rather than throwing - the auto-recheck is a nice-to-have, not
 * something that should break the calling flow (e.g. a manual "Check
 * Fatality" click in the admin panel) if QStash isn't configured yet.
 */
export async function scheduleDelayedCall(path: string, delaySeconds: number): Promise<void> {
  const token = process.env.QSTASH_TOKEN
  if (!token) {
    console.warn(`QSTASH_TOKEN not set - skipping scheduled call to ${path} (would have fired in ${delaySeconds}s)`)
    return
  }

  const cronSecret = process.env.CRON_SECRET
  const destination = `${SITE_URL}${path}`
  // QSTASH_URL picks a specific regional cluster (matches the token, which
  // is region-scoped) - falls back to the global routing endpoint if unset.
  const qstashHost = process.env.QSTASH_URL || 'https://qstash.upstash.io'

  // The destination URL goes directly in the path, unencoded - QStash's
  // /v2/publish/{destination} expects the raw target URL there, not a
  // URL-encoded one (confirmed via a live 400: "invalid destination url:
  // endpoint has invalid scheme" when this was encodeURIComponent'd).
  const res = await fetch(`${qstashHost}/v2/publish/${destination}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Upstash-Delay': `${delaySeconds}s`,
      // QStash strips the "Upstash-Forward-" prefix and sends the rest as
      // a real header to our destination - this is how the destination
      // route authenticates the call as genuinely coming from QStash
      // (same CRON_SECRET convention as the existing /api/cron/* routes).
      ...(cronSecret ? { 'Upstash-Forward-Authorization': `Bearer ${cronSecret}` } : {}),
    },
    body: JSON.stringify({}),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`QStash publish failed (${res.status}): ${text}`)
  }
}
