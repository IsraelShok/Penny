# Connecting an AI agent over MCP

Penny ships a small [MCP](https://modelcontextprotocol.io/) server, so Claude, ChatGPT or any
agent that speaks MCP can ask about the household's money in plain words: which subscriptions got
more expensive, where a household month went, what is coming up before payday.

It is deliberate about what it can do:

- **Read-only.** Every tool asks the running app over its local HTTP API. There is no tool that
  writes, categorizes, syncs or deletes anything.
- **Local.** It is a stdio process, not a port. Nothing leaves the machine except the calls it makes
  to `127.0.0.1`, and the app must already be running.
- **No passwords.** It uses the same local API the browser uses, so it works only where the app
  itself is reachable. It never sees the lock PIN or a bank login.

## With the app lock on

The lock normally refuses every request that has no unlocked browser session. So that an agent can
still read, the app keeps a random token in its data folder (`mcp-token`, readable only by your
user) and the MCP server sends it with each call. The token opens the read-only routes listed
under Tools, with `GET` only, and nothing else: no page, no settings, no backup or export, no bank
logins, no write. It works whether or not the app is currently unlocked, because none of those
routes needs the key to the saved logins. Anyone who can read the data folder could already read
the database file itself, so the token gives them nothing new.

The server looks for the token in the app's data folder: `PENNY_DATA_DIR` if set, the desktop
app's folder if `PENNY_INSTALL=desktop`, otherwise `data/` next to `scripts/`. The file appears
the first time a locked app refuses a call; the server then retries by itself. To revoke the
token, delete the file: the app writes a new one.

When the app has separate user accounts (`/access`), MCP access is not available: every request
then needs a signed-in user, and the token does not stand in for one.

## Tools

| Tool | What it answers |
|---|---|
| `penny_overview` | Income, spending, net, savings rate and the breakdown by category for a month, quarter, half year or year |
| `penny_transactions` | Search by date range, free text or kind, newest first |
| `penny_budgets` | This household month against the monthly target, and every category budget with what is left |
| `penny_net_worth` | Net worth, liquid assets, liabilities, deferred tax and the largest holdings |
| `penny_upcoming` | Planned purchases and their next payments, including overdue ones |
| `penny_balance_forecast` | The expected bank balance over the next 90 days, its lowest point and whether it goes below zero |
| `penny_cash_ahead` | What is free to spend until the next payday, after the card bills due first |
| `penny_cashflow_health` | Whether the cash flow is healthy, and the warning signs found |
| `penny_insights` | Recurring charges with price changes, expected card bills, unusual spending this month |
| `penny_pension` | Imported pension reports with total savings, and connected funds with their last sync |
| `penny_insurance` | Policies with monthly cost and renewal month, and insurance-looking charges with no policy |
| `penny_sync_status` | Whether a sync is running, and when the next automatic one is due |

They read `GET /api/overview`, `/api/transactions`, `/api/summary`, `/api/assets`, `/api/planned`,
`/api/balance-forecast`, `/api/cash-ahead`, `/api/cashflow-health`, `/api/insights`,
`/api/pension`, `/api/pension/report`, `/api/insurance` and `/api/activity`.

## Run it

The app must be running (the Penny service, `npm start`, or `npm run dev`). Then:

```bash
npm run mcp
```

A normal run prints nothing: it waits for JSON-RPC messages on stdin.

| Environment variable | Default | What it does |
|---|---|---|
| `PENNY_BASE_URL` | `http://127.0.0.1:41234` | Where the app answers. `npm run dev` serves port 3000. |
| `PENNY_WORKSPACE_ID` | the default workspace | Reads a specific household workspace |
| `PENNY_DATA_DIR` | `data/` in the checkout | The app's data folder, where the lock token is. Set it to what the app uses. |
| `PENNY_INSTALL` | | `desktop` reads the token from the desktop app's data folder |

## Claude Desktop

Add this to `claude_desktop_config.json` (Settings → Developer → Edit Config) and restart Claude:

```json
{
  "mcpServers": {
    "penny": {
      "command": "node",
      "args": ["/absolute/path/to/Penny/scripts/mcp.mjs"]
    }
  }
}
```

On Windows use forward slashes or doubled backslashes in the path.

## Claude Code

```bash
claude mcp add penny -- node /absolute/path/to/Penny/scripts/mcp.mjs
```

## Any other MCP client

Point it at a stdio server whose command is `node` and whose arguments are the absolute path of
`scripts/mcp.mjs`. Server name `penny`, version `0.3.0`. It answers `initialize`, `tools/list`,
`tools/call` and `ping`, and it handles the `2024-11-05`, `2025-03-26` and `2025-06-18` protocol
versions.

## Notes

- Amounts are in shekels, rounded, with spending negative.
- Category names are whatever the household named them, in its own language.
- The tools read the app's own endpoints, so a household month that starts on the 10th is respected
  the same way the dashboard respects it.
- Running it against the demo (`npm run demo`, then `PENNY_BASE_URL=http://127.0.0.1:3000`) is a
  safe way to try it without touching real data.
