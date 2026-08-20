# Releasing

Version bumps and changelog entries are automated with
[release-please](https://github.com/googleapis/release-please) after merges to `main`.

## How it works

1. Merge feature PRs into `main` as usual.
2. On each push to `main`, the [Release Please](../../.github/workflows/release-please.yml) workflow opens or updates a **Release PR** (into `main`).
3. That PR bumps `package.json` / `package-lock.json`, updates [CHANGELOG.md](../../CHANGELOG.md), and refreshes `.release-please-manifest.json`.
4. Merging the Release PR creates a GitHub Release and a `vX.Y.Z` tag.

There is no long-lived `release` branch — only the bot’s short-lived PR branch.

npm publish is not wired yet; tags and GitHub Releases are enough until you add a publish job and `NPM_TOKEN`.

## What you write in PRs

Release Please reads **Conventional Commits** on `main` (commit messages and/or squash merge titles):

| Prefix | Release bump (while on `0.x`) |
|---|---|
| `fix:` | patch (`0.2.0` → `0.2.1`) |
| `feat:` | minor (`0.2.0` → `0.3.0`) |
| `feat!:` / `fix!:` / `BREAKING CHANGE:` | minor (`bump-minor-pre-major`) until `1.0.0` |
| `docs:`, `chore:`, `test:`, `ci:` | no version bump (unless configured otherwise) |

Examples:

```
feat: walk up from file path to resolve .prompts store
fix: silence git stderr when cwd is not a repository
feat!: drop path from links; path lives on target only
```

Prefer squash-merging PRs with a conventional title so one clear commit lands on `main`.

## Bootstrapping

The manifest is seeded at **0.2.0** (current `package.json`). After this lands on `main`, create a matching tag once so history is clear:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Only commits **after** that baseline (with conventional prefixes) feed the next Release PR.

## Manual changelog notes

You can still edit the Release PR’s changelog section before merging if a commit message is too terse. Day-to-day “Unreleased” bullets are optional once Conventional Commits are the source of truth; release-please owns the versioned sections of `CHANGELOG.md`.
