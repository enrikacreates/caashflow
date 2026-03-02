# Caashflow — Claude Project Memory

## What This App Is
Budget management system for modern creative/entrepreneurial families. App #1 in a ~5-app lifestyle suite. Each app is independent (separate repo, separate Supabase project) and connected via shared studio brand DNA — **not** a shared auth platform.

**Domain:** caashflow.app
**Studio brand:** TBD (working name: Small Gorilla Creative)
**Design inspiration:** Not Boring Apps (standalone apps, cohesive brand)

---

## Tech Stack
- **Framework:** Next.js 16.1.6 (App Router, Turbopack)
- **Auth + DB:** Supabase (`@supabase/ssr` v0.8.0, `@supabase/supabase-js` v2.97.0)
- **Supabase key env var:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (not the usual ANON_KEY — this is the newer publishable key format)
- **Styling:** Tailwind CSS v4
- **Language:** TypeScript
- **Deploy:** Vercel
- **Dev server:** `npm run dev` on port 3000 (use `preview_start` with config `caashflow-dev`)

## Key Conventions
- Server actions live in `app/actions/` — always `'use server'`, always validate `household_id`
- Client components in `components/` — named by feature area (e.g. `components/periods/`, `components/settings/`)
- All DB access goes through Supabase server client (`lib/supabase/server.ts`) — never query directly from client components
- `getUserHouseholdId()` in `lib/supabase/helpers.ts` is the standard way to get the current user's household — reuse it everywhere
- Middleware is in `middleware.ts` (deprecated name — should be `proxy.ts` per Next.js 16 but not yet renamed)
- Route groups: `app/(dashboard)/` wraps all protected routes — `app/login/` is public

## Database Tables
| Table | Purpose |
|-------|---------|
| `households` | Family/org unit — central entity |
| `household_members` | User ↔ household join (role: owner\|member) |
| `settings` | Deduction percentages (1:1 with household) |
| `base_budget_items` | Master expense template |
| `budget_periods` | Pay periods |
| `period_expenses` | Expenses copied into a period |
| `period_linked_invoices` | Many-to-many: periods ↔ invoices |
| `period_manual_income` | One-off income per period |
| `invoices` | Income/invoice tracking |
| `budget_requests` | Wish-list items |

**RLS:** Enabled on all tables. Users access data only through their `household_id`.
**New user trigger:** `handle_new_user()` auto-creates household + settings + owner membership on signup.

## Known Issues / Tech Debt
- `app/actions/periods.ts` and `app/actions/period-expenses.ts` have duplicate exports — consolidate into `period-expenses.ts` (it has proper `household_id` validation)
- `middleware.ts` should be renamed to `proxy.ts` (Next.js 16 deprecation warning)
- Accounts and priority categories are hardcoded in `lib/constants.ts` — should be DB-driven

## Roadmap (see full plan at `.claude/plans/roadmap.md`)
### NOW
1. ⭐ Household Member Invite + Budget Scope (personal vs household)
2. Fix duplicate server actions + rename middleware
3. ✅ Dynamic Accounts & Priority Categories (CRUD)
4. ✅ Debt Paydown (progress tracking, payoff date, confetti)
5. Savings Goals
6. Budget Period Status (incomplete/complete/closed/archived)
7. Budget Request → Period Linking

### NEXT
8. CSV Import/Export
9. Bulk Edit / Multi-Select
10. Analytics & Charts (Recharts)
11. Due Date Alerts

### LATER
12. Visual Redesign (designer-led, Figma → implementation)
13. Micro-interactions & Confetti polish
14. App Switcher + Studio brand footer links
15. Email Notifications
16. Mobile / PWA

## Important Notes for Agents
- Always run the dev server via `preview_start "caashflow-dev"` before testing UI changes
- Use `preview_logs` to check for server errors after edits
- Use `preview_screenshot` or `preview_snapshot` to verify visual changes
- The user is a designer — don't make unsanctioned visual changes without checking first
- The LATER visual redesign is a **collaboration** — the user will design in Figma and work through it together
- `caashflow.app` domain is the target — `.com` is taken
