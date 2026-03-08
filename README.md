# 📘 CampusCare — Academic Tracking Platform

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Auth0](https://img.shields.io/badge/Auth0-2.11.3-EB5424?style=flat-square&logo=auth0&logoColor=white)](https://auth0.com/)
[![jsPDF](https://img.shields.io/badge/jsPDF-4.0.0-FF0000?style=flat-square)](https://github.com/parallax/jsPDF)
[![Playwright](https://img.shields.io/badge/Playwright-1.58.1-45BA4B?style=flat-square&logo=playwright&logoColor=white)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**A student-focused academic management platform built with Vanilla TypeScript — track attendance, calculate CGPA, simulate what-if scenarios, and manage your full semester in one place.**

[Features](#-features) · [How It Works](#-how-it-works) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [Project Structure](#-project-structure)

</div>

---

## 📌 Project Overview

CampusCare is a fully client-side academic management platform built as part of the **Transforming Ideas to Innovation (TII)** course following a complete **Design Thinking process** — from empathy research and problem definition through to a working implementation.

Students often realize academic risks (attendance shortage, CGPA gaps) too late due to fragmented information and reactive behavior. CampusCare solves this by providing a single, structured dashboard where every academic metric is continuously visible, calculated, and actionable.

All data is stored locally in the browser via `localStorage` — no backend, no server, no sign-up friction. Auth0 handles identity, and the app scopes each user's data to their Auth0 `sub` identifier so multiple users can share the same device safely.

---

## 🧠 How It Works

### Application Flow

```
Browser loads index.html
        │
        ▼
main.ts initialises → "Loading CampusCare..."
        │
        ▼
initAuth0() called (auth.ts)
        │
        ├── Not authenticated → renderLandingPage()
        │
        └── Authenticated
                │
                ▼
        store.handleAuth0Login()
        Scopes localStorage data to Auth0 sub
                │
                ├── First-time user (setupComplete = false)
                │       └── renderOnboarding()
                │           Semester wizard → subjects → timetable
                │
                └── Returning user
                        └── renderAppLayout()
                            Sidebar nav → renderSection() router
                            Loads feature module for active tab
```

### Data Architecture

All application state lives under a single `localStorage` key: **`campusCare_premium_data`**

The data is a JSON object structured as a dictionary keyed by Auth0 `sub` (user ID), each containing an array of semester objects. Every semester holds its own subjects, timetable, attendance records, and configuration — fully isolated per user and per semester.

`store.ts` is the central data service responsible for reading, writing, migrating, and scoping all data. It includes a **migration engine** that silently detects legacy single-semester data structures and converts them to the modern multi-semester format on load, preventing crashes for returning users.

### Attendance Tracking

Attendance is stored as a map of `date string → { subjectId → status }` where status is one of `present`, `absent`, `present_half`, or `class_cancelled`. Each day's scheduled classes are derived from the user's timetable configuration. The calendar renders a custom CSS grid built from native JavaScript `Date()` mathematics — no external calendar library is used.

### CGPA Calculation

The calculator supports two modes — **Marks** and **Grades** — and two scopes — **Calculate for Me** (pulls enrolled subjects) and **Calculate for Other** (manual entries). In Marks mode, internal and end-term marks are mapped to letter grades via threshold lookup (`MARKS_TO_GRADE`), then to grade points (`GRADE_POINTS`). The final SGPA uses the standard formula:

```
SGPA = Σ(grade_points × credits) / Σ(credits)
```

### What-If Simulation

The What-If simulator creates a deep in-memory clone of the current attendance data (`JSON.parse(JSON.stringify(data.attendance))`). The user can freely mark future presences or absences on the calendar. Impact Cards update in real time showing the exact percentage change per subject (e.g., `↓ 2.5%`). On exit, the simulation is completely discarded — nothing is written to `store`.

---

## ✨ Features

**Auth0 Authentication** — Secure login/logout via `@auth0/auth0-spa-js`. Data is scoped to each user's Auth0 `sub` identifier, allowing multiple users on the same device without data leakage.

**Onboarding Wizard** — First-time users are guided through a step-by-step semester setup: program details → subject registration → timetable configuration.

**Multi-Semester Management** — Full support for multiple semesters per user. Each semester is independently configured with its own subjects, timetable, attendance records, and evaluation structure.

**Subject Configuration** — Register subjects with credits, class types (Lecture / Lab / Tutorial), and internal/external mark limits per subject.

**Weekly Timetable Builder** — Add daily time slots per subject with automatic conflict detection. Lab classes enforce a 2-hour minimum; Lectures and Tutorials enforce 1 hour. Stored per user, per semester.

**Attendance Tracking** — Log attendance per subject per day with four statuses: Present, Absent, Present (Half), and Class Cancelled. Absence reason logging is supported for every missed class.

**Custom Calendar View** — A hand-built monthly calendar (no library) shows attendance dots per day. Semester boundaries are enforced — out-of-range dates are disabled. Holidays are highlighted in amber, selected days in blue.

**Attendance Analytics Dashboard** — Weekly workload cards, per-subject attendance bars, credit summaries, and semester progress visualization — all rendered using native DOM and CSS without any charting library.

**Absence Insights** — Visualizes the most frequently missed classes and breakdown of absence reasons using CSS horizontal bar charts.

**What-If Attendance Simulation** — Simulate future attendance scenarios without affecting real data. Real-time impact cards show percentage changes per subject.

**Extra Class Addition** — Add ad-hoc extra classes outside the regular timetable.

**CGPA / SGPA Calculator** — Dual-mode calculator (Marks or Grades input), dual-scope (enrolled subjects or custom entries). Supports O, A+, A, B+, B, C, D, F grade scales.

**PDF Report Generation** — Export a styled academic report via `jsPDF` + `jspdf-autotable` containing student name, semester, program, subject table (credits, grades, points), projected SGPA, and a disclaimer footer.

**Account Deletion** — Full data wipe with a forced countdown timer confirmation UI to prevent accidental deletion.

**Data Migration** — Automatic silent migration of legacy data structures to the current multi-semester format on every app load.

**Responsive UI** — Fully responsive design using vanilla CSS with a sidebar navigation layout.

**E2E Testing** — Playwright test suite with `example.spec.ts` and `homepage.spec.ts`.

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|:-------:|
| **Language** | TypeScript | 5.2.2 |
| **Build Tool** | Vite | 5.0.0 |
| **UI Paradigm** | Vanilla TypeScript (no framework) | — |
| **Styling** | Vanilla CSS (`src/style.css`) | — |
| **Authentication** | Auth0 SPA JS SDK | 2.11.3 |
| **PDF Generation** | jsPDF + jspdf-autotable | 4.0.0 / 5.0.7 |
| **E2E Testing** | Playwright | 1.58.1 |
| **Storage** | Browser `localStorage` | — |
| **Type Checking** | TypeScript compiler (`tsc`) | 5.2.2 |

> No React, Vue, Svelte, or any UI framework. No charting library. No backend. No cloud database. The entire UI is constructed via TypeScript DOM manipulation and HTML template strings.

---

## 📁 Project Structure

```
CampusCare/
├── public/                     # Static assets
├── src/
│   ├── features/               # Feature modules
│   │   ├── attendance.ts       # Calendar engine, tracking logic, What-If simulator
│   │   ├── cgpa.ts             # CGPA/SGPA calculator + PDF report generation
│   │   ├── onboarding.ts       # First-time setup wizard
│   │   ├── stats.ts            # Attendance % calculation, holiday & semester stats
│   │   ├── subjects.ts         # Subject registration and mark tracking
│   │   ├── tt.ts               # Timetable builder with conflict detection
│   │   └── about.ts            # About / information tab
│   ├── ui/                     # Reusable UI components
│   │   ├── modal.ts            # Global singleton modal (Alert / Prompt / Confirm)
│   │   ├── absence-modal.ts    # Absence reason input prompt
│   │   └── timepicker.ts       # Time slot selection utility
│   ├── auth.ts                 # Auth0 SPA JS integration service
│   ├── store.ts                # Central data service (localStorage + migration engine)
│   ├── utils.ts                # Helper utilities (jQuery-like $ selector shorthand)
│   ├── style.css               # Global typography and theme
│   └── main.ts                 # App entry point, layout renderer, section router
├── tests/
│   ├── example.spec.ts         # Playwright example test
│   └── homepage.spec.ts        # Playwright homepage E2E test
├── playwright.config.ts        # Playwright configuration
├── vite.config.js              # Vite config (host: true, allowedHosts: true)
├── tsconfig.json               # TypeScript config (ES2020, strict mode)
├── package.json
└── .env.example                # Environment variable template
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- An [Auth0](https://auth0.com) application (free tier works)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/parteek1907/CampusCare.git
cd CampusCare

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file in the project root:

| Variable | Required | Description |
|----------|:--------:|-------------|
| `VITE_AUTH0_DOMAIN` | ✅ | Your Auth0 tenant domain (e.g. `dev-xxx.us.auth0.com`) |
| `VITE_AUTH0_CLIENT_ID` | ✅ | Your Auth0 application client ID |

### Run Locally

```bash
npm run dev
```

Available at **http://localhost:5173**

### Production Build

```bash
npm run build     # Type-check + Vite bundle → dist/
npm run preview   # Preview the production build locally
```

### Run E2E Tests

```bash
npx playwright install   # First time only — installs browsers
npm run test             # or: npx playwright test
```

---

## 🌐 Deployment

CampusCare is a fully static frontend application — the `dist/` folder produced by `npm run build` can be deployed to any static host.

### GitHub Pages

1. Run `npm run build` to generate `dist/`.
2. Push the `dist/` folder contents to a `gh-pages` branch, or use the [gh-pages](https://github.com/tschaub/gh-pages) npm package:
   ```bash
   npm install --save-dev gh-pages
   npx gh-pages -d dist
   ```
3. Enable GitHub Pages in your repo settings pointing to the `gh-pages` branch.
4. Add your Auth0 callback URL (`https://your-username.github.io/CampusCare`) to your Auth0 application's **Allowed Callback URLs** and **Allowed Web Origins**.

### Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git**.
2. Set **Build command** to `npm run build` and **Publish directory** to `dist`.
3. Add `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` under **Site settings → Environment variables**.
4. Click **Deploy**.

### Vercel

```bash
npm i -g vercel
vercel
```

Add both environment variables in the Vercel dashboard under **Project Settings → Environment Variables**.

> **Important for all deployments:** Add your live URL to Auth0's **Allowed Callback URLs**, **Allowed Logout URLs**, and **Allowed Web Origins** in your Auth0 application settings.

---

## 🧪 Testing

The project uses [Playwright](https://playwright.dev/) for end-to-end testing.

```bash
# Install browsers (first time)
npx playwright install

# Run all tests
npx playwright test

# Run with UI mode
npx playwright test --ui

# View test report
npx playwright show-report
```

Test files are located in the `tests/` directory:
- `homepage.spec.ts` — Validates landing page rendering and Auth0 login flow
- `example.spec.ts` — Baseline Playwright example test

---

## 🎓 Academic Context

CampusCare was developed as part of the **Transforming Ideas to Innovation (TII)** course, following the complete Design Thinking framework:

| Phase | Activity |
|-------|---------|
| **Empathize** | Student surveys and interviews to identify pain points |
| **Define** | Root problem framing — late awareness of academic risk |
| **Ideate** | Solution architecture and feature planning |
| **Prototype** | Working platform development |
| **Test** | Iterative refinements, bug fixes, and E2E testing |

---

## 🔮 Future Improvements

- Push notification system for attendance risk alerts
- Performance prediction model based on historical trends
- AI-based academic insights and recommendations
- Mobile app version (React Native / PWA)
- Cloud sync option for cross-device access

---

## 👤 Author

**Parteek Garg**

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with the Design Thinking framework to make academic visibility proactive, not reactive.

⭐ Star this repo if you found it useful!

</div>
