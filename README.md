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

The homepage works offline from the backend. Submitting the form displays “Analysis coming soon” without sending the product URL.

## Checks

Run `npm run lint` and `npm run build`. Use `npm start` to serve the production build.

## Source layout

- `src/app` — routes, layout and global styles
- `src/components` — status indicator and analysis form
- `src/hooks` — connection status lifecycle
- `src/services` — shared HTTP client
- `src/types` — shared TypeScript types
