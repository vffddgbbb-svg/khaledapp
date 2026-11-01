<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep authenticated content under the managed pathless layout and use current Cloud clients; this preserves session gating and database ownership.
- First-admin role assignment must use a service-role-only RPC with a transaction advisory lock after server token verification; this prevents concurrent claims.
- Import assignments through an admin-gated transactional RPC after client preview and exact member/type resolution; this avoids invented rows and duplicate saves.
- Register the generated app-shell service worker only through the guarded wrapper; cache assets and an offline notice, never private HTML or API responses.
- Use the shared shell for a single Realtime subscription and mobile navigation; this keeps shared changes consistent across views.

- Use the admin-gated save_shift RPC for manual shift creation and editing; enforce assignment uniqueness in the database so concurrent writes and imports cannot duplicate rows.
