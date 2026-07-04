# Audit mode — starting to-do (Fable)

This is your beginning checklist, not the whole truth. Read the actual
source and adjust. The goal: a new `openwiki --audit` mode that reads the
existing `openwiki/` docs against current source and **flags claims that no
longer match** — it does NOT rewrite docs (that's what `--update` is for).
Output is a report of stale/contradicted claims with file+line evidence.

## Why
`--update` refreshes docs. Nothing today *catches* a doc that confidently
states something false (e.g. "X is not yet built" when X exists, a
referenced file that was deleted, a wrong branch name). Audit mode is the
read-only cop.

## Injection points (already mapped — verify before trusting)
- `src/agent/types.ts` — `OpenWikiCommand` union is `"chat" | "init" | "update"`. Add `"audit"`.
- `src/commands.ts` — `parseCommand()` handles `--init`/`--update`. Add `--audit` the same way; it's a `run` command like the others.
- `src/agent/prompt.ts` — `createModeInstructions()` has a branch per command. Add an `audit` branch. `createUserPrompt()` too.
- `src/agent/index.ts` — `runOpenWikiAgentCore()`: audit must be **read-only**. It should NOT write `.last-update.json`, NOT take the content snapshot for change-detection, and the backend should not need write tools. Confirm how `LocalShellBackend`/deepagents tools are scoped and make audit not write to `openwiki/`.
- `src/cli.tsx` — surface `--audit` in help output (see `commands.ts` help content).

## Behavior spec (first pass)
- `openwiki --audit` reads `openwiki/` + current source + git, produces a findings report to stdout (respect `-p`/`--print`).
- Each finding: doc file + location, the claim, why it's stale (source/git evidence), confidence.
- Zero findings = exit clean with "docs appear consistent with source."
- It must NOT edit any file. Not docs, not AGENTS.md/CLAUDE.md, nothing.
- Reuse the SKILL.md mechanism — `readProjectSkill()` already loaded per run; audit should honor project-specific instructions too.

## Prompt content to write (audit mode instructions)
Model the discipline sections on the existing `update` instructions in `prompt.ts` but invert the intent: the update prompt says "edit only what's stale." Audit says "find what's stale and report it, edit nothing." Steal the git-diff discipline (diff since `.last-update.json` gitHead) — that's exactly how you find what drifted.

## Done when
- [ ] `pnpm run build` clean
- [ ] `pnpm run lint:check` clean
- [ ] `pnpm run format:check` clean
- [ ] `--audit` appears in `openwiki --help`
- [ ] A direct functional check (no live LLM needed) confirms: audit command parses, routes to audit instructions, and the run path takes no write actions / writes no metadata
- [ ] Live end-to-end run against a repo with a known-stale doc, confirming it's flagged (needs an API key)

## Do not
- Do not touch the SKILL.md feature (just merged, working).
- Do not make audit write anything — the entire value is that it's the read-only check.
- Do not open a PR to langchain-ai upstream; this is the custom-downstream fork. PR into `c10vis-poem/openwiki:main` only.
