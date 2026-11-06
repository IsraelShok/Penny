# Penny security and privacy review (2026-11)

Scope: a single-user, local-first app. Next.js 16 server on 127.0.0.1, better-sqlite3 database
and encryption key in `SPENT_DATA_DIR`, bank scraping through Puppeteer, optional Telegram bot and AI.
Attackers considered: a hostile website open in the same browser, another device on the LAN,
malware or a person with read access to the disk or a backup, a cloud provider seeing prompts,
someone looking at the screen. Out of scope: an attacker running code as the same OS user (game over
for any local app without an OS-level secret store).

Legend: **Fixed** = changed in this commit. **OK** = already in place. **Open** = documented, not built.

## 1. Network exposure

| Item | Status |
|---|---|
| Bind address: `next dev/start -H 127.0.0.1`; Docker publishes to `127.0.0.1` | OK |
| DNS rebinding: `src/proxy.ts` rejects any `Host` not in the localhost list (`src/lib/host-guard.ts`, `SPENT_ALLOWED_HOSTS` to extend) | OK |
| CSRF: every POST/PUT/PATCH/DELETE under `/api` needs an `Origin` (or `Referer`) equal to the host; `Origin: null` is rejected | OK, now tested (`tests/proxy.test.ts`) |
| Cross-site reads and side-effect GETs (`<img src=/api/...>`): any `/api` request with `Sec-Fetch-Site: cross-site` or `same-site` is rejected | **Fixed** |
| No session/cookie auth, so there is no cookie to steal; the Host + Origin checks are the boundary | OK |

A LAN self-hoster who adds a host to `SPENT_ALLOWED_HOSTS` exposes the app without any login.
**Open:** an app lock (passphrase hashed with scrypt, signed HttpOnly session cookie checked in
`proxy.ts`, auto-lock after idle). It is the next most valuable item, required before anyone runs
Penny on a LAN. Not built here because it touches every route and the setup flow; the proxy is the
single place to add it.

## 2. XSS and browser hardening (`next.config.ts`)

| Item | Status |
|---|---|
| CSP `default-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'` | OK |
| `object-src 'none'`; dropped `fonts.googleapis.com`/`gstatic` (next/font self-hosts) and `api.anthropic.com`/`:11434` from `connect-src` (only the server calls them) | **Fixed** |
| `'unsafe-eval'` only in development | **Fixed** |
| `script-src 'unsafe-inline'` remains. Next 16 supports per-request nonces via the proxy, but that makes every page dynamic. Inline-script XSS still needs an injection point; React escapes output and the app uses no `dangerouslySetInnerHTML` on data. | Open (accepted) |
| `Referrer-Policy: no-referrer` (was `strict-origin-when-cross-origin`) | **Fixed** |
| `Permissions-Policy` extended (usb, serial, hid, bluetooth, midi, display-capture, topics) | **Fixed** |
| `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-DNS-Prefetch-Control: off` | **Fixed** |
| `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` | OK |

## 3. Secrets at rest (`src/server/lib/encryption.ts`)

Bank credentials, the AI API key and the Telegram token are AES-256-GCM encrypted with a random 32-byte
key in `<data>/.encryption-key` (mode 600 enforced on POSIX; Windows relies on profile ACLs).
The key sits next to the database, so a copy of the data folder (backup, synced folder, stolen disk)
decrypts everything. Status: OK for a casual disk reader, weak for backups.

**Open, recommended order:**
1. Store the key in the OS keychain (Windows DPAPI/Credential Manager, macOS Keychain, libsecret) with
   the file as fallback; this keeps backups of the data folder useless without the user's OS login.
2. Optional passphrase: derive a key-encryption key with `crypto.scrypt` (N=2^17, r=8, p=1, 16-byte salt)
   and wrap the data key with it; unlock on app start. Ties in with the app lock in section 1.

## 4. Database at rest

Transactions, balances, merchants and notes are plaintext SQLite. Column encryption would break
search, sorting and aggregation in SQL; SQLCipher (`better-sqlite3-multiple-ciphers`) is the clean
route and pairs with the key work above. **Open.** Until then the privacy page tells users to enable
BitLocker/FileVault.

## 5. Logs

New `src/server/lib/redact.ts` scrubs API keys, Telegram tokens, bearer values, `password/otp/id/...`
pairs, emails, card-number groups and any 5+ digit run (IDs, accounts, cards); dates and amounts stay.
Applied to scraper errors (replaces the older narrower `sanitizeError` rules), sync route and
orchestrator errors, AI batch failures (previously logged the raw error object, which can include
the provider response), the scheduler, and the bot. **Fixed** (`tests/redact.test.ts`).
Errors are logged as `name: message` only, no stacks.

## 6. Telegram bot (`src/server/bot`)

| Item | Status |
|---|---|
| Linking: one-time 48-bit random code, compared with `timingSafeEqual`, deleted after use | OK |
| Only the linked chat gets answers (`handleCommand` returns null for others) | OK |
| Token encrypted in settings | OK |
| Rate limit: Telegram itself rate-limits; non-owner chats get no reply, so there is nothing to brute force once linked | OK |
| Summaries include amounts. **Open:** a "hide amounts in Telegram" setting (send percentages and categories only); messages sit on Telegram's servers. |

## 7. AI providers (`src/server/ai`)

Local Ollama is the default. With a cloud provider, the categorisation prompt sends, per transaction,
the merchant description, currency, absolute amount and memo, plus category names. Now the description
and memo pass through `redact()`, so account, card and ID digits and emails never leave (they do not
help categorisation). **Fixed.** Names in transfer descriptions (for example a person's name in a bank
transfer) still go out. **Open:** explicit consent screen when switching to a cloud provider, and skipping
transfer-type transactions in cloud prompts. The "ask" feature sends aggregates; review it in the same pass.

## 8. Screen privacy

New privacy mode: an eye button in the sidebar footer and a switch on Settings, Privacy & security
blur every tabular number, figure and chart label. State is in a cookie so the server renders it and
numbers never flash on load. Screen readers still read the values (blur is visual only). **Fixed.**

## 9. Backups and exports

CSV/XLSX exports and copies of the data folder are plaintext and the folder copy includes the key.
**Open:** password-protected export (AES-GCM with an scrypt-derived key, `.penny` file) and a warning
on export. The privacy page already warns that a folder backup contains the key.

## 10. Deletion

Settings, Data has "delete everything" for transactions, sync history and category memory; bank
connections are removed per bank. The new Privacy & security page links to it. **Open:** one wipe that
also removes credentials, the bot, AI keys and the key file.

## 11. Dependencies (`npm audit --omit=dev`, 2026-11-06)

18 findings (13 high, 5 moderate), all transitive under the two bank scraper packages
(`israeli-bank-scrapers` -> puppeteer, ws, zod, proxy-agent, basic-ftp, ip-address;
`@sergienko4/israeli-bank-scrapers` -> camoufox-js, glob, minimatch, moment). Fixes need major
upgrades (`israeli-bank-scrapers@6.7.1`, `@sergienko4/israeli-bank-scrapers@8.6.0`) which change
scraper behaviour, so they are not applied here. Exposure is limited: the scraper only talks to bank
domains and the proxy/FTP paths are unused. Upgrade with a full sync test per bank.

## 12. Update check

`src/server/update/check.ts` calls `api.github.com` for the latest commit on the branch. It sends no
user data; GitHub sees the IP and a request per check. **Open:** a setting to turn it off.
