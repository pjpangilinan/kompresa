# Kompressa

Video compression service frontend. Phantom Protocol design system, Vite + React 19 + TypeScript.

## Stack

- **Vite 8** + **React 19** + **TypeScript 6**
- **Tailwind v4** (CSS-first `@theme` tokens)
- **React Router v6** + **TanStack Query**
- **Phantom Protocol** design tokens (Anton / Geist / Space Mono, Cyber Blue `#00F0FF`)
- **Mock backend** built in (`VITE_API_MOCK=true` by default)
- **ffmpeg** (real backend, not yet wired)

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
```

**Dev credentials (mock only):** `passphrase=phantom`, `totp=000000`. Shown in the login UI as a hint. Remove before production.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript + production build to `dist/` |
| `npm run preview` | Serve the prod build locally |
| `npm run lint` | oxlint (0 warnings required) |

## Environment

| Var | Default | What |
|---|---|---|
| `VITE_API_MOCK` | `true` | Use in-memory mock backend |
| `VITE_API_ORIGIN` | `''` | Real API origin (e.g. `https://api.kompressa.com`). When set, also set `VITE_API_MOCK=false` |

## Project layout

```
src/
  api/          # typed API client + mock backend
  components/   # reusable UI (Button, Panel, GlitchStrip, JobCard, ...)
  context/      # AuthProvider, JobsProvider
  hooks/        # useAuth, useJobPolling, useJobsContext
  lib/          # types, helpers
  pages/        # route-level components
  index.css     # Tailwind v4 + Phantom @theme tokens
```

## Deploy

Static build. Drop `dist/` on any static host (S3+CloudFront, GitHub Pages, Netlify, etc.). Backend lives separately (AWS Fargate+Lambda per project plan).
