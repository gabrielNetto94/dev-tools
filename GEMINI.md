# dblab Agents

Skills live in `.agents/skills/`. Read the matching `SKILL.md` before starting a task.

| Task type | Agent |
|---|---|
| New feature, refactor, ambiguous request | `planner` |
| Tests, regressions | `tester` |
| Changes in `app/public/*` | `ui` |
| dump/restore, TEMPLATE, SSE backend | `postgres-specialist` |
| DynamoDB, NoSQL Workbench, item/variable editing, AWS SDK | `dynamodb-specialist` |
| compose, Dockerfile, env | `docker-specialist` |
| Input handling, credentials, auth | `security-specialist` |
| Keeping README, agents and `.env.example` up to date | `docs` |

Start non-trivial work with `planner`; involve `security-specialist` whenever credentials, SQL identifiers, or child processes are touched.

Finish every task that changes behavior, endpoints, env vars, commands, or agents with `docs`, so `README.md` and the skills stay in sync with the code.
