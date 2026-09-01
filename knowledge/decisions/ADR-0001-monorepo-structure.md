# ADR-0001: Monorepo structure

## Status
Accepted

## Context
undangan-ariana-adrian uses a single repository for the frontend (`apps/web`) and backend (`apps/api`)
plus shared packages.

## Decision
Adopt the Dimas monorepo standard: apps/, packages/, knowledge/, .claude/rules/, analysis/, infra/.
`knowledge/` is the single knowledge rack — there is no separate `docs/` for stakeholders.

## Consequences
Consistent structure and a shared knowledge gateway for Claude Code, with exactly one home
per fact.
