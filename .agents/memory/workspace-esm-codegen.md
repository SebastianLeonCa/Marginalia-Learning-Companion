---
name: Workspace ESM codegen
description: Node 24 test-runner and Orval barrel behavior in this monorepo
---

Use explicit `.ts` extensions for internal ESM imports that must execute directly under Node 24's strip-only TypeScript runner. Keep generated API package barrels manually owned and configure Orval not to rewrite them.

**Why:** Node's direct TypeScript runner does not resolve extensionless workspace imports reliably, and Orval's split output can append stale barrel exports on every codegen run.

**How to apply:** When adding a workspace package consumed by API tests, enable `allowImportingTsExtensions` where needed, use explicit source extensions, and verify codegen leaves package indexes stable.