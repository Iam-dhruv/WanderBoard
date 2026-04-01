# WanderBoard

WanderBoard is a unified system that will actively help users discover local activities, share their ideas, and finalize plans using a centralized decision-making system while using context-aware travel data along with allowing them to manage their expenses

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

### 1. Clone and install

```bash
git clone https://github.com/Iam-dhruv/wanderboard.git
cd wanderboard
npm install
```

### 2. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication** → Sign-in methods → Email/Password + Google
4. Enable **Firestore Database** → Start in **production mode**
5. Register a Web app and copy the config

### 3. Configure environment

```bash
cp .env.example .env.local
# Open .env.local and paste your Firebase config values
```

### 4. Deploy Firestore rules

```bash
firebase login
firebase use --add   # select your project
firebase deploy --only firestore:rules,firestore:indexes
```

### 5 Run locally

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


## 🚀 Week 1 To-Dos (Foundation & Auth)

- [ ]  **Repo Setup:** Initialize React+Vite project, configure Tailwind, and push to GitHub (Dhruv & Keshav).
- [ ]  **Firebase Init:** Create Firebase project, enable Auth & Firestore, and share `.env.example` (Dhruv).
- [ ]  **Data Modeling:** Define TypeScript interfaces for `User`, `Trip`, and `Role` entities (Dakshata & Naivadhya).
- [ ]  **Security Rules:** Write initial Firestore rules to lock down read/write access based on Auth state (Naivadhya).
- [ ]  **UI Components:** Build foundational UI elements (Buttons, Inputs, Modals) (Bhoomika & Garima).
- [ ]  **Auth Pages:** Create Login and Registration pages, integrating Firebase Auth (Bhoomika).
- [ ]  **Workspace Creation:** Build the "Create Trip" and "Join via 6-digit code" UI and logic (Garima & Keshav).
- [ ]  **CI/CD:** Set up GitHub Actions for automated testing on pull requests (Dhruv).

---

## 📅 Project Plan & Member Division

The project is divided into 5 core phases based on the functional requirements. The workload is distributed across three specialized tracks:
1. **Infrastructure & APIs:** Dhruv & Keshav
2. **Frontend & UX:** Bhoomika & Garima
3. **Backend Logic & Data:** Dakshata & Naivadhya

### Phase 1: User Auth & Workspace Management (Week 1)
* **Goal:** Secure authentication, trip creation, and role-based access control. 
* **Dhruv/Keshav:** Firebase setup, Authentication integration, CI/CD pipeline. 
* **Bhoomika/Garima:** Login/Signup screens, Dashboard UI, Workspace layout.
* **Dakshata/Naivadhya:** Firestore schema, Invite code generation logic, RBAC database rules.

### Phase 2: Collaborative Planning (Week 2)
* **Goal:** Implement the Bucket List, suggestion engine, and real-time voting. 
* **Dhruv/Keshav:** Integrate Google Places API for discovery. 
* **Bhoomika/Garima:** Bucket List UI, interactive activity cards, Voting UI, drag-and-drop timeline (Trip Owner only).
* **Dakshata/Naivadhya:** Real-time vote incrementing logic, timeline write-protection logic.

### Phase 3: Environmental Dashboard (Week 3)
* **Goal:** Context-aware data integration and contingency flagging.
* **Dhruv/Keshav:** Integrate Weather API (OpenWeatherMap) and Solar data calculation. 
* **Bhoomika/Garima:** Weather widgets, Golden Hour indicators, visual alert styling for conflicts.
* **Dakshata/Naivadhya:** Logic to trigger contingency flags (e.g., Rain > 20% for outdoor tags). 112, 123

### Phase 4: Expense Tracker (Week 4)
* **Goal:** Shared expense logging and settlement optimization.
* **Dhruv/Keshav:** Connect expense data to the main dashboard state via Zustand.
* **Bhoomika/Garima:** Add Expense forms (equal, percentage, fixed splits), balance ledger UI. 
* **Dakshata/Naivadhya:** Implement validation logic (sum of splits = total) and the Greedy Algorithm for Debt Chaining.

### Phase 5: AI Itinerary & Polish (Week 5) 145
* **Goal:** Automated starter itineraries and final system testing.
* **Dhruv/Keshav:** Integrate LLM API for automated itinerary generation.
* **Bhoomika/Garima:** AI suggestion "Sandbox" UI, overall visual polish, responsive design checks.
* **Dakshata/Naivadhya:** Write integration tests, verify concurrent user actions, test offline fallbacks.

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
