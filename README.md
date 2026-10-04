# Mac OS 9 — Platinum

A browser-native recreation of the Mac OS 9.0 desktop, implemented in HTML, CSS and JavaScript ES modules. It includes a spatial Finder, persistent virtual disk, application suite, control panels, and a WebGPU compositor with WebGL2 and Canvas2D fallbacks.

This is an independently implemented desktop environment. It is **not a PowerPC/68k machine emulator**, does not run original Macintosh application binaries, and does not implement every historical Mac OS API. The [feature matrix](docs/FEATURES.md) describes actual behavior and boundaries. Visuals closely follow the Platinum interface; exact pixel identity across fonts, operating systems, browser zoom levels, and every application is not claimed.

**Live demo:** https://wieslawsoltes.github.io/MacOS9/

## Run the plain HTML/JavaScript edition

With Node.js 22 or newer, no dependency installation or build is needed:

```sh
node scripts/serve-standalone.mjs
```

Open `http://localhost:8080`. This edition uses native browser ES modules and an import map. Its virtual disk is saved in IndexedDB on that browser. Keep backups with **Special → Back Up Disk**. `PLATINUM_PORT` changes the local port.

## Deploy to GitHub Pages

`node scripts/build-pages.mjs` writes the plain edition to `_site/` with relative URLs, so it can be served from any base path. The `Deploy to GitHub Pages` workflow publishes it on every push to `main`. The cloud disk API is not available there; the virtual disk is saved in IndexedDB.

## Develop the hosted edition

The hosted wrapper uses Vinext/React only to mount the standalone shell and provide a Cloudflare-compatible disk API. The desktop and application packages do not depend on React.

```sh
corepack pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm check
pnpm build
```

Node 22.13+ and the pinned pnpm version in `package.json` are required. The provided environment-aware scripts also support the managed Sites environment. D1 and R2 bindings are named `DB` and `FILES`. Apply the SQL migration in `drizzle/` to the configured D1 database. The hosted disk API is optional; if unavailable, edits stay in the device journal and synchronization can be retried later.

## Workspace packages

| Package | Responsibility |
| --- | --- |
| `@platinum/core` | Event bus, preferences, clipboard, sound, virtual filesystem, initial disk |
| `@platinum/storage` | IndexedDB journal, recovery candidates, versioned cloud synchronization |
| `@platinum/renderer` | WebGPU/WGSL, WebGL2/GLSL and Canvas2D surface composition |
| `@platinum/ui` | Reusable Platinum elements, windows, menus and shared stylesheet |
| `@platinum/finder` | Desktop, spatial folders, selection, drag/drop, file commands |
| `@platinum/shell` | Boot, app registry, menu dispatch, dialogs, power and OS services |
| `@platinum/apps-text` | SimpleText, Stickies, Note Pad and Scrapbook |
| `@platinum/apps-utilities` | Search, calculator, graphing, scripting, disk tools and help |
| `@platinum/apps-media` | Media playback, generated CD tracks, recording, camera and drawing |
| `@platinum/apps-internet` | Browser and local mail workflows |
| `@platinum/control-panels` | 33 control panels and preference workflows |

Each package has its own manifest, explicit exports and workspace dependencies. Core math and filesystem modules are independent of the DOM. The UI packages share the OS service object instead of importing application state from one another.

## Embed or extend

```js
import { boot } from '@platinum/shell';
import '@platinum/ui/styles.css';

const dispose = await boot(document.querySelector('#macintosh'));
// Call dispose() when your host unmounts the desktop.
```

Serve the supplied `public/assets/`, `public/fonts/`, favicon and version file at the root URLs used by the desktop. The root must fill the desired desktop area. `standalone/index.html` demonstrates import-map embedding without a bundler.

Applications register with `os.register(id, title, icon, open)`. An opener returns a window from `os.wm.create(...)`; its `commands`, `menus`, `beforeClose`, and lifecycle callbacks connect it to the menu bar and shared Save/Open flows. Use `os.saveDocument` for documents, `os.vfs` for file operations, and `os.settings` for preferences.

## Graphics

The backend chain is **WebGPU → WebGL2 → Canvas2D**. Choose a preference in **Control Panels → Monitors** or append `?renderer=canvas2d` / `?renderer=webgl2` during development. System Profiler reports the actual selected backend.

The renderer uploads a source texture and renders a full-screen triangle with nearest sampling. Its 48-byte uniform block contains viewport size, device scale, pattern, color, tile dimensions and brightness. Drawing and graph applications generate their source surfaces with Canvas2D, then use this compositor. Window chrome, text, accessibility and hit testing remain DOM/CSS. This hybrid design does not claim to render every widget through WebGPU.

Frames are invalidated by damage and resize, with no continuous desktop render loop. GPU creation errors and device/context loss trigger the next available backend. Device scale is capped at 2; a 1× display at 100% zoom provides the closest period appearance.

## Persistence and recovery

The filesystem uses stable IDs, atomic mutations, undo/redo snapshots and parent-cycle validation. A local IndexedDB commit is the first durable save. Hosted synchronization writes immutable R2 objects, then advances a D1 version using compare-and-swap. Conflicting sessions retain their local edits rather than silently overwriting each other.

An explicit Save succeeds after a confirmed local or cloud commit. If both fail, the document remains dirty. Other sessions' uncommitted journals are available under **Apple System Profiler → Recover Local Edits**. Conflict replacement completes all cancellable close prompts before changing the active disk version. Full backups use the JSON `.mac9disk` format; they are not HFS disk images.

The hosted API accepts snapshots up to 32 MiB. File imports are limited to 20 MiB each, and the virtual filesystem is capped at 25,000 nodes. This snapshot-based implementation is intended for small desktop projects rather than gigabytes of media. Browser storage can be cleared by the browser or user; exported backups remain useful.

## Verification and source provenance

See [verification](docs/VERIFICATION.md), [feature matrix](docs/FEATURES.md), and [third-party asset provenance](THIRD_PARTY_ASSETS.md). Authored implementation code is MIT licensed. Third-party artwork and historical references retain their original rights and are excluded from that grant.
