# ADR-0003: Frontend standard

## Status
Accepted

## Context
We want a consistent, simple frontend stack.

## Decision
React 19 + Tailwind 4, react-router-dom (lazy routes), Zustand, Zod, Axios, `@/*` alias,
centralized theme. No TanStack libraries by default.

## Consequences
Predictable structure; simple data patterns until advanced needs are proven.

> **Deviation for this project:** `apps/web` runs React 18.3.1, not 19 —
> see [ADR-0004](ADR-0004-react-18.md) for why (legacy jQuery DOM interop
> already verified on React 18). Tailwind 4, react-router-dom, Zustand,
> Zod, Axios, and the `@/*` alias are all followed as locked, and apply
> only to the admin entry (`admin.html`) — the guest-facing entry
> (`index.html`) intentionally has none of them (see `FRONTEND.md`).
