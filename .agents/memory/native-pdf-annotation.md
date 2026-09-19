---
name: Native PDF annotation constraint
description: Why annotation capture cannot depend on selection events from the browser's built-in PDF viewer.
---

Do not assume a native PDF iframe can report selected text, page numbers, or selection coordinates to the parent application. Use an explicit copy/paste capture flow, or replace it with an in-app PDF renderer when direct selection is required.

**Why:** Browser PDF plugins are isolated and inconsistent, so parent-page selection listeners are not a reliable product interface.

**How to apply:** Keep note storage independent of viewer implementation. If direct highlighting is added, preserve the same passage and page fields while changing only how they are populated.