# Product Intelligence

Frontend for the AI Product Review Intelligence Agent, built with Next.js App Router, strict TypeScript, Tailwind CSS and Lucide React.

## Local development

Use Node.js 20.19 or later. From the repository root run:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

In PowerShell use `Copy-Item .env.example .env.local` for the copy step. Open http://localhost:3000.

The browser checks `GET /api/v1/health` once on page load using `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`). Configure FastAPI CORS to allow the frontend origin for cross-origin requests. Restart the dev server after changing the environment, or rebuild for production.

Submitting an Amazon.in product URL calls `POST /api/v1/analysis`. The UI shows
loading and error states, a buy/skip/insufficient-evidence judgment, collected and
analysed review counts, coverage limitations, and reasons linked to expandable
source reviews. It also displays the model, cache reuse and conservative cost
reservations when supplied by the backend. The OpenAI key belongs in the backend.

## Project progress

Completed UI and backend features, validation and remaining work are maintained in
[Project status](https://github.com/VikasX/product-decision/blob/main/STATUS.md).
The local URL-to-analysis flow is working. UI lint and production build passed,
and the integrated app analysed eight real reviews and reused the cached result.

Amazon authentication verified in a separate browser session does not authenticate
the backend collector. Broader review access and recommendation quality remain
under evaluation.

## Vercel deployment

The production UI is https://product-decision-ui.vercel.app. Set
`NEXT_PUBLIC_API_BASE_URL=https://product-decision.vercel.app` in the Production
environment and rebuild after changes. Git pushes to main trigger a new deployment.
The backend allows this UI origin through CORS.

The backend application health endpoint is `/api/v1/health`; database connectivity
is checked separately at `/api/v1/health/db`. A connected API indicator confirms
application liveness. Analysis also requires the backend to reach MongoDB for its
shared cache and spending limits. Temporary Atlas access restored that connection.
The latest hosted test collected no reviews because Amazon returned CAPTCHAs.
See the linked project status for the temporary access expiry and remaining work.

## Checks

Run `npm run lint` and `npm run build`. Use `npm start` to serve the production build.

## Source layout

- `src/app` — routes, layout and global styles
- `src/components` — status indicator and analysis form
- `src/hooks` — connection status lifecycle
- `src/services` — shared HTTP client
- `src/types` — shared TypeScript types
