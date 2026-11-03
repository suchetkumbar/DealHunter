# Security

## Reporting a vulnerability

Please open a private security advisory on this repository (**Security → Report a vulnerability**) rather than a public issue. Include steps to reproduce. You'll get a response within a few days.

## What SaleCrawler exposes

| Surface | Risk | Controls |
| --- | --- | --- |
| `POST /api/analyze` fetches any URL a client sends | SSRF into private networks, open proxy, cost abuse | URL validation, private-IP blocking at **connect time**, port allowlist, redirect re-checks, timeouts, size cap, rate limits, BotID |
| `GET /api/places` calls OpenStreetMap | Quota exhaustion on shared community services | CDN caching, server cache with stale fallback, rate limits, BotID |
| The web page | XSS, clickjacking | Nonce-based CSP, frame-ancestors none, React escaping, no `dangerouslySetInnerHTML` |
| Browser storage (My leads) | Tampered or corrupt data | Every entry is validated with zod on load; invalid entries are dropped |
| Accounts (Neon Auth) | Credential stuffing, open redirects, cross-user data access | Hosted Better Auth (hashed passwords, sessions in signed httpOnly cookies), 10 attempts / 5 min per IP on sign-in and sign-up, generic sign-in errors, same-site-only `redirectTo`, every query scoped to the session user, FK cascade on account deletion, DB-level CHECK constraints |
| CSV exports | Spreadsheet formula injection | Cells starting with `= + - @` are neutralised |

Secrets (`DATABASE_URL`, `NEON_AUTH_COOKIE_SECRET`) live only in Vercel environment variables and the git-ignored `.env.local`, which `.vercelignore` keeps out of uploads. Server actions get Next.js's built-in Origin check against cross-site requests.

## Controls in the code

- **SSRF and network** (`src/lib/safe-fetch.ts`)
  - Only `http`/`https`, standard ports (80, 443, 8080, 8443) and no embedded credentials.
  - Every DNS answer must be public. Blocked ranges: RFC 1918, loopback, link-local/metadata `169.254.0.0/16`, CGNAT, IPv6 ULA/link-local, multicast and reserved.
  - The check runs **inside the connection's DNS lookup** (undici `Agent` with `connect.lookup`), so a DNS-rebinding answer can't swap in a private IP after validation.
  - Redirects are followed manually (max 3), and each hop is re-validated.
  - 8 s timeout, 1.5 MB body cap, and only `text/html` is parsed.
  - The TLS certificate check connects through the same validated lookup.
- **API guards** (`src/lib/guard.ts`)
  - Cross-site browser requests are rejected (`Sec-Fetch-Site` / `Origin`).
  - Per-IP token bucket: analyze 60/min, places 15/min, returning 429 with `Retry-After`.
  - Bodies over 4 KB are rejected with 413.
  - Vercel BotID runs in **basic** mode (free). Deep Analysis is a paid add-on and is deliberately not used.
  - Errors never include stack traces or upstream bodies.
- **Headers**
  - `src/proxy.ts` sets a per-request nonce CSP:
    - `script-src 'nonce-…' 'strict-dynamic'`
    - `object-src 'none'`
    - `base-uri 'self'`
    - `frame-ancestors 'none'`
  - `next.config.ts` adds:
    - HSTS (2 years, preload)
    - `nosniff`
    - `X-Frame-Options: DENY`
    - a strict `Referrer-Policy`
    - a locked-down `Permissions-Policy`
    - COOP/CORP `same-origin`
  - `X-Powered-By` is removed.
- **Supply chain**
  - Dependabot opens weekly update PRs.
  - CI runs lint, types, tests and build on every push.
  - CI fails on high or critical advisories in production dependencies.

## Edge protection on Vercel

Free on every plan, including Hobby:
- **DDoS mitigation** is automatic. It needs no setup.
- **Vercel BotID** runs in basic mode on both API routes. Real browsers pass. Scripts and headless browsers get 403.
- **Deployment Protection**: keep *Vercel Authentication* on for preview deployments. It's the default.
- **WAF custom rules** (deny / challenge / log): `scripts/firewall.sh` stages `Block exploit probes` (`/wp-admin`, `/.env`, `/.git/config`, …) in **log** mode.

Not available on Hobby:
- **WAF rate limiting.** The API returns `402 Rate limiting is not available for this plan`.
- On Hobby, rate limiting comes from the in-app per-IP limiter (`src/lib/guard.ts`) plus BotID.
- If you move to Pro, uncomment the two rate-limit rules in `scripts/firewall.sh`.

### Rolling out the firewall rule

1. `bash scripts/firewall.sh`, then review the diff and run `vercel firewall publish --yes` yourself.
2. Watch **Firewall → Traffic** in the dashboard for a few days. Confirm that only scanners match.
3. Switch it to enforce:
   ```bash
   vercel firewall rules edit "Block exploit probes" --action deny \
     --condition '{"type":"path","op":"inc","value":["/wp-admin","/wp-login.php","/.env","/.git/config","/phpmyadmin","/xmlrpc.php"]}' --yes
   vercel firewall publish --yes
   ```
4. If you're under active attack, enable **Attack Mode** from the dashboard or with `vercel firewall attack-mode enable`.

## Cost

This project is designed to run on the **Vercel Hobby plan at $0**:
- Hobby has hard limits: the project pauses rather than billing.
- Don't enable Observability Plus, BotID Deep Analysis, Speed Insights, Web Analytics or any Marketplace integration unless you accept their cost.
