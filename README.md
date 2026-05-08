# JINTA Content Engine

JINTA Content Engine is an internal Next.js dashboard and automation stack for turning a keyword into TikTok-ready slide carousels. It plans the story with Gemini, pulls visuals and music, renders branded slides, packages the batch for Telegram review, and can hand approved content off to TikTok automation.

## What it does

- Generates a story plan from a keyword.
- Pulls portrait photos from Pexels, with Pixabay and Unsplash fallbacks when configured.
- Renders 1080x1920 slide images with a custom compositor.
- Fetches royalty-free music previews from Freesound.
- Generates captions and ZIP bundles for posting.
- Saves approved batches in `_approved_vault/`.
- Streams research into Supabase and shows it inside the dashboard.
- Supports manual generation, autonomous autopilot, and Telegram human-in-the-loop approval.
- Runs scheduled research and content jobs through GitHub Actions.

## Main user flow

1. Enter a keyword and slide count in the dashboard.
2. Generate a plan with Gemini 2.5 Flash.
3. Render the slides one by one with source images and overlay text.
4. Generate or edit the caption.
5. Download a ZIP or send the batch to Telegram for approval.
6. Approve the batch in Telegram to trigger the TikTok upload flow.

## Dashboard features

- Manual generation with a keyword input and slide count selector.
- Autopilot mode with timing controls and keyword rotation.
- Automation settings for cadence, jitter, and keyword lists.
- Caption Studio for generating, editing, copying, and exporting captions.
- Music browser for previewing Freesound tracks by mood.
- Intelligence Grounding panel for research sources pulled from Supabase.
- Swarm Intelligence panel for research insights and generation history.
- Per-slide downloads plus one-click ZIP export.

## Background automation

- `src/scripts/researcher.ts` runs the master librarian and stores research insights in Supabase.
- `src/scripts/shadow-worker.ts` runs the autonomous content cycle, uploads the batch, and records the result.
- `telegram-listener.mjs` listens for Telegram approve/reject callbacks and triggers the TikTok upload route.
- `.github/workflows/shadow-librarian.yml` runs research on a schedule.
- `.github/workflows/shadow-swarm.yml` runs the full swarm cycle on an hourly schedule.

## API routes

- `/api/health` - service and dependency health check, including Pexels, Freesound, and local Gemma/Ollama status.
- `/api/generate` - builds the story plan, research grounding, image list, and optional music pick.
- `/api/generate/process` - composites a single slide image from a prompt and source image.
- `/api/caption` - generates a human caption for the finished batch.
- `/api/music` - searches Freesound by mood.
- `/api/music/download` - proxies audio so it can be bundled into ZIP files.
- `/api/orchestrate` - runs the full server-side autopilot pipeline and saves the result locally.
- `/api/swarm/research` - manually triggers live research collection.
- `/api/swarm/status` - returns the current research vault and generation history.
- `/api/telegram/send` - sends either a saved batch or a preview batch to Telegram.
- `/api/telegram-approve` - runs the Playwright TikTok upload after Telegram approval.

## Repository layout

- `src/app` - Next.js app, dashboard UI, and API routes.
- `src/lib` - Gemini, Pexels, Freesound, Supabase, Telegram, compositor, archive, and cache helpers.
- `src/scripts` - standalone autonomous research and content jobs.
- `_approved_vault` - local batches saved for review and posting.
- `_cache` - usage caches for image and music deduplication.

## Setup

1. Install dependencies: `npm install`
2. Create a `.env.local` file from the required secrets below.
3. Start the dashboard: `npm run dev`
4. Open `http://localhost:3000`

## Useful scripts

- `npm run dev` - start the dashboard in development.
- `npm run build` - build the production app.
- `npm run start` - run the production server.
- `npm run tg` - start the Telegram HITL listener.
- `npx tsx src/scripts/researcher.ts` - run the librarian once.
- `npx tsx src/scripts/shadow-worker.ts` - run the autonomous content worker once.
- `node test-models.js` - list available Gemini models.
- `node test-gemma.mjs` - test the local Gemma/Ollama endpoint.
- `npx tsx src/scripts/test-compositor.ts` - render a sample slide for compositor checks.

## Environment variables

### Required

- `GEMINI_API_KEY`
- `PEXELS_API_KEY`
- `FREESOUND_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Optional

- `PIXABAY_API_KEY`
- `UNSPLASH_ACCESS_KEY`
- `JINTA_VAULT_ROOT`

## Notes

- The app is marked `noindex, nofollow` because it is an internal tool.
- If you want the GitHub Actions workflows to run successfully, configure the repository secrets listed above before enabling the scheduled jobs.
