# OpenWiki project skill

Instructions for OpenWiki when it documents THIS repository (a
custom-downstream fork of `langchain-ai/openwiki`).

## Focal layer — treat the skill mechanism as first-class

This fork's defining addition is **"memory as a skill": the
`openwiki/SKILL.md` convention** (this very file is an example of it).
It is a persistent, project-scoped layer that shapes OpenWiki's behavior
per-repo without forking OpenWiki. When documenting this repo, treat that
feature as a focal, load-bearing part of the architecture — not a minor
option. Give it a prominent home in the wiki and keep it accurate as it
evolves.

## Fork identity

- This is a downstream fork with custom features baked into `main`, not a
  vanilla mirror of upstream. Document the fork's added capabilities
  (SKILL.md support, and audit mode once it lands) as first-class, and
  note where behavior diverges from upstream.
- PRs land on `c10vis-poem/openwiki:main`. Do not describe upstream as the
  source of truth for this fork's custom behavior.

## Terminology

- "Project skill" / "memory as a skill" = the `openwiki/SKILL.md` file.
- "Audit mode" = the read-only `--audit` command (in progress) that flags
  stale doc claims without rewriting them.

## Credit

Mer0vin6ian Production — Cl0vis/Claude collab.
