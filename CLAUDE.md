# CLAUDE.md — GXP Tenant Dashboard (Frontend)

The hotel-facing dashboard (Next.js) — **this is the product our paying clients see every day.** Quality bar is commercial SaaS, noticeably above internal-tool level. Users are hotel staff in Egypt/MENA; for many, this is the first dashboard they've ever used. Epic markdown files are the source of truth for features; this file is the standing law between them.

## Tenant context

- Tenant resolved from subdomain (`{slug}.domain`) with `/t/{slug}` path fallback. Unknown slug → branded 404; suspended hotel → locked page; expired trial → read-only mode with conversion banner. URLs never break.
- The hotel's own name + logo lead the shell; GXP is "Powered by GXP" in the footer — their system, our platform underneath.
- All API calls rely on the session's tenant; never send or trust a client-side hotel id.

## Design system (Epic 08 — established, reuse, don't reinvent)

- Brand tokens: navy `#0E2A47` primary, gold `#C8A24A` accent (sparingly; never gold text on white — fails contrast). Typography scale, spacing rhythm, button hierarchy (primary/secondary/ghost/destructive), form field states — all defined; new modules consume them.
- Designed empty states (never a blank table), skeleton loading (no spinners-only, no layout jumps), micro-transitions on modals/dropdowns/banners.
- Trial countdown and read-only banners are **conversion surfaces** — treat their design and copy accordingly.
- Responsive to tablet (front desk reality): collapsible sidebar, responsive table strategy, touch targets. Desktop-first, tablet-verified.
- Accessibility floor: WCAG AA contrast, visible focus states, correct labels.

## Guidance layer (Epic 12 — part of definition of done, no exceptions)

- Every new form, filter, list, status, and confirmation ships WITH its guidance: FieldHelp (rule + realistic example), InfoTips on status badges and non-obvious columns, PageIntro per page, permission-gated empty-state CTAs, dismissible HintCards where a page has non-obvious powers.
- InfoTip is tap-first (popover on touch, hover as enhancement) — no hover-only information.
- Hierarchy discipline: placeholder = example, FieldHelp = rule, InfoTip = deeper context — never three saying the same thing.
- "No results matching filters" (with clear-filters action) and "truly empty" (designed empty state) are two distinct screens.
- Confirmations use ConsequenceNote: what happens, what's reversible, with counts ("سيتم إنشاء 28 غرفة"). Destructive-red only for irreversible actions.
- Validation messages teach ("allowed: lowercase letters, digits, . _ -"), never scold ("invalid input").

## i18n & RTL

- Full AR/EN, namespaced locale files incl. `guidance.*`; parity check must pass; no hardcoded user-facing strings.
- Arabic register: professional فصحى مبسطة — clear, warm, never condescending. Latin digits both languages. ICU plurals (Arabic has 6 forms).
- Logical CSS properties only; bidi isolation around usernames, emails, URLs in Arabic text; directional icons mirror in RTL.
- API errors map from stable error codes to translated strings.

## Established flows (keep consistent)

- One-time secrets (temp passwords, invite links) display once with copy button + explicit "won't be shown again" copy — highest-stakes copy in the product.
- Add Staff = one screen, two paths: invite by email (default) / create directly with username + temp password.
- Bulk operations (rooms range, Excel import) follow preview → confirm; previews show per-row errors and remaining plan seats/rooms.
- Setup-steps block on home checks off from real data and disappears when complete.

## Quality bar

- Component tests (@testing-library + jsdom via environmentMatchGlobs) for interactive components; unit tests for logic; i18n parity check; TypeScript build clean — always.
- Reuse the guidance kit and design-system components; ad-hoc one-off UI patterns are a review failure.

## Specs

Feature specs live in the backend repo (`gxp-backend`) under `/specs`. Before
planning or implementing any feature, read its epic file fully — it is the source of
truth. Durable decisions made during Q&A go back into the epic file.

## Workflow (pre-production convention — revisit at launch)

- All work happens directly on `master`; `main` (the GitHub default) is
  fast-forwarded and pushed alongside it on every push so the default branch
  is never stale. No feature branches, no stacked epic branches, no worktrees.
- Small, clear commits per task; push to origin after each verified green
  state — origin always holds the latest work.
- Quality gates never relax: `npm test` + `npm run build` (includes the i18n
  parity check) must be green before every push. Never push red.
- Changes spanning repos land backend-first, then the frontends.


## Model Discipline (execution workflow law)

This project runs a fixed model assignment per phase. These are standing
rules, not suggestions:

1. **Planning** runs on the strongest available model (Fable-class). Plans
   read the epic spec + this file fully before proposing anything.

2. **Execution** (implementing plan tasks) runs on Sonnet. Per-task reviews
   and their fix rounds also run on Sonnet — they verify task-level
   correctness, not architecture.

3. **Final whole-epic review is a hard checkpoint:** when all plan tasks
   (including fix rounds) are complete and the epic is otherwise ready,
   STOP before starting the final review. Announce: "Ready for final
   review — switch the model now." Wait for the user to switch (they will
   run /model) and confirm before proceeding. Never run the final
   whole-epic review on the execution model, and never skip it.

4. **The final review re-verifies from scratch:** every acceptance
   criterion in the epic spec, cross-cutting concerns (tenant isolation,
   permission gating, i18n parity, budget/perf gates), and consistency
   with this file's conventions. It does not trust per-task review
   conclusions — it re-checks. Findings are classified must-fix vs
   recommendation; must-fixes land before push.

5. **After final-review fixes**, the fix verification may run on the
   execution model, but any NEW must-fix found during verification
   re-triggers rule 3.

6. If a mid-session model switch happens for any other reason (e.g., a
   flagged-message fallback), note it in the final report so the user
   knows which phases ran on which model.