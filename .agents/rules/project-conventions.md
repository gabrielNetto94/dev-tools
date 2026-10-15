# Project Conventions

- Stack: Node.js + Express (`app/server.js`), vanilla JS UI (`app/public/`), PostgreSQL 18 & DynamoDB Local via Docker Compose.
- Run: `docker compose up -d --build` then open http://localhost:3000.
- Test: `cd app && npm test` (needs the stack running).
- Architecture: Keep files cohesive (< 300-400 lines); extract pure domain logic for fast `node:test` coverage.
- Workflow: Plan non-trivial changes with `planner`, implement with `implementer`, verify with `tester` / reviewers (`regression-reviewer`, `ui-reviewer`, `platform-reviewer`), and conclude with `docs`.
- Preserve existing comments and docstrings unrelated to your change.
- Never commit `.env`; keep `.env.example` updated.
- Keep dependencies minimal; avoid adding packages without a clear need.
- Any user-facing change must follow the design system in `.agents/skills/ui/SKILL.md` (tokens in `style.css`, wine as the only accent, no emoji, existing components first), whichever agent makes it.
- Run the `docs` agent at the end of every behavior-changing task to keep README, CONTEXT, and agents current.
