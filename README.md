# EasyTrip

EasyTrip is a local-first travel planner for short city trips. It helps travelers create trips, organize day-by-day stops, preview route movement, and switch into a focused Today Mode while traveling.

繁體中文版本：[README.zh-TW.md](README.zh-TW.md)

## Current Status

Phase 3 is implemented locally:

- Taiwanese-inspired visual language for the single-day itinerary page
- Mobile bottom sheet editing for itinerary stops
- Upgraded `Place` model with Google Maps URL, place id, coordinates, address, and source metadata
- Google Maps URL preview and short-link resolution
- `RoutePreview` component with route status, Google Maps directions link, and Routes API estimates
- Routes API walking time and distance estimates between adjacent stops
- AI prompt-assisted itinerary import through copy/paste JSON
- Upgraded Today Mode with next-stop focus, progress, reminders, and movement time
- RWD hardening and test pass

Existing demo:

[https://easy-trip-chi.vercel.app/](https://easy-trip-chi.vercel.app/)

## Core Features

- Trip list with selected-trip state
- Create trip flow with date range validation
- Day-by-day itinerary planner
- Add, edit, and delete itinerary items
- Google Maps URL based place source
- Google Maps place preview in the editor
- Route preview for daily movement
- Routes API travel time and distance estimates
- AI prompt generation for ChatGPT, Claude, and Gemini
- AI JSON paste-back flow with validation, preview, skipped-row feedback, and batch import
- Today Mode for current-day travel focus
- Local persistence through `localStorage`
- Responsive layouts for mobile, tablet, and desktop
- Unit tests for trip creation, itinerary timing, storage, route helpers, Google Maps helpers, and AI import parsing

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Zustand
- React Hook Form
- Zod
- Vitest
- Google Maps Platform: Places API and Routes API

The app is still local-first. Trip data is stored in `localStorage`; the API routes are used only for Google Maps URL resolution and route estimates.

## AI Itinerary Import

EasyTrip includes a copy/paste AI workflow on the single-day itinerary page.

The flow is:

1. Open `/trips/:tripId/day/:dayId`.
2. Use the AI IMPORT panel to copy the generated prompt.
3. Open ChatGPT, Claude, or Gemini from the panel.
4. Ask the AI to plan or refine the day.
5. Paste the AI's JSON result back into EasyTrip.
6. Review valid rows and skipped rows.
7. Import valid rows into the current day.

The import appends valid rows and does not replace existing itinerary items. If the pasted schedule crosses midnight or clearly continues into the next morning, EasyTrip automatically expands the trip days and places those rows on the following day.

Expected JSON shape:

```json
{
  "version": 1,
  "items": [
    {
      "title": "Taipei 101",
      "address": "Taipei 101, Xinyi District, Taipei",
      "startTime": "10:00",
      "endTime": "11:30",
      "type": "attraction",
      "note": "Book tickets ahead."
    }
  ]
}
```

Allowed `type` values:

```text
attraction, food, hotel, transport, shopping, rest
```

This feature does not call the OpenAI, Anthropic, or Gemini APIs directly. External AI tools are opened as normal websites, and EasyTrip only handles prompt generation, JSON parsing, validation, preview, and local import.

## Routes

```text
/
/trips
/trips/new
/trips/:tripId/day/:dayId
/trips/:tripId/today
/api/places/resolve
/api/routes/estimate
```

## Getting Started

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_key
```

The Google Cloud project should enable:

- Places API (New)
- Routes API

Run the app:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Authentication and Collaboration

Local-only planning still works without an account. Shared trips use Supabase Auth (Google OAuth or Email Magic Link), invite links, a proposal pool, three-state reactions, optional limited must-go cards, and collaborative itinerary editing.

1. Create a Supabase project and enable Email and Google providers.
2. Add local and production `/auth/callback` URLs to the allowed redirects.
3. Run `supabase/migrations/202607140001_collaboration_mvp.sql` in the SQL Editor.
4. Copy `.env.example` to `.env.local` and fill in the Supabase and Maps keys.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. A local trip is uploaded only after its owner explicitly selects **旅伴候選池** from the trip list.

## Google Maps Behavior

EasyTrip treats a Google Maps URL as the main place source.

When a user pastes a Google Maps URL, the app tries to resolve:

- Google place id
- formatted address
- latitude and longitude
- canonical Google Maps URL

Route estimates use the strongest available data in this order:

1. Google place id
2. Places API location
3. exact coordinates from the Google Maps URL
4. text address or place title

This keeps route estimates from drifting to a similarly named place when old or incomplete address data exists.

## Quality Checks

```bash
npm run lint
npm run test -- --run
npm run build
```

Current local verification:

- Vitest: 12 files, 77 tests passing
- ESLint: passing
- Next production build: passing
- Route smoke checks: `/`, `/trips`, `/trips/new`, day page, and Today Mode return HTTP 200 locally

## Deployment

This is a standard Next.js app and can be deployed to Vercel.

Recommended deployment:

1. Push the repository to GitHub.
2. Import the repository in Vercel.
3. Keep the framework preset as Next.js.
4. Add `GOOGLE_MAPS_API_KEY` in Vercel Project Settings > Environment Variables.
5. Enable Places API (New) and Routes API for that key in Google Cloud.
6. Deploy.

Build settings:

```text
Install Command: npm install
Build Command: npm run build
Output: Next.js default
```

CLI deployment:

```bash
vercel
vercel deploy --prod
```

Do not commit `.env.local`; it is already ignored by `.gitignore`.

## Demo Flow

Use this sequence when presenting:

1. Open `/` to show the selected trip dashboard and next-stop summary.
2. Open `/trips` to show saved trips and entry points.
3. Open `/trips/new` to create a new trip.
4. Open `/trips/trip-nagoya-overnight/day/day-1` to edit a sample day.
5. Use the AI IMPORT panel to copy the planning prompt.
6. Paste an AI JSON result back into EasyTrip and import valid rows.
7. Paste a Google Maps URL into a stop and save it.
8. Review RoutePreview movement estimates.
9. Open `/trips/:tripId/today` when the trip has a day matching the current date.

## Project Structure

```text
src/
  app/
    api/
    trips/
  components/
  data/
  lib/
    itinerary/
    places/
    routes/
    storage/
    time/
    trips/
    ui/
  store/
  types/
```

## Roadmap

- Add cloud sync and authenticated trips
- Add shareable itinerary links
- Add drag-and-drop itinerary ordering
- Add optional direct AI provider integration after the copy/paste workflow is validated
- Add route estimate caching to reduce Google Maps Platform usage
- Add Playwright E2E once browser automation is available in CI
