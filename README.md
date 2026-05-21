# EasyTrip

EasyTrip is a calm travel-planning MVP for travelers who want a clearer daily itinerary without turning trip planning into spreadsheet work. It helps people create trips, organize day-by-day stops, spot tight schedules, and switch into a focused "today mode" while traveling.

> Portfolio status: MVP complete and deployed.

Live demo: [https://easy-trip-chi.vercel.app/](https://easy-trip-chi.vercel.app/)

## Product Positioning

EasyTrip is designed as a soft utility: practical, quiet, and reassuring. Instead of optimizing for maximum information density, the interface emphasizes the next useful action: where the traveler is going next, whether the day feels too packed, and what can be edited quickly.

Target users:
- Independent travelers planning short city trips
- People who want time-aware itineraries without complex travel software
- Portfolio reviewers looking for a complete frontend MVP with state, forms, validation, persistence, responsive UI, and tests

## Core Features

- Trip list with selected trip state
- Create trip flow with date range validation
- Day-by-day itinerary planner
- Add, edit, and delete itinerary items
- Time helpers for stay duration, sorting, next stop, and tight-gap warnings
- Today mode for current-day travel focus
- Local persistence through `localStorage`
- Responsive layouts for mobile and desktop
- Unit tests for trip creation, itinerary timing, day insights, suggestions, and storage

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Zustand
- React Hook Form
- Zod
- Vitest

The project intentionally keeps the MVP local-first with mock data and `localStorage`. API-backed data, map integrations, and route estimates are planned as follow-up work.

## Demo Flow

Use this sequence when presenting the project:

1. Open [the live demo](https://easy-trip-chi.vercel.app/) to show the current trip dashboard and next-stop summary.
2. Open `/trips` to show multiple saved trips and entry points.
3. Open `/trips/new` to create a new trip with validated dates and pace.
4. Open `/trips/trip-taipei-weekend/day/day-1` to edit the sample itinerary.
5. Add a stop with a short gap to show schedule warnings.
6. Open `/trips/trip-taipei-weekend/today` when the sample trip date matches today, or explain the empty state when it does not.

## Routes

```text
/
/trips
/trips/new
/trips/:tripId/day/:dayId
/trips/:tripId/today
```

## Getting Started

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Quality Checks

```bash
npm run lint
npm run test -- --run
npm run build
```

Current local verification:

- Vitest: 7 test files, 30 tests passing
- ESLint: passing
- Next production build: passing
- RWD smoke check: mobile and desktop layouts checked for horizontal overflow during Phase 6

## Deployment

This project is deployed on Vercel:

[https://easy-trip-chi.vercel.app/](https://easy-trip-chi.vercel.app/)

Vercel supports zero-configuration deployment for Next.js projects, and the CLI deploy command can be run from the project root.

Recommended Git-based deployment:

1. Push the repository to GitHub.
2. Import the repository in Vercel.
3. Keep the default framework preset as Next.js.
4. Use the default install and build commands:

```text
npm install
npm run build
```

CLI deployment option:

```bash
vercel
vercel deploy --prod
```

References:

- [Next.js on Vercel](https://vercel.com/docs/concepts/next.js/overview)
- [Vercel CLI deploy](https://vercel.com/docs/cli/deploy)
- [Deploying from the CLI](https://vercel.com/docs/projects/deploy-from-cli)

## Portfolio Notes

Problem:

Trip planning often starts clear but becomes messy once timing, gaps, and day-by-day edits enter the picture. EasyTrip focuses on the moment when the traveler needs a practical plan, not a giant planning board.

Product decisions:

- Local-first MVP to keep the first version fast and demoable
- Form validation with Zod to protect trip and time data
- Separate domain helpers for timing and insight logic so the UI stays readable
- Responsive layouts that prioritize clear actions on mobile
- Tests around scheduling logic and persistence because those are the highest-risk areas

What this project demonstrates:

- Building a complete TypeScript frontend MVP from a product plan
- Translating UX goals into concrete routes and UI states
- Managing client state and persistence without backend complexity
- Writing focused tests around business logic
- Preparing a project for deployment and portfolio review

## Roadmap

- Add real map and place search integration
- Google Maps URL auto-fill can resolve short links and use them as the primary place source.
- Route duration estimates use Google Routes API through `GOOGLE_MAPS_API_KEY`; enable Routes API in Google Cloud for real travel times.
- Add route duration estimates between stops
- Add drag-and-drop itinerary ordering
- Add cloud sync and authenticated trips
- Add shareable itinerary links
- Add Playwright E2E once browser binaries are available in CI
- Add API mocks with MSW before introducing a backend

## Project Structure

```text
src/
  app/
  components/
  data/
  lib/
    itinerary/
    storage/
    time/
    trips/
  store/
  types/
```
