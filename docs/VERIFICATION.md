# Verification record

Version: 1.0.0 · 2026-10-04

## Automated checks

**24 tests passed.** `node --test tests/*.test.js` covers filesystem transaction rollback, valid initial disk, alias stability, recursive copy identity, trash/restore/undo/redo, locked documents, case-insensitive names, malformed snapshots, scoped content search, graph-expression safety/precedence, calculator behavior, bounded scripts, queued cloud writes, conflict preservation, offline retries, candidate-read cancellation safety, unavailable storage and confirmed cloud adoption.

`node scripts/check-modules.mjs` checks all 20 authored JavaScript modules. TypeScript checking covers the host wrapper and disk API. The final production build validates module resolution and Cloudflare-compatible output.

Storage unit tests use controlled network responses and an in-memory cache adapter. They do not substitute for a multi-device endurance or quota test against the hosted service.

## Browser workflows

- Created a new SimpleText document, edited it, saved it in Documents, closed it and reopened the exact contents through Finder.
- Tested a real synchronization conflict and the cloud-disk recovery dialog.
- Verified that clicking a Control Strip application while a modal is open does not activate a background application.
- Inspected the actual selected graphics backend in System Profiler: explicit Canvas2D, WebGL2 preference and automatic WebGPU preference all produced a functioning Canvas2D fallback in this GPU-unavailable browser. Native GPU execution remains unverified.
- Opened and closed all 26 launchable applications and all 33 control panels.
- Found the saved Verification Note with Sherlock after cloud recovery and a page reload.
- Observed “All changes saved” in System Profiler after synchronization.

Additional final browser results and build output are recorded in the delivery summary.

## Validation limits

The cloud browser exposes no document WebMCP tools, so its optional WebMCP registration could not be exercised in a supported runtime. Browser permission prompts for the camera/microphone were not accepted during automated verification. External sites may restrict iframe embedding. Visual comparison was performed against historical screenshots, but there is no exhaustive golden-image test suite for every application and OS state.

These targeted checks do not validate every feature of a historical operating system. See `FEATURES.md` for the precise implemented and modeled scope.
