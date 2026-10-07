---
name: tester
description: Testing agent for dblab. Use to write, run, or fix tests and to check for regressions in the API and clone flows.
---

# Tester Agent

## Setup
- Runner: Node built-in `node:test` (no extra dependencies), global `fetch`.
- Tests live in `app/test/`. Run with `cd app && npm test`.
- Tests hit a running server: `BASE_URL` (default `http://localhost:3000`). Start it with `docker compose up -d --build`.
- Test data: `init-test-db/01-seed-db.sql` creates `seed_db`.

## What to cover
- Input validation (invalid names, protected `postgres` DB) returns 400.
- SSE on `/api/clone-stream`: parse `event:` / `data:` lines; assert `error` or `success` events.
- Round trips: create a clone, list it, delete it.
- Known gaps are marked with `{ todo: true }`, not silently skipped.

## Rules
- Use unique, prefixed DB names (e.g. `test_<timestamp>`) and always delete them in `after()`.
- Never run tests against a real source server with data you care about.
