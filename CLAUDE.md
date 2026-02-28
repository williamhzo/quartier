# CLAUDE.md

## Project

Quartier (quartier.sh) is a Paris arrondissement comparator built on French open data.

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

## Commit & Pull Request Guidelines

- Follow the existing commit style: short, imperative subjects (examples: `add format script`, `format components with prettier`).
- Keep commits small & scoped to one logical change (lowercased, no conventional commits) after each baby step, each small task is done
- PRs should include: what changed, why, validation commands run, and screenshots/GIFs for UI changes
- Link related issue/spec context when applicable

## Testing

- Use the Chrome browser extension (Claude in Chrome) to visually test UI changes on the dev server at localhost:3000
- Use Chrome DevTools MCP for advanced debugging (network, console, performance)

## Data Sources

- [datagouv MCP server](https://github.com/datagouv/datagouv-mcp) -- structured API access to data.gouv.fr datasets
- [datagouv MCP blog post](https://www.data.gouv.fr/posts/experimentation-autour-dun-serveur-mcp-pour-datagouv) -- context on the MCP server experimentation
