# BuyWise AI

Frontend for the AI Product Review Intelligence Agent, built with Next.js App Router, strict TypeScript, Tailwind CSS and Lucide React.

## Local development

Use Node.js 20.19 or later. From the repository root run:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

In PowerShell use `Copy-Item .env.example .env.local` for the copy step. Open http://localhost:3000.

Requests use `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`). Configure FastAPI CORS to allow the frontend origin for cross-origin requests. Restart the dev server after changing the environment, or rebuild for production.

Submitting an Amazon.in product URL calls `POST /api/v1/analysis`. The UI shows
loading and error states, a four-way recommendation, collected and analysed review
counts, coverage limitations, and findings linked to expandable source reviews.
Recommendations are Worth Considering, Proceed with Caution, Not Recommended and
More Evidence Needed. Legacy buy/skip responses are accepted during deployment.

The UI follows the approved [Stitch light/dark screens](https://stitch.google.com/projects/16176306442509430335).
One responsive layout uses theme variables. The toggle persists `buywise-theme` in
localStorage; a fixed pre-paint script restores it without a theme flash. Plus Jakarta
Sans and Playfair Display are bundled by Next's font integration. Product/verdict,
analytics, insights and limitations retain the reference hierarchy. There is no
separate recommendation score.

Overall percentages come exclusively from supplied Amazon histogram buckets:
positive = 4+5 stars, neutral = 3 stars, negative = 1+2 stars. Missing components stay
N/A. The Review Sentiment ring is the collected rating-based sample, not overall
customer satisfaction; it shows actual category counts. AI-analyzed and collected
counts may differ under input limits. Up to 7 per category is a collection target,
never a hardcoded count. Optional price, safe Amazon image and specifications appear
only when returned. Discounts and warranties are not invented.

Findings link to exact source excerpts and nested expandable reviews. Recurring
issues retain their category and cited-review count. The key takeaway and limitations
come from the backend. Export Report downloads a plain-text snapshot of the current
response with counts, findings, quotes, URLs and limitations. Exporting makes no
backend or LLM request.

Nested API responses are validated before rendering, including numeric ranges,
review references, evidence quotes, optional product metadata and Amazon source URLs.
Cache reuse and backend budget-limit messages stay visible. The OpenAI key belongs
only in the backend. Additive fields fall back safely with older cached responses.

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
is checked separately at `/api/v1/health/db`. Analysis requires MongoDB for its
shared cache and spending limits. Temporary Atlas access restored that connection.
The hosted UGREEN hub test collected and analysed 13 reviews after the backend moved
to Mumbai. Amazon can still challenge requests or require sign-in for review pages.
See the linked project status for the temporary access expiry and remaining work.

## Checks

Run `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build`. The 17 tests
use Node's built-in test runner and stored in-process examples, with no external
requests or API credits. Use `npm start` to serve the production build.

Local browser checks used a loopback fixture API for both themes, saved preference,
390px mobile layout, all verdicts, missing/partial metadata, clean API errors,
source links and downloaded report. Fixture data never ships in the application.
Live Amazon 7+7+7 availability and new model output were not tested in this release.

## Source layout

- `src/app` — routes, layout and global styles
- `src/components` — status indicator and analysis form
- `src/hooks` — connection status lifecycle
- `src/services` — shared HTTP client
- `src/types` — shared TypeScript types
