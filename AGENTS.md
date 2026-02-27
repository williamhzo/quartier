# Repository Guidelines

- `ideas.md` and `spec.md`: product and feature direction docs

## Build, Test, and Development Commands

- Primary workflow uses Bun (`bun dev`, `bun run build`, etc.)

## Coding Style & Naming Conventions

- Formatting: Prettier is source of truth; do not hand-format
- Linting: fix ESLint warnings before opening PRs
- File names are typically kebab-case (example: `component-example.tsx`), while component exports are PascalCase

## Spec Tracking

`spec.md` is the source of truth for Quartier's product definition. It must stay in sync with the code:

- When implementing a feature or changing behavior, update the relevant `spec.md` section in the same commit
- Mark completed phases in the Phasing section
- If implementation diverges from the spec, update the spec to match reality -- never leave stale spec sections

## Commit & Pull Request Guidelines

- Specifically for this project it's fine to commit and push on main (no need for a dedicated branch and PR)
- Follow the existing commit style: short, imperative subjects (examples: `add format script`, `format components with prettier`).
- Keep commits small & scoped to one logical change (lowercased, no conventional commits)
- PRs should include: what changed, why, validation commands run, and screenshots/GIFs for UI changes
- Link related issue/spec context when applicable

## Security & Configuration Tips

- Never commit secrets or tokens
- Use `.env` for local-only configuration
- Keep generated/build output out of commits (`.next/`, `out/`, `build/`)
