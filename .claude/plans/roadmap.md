# Caashflow Roadmap

_Last updated: 2026-03-02 (Savings Allocation + % | $ Toggle in progress)_

---

## NOW

### 1. ✅ Household Member Invite + Budget Scope
**Status:** Complete
- Invite members to a household via email
- Roles: owner vs member
- Budget scope: personal vs household visibility

### 2. ✅ Fix Duplicate Server Actions + Rename Middleware
**Status:** Complete
- Consolidated server actions
- Renamed middleware per Next.js 16 convention

### 3. ✅ Dynamic Accounts & Priority Categories
**Status:** Complete (landed in commit `eeb5697`)
- Accounts and priority categories moved from `lib/constants.ts` to DB
- CRUD UI in settings

### 4. ✅ Debt Demo
**Status:** Complete (renamed from "Debt Paydown" — demolition wordplay 🔨)
- Track debts (name, starting balance, current balance, interest rate)
- Progress bar toward $0, estimated payoff date
- Big confetti on paid off, small confetti for payments exceeding minimum
- `debts` table + RLS, full CRUD, `logPayment` + `markPaidOff` actions
- Paid off section collapses at bottom

### 5. ✅ Savings Goals
**Status:** Complete (landed in commit `5b7598c`)
- Two goal types: **Purchase** (🎯 blue accent, deadline-driven) and **Fund** (🌱 green accent, ongoing)
- Progress tracking, inline contributions, monthly contribution goals
- Fund overflow: animated pulse glow when current > target, shows "+$X over"
- Big confetti on goal achieved, small confetti on exceeds monthly contribution
- Linked budget items: auto-contribute when period expense marked paid
- `savings_goals` table + RLS, full CRUD
- `base_budget_items.savings_goal_id` + `period_expenses.savings_goal_id` FK columns

### 6. Budget Period Status
**Status:** Not started
- Status states: incomplete / complete / closed / archived
- Visual indicators on period list
- Possibly lock editing on closed/archived periods

### 7. Budget Request → Period Linking
**Status:** Not started
- Connect wish-list items (`budget_requests`) to active budget periods
- Approve a request → it becomes a `period_expense`

---

## NEXT

### 8. CSV Import/Export
- Export period expenses, invoices to CSV
- Import base budget items from CSV

### 9. Bulk Edit / Multi-Select
- Multi-select expenses in a period
- Bulk delete, bulk categorize, bulk mark paid

### 10. Analytics & Charts
- Recharts-based visualizations
- Spending over time, income vs expenses, category breakdown

### 11. Due Date Alerts
- Flag expenses with due dates approaching
- In-app alerts (email notifications in LATER)

---

## LATER

### 12. Visual Redesign
- Designer-led — Enrika designs in Figma, then implements together
- Do NOT make unsanctioned visual changes before this phase

### 13. Micro-interactions & Confetti Polish
- Delight layer on top of the redesign

### 14. App Switcher + Studio Brand Footer
- Links to other apps in the suite
- Small Gorilla Creative brand presence

### 15. Email Notifications
- Due date reminders, invite emails, payoff celebrations

### 16. Mobile / PWA
- Responsive audit + PWA manifest
