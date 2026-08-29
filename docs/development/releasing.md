# Releasing

Version bumps and changelog entries are automated with
[release-please](https://github.com/googleapis/release-please) after merges to `main`.

This repo is an **npm workspaces** monorepo. Independent components:

| Path | npm package | Release tag prefix |
|---|---|---|
| `packages/core` | `dot-prompts` | `dot-prompts-v*` |
| `packages/pi` | `@dot-prompts/pi` | `dot-prompts-pi-v*` |
| `packages/conformance` | `@dot-prompts/conformance` | `dot-prompts-conformance-v*` |

Private stubs (`packages/cursor`, `packages/claude-code`) are not released.

## How it works

1. Merge feature PRs into `main` as usual.
2. On each push to `main`, the [Release Please](../../.github/workflows/release-please.yml) workflow opens or updates **Release PR(s)** (into `main`) per component that has releasable commits.
3. Each Release PR bumps that package’s `package.json`, updates its `CHANGELOG.md`, and refreshes `.release-please-manifest.json`.
4. Merging a Release PR creates a GitHub Release and a component tag (e.g. `dot-prompts-v0.3.1`).
5. The [Publish](../../.github/workflows/publish.yml) workflow runs on `release: published` and `npm publish`es the matching workspace package via [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC — no `NPM_TOKEN`).

There is no long-lived `release` branch — only the bot’s short-lived PR branches.

## What you write in PRs

Release Please reads **Conventional Commits** on `main` (commit messages and/or squash merge titles):

| Prefix | Release bump (while on `0.x`) |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` / `fix!:` / `BREAKING CHANGE:` | minor (`bump-minor-pre-major`) until `1.0.0` |
| `docs:`, `chore:`, `test:`, `ci:` | no version bump (unless configured otherwise) |

Prefer squash-merging PRs with a conventional title so one clear commit lands on `main`. Path-filtered commits still map to the packages they touch via release-please’s node-workspace plugin.

## Enforcement

| Layer | Role |
|---|---|
| [AGENTS.md](../../AGENTS.md) + `.cursor/rules/conventional-commits.mdc` | Guide coding agents |
| [PR title](../../.github/workflows/pr-title.yml) workflow | Fail PRs whose title is not Conventional Commits |
| GitHub repo settings | Squash-only merges + require the PR title check on `main` |

### GitHub settings (one-time)

1. **Settings → General → Pull Requests**
   - Enable **Allow squash merging**; set default squash commit to **Pull request title**.
   - Disable merge commits / rebase if you want only squash on `main`.
2. **Settings → Branches** — require PR + **PR title / lint** check on `main`.
3. **Settings → Actions → General → Workflow permissions**
   - Allow GitHub Actions to create and approve pull requests
   - Read and write permissions (needed for tags/releases)

### npm trusted publishing (one-time)

For each publishable package on [npmjs.com](https://www.npmjs.com) (`dot-prompts`, `@dot-prompts/pi`, `@dot-prompts/conformance`):

1. Package → **Settings → Trusted Publisher** → **GitHub Actions**
2. Organization or user: `EpicCamel2302`
3. Repository: `dotprompts`
4. Workflow filename: `publish.yml` (filename only)
5. Allowed actions: `npm publish` (at least)

The package must already exist on the registry before you can attach a trusted publisher. For a brand-new package, publish once with a token (or from your laptop), then configure OIDC and remove the token.

After a successful OIDC publish, optionally set **Publishing access** to require 2FA and disallow tokens, then revoke any old automation `NPM_TOKEN` secrets in GitHub.

Provenance attestations are generated automatically when publishing via trusted publishing from this public repo — no `--provenance` flag required.
## Bootstrapping notes

Manifest versions are seeded in `.release-please-manifest.json`. Tags use `include-component-in-tag` (not a single repo-wide `vX.Y.Z` for every package).

## Manual changelog notes

You can still edit a Release PR’s changelog section before merging if a commit message is too terse. release-please owns the versioned sections of each package `CHANGELOG.md`.
