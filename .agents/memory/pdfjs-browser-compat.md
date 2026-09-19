---
name: PDF.js browser compatibility
description: Browser APIs that must be present before the Marginalia Reader initializes PDF.js.
---

Some preview browsers expose `ReadableStream` but not its async iterator, and may also lack `Promise.withResolvers`. PDF.js 6 uses both APIs while extracting text and rendering pages.

**Why:** Without these APIs, PDF.js throws `undefined is not a function (near '...value of readableStream...')` before the Reader can display the document.

**How to apply:** Keep the small compatibility shim imported before the React app imports or renders `react-pdf`; do not replace the authenticated in-app renderer with a PDF iframe when selection and page metadata are required.