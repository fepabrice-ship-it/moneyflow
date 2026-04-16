# MoneyFlow — Global Project Analysis

> **Audit Date:** April 13, 2026  
> **Codebase:** 12 source files • 93 KB • 7 commits • React 19 + Supabase + Capacitor

---

## 1. Executive Summary

| Dimension | Score | Verdict |
|-----------|-------|---------|
| **Value Proposition** | ⭐⭐⭐⭐ | Solves a real, personal pain point well |
| **Architecture** | ⭐⭐⭐ | Solid for MVP, needs structure for growth |
| **Code Quality** | ⭐⭐⭐ | Clean but has accumulation of logic debt |
| **Security** | ⭐⭐⭐ | RLS is well thought out; some gaps remain |
| **UI/UX** | ⭐⭐⭐⭐ | Premium dark theme, mobile-first, polished |
| **Database Design** | ⭐⭐⭐⭐ | Normalized, well-constrained, production-ready |
| **Scalability** | ⭐⭐ | Will struggle beyond ~3 projects / 500 tx |

**Overall Verdict: A strong personal MVP that genuinely delivers value.** It's well beyond a weekend hack project — the financial logic (dual cash/performance tracking, carry-over, investment balance) shows real domain thinking. But it's reached the point where the architecture needs to catch up with the feature ambition.

---

## 2. Does It Bring Value?

### ✅ Yes — and here's why it's not just "another expense tracker"

Most expense trackers stop at `income - expenses = balance`. MoneyFlow goes deeper with three differentiating features:

1. **"Safe-to-Spend" (Reste à Vivre)** — Subtracts obligations *before* showing available cash. This is a genuinely useful mental model for someone in an FCFA economy where fixed costs (tontines, rent, utilities) eat a large % of income.

2. **Multi-project architecture** — The ability to track personal finances AND a business side-project in separate "projects" with different accounting logic (`standard` vs `continuous` vs `investment`) is a real differentiator. Most personal finance apps don't do this.

3. **Collaborative projects** — Inviting members by email and tracking who made each transaction adds accountability — relevant for shared businesses or household expenses.

### ⚠️ What limits its value today

- **No recurring transaction automation** — The `recurring_obligations` table exists but there's no code to auto-generate transactions from it. It's just a reference number for dashboard math.
- **No data export** — No CSV/PDF export, no way to back up your financial history.
- **No charts/visualization** — Recharts is installed but unused. The spec mentions "vue d'ensemble circulaire" which doesn't exist yet.
- **No notifications/reminders** — No nudge when you approach a budget limit.

---

## 3. Architecture Review

### What's good

```
src/
├── App.jsx              ← Router + shell (tab-based, not URL-based)
├── components/          ← 7 focused view components
├── contexts/            ← Single ProjectContext (clean)
├── lib/                 ← Supabase client init
└── main.jsx             ← Entry point
```

- **Flat, simple structure** — Easy to navigate, nothing hidden.
- **Single context provider** — `ProjectContext` cleanly manages project + member state.
- **Supabase as BaaS** — Good choice: auth, RLS, real-time all built in without a custom backend.

### What's concerning

| Issue | Impact |
|-------|--------|
| **No routing library used** | Tab-based navigation via `useState`. No deep linking, no URL history, no back-button support. `react-router-dom` is installed but **not used at all**. |
| **No custom hooks** | All data fetching logic lives inside component `useEffect` blocks. Components are 300-400 lines because they handle fetch + filter + render + format. |
| **`window.dispatchEvent('refresh-data')`** | Global event bus pattern used for cross-component data sync. This is fragile and doesn't scale — it bypasses React's data flow entirely. |
| **No error boundary** | A single Supabase outage crashes the entire app with no fallback UI. |
| **No loading states between tab switches** | Switching tabs has no transition — data flashes in from cache then re-fetches. |

---

## 4. Code Quality — File-by-File

### [Dashboard.jsx](file:///c:/Users/brayc/Documents/Phantomhive/dev/expense%20tracker/src/components/Dashboard.jsx) (364 lines) — ⚠️ Most complex file

- **Dual tracking logic** (cash flow vs performance) is impressive but hard to follow. ~70 lines of `forEach` with 12+ running counters and branching on `catName === 'Investissement'`.
- The business logic is **NOT reusable** — if you later want to show the same numbers in a report or notification, you'd have to duplicate this entire block.
- `fetchData()` fires on every `viewMode` or `memberFilter` change — it re-fetches **all** transactions from Supabase every time, even though only the local aggregation changes.

> [!WARNING]
> **Critical:** Line 76-78 fetches ALL transactions for the project with no pagination. For a project with 1000+ transactions, this query will become noticeably slow and expensive.

### [TransactionsList.jsx](file:///c:/Users/brayc/Documents/Phantomhive/dev/expense%20tracker/src/components/TransactionsList.jsx) (379 lines)

- Duplicates summary calculation logic from Dashboard (lines 127-136).
- Search filtering happens client-side after full fetch — works fine for MVP scale.
- No pagination — all transactions for the month/global view render at once.
- Typo on line 256: `Touts` → should be `Tous`.

### [TransactionModal.jsx](file:///c:/Users/brayc/Documents/Phantomhive/dev/expense%20tracker/src/components/TransactionModal.jsx) (277 lines)

- Clean form component, good mobile drawer UX.
- **No form validation beyond `required`** — no max amount check, no negative amount check, no date range validation.
- `alert(err.message)` for error display — should use inline toast or error state.
- Categories are re-fetched every time the modal opens. These rarely change and should be cached.

### [Settings.jsx](file:///c:/Users/brayc/Documents/Phantomhive/dev/expense%20tracker/src/components/Settings.jsx) (381 lines)

- Longest file but well-organized with clear sections.
- `alert()` used 4 times for success/error feedback.
- The `handleInvite` function uses `rpc('get_user_id_by_email')` — this is a **SECURITY DEFINER** function that exposes whether an email exists in the system.

### [ProjectContext.jsx](file:///c:/Users/brayc/Documents/Phantomhive/dev/expense%20tracker/src/contexts/ProjectContext.jsx) (158 lines)

- Well-structured with `useCallback` + `useMemo` for performance.
- Good use of `localStorage` for persisting last active project.
- The `fetching` guard (line 46) prevents double-fetch race conditions — nice detail.

### [Auth.jsx](file:///c:/Users/brayc/Documents/Phantomhive/dev/expense%20tracker/src/components/Auth.jsx) (116 lines)

- Simple, functional. 
- `alert('Check your email for the confirmation link!')` on signup — should be an inline message.
- No "forgot password" flow.
- No OAuth (Google, etc.) — might be intentional for simplicity.

### [Onboarding.jsx](file:///c:/Users/brayc/Documents/Phantomhive/dev/expense%20tracker/src/components/Onboarding.jsx) (185 lines)

- Actually the best-written component. Clean step-based flow, great UX micro-copy, nice animations.
- 👏 The project type selection UI is premium.

---

## 5. Database & Security Assessment

### Schema Design — ✅ Well done

- Proper UUID primary keys everywhere.
- `CHECK` constraints on type enums (prevents bad data).
- `UNIQUE` constraints prevent duplicate budgets/memberships.
- `ON DELETE CASCADE` on memberships — correct relational design.
- `SECURITY DEFINER` helper function to avoid RLS recursion — this is a mature pattern.

### RLS Policies — ✅ Solid, with one gap

The `is_project_member()` and `get_auth_project_ids()` pattern is clean. All data tables are properly locked behind membership checks.

> [!CAUTION]
> **Security Gap:** The `categories` table has **NO RLS enabled**. It's a shared global table, which is fine for read access, but any authenticated user can `INSERT`, `UPDATE`, or `DELETE` categories. This means one malicious or buggy user can corrupt categories for everyone.

> [!WARNING]
> **`get_user_id_by_email` RPC** — This function lets any authenticated user check if an arbitrary email exists in your auth.users table. This is an information disclosure vulnerability. Consider rate limiting or using invite tokens instead.

### Migration Strategy — ⚠️ Manual & fragile

- Three separate `.sql` files at root level, not managed by any migration tool.
- No version tracking, no rollback capability.
- The migration script (April 11) has good defensive patterns (`IF NOT EXISTS`, `DO $$ EXCEPTION`).
- But running these manually against a live database is risky.

---

## 6. UI/UX Critique

### Strengths
- **Premium dark theme** — The glassmorphism cards, blur effects, and color palette are genuinely polished.
- **Mobile-first** — Bottom nav, drawer modal, compact project selector chips — all feel native-app-quality.
- **Typography system** — Inter font, uppercase tracking-widest labels, font-black headings — consistent brand.
- **French localization** — All labels and copy are in French, appropriate for the target audience.

### Weaknesses
- **No visual feedback on success** — Every mutation uses `alert()`. This breaks immersion completely.
- **No data visualization** — The spec calls for pie charts and progress bars. Recharts is installed but unused.
- **Budget page typo** — "Budgets Menusels" should be "Budgets Mensuels" ([Budgets.jsx:109](file:///c:/Users/brayc/Documents/Phantomhive/dev/expense%20tracker/src/components/Budgets.jsx#L109)).
- **No skeleton loaders** — Components show a single spinner. Skeleton loaders would feel faster.
- **Hardcoded `bg-[#1a1a1a]`** — Appears in TransactionsList selects instead of using the theme variable `bg-muted`.
- **No animations between tabs** — Switching tabs is instant, no `AnimatePresence` from framer-motion (which is installed).

---

## 7. Missing from the Spec

Comparing the [specifications.md](file:///c:/Users/brayc/Documents/Phantomhive/dev/expense%20tracker/specifications.md) against what's built:

| Spec Item | Status |
|-----------|--------|
| Safe-to-Spend dashboard | ✅ Implemented |
| Circular breakdown chart (Fixe vs Variable) | ❌ Missing |
| Mobile-first quick entry | ✅ Implemented (FAB + modal) |
| Color feedback bar (green → red) | ❌ Missing (only in budget page, not main dashboard) |
| FCFA formatting (no decimals) | ✅ Implemented |
| Instant recalculation on change | ⚠️ Partial (requires full page refresh via event) |
| Automated tontine calendar logic | ❌ Not implemented |

---

## 8. Critical Issues (Fix ASAP)

### 🔴 1. No pagination on transaction queries
Dashboard fetches ALL transactions for a project (`txAllRes` line 76), with no `.limit()` or `.range()`. This will cause:
- Slow dashboard loads as data grows
- Excessive Supabase bandwidth usage
- Potential timeout errors

### 🔴 2. Categories table is unprotected
Any authenticated user can mutate categories. Add RLS:
```sql
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read categories" ON public.categories FOR SELECT TO authenticated USING (true);
-- No INSERT/UPDATE/DELETE for regular users
```

### 🔴 3. `.env` file is 321 bytes — likely committed to git at some point
`.gitignore` has `.env` but check `git log -p --follow .env` to verify it wasn't committed in an earlier commit. If it was, your Supabase keys are compromised.

### 🔴 4. `react-router-dom` installed but unused
This is a 50KB dependency adding to bundle size for zero benefit. Either use it (recommended) or remove it.

---

## 9. High-Priority Improvements

### 🟡 Extract business logic into custom hooks
```
src/hooks/
├── useFinancialSummary.js    ← Dual tracking + investment logic
├── useTransactions.js         ← Fetch + filter + paginate
├── useCategories.js           ← Fetch + cache categories
└── useBudgets.js              ← Budget CRUD + calculations
```
This makes Dashboard and TransactionsList ~100 lines each instead of 360+.

### 🟡 Replace `alert()` with toast system
Use a lightweight toast library or build one with framer-motion. Every `alert()` in the codebase breaks the premium UX.

### 🟡 Implement proper routing with `react-router-dom`
- `/` → Dashboard
- `/transactions` → TransactionsList  
- `/budgets` → Budgets
- `/settings` → Settings
- This enables deep linking, back button, and shareable URLs.

### 🟡 Add Recharts visualizations
The dependency is already installed. Add at minimum:
- A donut chart showing Obligations vs Loisirs vs Épargne breakdown
- A trend line of monthly spending over time

### 🟡 Use Supabase migrations properly
Move SQL files into a `supabase/migrations/` directory with timestamps. Use `supabase db push` for deployment.

---

## 10. Future Feature Suggestions

| Feature | Effort | Impact |
|---------|--------|--------|
| **Auto-generate recurring transactions** | Medium | 🔥 High — this is the main gap in the spec |
| **CSV/PDF export** | Low | Medium — important for tax/accounting |
| **Budget alert system** | Medium | High — push notifications via Capacitor |
| **Multi-currency support** | Low | Low — nice to have for dual FCFA/EUR users |
| **Offline mode** | High | 🔥 High — critical for mobile in low-connectivity areas |
| **Dark/Light theme toggle** | Low | Low — currently hardcoded dark only |
| **Transaction attachments (receipt photos)** | Medium | Medium — Supabase Storage is ready |
| **Dashboard date range picker** | Low | Medium — currently locked to current month |

---

## 11. Final Verdict

**MoneyFlow is a genuinely useful personal finance tool that solves a real problem for its target user.** The financial logic is more sophisticated than 90% of expense trackers I've seen at this stage, and the UI quality is above average.

**The main risk is technical debt.** The codebase has reached the inflection point where adding more features will compound complexity unless you refactor now. The three highest-ROI investments are:

1. **Extract hooks** — separate data logic from rendering
2. **Add routing** — unlock deep links and proper navigation
3. **Protect categories + paginate queries** — prevent the two biggest production risks

It's a project worth continuing. 🚀
