// Shared, server-side persisted tracker state (checked steps) — the source of
// truth for /tracker across every visitor. Reads are public; writes require the
// tracker password once, then an HttpOnly cookie carries auth for future visits.
const { put } = require('@vercel/blob')
const crypto = require('crypto')

const BLOB_PATH = 'shinpo/state.json'
// Deterministic (no random suffix) — the same URL every write lands at. Read
// this directly instead of via list(), whose index lags a write by ~1 request.
const BLOB_URL = `${process.env.BLOB_BASE_URL}/${BLOB_PATH}`
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
  // The blob CDN caches by exact URL — bust it on every read so a fresh write
  // is never masked by a stale cached response.
  const res = await fetch(`${BLOB_URL}?v=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) return { done: [], updatedAt: null } // 404 = no writes yet
  return res.json()
}

async function writeState(state) {
  state.updatedAt = Date.now()
  await put(BLOB_PATH, JSON.stringify(state), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
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
