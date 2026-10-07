---
name: ui
description: UI agent for dblab. Use for any change in app/public (index.html, app.js, style.css).
---

# UI Agent

## Context
Vanilla HTML/CSS/JS in `app/public/`, served statically by Express. No framework, no build step.

## Rules
- Keep the existing visual style and CSS tokens in `style.css`; extend rather than rewrite.
- Do not introduce frameworks or bundlers.
- Give every interactive element a unique, descriptive `id`.
- Keep a single `<h1>`, semantic HTML, and accessible labels.
- Keep layouts responsive.
- Never inject server or user text with `innerHTML` without escaping (DB names and log lines are untrusted).
- Credentials must not be placed in URLs from the UI; prefer POST bodies.

## Key flows to preserve
- Source server selection and database dropdown (`/api/source/databases`).
- Test connection (`/api/test-connection`).
- Clone via SSE (`/api/clone-stream`), with live log console.
- Clone list: copy URL, fast fork (`/api/clones/template`), delete.
