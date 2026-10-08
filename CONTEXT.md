# DEVinho Suite (`dblab`) — Comprehensive Application Context

> **Single Source of Truth** for developers, AI coding assistants, and automated agents working on the `dblab` codebase.

---

## 1. Executive Summary & Vision

**DEVinho Suite** (internally identified as `dblab` or `postgres-cloner`) is a local development and data manipulation platform built with a dark, dense, minimalist tool aesthetic (wine/ruby brand identity). 

The application solves two frequent local engineering bottlenecks:
1. **🐘 Postgres Cloner**: Instant and streaming replication of PostgreSQL databases. It allows developers to clone databases from local, host, or remote servers into isolated Docker databases or back into existing targets using in-memory streaming (`pg_dump | pg_restore`) or ultra-fast template forks (`CREATE DATABASE ... TEMPLATE ...` under 1 second), with real-time Server-Sent Events (SSE) streaming progress.
2. **⚡ DynamoDB Workbench**: A lightweight, web-based alternative to AWS NoSQL Workbench. It allows developers to connect to AWS Cloud, DynamoDB Local, or LocalStack, inspect table schemas (Partition Key and Sort Key), scan items, and view/edit attributes and variables in real time using a synchronized dual-mode interface (Visual field editor + Raw JSON editor).

---

## 2. Technology Stack & Key Decisions

| Layer | Technology | Rationale & Architectural Choice |
|---|---|---|
| **Backend Runtime** | Node.js 20 (`node:20-alpine`) | Modern LTS, native `fetch`, native `node:test` runner. |
| **HTTP Framework** | Express 4.19 (`express`, `cors`) | Minimalist, zero bloat, native SSE support (`res.write`). |
| **PostgreSQL Driver** | `pg` 8.12 (`Pool`, `Client`) | Native PostgreSQL connection pooling and queries. |
| **PostgreSQL CLI** | `postgresql18-client` (Alpine package) | Provides `pg_dump`, `pg_restore`, `psql`. Major version matches target server (`PostgreSQL 18`) to avoid dump/restore version mismatch errors. |
| **AWS SDK** | `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb` v3.1147 | Modular AWS SDK v3. `DynamoDBDocumentClient` simplifies serialization of JavaScript objects to/from DynamoDB attribute maps without manual unmarshaling. |
| **Frontend Framework** | **Vanilla HTML5, CSS3, ES6+ JavaScript** | **Zero build step, zero bundler, zero frontend dependencies.** Served statically by Express. Instant reload, maximum maintainability. |
| **Design System** | Custom CSS Variables (`style.css`) | Flat, dense desktop tool aesthetic. Dark surface palette, single wine accent (`--wine-*`), strict zero-emoji policy (stroke SVGs only), Brazilian Portuguese copy. |
| **Testing** | Node native test runner (`node:test`, `node:assert`) | No Jest/Mocha dependencies. Direct integration tests against running Docker stack. |
| **Containerization** | Docker Compose v2 | Multi-container stack (`cloner_postgres`, `cloner_ui`, `cloner_dynamodb`). |

---

## 3. Repository & Directory Structure

```
dblab/
├── .agents/                        # AI Agent system specifications & skills
│   ├── rules/
│   │   └── project-conventions.md  # Core project conventions & non-negotiables
│   └── skills/                     # Specialized agent definitions (SKILL.md)
│       ├── docker-specialist/      # Infrastructure, compose, Dockerfile, env
│       ├── docs/                   # Keeps README, skills, and env files updated
│       ├── dynamodb-specialist/    # DynamoDB operations, NoSQL workbench, SDK
│       ├── planner/                # Pre-coding planning & impact assessment
│       ├── postgres-specialist/    # pg_dump/restore, TEMPLATE forks, SQL backend
│       ├── security-specialist/    # Credentials, SQL identifier safety, processes
│       ├── tester/                 # node:test test suite and regression tests
│       └── ui/                     # app/public frontend and design system owner
├── app/                            # Application source code
│   ├── Dockerfile                  # Alpine Node.js 20 + postgresql18-client
│   ├── package.json                # Express, pg, cors, @aws-sdk packages
│   ├── package-lock.json
│   ├── server.js                   # Primary Express server, Postgres API & SSE stream
│   ├── dynamodb.js                 # DynamoDB router (CRUD, describe, scan, tables)
│   ├── public/                     # Static frontend files (served by Express)
│   │   ├── index.html              # Single page layout, accessible semantic markup
│   │   ├── style.css               # Design system tokens, dense layout, animations
│   │   ├── app.js                  # Global DEVinho utilities, Postgres UI controller
│   │   ├── dynamodb.js             # DynamoDB Workbench UI controller & editor
│   │   └── devinho-logo.jpg        # DEVinho brand icon
│   └── test/                       # Integration test suite
│       ├── api.test.js             # Postgres Cloner & SSE tests
│       └── dynamodb.test.js        # DynamoDB Workbench API tests
├── init-test-db/                   # Database seed scripts for testing
│   └── 01-seed-db.sql              # Seeds `seed_db` with sample tables and rows
├── .env.example                    # Template environment variables
├── .env                            # Local environment variables (not committed)
├── .gitignore                      # Git ignore patterns
├── docker-compose.yaml             # Multi-service composition definition
├── GEMINI.md                       # Agent routing table & global instructions
├── README.md                       # User-facing manual and documentation
└── CONTEXT.md                      # This comprehensive application context file
```

---

## 4. Module 1: Postgres Cloner

### 4.1 Architecture & Core Concepts
The Postgres Cloner module allows duplicating PostgreSQL databases without saving large temporary dump files to disk.

1. **In-Memory Pipe Streaming (`pg_dump | pg_restore`)**:
   - Spawns `pg_dump` with `--format=custom --no-owner --no-privileges --verbose`.
   - Spawns `pg_restore` with `--no-owner --no-privileges --verbose`.
   - Pipes `dumpProcess.stdout` directly into `restoreProcess.stdin`.
   - Progress and diagnostic messages from `stderr` of both processes are streamed live to the client via Server-Sent Events (SSE).
2. **Instant Template Forks (`CREATE DATABASE ... TEMPLATE ...`)**:
   - For databases residing on the target PostgreSQL server, executes `CREATE DATABASE "<new>" TEMPLATE "<source>"`.
   - Prior to execution, terminates all other client connections via `pg_terminate_backend(pid)` to satisfy PostgreSQL template locking requirements.
   - Operates in typically **under 1 second**.
3. **Target Server Modes**:
   - **Local (`local`)**: The managed container `cloner_postgres` (`postgres:5432`).
   - **Source (`source`)**: Clones back into the source server (e.g. `host.docker.internal`).
   - **Custom (`custom`)**: Any arbitrary user-specified host, port, user, and password.
4. **Database Destination Behavior**:
   - **New Database**: Creates a new database; aborts if the name already exists unless overwrite is specified.
   - **Overwrite Existing Database**: Drops active connections, drops the database, and recreates it clean.
   - **Same Server & Same Database (In-place restore)**: Passes `--clean --if-exists` to `pg_restore` without dropping the database itself.
5. **PostgreSQL Version Compatibility Rule**:
   - PostgreSQL `pg_dump` client version must be **greater than or equal to** the source database major version.
   - Target database server version must be **greater than or equal to** the `pg_restore` client version.
   - DEVinho uses **PostgreSQL 18** client and server to support dumps up to PostgreSQL 18.

### 4.2 Postgres API Endpoints

| Method | Endpoint | Description | Request Body / Query Params | Response |
|---|---|---|---|---|
| `GET` | `/api/info` | Health check & target server version | None | `{ status, targetHost, hostPort, pgVersion }` |
| `GET` | `/api/source/config` | Default source server configuration | None | `{ host, port, user, hasPassword }` |
| `POST` | `/api/source/databases` | Lists non-template databases from source | `{ host, port, user, password }` | `{ success, server, databases: [{ name, size_pretty, size_bytes }] }` |
| `POST` | `/api/target/databases` | Lists non-template databases from target | `{ targetServerMode, targetHost, targetPort, ... }` | `{ success, server, databases: [...] }` |
| `POST` | `/api/test-connection` | Validates credentials and counts tables | `{ url }` or `{ host, port, user, password, database }` | `{ success, data: { dbname, dbuser, version, size, tables_count } }` |
| `GET` | `/api/clones` | Lists all created clones on target | None | `{ success, clones: [{ name, size_pretty, connectionString, psqlCommand }] }` |
| `DELETE` | `/api/clones/:name` | Drops clone after killing active connections | URL parameter `:name` (validated `/^[a-zA-Z0-9_]+$/`) | `{ success, message }` |
| `POST` | `/api/clones/template` | Instant clone via `CREATE DATABASE TEMPLATE` | `{ sourceClone, newCloneName }` | `{ success, message, connectionString }` |
| `GET` | `/api/clone-stream` | SSE endpoint streaming clone logs & result | Query params: `sourceHost`, `sourceDb`, `targetDbName`, `targetServerMode`, `schemaOnly`, `dropIfExists`, etc. | SSE stream with events: `event: log`, `event: success`, `event: error` |

---

## 5. Module 2: DynamoDB Workbench

### 5.1 Architecture & Core Concepts
The DynamoDB Workbench module provides a lightweight visual inspection and editing workbench for NoSQL tables.

1. **Flexible Credential Resolution**:
   - Connection profiles can use environment variables (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `DYNAMODB_ENDPOINT`) or dynamic credentials supplied per request in the POST body.
   - Pre-configured endpoint shortcuts:
     - **AWS**: Standard AWS region credentials.
     - **Docker**: `http://dynamodb-local:8000` (internal Docker network).
     - **Host**: `http://localhost:8000` (developer machine).
     - **LocalStack**: `http://localhost:4566`.
2. **Client-Side Connection Persistence**:
   - The frontend persists the last used connection configuration (endpoint, region, accessKeyId, sessionToken) in `localStorage` under the key `dblab_dynamo_connection`.
   - On initial page load, `dynamodb.js` automatically loads and tests this connection.
3. **Table & Schema Inspection**:
   - Discovers tables using `ListTablesCommand`.
   - Inspects table keys via `DescribeTableCommand`: extracts `KeySchema` to differentiate Partition Key (`HASH`) and Sort Key (`RANGE`), plus attribute types (`S`, `N`, `B`).
4. **Data Browsing & Scanning**:
   - Executes `ScanCommand` with pagination support (`Limit: 50` up to 100, and `ExclusiveStartKey` / `LastEvaluatedKey`).
   - Renders a dense data table where Partition Key (PK) is frozen/sticky on the left.
   - Dynamic columns automatically aggregate all discovered item attributes.
5. **Item & Variable Editor**:
   - Slide-over panel editor allowing live attribute creation and modification.
   - **Aba Visual**: Structured fields with type selectors (`String`, `Number`, `Boolean`, `Map`, `List`, `Null`). Sanitizes values into native types before saving.
   - **Aba JSON**: Raw JSON editor with real-time syntax validation.
   - Two-way live synchronization: modifications in the Visual tab instantly update the JSON tab and vice-versa.
   - Enforces key immutability: PK and SK cannot be renamed on existing items.

### 5.2 DynamoDB API Endpoints

All endpoints accept optional connection credentials in the request body (`{ region, endpoint, accessKeyId, secretAccessKey, sessionToken }`).

| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/api/dynamodb/config` | Returns server environment default config | None | `{ success, configuredViaEnv, defaultRegion, defaultEndpoint, maskedAccessKey }` |
| `POST` | `/api/dynamodb/tables` | Lists all table names | `{ ...creds }` | `{ success, tables: ["table_1", ...] }` |
| `POST` | `/api/dynamodb/describe-table` | Gets table schema & primary keys | `{ tableName, ...creds }` | `{ success, table: { tableName, keySchema, attributeDefinitions, itemCount, tableSizeBytes } }` |
| `POST` | `/api/dynamodb/scan` | Scans items with pagination | `{ tableName, limit, startKey, ...creds }` | `{ success, items: [...], lastEvaluatedKey, count, scannedCount }` |
| `POST` | `/api/dynamodb/item/get` | Retrieves a single item by key | `{ tableName, key: { pk, sk }, ...creds }` | `{ success, item: { ... } }` |
| `POST` | `/api/dynamodb/item/put` | Creates or replaces an item & variables | `{ tableName, item: { ... }, ...creds }` | `{ success, message, item }` |
| `POST` | `/api/dynamodb/item/delete` | Deletes an item by primary key | `{ tableName, key: { pk, sk }, ...creds }` | `{ success, message }` |

---

## 6. Frontend Architecture & Design System

The frontend is contained entirely in `app/public/` and requires no compilation step.

### 6.1 Architecture & Global Registry
- `window.DEVinho`: Global namespace initialized in `app.js` and consumed by `dynamodb.js`.
  - `DEVinho.icon(name)`: Generates inline SVG stroke icons.
  - `DEVinho.esc(str)`: HTML entity sanitizer to prevent XSS.
  - `DEVinho.toast(message, 'ok' | 'err' | 'info')`: Toast notifications.
  - `DEVinho.copy(text, buttonEl)`: Clipboard utility with temporary visual confirmation.
  - `DEVinho.setNavStatus(module, 'ok' | 'err' | 'warn' | 'live' | 'off', label)`: Updates status dot in the sidebar.
  - `DEVinho.createDbPicker(container, options)`: Searchable database dropdown component.
  - `DEVinho.confirmModal(options)`: Standard modal dialog with typed confirmation for destructive actions.

### 6.2 Design System Rules (`.agents/skills/ui/SKILL.md`)
- **Theme & Surfaces**:
  - Dark mode surfaces: `--bg` (`#0f0d11`), `--surface` (`#17141b`), `--raised` (`#201c26`), `--border` (`rgba(255,255,255,0.08)`).
  - Text hierarchy: `--text` (`#f2eef5`), `--text-2` (`#a59db0`), `--text-3` (`#6e6678`).
- **Wine Accent**:
  - Wine (`--wine-500: #8c1d40`, `--wine-600: #701431`, `--wine-900: #2a0813`) is the **sole accent color**.
  - One primary wine button (`.btn-primary`) per view.
  - Navigation indicator (`.nav-ind`) is a single sliding wine bar.
- **Strict Semantic Status Colors**:
  - `--ok` (`#22c55e`), `--warn` (`#f59e0b`), `--danger` (`#ef4444`) are used **strictly** for operational state (connected, warning, error), never decoratively.
- **Zero-Emoji Policy**:
  - No emoji characters in HTML markup, JS strings, toasts, logs, or UI text. All icons must be inline SVGs using class `.i` or `.i-sm`.
- **Typography & Layout**:
  - `Inter` for general UI text; `JetBrains Mono` (`.mono`) for code, JSON, keys, URLs, and database names.
  - Collapsible sidebar (`.sb.rail`) with `Ctrl+B` toggle shortcut. Automatically collapses to rail view on viewports below 1100px.
  - Single `<h1>` tag in the DOM with active module titles toggled via CSS classes.

---

## 7. Infrastructure, Networking & Docker Topology

```
+-----------------------------------------------------------------------------------------+
|                                    HOST MACHINE                                         |
|                                                                                         |
|   Web Browser ------------------------> http://localhost:3000                           |
|   Database Tools (psql, DBeaver) -----> localhost:5432                                   |
|   AWS CLI / Local DynamoDB -----------> http://localhost:8000                           |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   |                              DOCKER COMPOSE STACK                               |   |
|   |                                                                                 |   |
|   |   +-----------------------+     +-------------------+     +------------------+  |   |
|   |   |      cloner_ui        |     |  cloner_postgres  |     | cloner_dynamodb  |  |   |
|   |   |   (Express + UI)      |     |  (Postgres 18)    |     | (DynamoDB Local) |  |   |
|   |   |      Port 3000        |     |    Port 5432      |     |    Port 8000     |  |   |
|   |   +-----------+-----------+     +---------+---------+     +---------+--------+  |   |
|   |               |                           |                         |           |   |
|   |               |                           | (volume: pg_data18)     |           |   |
|   +---------------+---------------------------+-------------------------+-----------+   |
|                   |                                                                     |
|                   v (host-gateway: host.docker.internal)                                |
|   +-------------------------------+                                                     |
|   |  Host PostgreSQL Server       |                                                     |
|   |  Port 5432                    |                                                     |
|   +-------------------------------+                                                     |
+-----------------------------------------------------------------------------------------+
```

### 7.1 Container Services
1. **`cloner_postgres` (`postgres:18-alpine`)**:
   - Runs PostgreSQL 18.
   - Exposes `5432:5432` to the host.
   - Data stored in persistent volume `pg_data18` mounted at `/var/lib/postgresql`.
   - Seeds test databases on first initialization from `init-test-db/`.
2. **`cloner_ui` (`app/Dockerfile`)**:
   - Built on `node:20-alpine` with `postgresql18-client` and `bash`.
   - Exposes `3000:3000` to the host.
   - Contains `host.docker.internal:host-gateway` to communicate with services running directly on the host machine.
3. **`cloner_dynamodb` (`amazon/dynamodb-local:latest`)**:
   - Official Amazon DynamoDB Local image.
   - Exposes `8000:8000` to the host.
   - Runs in-memory with shared database: `-jar DynamoDBLocal.jar -sharedDb -inMemory`.

### 7.2 Configuration & Environment Variables

| Variable | Default Value | Purpose |
|---|---|---|
| `PORT` | `3000` | Port for Express web server |
| `TARGET_PG_HOST` | `postgres` | Internal Docker host for target PostgreSQL |
| `TARGET_PG_PORT` | `5432` | Internal Docker port for target PostgreSQL |
| `TARGET_PG_USER` | `postgres` | Target database user |
| `TARGET_PG_PASSWORD` | `postgres` | Target database password |
| `TARGET_PG_DATABASE` | `postgres` | Target maintenance database |
| `HOST_PORT` | `5432` | Host port exposed for client connection strings |
| `SOURCE_PG_HOST` | `host.docker.internal` | Default source PostgreSQL hostname |
| `SOURCE_PG_PORT` | `5432` | Default source PostgreSQL port |
| `SOURCE_PG_USER` | `postgres` | Default source PostgreSQL username |
| `SOURCE_PG_PASSWORD` | `postgres` | Default source PostgreSQL password |
| `AWS_REGION` | `us-east-1` | Default AWS region for DynamoDB |
| `AWS_ACCESS_KEY_ID` | `local` | Default AWS access key |
| `AWS_SECRET_ACCESS_KEY` | `local` | Default AWS secret access key |
| `AWS_SESSION_TOKEN` | *(empty)* | Optional AWS session token |
| `DYNAMODB_ENDPOINT` | `http://dynamodb-local:8000` | Default DynamoDB endpoint for container |

---

## 8. Security & Operational Guardrails

1. **SQL Identifier Sanitization**:
   - All database names interpolated into SQL statements (`CREATE DATABASE`, `DROP DATABASE`, `TEMPLATE`) must be validated against `/^[a-zA-Z0-9_]+$/` and escaped in double quotes (`"${name}"`).
   - The default `postgres` database is protected and cannot be deleted via the API.
   - *Known Gap*: In `app/server.js`, `sourceClone` in `/api/clones/template` is currently missing the regex check (asserted as `{ todo: true }` in `test/api.test.js`).
2. **Credential Transmission**:
   - Passwords and AWS Secret Access Keys must never be passed in `GET` query strings.
   - Always submit credentials via `POST` request bodies.
   - Mask credentials when exposing configurations (`/api/dynamodb/config` masks `AWS_ACCESS_KEY_ID`).
3. **Child Process Execution**:
   - Child processes (`pg_dump`, `pg_restore`) are executed using `child_process.spawn` with explicit argument arrays (never shell strings), preventing command injection.
   - If a client terminates an SSE connection, child processes are terminated to prevent orphaned streaming jobs.
4. **Network Scope**:
   - DEVinho is currently configured without built-in authentication and with permissive CORS (`cors()`). It is designed for secure local developer machines, not public network exposure.

---

## 9. Testing & Quality Assurance

The test suite uses Node.js's native test runner (`node:test`) and requires the Docker stack to be running.

### 9.1 Running Tests
```bash
# Start Docker stack
docker compose up -d --build

# Run test suite
cd app && npm test
```

### 9.2 Test Coverage
- `app/test/api.test.js`:
  - Validates `GET /api/info` returns online status.
  - Rejects deletion of protected `postgres` database and malformed identifiers.
  - Verifies template cloning round-trip: creation, listing in `/api/clones`, and cleanup.
  - Tests `/api/target/databases` with local and unreachable endpoints.
  - Verifies SSE error streaming on invalid clone arguments.
- `app/test/dynamodb.test.js`:
  - Validates `GET /api/dynamodb/config`.
  - Rejects missing table names and payloads with HTTP 400.
  - Tests unreachable endpoint error handling.
  - Performs full DynamoDB CRUD lifecycle: creates a test table, puts items, scans items, updates attributes, verifies get, and cleans up.

---

## 10. Agent Ecosystem & Contribution Workflow

The repository defines a team of specialized AI agents documented in `GEMINI.md` and located in `.agents/skills/`.

| Agent | Skill File | Domain of Responsibility |
|---|---|---|
| `planner` | `.agents/skills/planner/SKILL.md` | Required first step for new features, major refactors, or ambiguous requests before writing code. |
| `tester` | `.agents/skills/tester/SKILL.md` | Node test suite (`node:test`), regression detection, fixtures in `app/test/`. |
| `ui` | `.agents/skills/ui/SKILL.md` | Mandatory owner of all frontend changes in `app/public/`. Enforces the design system. |
| `postgres-specialist` | `.agents/skills/postgres-specialist/SKILL.md` | Streaming dumps, template clones, Postgres backend logic in `app/server.js`. |
| `dynamodb-specialist` | `.agents/skills/dynamodb-specialist/SKILL.md` | AWS SDK v3, NoSQL Workbench, item/attribute editing, DynamoDB endpoints. |
| `docker-specialist` | `.agents/skills/docker-specialist/SKILL.md` | `docker-compose.yaml`, `Dockerfile`, port forwarding, volumes, and networking. |
| `security-specialist` | `.agents/skills/security-specialist/SKILL.md` | SQL identifier injection, credentials, child process safety, and CORS. |
| `docs` | `.agents/skills/docs/SKILL.md` | Mandatory final step for any behavior-changing task. Keeps README, skills, and env files updated. |

### 10.1 Key Development Workflow Rules
1. **Visual Changes**: Every change reaching the screen must go through the `ui` agent guidelines (dense layout, wine accent only, zero emoji, Portuguese text).
2. **Sensitive Logic**: Involve `security-specialist` whenever credentials, SQL identifiers, or child processes are modified.
3. **Documentation Parity**: Finish every behavior-changing task with `docs` to keep `README.md`, `CONTEXT.md`, and skills synchronized with the code.
