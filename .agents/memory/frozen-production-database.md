---
name: Frozen production database
description: Deployment behavior when Replit's managed production PostgreSQL database is frozen.
---

The published API depends on the managed production PostgreSQL database supplied through the runtime-managed `DATABASE_URL`. When that database is frozen, authenticated application queries can return HTTP 500 even while the local API, development database, schema, and deployment build are healthy.

**Why:** Production SQL inspection reports a frozen-database error, while deployment logs show the same 500s at valid Drizzle queries. Routing or frontend fallbacks do not restore the data path.

**How to apply:** Unfreeze production in the workspace before debugging application SQL. Then inspect production schema/data; if the managed schema is behind development, use the supported Publish flow rather than adding startup or deployment-time DDL.