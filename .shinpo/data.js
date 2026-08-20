window.SHINPO = {
  title: 'LightwellHQ Audit Report — Shinpo',
  subtitle: 'Live progress on lightwellhq.com audit fixes. Tick as you go — saved in this browser.',
  source: 'lightwell-audit-report.html (4.6/10.0, 2026-08-19)',
  milestones: [
    { id: 'mvp',  label: 'Score 8.0+',  blurb: 'Headers fixed, analytics live, metadata/perf trimmed — the fast, high-impact fixes' },
    { id: 'full', label: 'Score 10.0',  blurb: 'Everything above plus schema depth, content depth, and trust signals' },
  ],
  sections: [
    {
      id: 's1', n: 1, title: 'Security',
      blurb: 'Headers are configured but only served on the redirect, not the live page — one config move fixes it.',
      steps: [
        { id: 's1a', text: 'Move CSP/HSTS/X-Frame-Options/Referrer-Policy/Permissions-Policy off the redirect-only rule so they apply to every response (Apache: mod_headers block outside the :80 vhost)', owner: '👤', tier: 'mvp', estMin: 10, estMax: 20 },
        { id: 's1b', text: 'Verify with `curl -sI https://lightwellhq.com/` that all five headers appear on the 200 response, not just the 301', owner: '👤', tier: 'mvp', estMin: 5, estMax: 5 },
      ],
    },
    {
      id: 's2', n: 2, title: 'Analytics',
      blurb: 'Currently zero tracking of any kind — no pageviews, no events, no conversion data.',
      steps: [
        { id: 's2a', text: 'Install a privacy-friendly analytics tool (Plausible or Fathom — avoids a cookie-consent banner) for pageviews and referrers', owner: '👤', tier: 'mvp', estMin: 20, estMax: 30 },
        { id: 's2b', text: 'Add event tracking on quiz start, quiz complete, tier recommendation shown, and each "Book" click', owner: '🤝', tier: 'mvp', estMin: 30, estMax: 60 },
        { id: 's2c', text: 'Capture utm_source/utm_medium/referrer into the existing Netlify form payload alongside q1/q2/q3/tier', owner: '🤝', tier: 'mvp', estMin: 15, estMax: 25 },
        { id: 's2d', text: 'Add server-side conversion tracking (Meta CAPI / GA4 measurement protocol) since checkout happens off-domain on Contra', owner: '👤', tier: 'opt', estMin: 60, estMax: 120 },
      ],
    },
    {
      id: 's3', n: 3, title: 'SEO',
      blurb: 'Solid technical foundation; the gaps are truncated metadata, a render-blocking script, and thin content.',
      steps: [
        { id: 's3a', text: 'Trim &lt;title&gt; to ≤60 chars, e.g. "Lightwell | AI UX Diagnostics in 72 Hours"', owner: '🤝', tier: 'mvp', estMin: 5, estMax: 10 },
        { id: 's3b', text: 'Trim meta description to ≤155 chars, front-loading the value prop', owner: '🤝', tier: 'mvp', estMin: 5, estMax: 10 },
        { id: 's3c', text: 'Add `defer` to the three.js script tag, or lazy-init the hero shader after DOMContentLoaded / on an IntersectionObserver', owner: '🤝', tier: 'mvp', estMin: 15, estMax: 25 },
        { id: 's3d', text: 'Add 2-3 sample-deliverable screenshots (redacted findings report, annotated screen) with descriptive alt text', owner: '👤', tier: 'full', estMin: 30, estMax: 60 },
        { id: 's3e', text: 'Publish 3-5 supporting pages: a real case study, a methodology/"how it works" page, and educational posts — update sitemap', owner: '👤', tier: 'full', estMin: 240, estMax: 480 },
      ],
    },
    {
      id: 's4', n: 4, title: 'AI-SEO (AEO / GEO)',
      blurb: 'Weakest section relative to the business itself — nothing here makes the site legible to AI answer engines.',
      steps: [
        { id: 's4a', text: 'Publish /llms.txt: what Lightwell is, the three tiers with prices, key differentiators, links to top pages', owner: '🤝', tier: 'mvp', estMin: 20, estMax: 30 },
        { id: 's4b', text: 'Add FAQPage schema around the "which tier fits" content', owner: '🤝', tier: 'full', estMin: 15, estMax: 25 },
        { id: 's4c', text: 'Add standalone Person schema for the founder (sameAs LinkedIn/Contra) and top-level Organization schema', owner: '🤝', tier: 'full', estMin: 15, estMax: 25 },
        { id: 's4d', text: 'Publish one case study with a concrete, quotable outcome number — something an LLM can actually cite', owner: '👤', tier: 'full', estMin: 60, estMax: 120 },
      ],
    },
    {
      id: 's5', n: 5, title: 'Engagement & conversion',
      blurb: 'The qualifier-quiz → tier → checkout flow is good; the gaps are trust-building and silent failure handling.',
      steps: [
        { id: 's5a', text: 'Await the Netlify form fetch before opening the payment link; show inline success or "email frank@…" failure state', owner: '🤝', tier: 'mvp', estMin: 20, estMax: 40 },
        { id: 's5b', text: 'Add a visible "Complete your purchase in the new tab →" state on the page instead of leaving it static after checkout opens', owner: '🤝', tier: 'full', estMin: 15, estMax: 25 },
        { id: 's5c', text: 'Add 2-3 short testimonials (name/title/company, or anonymized) plus a preview of an actual sample report output', owner: '👤', tier: 'full', estMin: 60, estMax: 120 },
      ],
    },
  ],
}
