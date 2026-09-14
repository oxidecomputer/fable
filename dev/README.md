# dev

A minimal deck directory for developing the package — Fable is centrally hosted, so there's
no consumer starter to scaffold; this exists only so `npm run dev` (from the repo root) has
a cwd to run `fable dev` against.

Needs a `.env` with `LIVEBLOCKS_SECRET_KEY` (see CLAUDE.md); set `FABLE_THEME` there to work
on a non-default theme, e.g. `FABLE_THEME=oxcon26`.
