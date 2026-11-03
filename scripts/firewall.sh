#!/usr/bin/env bash
# Stages SaleCrawler's Vercel WAF rules in LOG mode (nothing is blocked yet).
#
# Plan note: WAF custom rules (deny / challenge / log) are free on every plan, but WAF *rate limiting*
# is NOT available on Hobby (the API returns 402). On Hobby, rate limiting is handled in the app
# (src/lib/guard.ts: per-IP token bucket) plus Vercel BotID basic mode. On Pro, uncomment the
# rate-limit rules below.
#
# Prerequisites: `npm i -g vercel`, `vercel login`, `vercel link`.
# After running: review `vercel firewall diff`, then publish yourself with `vercel firewall publish --yes`.
set -euo pipefail

vercel firewall rules add "Block exploit probes" \
  --condition '{"type":"path","op":"inc","value":["/wp-admin","/wp-login.php","/.env","/.git/config","/phpmyadmin","/xmlrpc.php"]}' \
  --action log \
  --yes

# --- Pro plan only -----------------------------------------------------------------------------
# vercel firewall rules add "Rate limit analyze" \
#   --condition '{"type":"path","op":"eq","value":"/api/analyze"}' \
#   --condition '{"type":"method","op":"eq","value":"POST"}' \
#   --action rate_limit --rate-limit-window 60 --rate-limit-requests 120 \
#   --rate-limit-keys ip --rate-limit-action log --yes
# vercel firewall rules add "Rate limit places" \
#   --condition '{"type":"path","op":"eq","value":"/api/places"}' \
#   --action rate_limit --rate-limit-window 60 --rate-limit-requests 30 \
#   --rate-limit-keys ip --rate-limit-action log --yes

vercel firewall diff
echo
echo "Staged in log mode. Review the diff above, then run:  vercel firewall publish --yes"
