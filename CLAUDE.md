# CLAUDE.md

## Project

Quartier (quartier.sh) is a Paris arrondissement comparator built on French open data. See `spec.md` for the full product spec and `ideas.md` for broader product direction.

## Commands

```bash
bun dev          # dev server on :3000
bun run build    # production build
bun run lint     # eslint (flat config)
bun run format   # prettier (with tailwind class sorting)
```

## Conventions

- shadcn components use `data-slot` attributes for styling hooks
- Add new shadcn components via `bunx shadcn@latest add <component>`

## Spec Tracking

`spec.md` is the single source of truth for what Quartier does and how it works. Keep it current:

- After implementing a feature or changing behavior, update the relevant section of `spec.md` in the same commit
- If a phase is completed, mark it as done in the Phasing section
- If implementation diverges from the spec (e.g., different library, changed data source, altered schema), update the spec to match reality

## Data Sources

- [datagouv MCP server](https://github.com/datagouv/datagouv-mcp) -- structured API access to data.gouv.fr datasets
- [datagouv MCP blog post](https://www.data.gouv.fr/posts/experimentation-autour-dun-serveur-mcp-pour-datagouv) -- context on the MCP server experimentation
