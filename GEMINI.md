# dblab Agents

Skills live in `.agents/skills/`. Read the matching `SKILL.md` before starting a task.

| Task type | Agent |
|---|---|
| New feature, refactor, ambiguous request, project planning | `planner` |
| Architecture design, modularity, 300-line rule, pure domain logic | `architect` |
| Implementing planned tasks, bug fixes, refactoring execution | `implementer` |
| Tests, characterization tests, bug reproduction, regressions | `tester` |
| Changes in `app/public/*`, anything visual, design system | `ui` |
| Pre-completion diff review against contracts & regressions | `regression-reviewer` |
| UI design system & visual compliance review | `ui-reviewer` |
| Docker, host networking, PG version compatibility review | `platform-reviewer` |
| dump/restore, TEMPLATE, SSE backend | `postgres-specialist` |
| DynamoDB, NoSQL Workbench, item/variable editing, AWS SDK | `dynamodb-specialist` |
| compose, Dockerfile, env | `docker-specialist` |
| Input handling, credentials, auth | `security-specialist` |
| Keeping README, agents, CONTEXT and `.env.example` up to date | `docs` |

Every change that reaches the screen (new field, message, state, module) goes through `ui` (and `ui-reviewer`), even when another agent owns the task: the design system in `.agents/skills/ui/SKILL.md` is mandatory, not a suggestion.

Start non-trivial work with `planner`; involve `architect` for structural refactoring; execute with `implementer`; run tests with `tester`; review diffs with `regression-reviewer`; involve `security-specialist` whenever credentials, SQL identifiers, or child processes are touched.

Finish every task that changes behavior, endpoints, env vars, commands, or agents with `docs`, so `README.md` and the skills stay in sync with the code.
