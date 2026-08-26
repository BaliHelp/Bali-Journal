// In-memory login rate limiter - no new infra (Redis, etc.) needed for a
// single-instance deployment. Keyed by IP+email so one attacker can't lock
// out a real user by spamming failed logins for their address, while still
// capping how fast any single (ip, email) pair can be tried.
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

interface Attempt {
    count: number
    firstAttemptAt: number
}

const attempts = new Map<string, Attempt>()

// Prevent unbounded growth - sweep expired entries occasionally.
function sweep() {
    const now = Date.now()
    for (const [key, entry] of attempts) {
        if (now - entry.firstAttemptAt > WINDOW_MS) attempts.delete(key)
    }
}

export function isRateLimited(key: string): boolean {
    const entry = attempts.get(key)
    if (!entry) return false
    if (Date.now() - entry.firstAttemptAt > WINDOW_MS) {
        attempts.delete(key)
        return false
    }
    return entry.count >= MAX_ATTEMPTS
}

export function recordFailedAttempt(key: string): void {
    if (Math.random() < 0.05) sweep()

    const entry = attempts.get(key)
    const now = Date.now()
    if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
        attempts.set(key, { count: 1, firstAttemptAt: now })
        return
    }
    entry.count++
}

export function clearAttempts(key: string): void {
    attempts.delete(key)
}
