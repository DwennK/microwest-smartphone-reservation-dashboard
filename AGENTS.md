# AGENTS.md

## Purpose

This project is a small internal dashboard for smartphone reservations.
Prefer pragmatic, low-complexity changes over platform-heavy rewrites.

## Project Rules

- Keep the app simple to run locally.
- Preserve the current architecture unless the user explicitly asks for a refactor:
  - React + Vite frontend
  - Express backend
  - SQLite via `node:sqlite`
- Do not introduce unnecessary infrastructure or cloud-specific complexity by default.

## Versioning

- Use date-based versioning: `YYYY.MM.DD` or `YYYY.MM.DD.N`.
- When making a visible project update, keep versions in sync in:
  - `package.json`
  - `client/package.json`
  - `server/package.json`
- Keep the version displayed in the UI in sync with the current project version.
- Do not auto-bump the version unless the user asks for it or the change is clearly release-like.

## README

- Keep `README.md` aligned with the real state of the repository.
- Update the README when changing:
  - scripts
  - stack
  - local run instructions
  - storage behavior
  - deployment guidance

## SQLite And Data

- The SQLite database is local and must not be committed.
- Keep `server/data/` ignored by Git.
- Do not add a real database file to the repository.
- If example data is needed, prefer a seed script or documented sample data over committing a `.sqlite` file.
- Remember that deleting the local database should still allow the app to recreate it on next backend start.

## Deployment Guidance

- Prefer deployment approaches that preserve simple local development.
- If discussing hosting, bias toward solutions that fit the current architecture before suggesting major rewrites.
- Do not push Cloudflare/Fly/Workers-style rewrites unless the user explicitly wants that path.
- For this project, a mini PC or classic Node host is usually a better default recommendation than an edge-runtime migration.

## UI Changes

- Keep UI changes subtle, intentional, and easy to maintain.
- Avoid adding noisy status text or debug information to the interface.
- Small operational metadata, like the app version, should stay visually discreet.

## Safe Defaults

- Prefer reversible changes.
- If deployment experiments add complexity and are not requested anymore, remove them cleanly.
- Do not commit secrets, databases, or machine-specific config.
