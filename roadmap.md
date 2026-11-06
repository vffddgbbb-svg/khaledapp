# Roadmap

## Verified November 6, 2026
- [x] Correct the stale invalid-day test: malformed nonempty sources reject the entire import, never silently drop assignments.
- [x] Reject impossible full dates in parseDay; add invalid-month and leap-year regressions.
- [x] Unit tests: 65/65 passed across 7 files. Includes both grid directions, flat CSV/HTML, unlinked names, pagination, duplicates, source-cell rejection, read-back keys and roster statistics.
- [x] Full-project lint: zero errors, six existing Fast Refresh warnings in shared UI files. Format application-owned files only; exclude integration-generated files from lint.
- [x] Harness build: build OK at 00:08:19 UTC. Standalone typecheck not run: environment instructions reserve builds/typechecks for the harness; do not report a separate typecheck pass.
- [x] Read-only connected schema/RLS/RPC review: six scheduling tables only; all have RLS. Admin-only writes and swap owner restrictions are present. Sensitive RPCs deny anon execution, imports/reviews check auth.uid and admin, cancel scopes to requester, first-admin RPC denies authenticated execution.
- [x] Preserve data: read-back count 1193 shifts, 8 shift types, 3 profiles. No data writes, test records, migrations, connection/secret changes or production publish in this round.
- [x] Module readiness: emergency, blood-bank, handoff, notes, medications and follow-up remain ready:false and honestly marked قيد التجهيز; no clinical calculators or patient data added.
- [x] Training statistics use queried rows and exact identities; all training years remain unclassified because no dedicated field exists. No scheduling field repurposed.
- [x] Browser smoke check: public login pages render; signed-out /modules/handoff redirects to /auth; 390px mobile login has no horizontal overflow; no page errors observed.

## Blocked or deferred
- [ ] Authenticated browser/admin/member flows: no app account matches the requesting user; automatic session mint failed. Do not select another account without authorization. No save/swap/Realtime success claimed this round.
- [ ] Handoff, standalone notes and blood-bank CRUD: dedicated tables do not exist in the connected schema. Requires a documented, explicitly authorized storage change; do not substitute another database or misleading local storage.
- [ ] Persisted training-year classification: requires dedicated approved storage.
- [ ] Doctor/supervisor/department access: existing roles are admin/member only; no department ownership model. Current authenticated users can read the team schedule, as current policies specify.
- [ ] Android/iPhone installation and offline behavior on production: source preserved, not reverified in this round; preview deliberately disables service-worker installation.
- [ ] Real original-file import: requires the actual full source file and an authorized session. No import performed.
- [ ] Optional privilege minimization: table GRANTs are broad, including anon SELECT, but RLS has no anon policies; no public row access is authorized. Changing grants is outside this no-migration round.
- [ ] Production publishing: explicitly prohibited this round; preserve the existing hosting target.

## Files changed this round
Behavior/tests: `src/lib/schedule-import.ts`, `src/test/schedule-import.test.ts`.
Lint/tooling: `eslint.config.js`. Documentation: `roadmap.md`, `AGENTS.md`.
Formatting only: `vite.config.ts`; components `form-select`, `install-app`, `schedule-importer`, `sign-in-form`, `states`, `theme-toggle`, `training-roster`, `welcome`; libraries `admin.functions`, `import-validation`, `modules`, `pwa-policy`, `register-pwa`, `roster-summary`, `schedule-view`; `src/pwa.d.ts`; routes `__root`, `auth`, `index`, `reset-password`, `setup`, and authenticated `audit`, `dashboard`, `home`, `members`, `modules.$slug`, `profile`, `swaps`; tests `grid-import`, `import-rejection`, `roster-summary`, `source-cell-validation`.
