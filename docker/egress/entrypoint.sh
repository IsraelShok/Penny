#!/bin/sh
# Turns allowlist.txt (+ PENNY_EGRESS_EXTRA, comma separated) into anchored regexes:
# "bank.co.il" admits bank.co.il and any subdomain of it, nothing else.
set -eu
{
  sed 's/#.*//' /etc/egress/allowlist.txt
  printf '%s\n' "${PENNY_EGRESS_EXTRA:-}" | tr ',' '\n'
} | tr -d ' \t\r' | tr 'A-Z' 'a-z' | grep -E '^[a-z0-9.-]+$' \
  | sed 's/\./\\./g; s/.*/(^|\\.)&$/' > /tmp/filter
echo "egress: $(wc -l < /tmp/filter) allowed domains"

socat TCP-LISTEN:41234,fork,reuseaddr TCP:penny:41234 &
exec tinyproxy -d -c /etc/egress/tinyproxy.conf
