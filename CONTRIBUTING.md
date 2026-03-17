# Contributing to Inkgraph

## Code style

- **Named functions** — `function doThing()` not `const doThing = () =>`
- **No semicolons** — enforced by Biome
- **Double quotes** — enforced by Biome
- **2-space indentation**

Biome handles formatting and linting. Run `yarn lint:fix` to auto-fix.

## Development workflow

```bash
yarn install
cp .env.example .env   # fill in vars
yarn db:migrate
yarn dev
```

## Commit conventions

This project uses [Conventional Commits](https://conventionalcommits.org). Commits are validated by commitlint on every commit.

```
<type>(<scope>): <subject>

feat(editor): add node tagging system
fix(auth): handle expired session tokens
docs(readme): update deployment steps
chore(deps): upgrade react-router to 7.1
```

| Type | When to use |
|------|------------|
| `feat` | New feature → triggers **minor** release |
| `fix` | Bug fix → triggers **patch** release |
| `perf` | Performance improvement → triggers **patch** |
| `docs` | Docs only |
| `refactor` | Code change with no behaviour change |
| `test` | Adding or fixing tests |
| `chore` | Build, deps, tooling |
| `ci` | CI config changes |
| `style` | Formatting, whitespace |
| `revert` | Reverting a commit |

**Breaking changes** → add `BREAKING CHANGE:` footer or `!` after type → triggers **major** release:
```
feat(auth)!: replace session tokens with JWTs

BREAKING CHANGE: existing sessions are invalidated on upgrade
```

## Before you push

The pre-commit hook runs automatically:
1. **Biome** — lint + format staged files
2. **commitlint** — validate commit message format

To run manually:
```bash
yarn lint          # check
yarn lint:fix      # fix
yarn typecheck     # type check
yarn test          # run tests
```

## Release process

Releases are fully automated via [semantic-release](https://semantic-release.gitbook.io):

1. Push to `main`
2. GitHub Action analyses commits since last release
3. Bumps version in `package.json` based on commit types
4. Generates `CHANGELOG.md` entry
5. Creates GitHub release with release notes
6. Tags the commit

You never manually edit `CHANGELOG.md` or bump versions.
