# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

Implement in dependency order: data contracts first, API behavior second, and presentation integration last. Keep each tier's responsibilities within its existing boundary and preserve the configured ports and unauthenticated API.

- Presentation tier decision: Use the shared API client and existing React routes; keep data fetching and UI state in the presentation tier, with accessible loading, empty, and error states.
- Logic tier decision: Implement the `/api/*` contracts in Express routes/services, validate inputs before database operations, and return deliberate 4xx responses for invalid or unknown resources.
- Data tier decision: Define required fields, references, and validation in Mongoose models; keep representative seed data idempotent.
- Activity tracking approach: Validate that submitted user and team IDs are well formed and refer to existing records; persist the submitted activity fields with server-computed points and `occurredAt`.
- Team management approach: Require a non-empty name, preserve the submitted name and mascot, and support team members when creating and listing teams.
- Leaderboard approach: Sum activity points by team, order teams from highest total to lowest, and return each team's name, total, and 1-based rank.
- Workout suggestions approach: Find the user by email and use their goal or recent activity to choose and explain the first suggestion; return a deliberate 4xx when no user matches.

## Test plan

The three test commands below were run. Their current failures identify incomplete data validation, API behavior, and presentation behavior respectively. Build commands have not yet been run; a failure there indicates a compile, type-check, or bundling problem in that tier.

- Data-tier command: `npm run test:data --prefix octofit-tracker/backend` — **4 failed, 1 passed**. User, Team, Activity, and Workout required-field validation is missing; the seed-data test passes.
- API command: `npm run test:api --prefix octofit-tracker/backend` — **4 failed**. Invalid activity/team requests return `501` instead of `400`, the leaderboard is empty, and the first workout suggestion does not match the expected user's activity pattern.
- Frontend command: `npm test --prefix octofit-tracker/frontend` — **15 failed**. Main content and user-specific suggestions do not meet the UI contract; all four routes also fail loading, empty-state, and accessible API-error-state tests.
- Backend build command: `npm run build --prefix octofit-tracker/backend` — **not run**. Run after the backend tests; a failure indicates backend compilation or type errors.
- Frontend build command: `npm run build --prefix octofit-tracker/frontend` — **not run**. Run after the frontend tests; a failure indicates frontend compilation, type, or bundling errors.
