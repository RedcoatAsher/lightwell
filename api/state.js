// Shared, server-side persisted tracker state (checked steps) — the source of
// truth for /tracker across every visitor. Reads are public; writes require the
// tracker password once, then an HttpOnly cookie carries auth for future visits.
//
// Uses Upstash Redis (strongly consistent) rather than Blob storage — Blob is
// CDN-backed and has real write-then-read propagation lag, which showed up as
// stale reads immediately after a write. Redis has none of that.
const { Redis } = require('@upstash/redis')
const crypto = require('crypto')

// The Vercel Marketplace Upstash integration names vars KV_REST_API_* rather
// than the UPSTASH_REDIS_REST_* that Redis.fromEnv() looks for.
const redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
const STATE_KEY = 'shinpo:state'
const COOKIE_NAME = 'shinpo_auth'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90 // 90 days — trusted client shouldn't re-enter it

function authToken() {
  // Deterministic token derived from the password itself — no extra secret to
  // provision. Anyone with the password can compute it; that's the trust model.
  return crypto.createHmac('sha256', process.env.SHINPO_PASSWORD || '').update('shinpo-session').digest('hex')
}

function parseCookies(header) {
  const out = {}
  if (!header) return out
  header.split(';').forEach((p) => {
    const i = p.indexOf('=')
    if (i === -1) return
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim())
  })
  return out
}

function isAuthed(req) {
  const cookies = parseCookies(req.headers.cookie)
  return cookies[COOKIE_NAME] === authToken()
}

function setAuthCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${authToken()}; Max-Age=${COOKIE_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`
  )
}

async function readState() {
  const state = await redis.get(STATE_KEY)
  return state || { done: [], updatedAt: null }
}

async function writeState(state) {
  state.updatedAt = Date.now()
  await redis.set(STATE_KEY, state)
  return state
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const state = await readState()
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(state)
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const { action, id, on, password } = body

  const cookieAuthed = isAuthed(req)
  const passwordOk = typeof password === 'string' && password === process.env.SHINPO_PASSWORD
  if (!cookieAuthed && !passwordOk) {
    return res.status(401).json({ error: 'password required' })
  }
  if (!cookieAuthed && passwordOk) setAuthCookie(res)

  const state = await readState()

  if (action === 'toggle') {
    if (!id) return res.status(400).json({ error: 'missing id' })
    const set = new Set(state.done)
    on ? set.add(id) : set.delete(id)
    state.done = [...set]
  } else if (action === 'reset') {
    state.done = []
  } else {
    return res.status(400).json({ error: 'unknown action' })
  }

  const saved = await writeState(state)
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json(saved)
}
