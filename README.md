# WanderBoard

A collaborative, role-based travel discovery and planning platform.

> IIT Roorkee · CSC 206 Software Engineering · Group 9

---

## Tech stack

| Layer | Tool |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Auth | Firebase Authentication (Email + Google) |
| Database | Cloud Firestore (NoSQL, real-time) |
| State | Zustand |
| Routing | React Router v6 |
| Testing | Vitest |
| CI | GitHub Actions |
| Hosting | Firebase Hosting |

---

## Getting started

### Prerequisites
- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`

### 1 — Clone and install

```bash
git clone https://github.com/YOUR_ORG/wanderboard.git
cd wanderboard
npm install
```

### 2 — Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication** → Sign-in methods → Email/Password + Google
4. Enable **Firestore Database** → Start in **production mode**
5. Register a Web app and copy the config

### 3 — Configure environment

```bash
cp .env.example .env.local
# Open .env.local and paste your Firebase config values
```

### 4 — Deploy Firestore rules

```bash
firebase login
firebase use --add   # select your project
firebase deploy --only firestore:rules,firestore:indexes
```

### 5 — Run locally

```bash
# Option A: against real Firebase project
npm run dev

# Option B: fully offline with emulators (recommended for development)
npm run emulators        # terminal 1 — starts Auth + Firestore emulators
VITE_USE_EMULATORS=true npm run dev   # terminal 2
```

Emulator UI is available at http://localhost:4000

---

## Project structure

```
src/
  config/           firebase.ts, routes.ts
  features/
    auth/           AuthProvider, authService, LoginPage, RegisterPage, ProtectedRoute
    trips/          tripService, useTripStore, DashboardPage, TripWorkspacePage
    bucketlist/     (week 2)
    weather/        (week 2–3)
    expenses/       (week 3)
    ai/             (optional)
  components/       Shared UI: Button, Input, Modal, RoleBadge
  types/            index.ts — all domain interfaces + Result<T>
  lib/              generateInviteCode.ts
  tests/            Unit tests
```

---

## Team & responsibilities

| Member | Track |
|---|---|
| Dhruv, Keshav | Project lead — repo, Firebase setup, CI, deployment |
| Bhoomika, Garima | Auth UI, pages, shared components |
| Dakshata, Naivadhya | Data model, Firestore rules, RBAC, service tests |

---

## Running tests

```bash
npm test           # run once
npm run test:watch # watch mode
```

---

## Deployment

```bash
npm run build
firebase deploy --only hosting
```

---

## Security notes

- Firestore security rules enforce RBAC at the **database level** — UI guards are UX only
- Environment variables are validated at startup — missing keys throw immediately
- Firebase keys in `.env.local` are never committed (enforced by `.gitignore`)
- `Content-Security-Policy` header is set in `index.html` and `firebase.json`
- Invite codes use `crypto.getRandomValues` — not `Math.random()`
- All service functions return `Result<T>` — errors never propagate as thrown exceptions to the UI
