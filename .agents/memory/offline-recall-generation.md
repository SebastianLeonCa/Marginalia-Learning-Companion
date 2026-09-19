---
name: Offline Recall generation
description: Why Recall uses a local PDF-grounded question generator when the AI provider is unavailable.
---

Recall must remain a private five-question quiz grounded only in extracted PDF text, even when the workspace AI provider is unavailable. The local generator uses exact source excerpts as answer choices and validates every quote against the extracted text.

**Why:** The AI provider can be unavailable independently of PDF storage and reading, and making the entire Recall flow depend on provider credits prevents testing the core product.

**How to apply:** Keep the quiz contract at five questions with four options and no extra practice mechanics. Any future provider integration should improve question quality without weakening the exact-source grounding checks or making the provider mandatory.