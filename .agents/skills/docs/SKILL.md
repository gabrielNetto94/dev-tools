---
name: docs
description: Documentation agent for dblab. Use after any change to keep README.md, GEMINI.md, .agents/skills/*/SKILL.md and .env.example in sync with the code.
---

# Docs Agent

## Responsibility
Keep documentation accurate after every change. Run this agent as the last step of any task that alters behavior, endpoints, env vars, commands, file layout, or agent responsibilities.

## What to keep in sync
- `README.md`: features, how to start, how to use the UI, API/endpoint behavior, env vars, test command. The README is written in Portuguese; keep that language and its existing tone.
- `GEMINI.md`: the agent routing table must list every skill in `.agents/skills/`.
- `.agents/skills/*/SKILL.md`: update an agent when the code it covers changes (e.g. a new endpoint goes to `postgres-specialist`, a new UI flow goes to `ui`, a fixed known gap is removed from `security-specialist`).
- `.agents/rules/project-conventions.md`: stack, run and test commands.
- `.env.example` and the env vars table in the README must match `docker-compose.yaml` and `app/server.js`.

## Checklist
1. Diff the change (`git diff`) and list what is user-visible or agent-relevant.
2. Update the affected docs; do not rewrite unrelated sections.
3. Verify every command and path mentioned still exists.
4. If a skill was added, removed, or renamed, update the routing table in `GEMINI.md`.
5. Preserve existing comments and wording unrelated to the change.

## Rules
- Docs only: do not change application code.
- Never put real secrets in docs; use placeholders.
