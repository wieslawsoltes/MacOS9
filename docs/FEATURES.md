# Implemented behavior and compatibility

This matrix describes version 1.0.0. **Working** means the named workflow is implemented against the shared virtual disk or a real browser API. **Modeled** means it controls the virtual desktop or preserves a historical configuration, without configuring the host machine. A listed application is a new browser implementation, not the original application binary.

## Desktop and Finder

| Area | Implemented behavior | Boundary |
| --- | --- | --- |
| Platinum desktop | 20-pixel menu bar, embossed Finder pattern, bitmap icons, beveled controls, striped window titles, Control Strip | Font rasterization and several icons differ from original Mac hardware; no universal pixel-perfect certification |
| Windows | Drag, resize, zoom, collapse, stacking, app switching, hide/show, keyboard resizing and close prompts | Browser page windows; no native host-window integration |
| Menus | Application-specific menu bar, nested menus, separators, checks, disabled commands, keyboard navigation, recent items and contextual menus | Browser-reserved shortcuts may take precedence |
| Spatial Finder | Per-folder views and saved geometry, icon/list/button views, sorting, disclosure rows, labels, selection, marquee and type-to-select | Does not restore every previously open window on startup |
| Files | Create, rename, duplicate, move, aliases, copy/cut/paste, drag/drop, spring-loaded folders, Get Info, comments and locks | Stable-ID JSON tree; no HFS allocation structures or resource forks |
| Trash | Trash, Put Away, empty, undo/redo | Undo history is in memory; backups persist separately |
| Import/export | Host file drops, file picker, text/image/audio/video import, individual download, disk backup/restore | 20 MiB file import limit; `.mac9disk` is JSON, not a bootable disk image |
| Persistence | Local IndexedDB journals, cloud snapshots, compare-and-swap conflicts, explicit recovery candidates | No automatic branch merging or simultaneous collaborative editing |
| Startup and power | Boot screen/chime, startup folder items, sleep/wake, idle sleep, restart, shutdown screen | Does not power off the host computer or emulate a kernel |
| Accessibility | Semantic buttons/inputs, keyboard menus, modal routing, larger text, contrast, reduced motion, speech and balloon help | Physical input/accessibility settings remain controlled by the browser and host OS |

## Application suite

| Application | Working workflows | Boundary |
| --- | --- | --- |
| SimpleText | Multiple documents; styled text; font/size/style; edit, find/replace, save/save-as, print, speech, unsaved drafts and close prompts | Browser rich text; not all original SimpleText formats or QuickDraw typography |
| Sherlock 2 | File-name/content search, scopes, kind filters, result opening/reveal and explicit web-search handoff | No historical Sherlock channel plugins or obsolete search services |
| Stickies | Multiple persistent notes, colors, fonts, sizes, export and reopening | Browser text notes |
| Note Pad | Persistent pages, add/delete, navigation and export | Browser implementation of a legacy accessory |
| Scrapbook | Text/image clippings, navigation, paste and deletion | Modern text/image content |
| Calculator | Basic arithmetic, chaining, repeated equals, percent, decimals, sign and keyboard input | No separate scientific calculator mode |
| Key Caps | Interactive on-screen keys, modifier states, typing, font display and copying | Host physical keyboard layout/repeat is not reconfigured |
| Graphing Calculator | Safe expression parser, 2D pan/zoom, 3D function mesh and image export | Explicit supported function grammar, not the complete historical graphing engine |
| Script Editor | Edit, compile, run, stop, save and bounded AppleScript-style commands against OS services | Deliberate subset; no arbitrary Apple events, OSAX, native scripts or shell execution |
| Apple System Profiler | Actual renderer, browser viewport, virtual disk status, running apps, modeled memory, export, sync and recovery | CPU/memory model is labeled; not a hardware benchmark |
| Disk First Aid | Filesystem invariant checks and broken-alias repair | Validates the JSON filesystem, not HFS sectors |
| Drive Setup | Create named virtual volumes | No real partitioning, formatting or physical disk access |
| Disk Copy | Backup and restore the complete virtual disk | JSON snapshots, not Disk Copy 4.2/6.x image decoding |
| Font Viewer | Sample text and font inspection | Supplied/fallback fonts, not classic suitcase/resource decoding |
| Network Browser | Browse/mount virtual shared folders and open URL destinations | No raw AppleTalk, AFP, SMB or network discovery |
| Chooser | Select the browser print destination and connect virtual shares | No LaserWriter driver or AppleTalk printer discovery |
| Internet Explorer | Period browser chrome, local home/HTML pages, URL navigation, history, favorites, source view, external browser handoff | Modern browser engine; sites may refuse embedding; no Trident/IE4 execution environment |
| Outlook Express | Local inbox/drafts, compose, contacts, reply/forward, deletion, EML export and explicit mail-client handoff | No POP/IMAP/SMTP backend and no claim that mail was sent |
| QuickTime Player | Browser-supported files/URLs, transport, seek, volume, favorites and media information | Modern codecs; not the original QuickTime runtime or every `.mov` codec |
| Apple DVD Player | Video file/URL playback with a DVD-themed player | No physical DVD drive, encrypted DVD decoding or DVD menus |
| AppleCD Audio Player | Three generated WAV tracks, imported audio playlist, play/pause/seek, repeat/shuffle and eject | Synthesized/imported audio; no physical CD drive |
| SimpleSound | Microphone recording, playback and saving into Finder | Requires browser permission and MediaRecorder support; maximum recording 120 seconds |
| Apple Video Player | Camera preview and still capture | Requires browser permission; no analog tuner/capture-card emulation |
| Picture Viewer | Open images, zoom, rotate, navigate and print | Browser-supported image formats |
| Drawing Pad | Pencil/brush, line, rectangle, ellipse, fill, text, color, undo and PNG save | Additional browser drawing application |
| Puzzle | Solvable 15-tile puzzle, shuffle, move counter and undo-path solve | Optional classic accessory, not an exact stock OS 9 installation claim |
| Mac Help | Searchable topics, application tour, shortcuts, graphics/storage details and boundaries | Documentation for this implementation |

## Control panels

| Panel | Behavior |
| --- | --- |
| Appearance | Themes, highlight colors, fonts, view font, desktop patterns, alert sound, title collapse, labels, balloon help and reduced motion |
| Apple Menu Options | Recent item counts and menu preferences |
| AppleTalk | Modeled connection settings and virtual-network state |
| ColorSync | Preserved display/input/output profile selections and color preview; physical color management remains with the browser |
| Control Strip | Show/hide and collapse/expand the strip |
| Date & Time | Virtual clock offset, timezone, 12/24-hour formatting, seconds and date |
| Dial Assist | Country/area/prefix preferences and dialing example |
| Easy Access | Large text, contrast, reduced motion, speech and keyboard-related preferences; host-level Sticky Keys are not changed |
| Energy Saver | Configurable idle sleep, immediate sleep and reduced animation |
| Extensions Manager | Filter, toggle, save and select modeled extension sets; no original INIT/CDEF/native extension loading |
| File Sharing | Virtual owner/computer/sharing preferences and routes to shares/users; no host filesystem server |
| File Exchange | File-extension application associations used when opening documents |
| General Controls | Default document folder and desktop-related preferences |
| Internet | Home page/search/mail preferences used by browser and mail workflows |
| Keyboard | On-screen keyboard preferences and Key Caps access; physical layout/repeat remains host-controlled |
| Keychain Access | Password-derived encryption with PBKDF2-SHA256 and AES-GCM, lock/unlock, add, copy and delete items; a virtual keychain, not host credential integration |
| Launcher | Application launch buttons |
| Location Manager | Save and apply named preference sets |
| Memory | Modeled application-memory/cache/virtual-memory settings, explicitly distinguished from browser memory |
| Modem | Preserved modem configuration; no serial-port or dial-up hardware |
| Monitors | Actual graphics backend preference and brightness, full screen, viewport information; color-depth choice is modeled |
| Mouse | Double-click interval/test and tracking preference; actual cursor motion is supplied by the browser |
| Multiple Users | Named desktop profiles, preferences and home folders; shared system files, not security-isolated OS accounts |
| Numbers | Decimal/group/currency settings with a live sample |
| QuickTime Settings | Playback preferences and modeled connection speed |
| Remote Access | Modeled connect/disconnect profile and elapsed status; no PPP connection |
| Software Update | Manual version-file checks and optional five-minute checks while open |
| Sound | Synthesized system alerts, volume, mute and microphone-recorder access; sounds approximate period cues |
| Speech | Browser voices, speaking rate, speech sample and alert speech |
| Startup Disk | Select the virtual volume to open after restart |
| TCP/IP | Preserved virtual network configuration; no host network reconfiguration |
| Text | Locale-sensitive sorting preview and preference |
| Web Sharing | Select/open a local HTML folder and preview its home page; no inbound HTTP server |

## AppleScript subset

Supported statements include `tell application`, `activate`, `display dialog`, `say`, `beep`, bounded `delay`, variable assignment/get, opening virtual paths, creating files/folders, trashing an item, bounded repeat blocks and returning a result. Scripts are limited to 50,000 characters, 100 repeats per loop and 1,000 executed steps. The parser never calls JavaScript `eval` or `Function`.

## Requirements outside this implementation

Complete binary compatibility would require a separate 68k/PowerPC machine emulator plus appropriate original ROM/system software. This project contains neither. Unimplemented native subsystems include the Process Manager and Memory Manager APIs, QuickDraw/Toolbox traps, resource forks, HFS disk internals, original Apple-event semantics, third-party drivers/extensions, real hardware buses, obsolete networking protocols and all original bundled application codecs/engines.

The browser recreation supplies useful corresponding workflows where possible and identifies the modeled controls. The feature matrix is intended to prevent a polished desktop from being mistaken for universal native Mac OS compatibility.
