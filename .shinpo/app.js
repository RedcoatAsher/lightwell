/* lightwell shinpo — interactive logic, persistence, motion. */
(function () {
  'use strict'
  const T = window.SHINPO
  const KEY = 'lightwell-shinpo-v1'
  const C = 2 * Math.PI * 52 // ring circumference

  const allSteps = T.sections.flatMap((s) => s.steps.map((st) => ({ ...st, sec: s.id })))
  const isReq = (st) => st.tier !== 'opt' // required = mvp + full
  const reqSteps = allSteps.filter(isReq)
  const mvpSteps = allSteps.filter((st) => st.tier === 'mvp')
  // Steps seeded `done: true` in data.js are the source of truth — permanently
  // complete, never togglable in-session (see load()).
  const seeded = new Set(allSteps.filter((st) => st.done).map((st) => st.id))

  // ---- state ----
  let state = load()
  function load() {
    let raw = {}
    try { raw = JSON.parse(localStorage.getItem(KEY) || '{}') } catch { raw = {} }
    const done = new Set(raw.done || [])
    // Steps marked `done: true` in data.js are authoritatively complete (confirmed
    // applied/verified out-of-band) — always merge them in, on top of local ticks.
    T.sections.forEach((s) => s.steps.forEach((st) => { if (st.done) done.add(st.id) }))
    return { done, open: new Set(raw.open || null), savedAt: raw.savedAt }
  }
  function save() {
    state.savedAt = Date.now()
    localStorage.setItem(KEY, JSON.stringify({ done: [...state.done], open: [...state.open], savedAt: state.savedAt }))
    renderSavedAt()
  }
  // First run: open every not-yet-complete section.
  if (!localStorage.getItem(KEY)) {
    T.sections.forEach((s) => { if (!secComplete(s)) state.open.add(s.id) })
  }

  function secComplete(s) {
    const req = s.steps.filter(isReq)
    return req.length > 0 && req.every((st) => state.done.has(st.id))
  }

  // ---- theme ----
  const themeKey = 'lightwell-shinpo-theme'
  const root = document.documentElement
  root.dataset.theme = localStorage.getItem(themeKey) || 'dark'
  document.getElementById('themeBtn').onclick = () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(themeKey, root.dataset.theme)
  }

  // ---- ring gradient (inject into svg) ----
  const ringSvg = document.querySelector('.ring')
  const NS = 'http://www.w3.org/2000/svg'
  const defs = document.createElementNS(NS, 'defs')
  defs.innerHTML =
    '<linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="var(--grad-from)"/>' +
    '<stop offset="100%" stop-color="var(--grad-to)"/></linearGradient>'
  ringSvg.prepend(defs)

  // ---- header ----
  document.getElementById('title').textContent = 'LightwellHQ Audit Report'
  document.getElementById('subtitle').textContent = T.subtitle
  document.getElementById('src').textContent = T.source

  // ---- build milestones ----
  const msWrap = document.getElementById('milestones')
  T.milestones.forEach((m) => {
    const el = document.createElement('div')
    el.className = 'ms'
    el.dataset.id = m.id
    el.innerHTML =
      `<div class="ms-top"><b>${m.label}</b><small>${m.blurb}</small></div>` +
      `<div class="ms-bar"><i></i></div><span class="ms-pct">0%</span>`
    msWrap.appendChild(el)
  })

  // ---- build sections ----
  const secWrap = document.getElementById('sections')
  T.sections.forEach((s) => {
    const sec = document.createElement('section')
    sec.className = 'card sec'
    sec.dataset.id = s.id
    const tierTag = (t) => (t === 'mvp' ? '<span class="tag mvp">MVP</span>' : t === 'full' ? '<span class="tag full">FULL</span>' : '<span class="tag opt">OPT</span>')
    const [sLo, sHi] = sumEst(s.steps.filter(isReq))
    sec.innerHTML =
      `<div class="sec-head" role="button" tabindex="0" aria-expanded="false">
         <div class="sec-num">${s.n}</div>
         <div class="sec-title">
           <h3>${s.title}${sLo + sHi ? ` <span class="est">~${fmtRange(sLo, sHi)}</span>` : ''}</h3>
           <p>${s.blurb}</p>
         </div>
         <div class="sec-meta">
           <div class="mini-bar"><i></i></div>
           <span class="sec-count"></span>
           <span class="caret">▶</span>
         </div>
       </div>
       <div class="steps"><div class="steps-inner"><ul>
         ${s.steps.map((st, i) =>
           `<li class="step" data-id="${st.id}" data-owner="${st.owner}" data-tier="${st.tier}" style="--i:${i}" role="button" tabindex="0" aria-pressed="false">
              <span class="box"></span>
              <span class="step-text">${st.text}</span>
              <span class="step-tags"><span class="owner" data-o="${st.owner}">${st.owner}</span>${tierTag(st.tier)}</span>
            </li>`).join('')}
       </ul></div></div>`
    secWrap.appendChild(sec)

    const head = sec.querySelector('.sec-head')
    const toggle = () => { sec.classList.toggle('open'); state.open.has(s.id) ? state.open.delete(s.id) : state.open.add(s.id); head.setAttribute('aria-expanded', sec.classList.contains('open')); save() }
    head.addEventListener('click', toggle)
    head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } })

    sec.querySelectorAll('.step').forEach((li) => {
      const toggleStep = () => {
        const id = li.dataset.id
        if (seeded.has(id)) return // seeded done:true steps are permanently complete
        state.done.has(id) ? state.done.delete(id) : state.done.add(id)
        const d = state.done.has(id)
        li.classList.toggle('done', d); li.setAttribute('aria-pressed', d)
        save(); applyFilter(); refresh(true)
      }
      li.addEventListener('click', toggleStep)
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleStep() } })
    })
  })

  // ---- filters ----
  let filter = 'all'
  document.getElementById('filters').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b))
    filter = b.dataset.filter
    applyFilter()
  })
  function stepVisible(st) {
    if (filter === 'mvp') return st.tier === 'mvp'
    if (filter === 'open') return !state.done.has(st.id)
    if (filter === 'mine') return st.owner === '👤'
    return true
  }
  function applyFilter() {
    T.sections.forEach((s) => {
      const sec = secWrap.querySelector(`[data-id="${s.id}"]`)
      let shown = 0
      s.steps.forEach((st) => {
        const li = sec.querySelector(`.step[data-id="${st.id}"]`)
        const vis = stepVisible(st)
        li.style.display = vis ? '' : 'none'
        if (vis) shown++
      })
      sec.hidden = shown === 0
    })
  }

  // ---- render dynamic state ----
  function setRing(pct) {
    document.querySelector('.ring-fill').style.strokeDashoffset = C * (1 - pct / 100)
    document.getElementById('overallPct').textContent = Math.round(pct) + '%'
  }
  function pctOf(list) { return list.length ? (list.filter((st) => state.done.has(st.id)).length / list.length) * 100 : 0 }

  let prevMvp = mvpDone(), prevFull = fullDone()
  function mvpDone() { return mvpSteps.every((st) => state.done.has(st.id)) }
  function fullDone() { return reqSteps.every((st) => state.done.has(st.id)) }

  function refresh(animate) {
    const overall = pctOf(reqSteps)
    setRing(overall)
    document.getElementById('overallCount').textContent =
      `${reqSteps.filter((st) => state.done.has(st.id)).length} / ${reqSteps.length} steps`
    renderTime()

    // milestones
    const mvpPct = pctOf(mvpSteps), fullPct = pctOf(reqSteps)
    setMs('mvp', mvpPct); setMs('full', fullPct)

    // sections
    T.sections.forEach((s) => {
      const sec = secWrap.querySelector(`[data-id="${s.id}"]`)
      const req = s.steps.filter(isReq)
      const done = req.filter((st) => state.done.has(st.id)).length
      sec.querySelector('.mini-bar > i').style.width = (req.length ? (done / req.length) * 100 : 100) + '%'
      sec.querySelector('.sec-count').textContent = `${done}/${req.length}`
      sec.classList.toggle('complete', secComplete(s))
      sec.classList.toggle('open', state.open.has(s.id))
      sec.querySelector('.sec-head').setAttribute('aria-expanded', state.open.has(s.id))
      s.steps.forEach((st) => { const li = sec.querySelector(`.step[data-id="${st.id}"]`); const d = state.done.has(st.id); li.classList.toggle('done', d); li.setAttribute('aria-pressed', d) })
    })

    // milestone reached → celebrate
    if (animate) {
      const nowMvp = mvpDone(), nowFull = fullDone()
      if (nowFull && !prevFull) burst(260)
      else if (nowMvp && !prevMvp) burst(140)
      prevMvp = nowMvp; prevFull = nowFull
    }
  }
  function setMs(id, pct) {
    const el = msWrap.querySelector(`[data-id="${id}"]`)
    el.querySelector('.ms-bar > i').style.width = pct + '%'
    el.querySelector('.ms-pct').textContent = Math.round(pct) + '%'
    el.classList.toggle('done', pct >= 100)
  }

  // Estimated hands-on time, per-step: total = all non-optional steps;
  // remaining = unchecked non-optional steps. Rendered as ranges, human units.
  function sumEst(list) {
    return [list.reduce((a, st) => a + (st.estMin || 0), 0), list.reduce((a, st) => a + (st.estMax || 0), 0)]
  }
  function fmtMins(m) {
    if (m <= 0) return '0m'
    const h = Math.floor(m / 60), mm = m % 60
    return h ? (mm ? `${h}h ${mm}m` : `${h}h`) : `${mm}m`
  }
  function fmtRange(lo, hi) { return lo === hi ? fmtMins(lo) : `${fmtMins(lo)}–${fmtMins(hi)}` }
  function renderTime() {
    const [tLo, tHi] = sumEst(reqSteps)
    const [lo, hi] = sumEst(reqSteps.filter((st) => !state.done.has(st.id)))
    document.getElementById('overallTotal').textContent = `⏱ ~${fmtRange(tLo, tHi)} total`
    const el = document.getElementById('overallTime')
    el.textContent = lo + hi === 0 ? '⏱ done' : `⏱ ~${fmtRange(lo, hi)} left`
    el.classList.toggle('time-done', lo + hi === 0)
  }

  function renderSavedAt() {
    const el = document.getElementById('savedAt')
    el.textContent = state.savedAt ? 'Saved ' + new Date(state.savedAt).toLocaleString() : 'Not started'
  }

  // ---- reset ----
  document.getElementById('resetBtn').onclick = () => {
    if (!confirm('Reset all progress in this browser?')) return
    state.done.clear()
    seeded.forEach((id) => state.done.add(id)) // seeded steps stay complete
    localStorage.removeItem(KEY)
    document.querySelectorAll('.step.done').forEach((s) => s.classList.remove('done'))
    save(); applyFilter(); refresh(false)
  }

  // ---- confetti (hand-rolled) ----
  const cv = document.getElementById('confetti')
  const ctx = cv.getContext('2d')
  function fit() { cv.width = innerWidth; cv.height = innerHeight }
  addEventListener('resize', fit); fit()
  let parts = []
  const COLORS = ['#33D6C6', '#0B6E67', '#5FE6D8', '#63C58F', '#E0A23C']
  function burst(n) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (let i = 0; i < n; i++) {
      parts.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.34,
        vx: (Math.random() - 0.5) * 11, vy: Math.random() * -12 - 4,
        r: Math.random() * 5 + 3, c: COLORS[(Math.random() * COLORS.length) | 0],
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, life: 1,
      })
    }
    if (!raf) tick()
  }
  let raf = 0
  function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height)
    parts.forEach((p) => {
      p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr; p.life -= 0.008
      ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.rot)
      ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 1.4); ctx.restore()
    })
    parts = parts.filter((p) => p.life > 0 && p.y < cv.height + 40)
    raf = parts.length ? requestAnimationFrame(tick) : 0
    if (!raf) ctx.clearRect(0, 0, cv.width, cv.height)
  }

  // ---- boot ----
  applyFilter()
  renderSavedAt()
  // animate the ring from 0 on first paint
  requestAnimationFrame(() => requestAnimationFrame(() => refresh(false)))
})()
