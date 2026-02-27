# Repository Guidelines

- `ideas.md` and `spec.md`: product and feature direction docs

## Build, Test, and Development Commands

- Primary workflow uses Bun (`bun dev`, `bun run build`, etc.)

## Coding Style & Naming Conventions

- Formatting: Prettier is source of truth; do not hand-format
- Linting: fix ESLint warnings before opening PRs
- File names are typically kebab-case (example: `component-example.tsx`), while component exports are PascalCase

## Commit & Pull Request Guidelines

Follow the existing commit style: short, imperative subjects (examples: `Add format script`, `Format components with prettier`).

- Keep commits small & scoped to one logical change (lowercased, no conventional commits)
- PRs should include: what changed, why, validation commands run, and screenshots/GIFs for UI changes
- Link related issue/spec context when applicable

## Security & Configuration Tips

- Never commit secrets or tokens
- Use `.env` for local-only configuration
- Keep generated/build output out of commits (`.next/`, `out/`, `build/`)
