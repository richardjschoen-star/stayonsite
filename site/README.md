# StayonSite

Marketing site and client console for StayonSite, an AI software studio. React 19 + Vite + Tailwind v4, built on [BoardUI](https://www.boardui.com) free components, deployed as one Cloudflare Worker.

```sh
npm install
cp .dev.vars.example .dev.vars   # then set BETTER_AUTH_SECRET (openssl rand -hex 32)
npm run dev                      # http://localhost:5173
npm run db:local seed            # with dev running: apply migrations/ and add demo invites
npm test                         # authorization rules (worker/access.ts)
npm run build
```

Sign in locally at `/console/login` as `dev@stayon.site` (staff) or `client@example.com` (a client owner). Without `RESEND_API_KEY` the 6-digit code prints in the dev terminal.

## Marketing site

- `src/App.tsx`: nav, hero, ⌘K menu, footer; "Client login" links to `/console`
- `src/console.tsx`: the hero console artwork (sidebar, stats, live agent run, runs table)
- `src/capabilities.tsx`: the interactive service tiles
- `src/sections.tsx`: work, process, pricing, testimonial, FAQ, contact
- `src/process.ts`: the delivery phases (shown on the site) and the 11-step engagement the console runs
- `src/globe.tsx`: dot globe (Natural Earth land mask)
- `styles/brand.css`: the brand layer over BoardUI tokens (blue + the mark's yellow, Instrument Sans)
- `components/`, `styles/theme.css`, `styles/typography.css`: BoardUI source, installed with `npx boardui@latest add <name>`

## Client console (`/console`)

A project workspace shared by the StayonSite team and each client: home, inbox, my tasks, projects with process / board / list / table / calendar / timeline / files views, members, teams, activity, archive, settings and invoices. Each client company is a workspace; staff see all of them, clients see only theirs.

- **Engagement process:** projects started from the Engagement template walk 11 steps (inquiry → NDA → proposal → SOW and deposit → kickoff → discovery → prototype → production → handover → operate). NDA, proposal, SOW, go/no-go and handover end in a client sign-off: staff upload the document and request it, a client owner or admin signs or asks for changes, and the decision is recorded with name, time, IP and the exact file.
- **Auth:** [Better Auth](https://better-auth.com) in the Worker, invite-only. Email codes via Resend, plus Google and Microsoft when their keys are set. Okta (per-client SSO) is not wired yet: add `@better-auth/sso`.
- **Data:** D1 (`migrations/`), files in R2 under `<org>/<file id>`. Staff can mark tasks, comments and files internal; clients never receive them.

Where things live:

- `worker/index.ts`: routes `/api/contact`, `/api/auth/*`, `/api/portal/*`, and serves the console for every `/console/*` URL
- `worker/auth.ts`: Better Auth config and the invite gate; `worker/mail.ts`: Resend
- `worker/portal.ts`: the console API (snapshot, writes, sign-offs, uploads)
- `worker/access.ts`: who may see and do what, with `access.test.ts`
- `src/portal/`: the console app (`store.ts` snapshot + optimistic writes, `router.ts`, `shell.tsx`, `pages/`, `views/`, `overlays/`)

## Going live

1. Create a Google OAuth client (redirect `https://stayon.site/api/auth/callback/google`) and a multi-tenant Microsoft Entra app (redirect `/api/auth/callback/microsoft`; add the ID-token optional claims `email`, `verified_primary_email` and `verified_secondary_email`, or Microsoft sign-ins are rejected as unverified).
2. Verify `stayon.site` as a sending domain in Resend and create an API key.
3. Set the secrets with `cf workers secrets update`: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (`https://stayon.site`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `RESEND_API_KEY`.
4. Deploy (`npm run deploy`), then apply migrations to the D1 database: `cf d1 migrations apply <database id>`.
5. Bootstrap the first staff account: `INSERT INTO invite (id, email, name, org_id, role, invited_by, created_at, expires_at) VALUES ('first', 'you@stayon.site', 'You', NULL, 'staff', 'bootstrap', 0, 4102444800000)` with `cf d1 execute`, then sign in. Everyone after that is invited from the console.

`migrations/0001_auth.sql` is generated: with `npm run dev` running, `curl localhost:5173/api/dev/auth-sql` prints the SQL Better Auth needs (run it against a database that has the previous migrations to get only the difference).
