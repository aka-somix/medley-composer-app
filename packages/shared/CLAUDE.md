# packages/shared

`@medleys/shared` — pure domain types + music theory, imported by both apps.

**Before changing anything here, follow
[`.claude/rules/shared.md`](../../.claude/rules/shared.md)**: keep it pure (no
I/O), preserve the degree-token format invariants, wrap `tonal` behind our own
functions, and keep 100% of exported behavior unit-tested (including both spec
examples and the round-trip property).

- `pnpm --filter @medleys/shared test` — unit tests
