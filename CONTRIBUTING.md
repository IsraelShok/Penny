# Contributing to Penny

Thanks for helping. Penny handles people's bank data, so the bar is: correct, private, and tested.

## Set up

```bash
git clone https://github.com/Sergey-Bar/Penny.git
cd Penny
npm install
npm run dev        # http://127.0.0.1:3000
```

Node.js 22 or newer. Before you open a PR:

```bash
npx tsc --noEmit
npm run lint
npm test               # unit tests (Vitest)
npx playwright test    # end-to-end, optional for small changes
```

## Good first places

- **A bank:** add it to `BANK_PROVIDERS` in `src/lib/types.ts` and map it in `src/server/scrapers/index.ts`.
- **An AI provider:** implement `AIProvider` from `src/server/ai/types.ts` and register it in `src/server/ai/factory.ts`.
- **Israeli numbers:** tax brackets, ceilings and rates live in `src/lib/il-defaults.ts`, each with its year and source. Updates with an official source are especially welcome.
- **A language:** add `<locale>.json` under `src/i18n/messages/` with the keys of `en.json`, and register it in `src/i18n/routing.ts`.

## Rules

- TypeScript strict. No `any` without a comment saying why.
- Every new pure function gets a Vitest test.
- UI text goes in both `he.json` and `en.json`. Hebrew text does not use the product name.
- Commits follow Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Comments explain *why*, not *what*.
- Never commit real bank data, passwords, account numbers, or screenshots that show them.

## Security

Found a vulnerability? Report it privately as described in [SECURITY.md](SECURITY.md), not in an issue.
