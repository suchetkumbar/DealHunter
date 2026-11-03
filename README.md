# SaleCrawler

Find local businesses that still run on paper. Pick a city and a niche and SaleCrawler maps every matching business near the city centre. It then audits each website for the things an AI or automation agency could sell them: online booking, chat or an AI assistant, a mobile-ready site, HTTPS, speed, analytics, a modern platform and recent updates.

Everything is free. There are no API keys and no paid services.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |

Requires Node.js 20.9 or newer.

## How it works

- **Business data:** [OpenStreetMap](https://www.openstreetmap.org/copyright).
  - Nominatim finds the city, then searches inside a ~6 km box around it, usually in 1–3 seconds.
  - If Nominatim finds nothing, a slower Overpass query (capped at 15 s) runs against several public mirrors in parallel.
  - Results are cached in memory for 10 minutes, and Nominatim calls are throttled to 1 per second, per their usage policy.
  - Resilience: transient Nominatim failures (network errors, 429, 5xx) are retried once.
  - If a refresh fails, cached answers up to 6 hours old are served instead.
  - The browser retries a failed search once before showing an error.
- **Website audit:** `src/lib/analyze.ts`.
  - The homepage is fetched server-side and parsed with cheerio.
  - Tools are detected from script, iframe and link targets rather than page text, which avoids false positives.
  - The scoring weights in `src/lib/scoring.ts` sum to 100. Opportunity = 100 − maturity.
  - Widgets that are injected only by JavaScript at runtime can be missed. The report says so.
- **Safety:** `src/lib/safe-fetch.ts`.
  - Only http(s) URLs are allowed.
  - Every DNS answer and every redirect hop is checked against private, loopback, link-local and metadata ranges.
  - 8 s timeout and 1.5 MB body cap.

## Project layout

```
src/app/page.tsx              UI shell: hero, survey scope, lead list, report
src/app/api/places/route.ts   GET  ?city=&niche=  → { center, businesses }
src/app/api/analyze/route.ts  POST { url|null }   → AnalysisReport
src/components/               SearchPanel, SurveyScope, LeadList, LeadReport
src/hooks/use-leads.ts        Search + audit state (keyed by id, abortable, 3 audits at a time)
src/lib/                      osm, analyze, scoring, safe-fetch, csv, types
src/lib/__tests__/            Vitest unit tests
```

## Deploying

The API routes use the Node.js runtime and have no native dependencies, so it deploys to Vercel or any Node host as is. For heavy use, run your own Nominatim/Overpass instance or a paid OSM provider, because the public endpoints are shared community resources.
