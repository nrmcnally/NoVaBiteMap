# BiteMap NOVA — Checkpoint 2026-07-17

Picks up from `docs/HANDOFF_2026-07-15.md`. Branch: `feat/intelligence-core-fish-guide`
(all work committed + pushed to `github.com/nrmcnally/NoVaBiteMap`).

## TL;DR

Phase 1 is **functionally complete and green**. The product works; hosting is
**intentionally deferred** — run it locally for now (one command below). No work is
lost; the hosting detour only touched deploy config, not the app.

## Done this session

- **Data-honesty fixes (all committed):**
  - Removed the fabricated hourly-bite fallback chart that rendered invented
    numbers under a "did not fabricate" banner (`a4e68de`).
  - Closed the rejection-ledger modeled bypass so a reviewer-removed
    (location, species, source) triple can't reappear via a modeled tier — and
    made the `EVIDENCE_METHODOLOGY` "can never reappear" claim actually true (`0375b92`).
- **Rejection-ledger audit + coverage re-adds (`05671cb`):** audited all 105
  rejections (0 misread their source), then re-added **40 tidal-Potomac species**
  across 10 access points that VAFWIS documents at the exact water but had been
  removed with a generalization source. Evidence 1443 → 1483.
- **Alpha hardening (`b5e5604`):** `/health` now checks the DB (503 if empty),
  seed failure is fatal, and `/admin/ingestion/reseed` is admin-gated (fails closed).
- **Full Phase 1 audit** (26-agent workflow, adversarially verified) — see the
  audit findings; the blockers it found are fixed.
- **Hosting scaffolding:** `docs/HOSTING.md`, `docs/SCALING.md`, `docker-compose.prod.yml`
  (Caddy auto-HTTPS), `deploy.sh`, ARM web-build fix, `.gitattributes`.

## Verified state

- pytest **79**, JS **22**, build, lint, seed parity, evidence `--check` — all green.
- Data: 196 waters, 37 species, **1483 evidence records**, 174 evidenced / 22 empty.
- Docker: `api` + `db` (Postgres/PostGIS) came up **healthy** in a real container run
  (migrations + seed work); the web image builds. The full stack runs locally.

## How to run it (local — the "host on my laptop" path)

```
docker compose up --build      # full stack → http://localhost:3000
```
Accounts, favorites, live forecast — all work locally. For hot-reload dev:
`npm run dev` (web) + the api via compose/uvicorn.

## Hosting: explored, paused

We tried to host the full stack and hit friction on every free/cheap option:
- **Oracle Always Free:** the ARM 24 GB shape was capacity-blocked; we landed on the
  1 GB AMD micro, which is too small to build the vinext frontend (OOM). Firewall +
  SSH + capacity fight documented in `HOSTING.md`.
- **Hetzner (~$4/mo):** new-account verification wanted $25 prepaid credit or an ID upload.
- **Fly.io:** cheap with scale-to-zero, but needs the compose restructured into fly apps.
- **Railway:** got the **read-only web live at `bitemap.up.railway.app`** (serves the
  bundled data snapshot — map + fish lists + scores work, which is enough for data
  validation). The PostGIS DB service crashed mid-setup; we paused there.

**Decision:** run locally for now; revisit hosting later with fresh patience. The
read-only Railway link can stay up for alpha feedback (delete the crashed DB service),
or tear the project down.

## Honest next step

The real remaining Phase 1 work is **not more building** — it's **real-angler feedback
on the fish data**. Share the read-only link (or run locally for a friend) with people
who know these waters; when they say "that water's fish list is wrong," it goes through
the same judged agency-evidence pipeline we've been using.

After the alpha proves useful, the productionization list in `docs/SCALING.md`
(per-gridpoint forecasts = the #1 accuracy + scale item; shared cache; converge map/detail
scoring) is the next phase.
