# Proposal Reviewer

Pre-submission review of research proposals to ANRF, AR&DB, NRB, DRDO, ISRO (RESPOND), VGST and MNRE.

Faculty enter their profile and the proposal, upload the proposal text (PDF or Word), and get:

- eligibility and compliance checks for the chosen call (pass / warn / fail)
- a readiness score across eight dimensions, weighted per call: PI track record, domain expertise, novelty, feasibility and TRL plan, budget, impact and economic viability, mission alignment, proposal completeness
- ranked suggestions, and an optional expert-panel review written by Claude
- Word and PDF review reports

The R&D cell reviews proposals before they go to the agency: comment, request changes, approve. Faculty then record submission and the sanction outcome, so the dashboard can compare readiness scores with real results.

## Workflow

Draft → With R&D cell → Changes requested / Approved to submit → Submitted to agency → Sanctioned / Not sanctioned. Transitions are defined in `shared/src/workflow.ts`.

## Roles

- **Faculty**: own proposals and profile.
- **R&D cell** (`rd`): sees every proposal that has left draft, comments, requests changes, approves; sees the dashboard.
- **Admin**: everything, plus user roles, password resets and rule reloads. Emails in `ADMIN_EMAILS` become admins on sign-up; if `ADMIN_EMAILS` is empty, the first account becomes admin.

## Project layout

```
rules/agencies/*.json   agency and scheme rules (edit these for new calls)
shared/src/             scoring engine, workflow, Claude prompt (used by web and server)
shared/test/            tests for rules and scoring
server/src/             Express API: auth, proposals, uploads, Claude review, reports
server/migrations/      SQL migrations, applied automatically at start-up
web/src/                React front end
docs/ADDING_A_SCHEME.md how to add agencies, schemes and checks
render.yaml             Render deployment blueprint
```

## Run locally

Needs Node 20+ and PostgreSQL.

```bash
npm install
cp .env.example .env         # set DATABASE_URL etc.
export $(grep -v '^#' .env | xargs)
npm run dev:server           # API on :3000 (migrations run on start)
npm run dev:web              # web on :5173, proxies /api to :3000
npm test
```

Production build: `npm run build && npm start` (serves the web app and API on `PORT`).

## Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Long random string for session cookies (required in production) |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated domains allowed to register, e.g. `dsatm.edu.in` |
| `ADMIN_EMAILS` | Comma-separated emails that become admins |
| `INSTITUTION_NAME`, `APP_NAME` | Shown in the header and reports |
| `ANTHROPIC_API_KEY` | Enables the Claude expert review |
| `CLAUDE_MODEL` | Model for the review (default `claude-sonnet-5-5`) |
| `AI_DAILY_LIMIT` | Claude reviews per user per day (default 15) |

## Deploying on Render

`render.yaml` defines the web service and database in Singapore. In the Render dashboard choose **New → Blueprint**, pick this repository, then fill in `ADMIN_EMAILS` and `ANTHROPIC_API_KEY`. Every push to `main` redeploys.

## Privacy

Uploaded files are read in memory and only their text is stored. The proposal text is sent to Anthropic only when someone presses **Run expert review**.
