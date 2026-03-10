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
| `base_budget_items` | Master expense template (has `debt_id`, `savings_goal_id` FK) |
| `budget_periods` | Pay periods |
| `period_expenses` | Expenses copied into a period (has `debt_id`, `savings_goal_id` FK) |
| `period_linked_invoices` | Many-to-many: periods ↔ invoices |
| `period_manual_income` | One-off income per period |
| `invoices` | Income/invoice tracking |
| `budget_requests` | Wish-list items |
| `debts` | Debt tracking (balance, interest, payments) |
| `savings_goals` | Savings goals (purchase 🎯 / fund 🌱 types) |
| `accounts` | User-defined account categories |
| `priority_categories` | User-defined priority categories with colors |

**RLS:** Enabled on all tables. Users access data only through their `household_id`.
**New user trigger:** `handle_new_user()` auto-creates household + settings + owner membership on signup.

## Incoming Caashflow (Invoices) Feature
- **Route:** `/invoices` (also accessible at `/cashflow` — both render the same `InvoicesClient`)
- **Page title:** "Incoming Caashflow" — generic income tracker, not just invoices
- **Form fields:** "Source *" (client_name in DB), "Description" (project_name in DB) — generic labels, works for invoices, gifts, sales, etc.
- **Status flow:** projected → sent → received (skip "sent" for non-invoice income)
- **Budget assignment:** available in the edit modal for `received` invoices only
  - `invoices.budgeted` (boolean) auto-sets `true` when linked to any period, clears when all links removed
  - Edit modal shows a clickable link to the period (e.g. "Mar 2026 →") when budgeted, or a dropdown picker when not
  - Link navigates to `/periods/[periodId]`
- **Period join:** `getInvoices()` joins `period_linked_invoices → budget_periods` to get the linked period name/id
- **`Invoice` type** has optional `period_linked_invoices` array with nested `budget_periods` shape

## Budget Periods Feature
- **`budget_periods.period_month`** — `DATE` column storing first-of-month for the budgeted calendar month (e.g. `2026-04-01`)
- **`CreatePeriodModal`** — has a month picker that defaults to next month; auto-updates the period name as the month changes
- **`createBudgetPeriod` action** — converts `"YYYY-MM"` from `<input type="month">` to `"YYYY-MM-01"` before storing

## Budgeting Model & Dashboard Calculations

**Model:** Priority-based budgeting for irregular income. Income arrives in multiple checks throughout a month. Expenses are paid in priority order as income comes in. Process continues until income is used up or all expenses are paid — surplus goes to savings/debt.

**Key flags on `period_expenses`:**
- `pay_now` — decision point: "I'm paying this from this period's income"
- `paid` — tracks whether the expense has actually been paid

### Dashboard Stat Cards (`app/(dashboard)/page.tsx`)

| Card | Value | Calculation | Gauge |
|------|-------|-------------|-------|
| **Income** | `income_amount` | Period income | Compares to `monthly_income_goal` (settings) or `monthlyExpenses` fallback |
| **Remaining** | `amountLeft` | `incomeAfterDeductions − calculatePaidTotal(expenses)` | Proportional to income; green if positive, red if over |
| **Pay Now** | `payNowTotal` | `calculatePayNowTotal(expenses)` — `pay_now && !paid` | Lower ratio to income = healthier |
| **Expenses** | `monthlyExpenses` | `calculateMonthlyEquivalent(baseItems)` — all base budget items normalized to monthly | Compares to `monthly_expense_goal` (settings) or income fallback |

### Calculation functions (`lib/calculations.ts`)

| Function | Filter | Purpose |
|----------|--------|---------|
| `calculatePayNowTotal` | `pay_now && !paid` | Unpaid items flagged for payment — what's left to pay |
| `calculatePaidTotal` | `pay_now && paid` | Paid items — money already deployed from income |
| `calculateMonthlyEquivalent` | All base items | Normalizes Weekly (×52/12), Annual (÷12), excludes One-Time |
| `calculateDeductions` | N/A | Tithe + savings + tax + profit + fun money off gross income |

**Flow:** Checking an expense as `paid` moves it from Pay Now → reduces Remaining. Goal is Remaining = $0 (every dollar deployed).

## Known Issues / Tech Debt
- `app/actions/periods.ts` and `app/actions/period-expenses.ts` have duplicate exports — consolidate into `period-expenses.ts` (it has proper `household_id` validation)
- `middleware.ts` should be renamed to `proxy.ts` (Next.js 16 deprecation warning)
- ~~Accounts and priority categories are hardcoded in `lib/constants.ts`~~ → ✅ Now DB-driven (accounts + priority_categories tables)

## Deployment
- **Production URL:** caashflow.app (hosted on Vercel)
- **Vercel project:** `caashflow` / team `enrika-greathouses-projects`
- **`.vercel/project.json`** links to `prj_lv9DD8tX3roHPJ0BnTlEwOyZMtv7` / `team_34AYhElACT1dHoEJEsadEdqy`
- **Deploy command (no git remote):** `npx vercel deploy --prod` from project root
- **Deploy command (with GitHub connected):** `git push origin main` — auto-deploys on push to main
- **GitHub status:** Connected — repo `enrikacreates/caashflow`, auto-deploys on push to main
- **DNS status:** Vercel recommends switching Namecheap A record → CNAME `cname.vercel-dns.com`

## Roadmap (see full plan at `.claude/plans/roadmap.md`)
### NOW
1. ⭐ Household Member Invite + Budget Scope (personal vs household)
2. Fix duplicate server actions + rename middleware
3. ✅ Dynamic Accounts & Priority Categories (CRUD)
4. ✅ Debt Demo (progress tracking, payoff date, confetti)
5. ✅ Savings Goals (purchase + fund types, linked budget items, confetti)
6. ✅ Incoming Caashflow — generic income tracker (invoices, gifts, sales) with budget period linking
7. Budget Period Status (incomplete/complete/closed/archived)
8. Budget Request → Period Linking

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
