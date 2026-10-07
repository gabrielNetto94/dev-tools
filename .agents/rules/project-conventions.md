# Project Conventions

- Stack: Node.js + Express (`app/server.js`), vanilla JS UI (`app/public/`), PostgreSQL 16 via Docker Compose.
- Run: `docker compose up -d --build` then open http://localhost:3000.
- Test: `cd app && npm test` (needs the stack running).
- Preserve existing comments and docstrings unrelated to your change.
- Never commit `.env`; keep `.env.example` updated.
- Keep dependencies minimal; avoid adding packages without a clear need.

- Run the `docs` agent at the end of every behavior-changing task to keep README and agents current.
