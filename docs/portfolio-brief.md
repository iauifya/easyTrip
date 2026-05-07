# EasyTrip Portfolio Brief

## One-Liner

EasyTrip is a responsive travel-planning MVP that helps users create trips, organize daily stops, catch tight schedules, and focus on the next stop during travel.

## Case Study Summary

I built EasyTrip as a local-first MVP for short city trips. The product goal was to reduce planning friction without overwhelming the traveler with a heavy planning interface. The app uses a calm visual system, clear itinerary states, and time-aware helpers to keep the user oriented.

## What I Built

- A Next.js App Router application with TypeScript
- Trip creation with React Hook Form and Zod validation
- Itinerary editing with add, edit, and delete flows
- Time calculations for sorting, duration, next stop, progress, and tight-gap warnings
- Zustand state management with `localStorage` persistence
- Responsive dashboard, trip list, creation, planner, and today-mode views
- Vitest coverage for domain logic and storage behavior

## Design Rationale

The UI is intentionally quiet: restrained colors, compact cards, clear hierarchy, and mobile-first actions. Travel apps can easily become visually noisy, so EasyTrip keeps the focus on one question at a time: what is the next useful thing to know or do?

## Technical Highlights

- Domain logic is separated into `src/lib` so tests can cover behavior without rendering UI.
- `localStorage` access is wrapped in an adapter that safely falls back to sample data.
- The itinerary planner derives defaults from the latest stop and title-based type suggestions.
- RWD adjustments avoid horizontal overflow on narrow screens and keep CTA groups usable.

## Verification

- `npm run test -- --run`: 30 tests passing
- `npm run lint`: passing
- `npm run build`: passing

## Next Iteration

The strongest next step would be connecting maps and route durations. That would turn EasyTrip from a planner into a lightweight travel companion that can reason about travel time between stops.
