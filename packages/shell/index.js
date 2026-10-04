import { EventBus, Settings, ClipboardService, SoundService, download, fileAsDataURL, formatBytes, debounce, clamp } from '@platinum/core';
import { VirtualFileSystem } from '@platinum/core/filesystem';
import { createSeed, APPLICATIONS, EXTRA_APPS, CONTROL_PANELS, INTERNET_APPS } from '@platinum/core/seed';
import { DiskStore } from '@platinum/storage';
import { SurfaceRenderer, patternOptions } from '@platinum/renderer';
import { el, h, button, icon, appleIcon, checkbox, select } from '@platinum/ui';
import { WindowManager } from '@platinum/ui/windows';
import { MenuManager, separator as sep } from '@platinum/ui/menus';
import { Finder, LABELS } from '@platinum/finder';
import { attachDialogs } from './dialogs.js';
import { registerTextApps } from '@platinum/apps-text';
import { registerUtilities } from '@platinum/apps-utilities';
import { registerMediaApps } from '@platinum/apps-media';
import { registerInternetApps } from '@platinum/apps-internet';
import { registerControlPanels } from '@platinum/control-panels';
import { registerAgentTools } from './webmcp.js';
export async function boot(root) {
    const lifecycle = new AbortController(), store = new DiskStore();
    root.replaceChildren(el('div', { class: 'boot-screen', html: `<div class="startup-card"><div class="startup-logo">${icon('finder', 64)}<strong>Mac OS 9</strong></div><p>Starting up…</p><div class="startup-progress"><span></span></div></div>` }));
    const saved = await store.load();
    const settings = new Settings(saved?.settings);
    let vfs;
    try {
        vfs = new VirtualFileSystem(saved?.filesystem ?? createSeed());
    }
    catch {
        vfs = new VirtualFileSystem(createSeed());
    }
    const state = saved?.state ?? {};
    const os = { root, store, settings, vfs, state, events: new EventBus(), clipboard: new ClipboardService(), sound: new SoundService(settings), registry: new Map(), running: new Map([['finder', { id: 'finder', title: 'Finder', icon: 'finder' }]]), activeApp: 'finder', recent: state.recent ?? [], disposed: false, started: Date.now() };
    state.recent = os.recent;
    const wallpaper = el('div', { class: 'desktop-wallpaper' }), desktop = el('div', { class: 'desktop-icons', 'aria-label': 'Desktop icons' }), windows = el('div', { class: 'windows-layer' }), menubar = el('nav', { class: 'menu-bar', 'aria-label': 'Menu bar' }), menus = el('div', { class: 'menus-layer' });
    root.replaceChildren(wallpaper, desktop, windows, menubar, menus);
    os.wm = new WindowManager(windows);
    os.run = async (action) => { try {
        if (typeof action === 'function')
            return await action();
        if (action)
            return await os.dispatch(action);
    }
    catch (error) {
        console.error(error);
        await os.alert(error?.message || 'The operation could not be completed.');
    } };
    os.menu = new MenuManager(menus, action => os.run(action));
    attachDialogs(os);
    os.persist = debounce(() => { if (!os.disposed && !os.replacing)
        store.schedule({ filesystem: vfs.export(), settings: settings.export(), state: structuredClone(state) }); }, 150);
    os.register = (id, title, iconName, open) => os.registry.set(id, { id, title, icon: iconName, open });
    os.persistNow = async (cloud = false) => { if (os.replacing)
        return; os.persist.cancel(); const cached = await store.schedule({ filesystem: vfs.export(), settings: settings.export(), state: structuredClone(state) }); if (cloud || cached === false) {
        const synced = await store.flush();
        if (!synced && cached === false)
            throw new Error('The document could not be saved. Keep this window open and download a disk backup.');
    } };
    os.touchRecent = id => { const at = os.recent.indexOf(id); if (at >= 0)
        os.recent.splice(at, 1); os.recent.unshift(id); os.recent.splice(15); os.persist(); };
    os.launch = async (id, options = {}) => { if (id === 'finder') {
        os.activeApp = 'finder';
        os.wm.showApp('finder');
        os.updateMenus();
        return;
    } const app = os.registry.get(id); if (!app)
        throw new Error('This application is not installed.'); if (os.wm.topModal())
        return os.wm.topModal(); os.running.set(id, app); os.activeApp = id; const win = await app.open(options); if (win && !win.closed)
        os.wm.focus(win); os.updateMenus(); os.events.emit('launch', { id }); return win; };
    os.openNode = async (id) => { const original = vfs.get(id), node = vfs.resolve(id); if (!node)
        return os.alert('The original item cannot be found.'); os.touchRecent(node.id); if (['disk', 'folder'].includes(node.type))
        return os.finder.open(node.id); if (node.type === 'application')
        return os.launch(node.appId); const ext = node.name.split('.').at(-1)?.toLowerCase(); const association = state.fileAssociations?.[ext]; if (association && os.registry.has(association))
        return os.launch(association, { node }); if (node.kind === 'font')
        return os.launch('fontbook', { node }); if (node.kind === 'extension')
        return os.launch('cp:extensions-manager'); if (node.kind === 'image')
        return os.launch('picture', { node }); if (node.kind === 'audio' || node.kind === 'video')
        return os.launch('quicktime', { node }); if (node.kind === 'script')
        return os.launch('scripter', { node }); if (node.kind === 'html')
        return os.launch('browser', { node }); return os.launch('simpletext', { node }); };
    os.quit = async (id) => { if (id === 'finder')
        return; for (const win of os.wm.windows.filter(w => w.appId === id)) {
        if (!await os.wm.close(win))
            return;
    } os.running.delete(id); os.activeApp = os.wm.active?.appId ?? 'finder'; os.updateMenus(); };
    os.printHTML = html => { const frame = el('iframe', { style: { position: 'fixed', left: '-10000px', top: '0', width: '800px', height: '600px' }, title: 'Print document' }); frame.srcdoc = `<!doctype html><html><head><title>Print</title><style>body{font:13px/1.5 Arial;padding:28px}img{max-width:100%}pre{white-space:pre-wrap}</style></head><body>${html}</body></html>`; frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 30000); }; document.body.append(frame); };
    os.importFiles = async (files, parent = 'documents') => { for (const file of [...files]) {
        if (file.size > 20 * 1024 * 1024) {
            await os.alert(`“${file.name}” is larger than the 20 MB import limit.`);
            continue;
        }
        const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : /\.html?$/i.test(file.name) ? 'html' : /\.applescript$/i.test(file.name) ? 'script' : 'text';
        const content = ['image', 'audio', 'video'].includes(kind) ? await fileAsDataURL(file) : await file.text();
        const name = vfs.uniqueName(parent, file.name.replace(/:/g, '-'));
        vfs.create(parent, name, { type: 'file', kind, content, size: file.size, mime: file.type, icon: kind === 'image' ? 'paint' : kind === 'audio' ? 'sound' : kind === 'video' ? 'quicktime' : kind === 'html' ? 'internet' : kind === 'script' ? 'script' : 'text' });
    } os.finder.open(parent); };
    os.chooseImport = (parent = os.finder.currentFolder()) => { const input = el('input', { type: 'file', multiple: true }); input.addEventListener('change', () => os.run(() => os.importFiles(input.files, parent))); input.click(); };
    os.exportNode = id => { const node = vfs.require(id); if (node.type === 'folder' || node.type === 'disk')
        return os.backup(); if (typeof node.content === 'string' && node.content.startsWith('data:')) {
        const a = el('a', { href: node.content, download: node.name });
        a.click();
    }
    else
        download(node.content ?? '', node.name, node.mime ?? 'text/plain'); };
    os.backup = () => download(JSON.stringify({ filesystem: vfs.export(), settings: settings.export(), state }, null, 2), 'Macintosh-HD.mac9disk.json', 'application/json');
    os.replaceSnapshot = async (payload, cloudSnapshot = null, recovery = null) => { for (const win of [...os.wm.windows])
        if (!await os.wm.close(win))
            return false; os.backup(); os.replacing = true; os.persist.cancel(); if (recovery)
        store.adoptedRecovery = recovery; if (cloudSnapshot)
        await store.adoptCloudSnapshot(cloudSnapshot);
    else {
        const cached = await store.schedule(payload);
        const synced = await store.flush();
        if (cached === false && !synced) {
            os.replacing = false;
            throw new Error('The replacement disk could not be saved. Your original disk backup is available.');
        }
    } location.reload(); return true; };
    os.restoreDisk = () => { const input = el('input', { type: 'file', accept: '.json,.mac9disk' }); input.addEventListener('change', () => os.run(async () => { if (!input.files[0])
        return; const payload = JSON.parse(await input.files[0].text()); const result = VirtualFileSystem.validate(payload.filesystem); if (!result.valid)
        throw new Error(result.errors.join('\n')); if (!await os.confirm('Replace this Macintosh disk with the selected backup? Your current disk will be downloaded first.', 'Restore'))
        return; await os.replaceSnapshot(payload); })); input.click(); };
    os.showInfo = id => { const node = vfs.require(id); const win = os.wm.create({ id: `info-${id}`, appId: 'finder', title: `${node.name} Info`, width: 378, height: 415, resizable: false }); const panel = el('div', { class: 'panel' }); const details = el('dl', { class: 'info-grid' }); const kind = os.finder.kind(node); for (const [label, value] of [['Kind:', kind], ['Size:', `${formatBytes(node.type === 'folder' ? vfs.size(id) : node.size ?? 0)}`], ['Where:', vfs.path(node.parent)], ['Created:', new Date(node.created).toLocaleString()], ['Modified:', new Date(node.modified).toLocaleString()]])
        details.append(el('dt', { text: label }), el('dd', { text: value })); panel.append(el('div', { class: 'info-header' }, el('span', { html: icon(node.icon ?? 'folder', 32) }), el('strong', { text: node.name })), details, el('hr'), checkbox('Locked', !!node.locked, value => vfs.update(id, { locked: value })), el('div', { class: 'field-row' }, el('span', { text: 'Label:' }), select(LABELS.map(([name], i) => [i, name]), node.label ?? 0, value => vfs.update(id, { label: Number(value) })))); const comment = el('textarea', { class: 'mac-input', value: node.comment ?? '', rows: 3, style: { width: '100%', marginTop: '6px' }, 'aria-label': 'Comments' }); comment.addEventListener('change', () => vfs.update(id, { comment: comment.value })); panel.append(el('p', { text: 'Comments:', style: { margin: '10px 0 0' } }), comment); if (node.type === 'alias')
        panel.append(button('Show Original', () => { const target = vfs.resolve(id); if (target) {
            os.finder.open(target.parent);
            os.finder.selected = new Set([target.id]);
            os.finder.updateSelection();
        } })); win.body.replaceChildren(panel); return win; };
    os.about = () => { const win = os.wm.create({ id: 'about-macintosh', title: 'About This Computer', appId: 'finder', width: 472, height: 348, resizable: false, x: Math.max(20, (root.clientWidth - 472) / 2), y: 95 }); const panel = el('div', { class: 'panel' }); panel.append(el('div', { class: 'about-header' }, el('span', { html: icon('finder', 64) }), el('div', {}, el('strong', { text: 'Mac OS 9' }), el('p', { text: 'Version 9.0', style: { margin: '7px 0 0' } }))), el('p', { text: 'Platinum Macintosh', style: { fontFamily: 'var(--system)' } }), el('p', { text: `Built-in Memory: ${settings.get('memoryMB')} MB     Virtual Memory: ${settings.get('virtualMemory') ? 'On' : 'Off'}` })); for (const app of os.running.values()) {
        const mem = app.id === 'finder' ? 8 : app.id === 'browser' ? 18 : 3;
        panel.append(el('div', { class: 'memory-row' }, el('span', { html: `${icon(app.icon, 16)} ${h(app.title)}` }), el('div', { class: 'about-memory' }, el('span', { style: { width: (mem * 3) + '%' } })), el('span', { text: `${mem.toFixed(1)} MB` })));
    } panel.append(el('div', { class: 'welcome-footer', text: 'Memory allocations describe this recreated Macintosh.' }), el('div', { class: 'panel-actions' }, button('System Profiler…', () => os.launch('profiler')))); win.body.replaceChildren(panel); return win; };
    os.sleep = () => { if (os.sleeping)
        return; os.sleeping = true; const screen = el('div', { class: 'power-screen sleep-screen', 'aria-label': 'Sleeping', tabIndex: 0 }, el('span', { text: 'Sleeping…' })); const wake = () => { screen.remove(); os.sleeping = false; os.lastActivity = Date.now(); document.removeEventListener('keydown', wake); }; screen.addEventListener('pointerdown', wake); document.addEventListener('keydown', wake, { once: true }); root.append(screen); screen.focus(); };
    os.restart = async () => { for (const win of [...os.wm.windows])
        if (!await os.wm.close(win))
            return; await os.persistNow(true); const screen = el('div', { class: 'boot-screen', html: `<div class="startup-card"><div class="startup-logo">${icon('finder', 64)}<strong>Mac OS 9</strong></div><p>Welcome to Mac OS.</p><div class="startup-progress"><span></span></div></div>` }); root.append(screen); os.sound.chime(); setTimeout(() => { screen.remove(); os.running = new Map([['finder', { id: 'finder', title: 'Finder', icon: 'finder' }]]); os.activeApp = 'finder'; os.finder.open(vfs.get(settings.get('startupDisk'))?.id ?? 'disk', { x: 80, y: 80 }); os.updateMenus(); for (const n of vfs.children('startup-items'))
        os.openNode(n.id); }, 1100); };
    os.shutdown = async () => { for (const win of [...os.wm.windows])
        if (!await os.wm.close(win))
            return; await os.persistNow(true); const screen = el('div', { class: 'power-screen' }, el('span', { html: icon('computer', 48) }), el('p', { text: 'It is now safe to turn off your computer.' }), button('Restart', () => { screen.remove(); os.restart(); })); root.append(screen); };
    os.finder = new Finder(os, desktop);
    registerTextApps(os);
    registerUtilities(os);
    registerMediaApps(os);
    registerInternetApps(os);
    registerControlPanels(os);
    os.appItems = () => [{ label: `Hide ${os.running.get(os.activeApp)?.title ?? 'Finder'}`, action: () => os.wm.hideApp(os.activeApp) }, { label: 'Hide Others', action: () => { for (const id of os.running.keys())
                if (id !== os.activeApp)
                    os.wm.hideApp(id); } }, { label: 'Show All', action: () => os.wm.showAll() }, sep, ...[...os.running.values()].map(app => ({ label: app.title, icon: app.icon, checked: app.id === os.activeApp, action: () => { os.activeApp = app.id; os.wm.showApp(app.id); if (!os.wm.windows.some(w => w.appId === app.id) && app.id !== 'finder')
                os.launch(app.id); os.updateMenus(); } })), sep, { label: 'Show Application Switcher', action: () => os.switcher() }];
    os.appleItems = () => [{ label: 'About This Computer…', action: () => os.about() }, sep, { label: 'Apple System Profiler', icon: 'computer', action: () => os.launch('profiler') }, { label: 'Calculator', icon: 'calculator', action: () => os.launch('calculator') }, { label: 'Chooser', icon: 'chooser', action: () => os.launch('chooser') }, { label: 'Control Panels', icon: 'control', items: CONTROL_PANELS.map(([id, label, ico]) => ({ label, icon: ico, action: () => os.launch(`cp:${id}`) })) }, { label: 'Favorites', icon: 'folder', items: () => { const ids = state.favorites ?? ['documents', 'app-simpletext', 'app-quicktime']; return ids.filter(id => vfs.get(id)).map(id => ({ label: vfs.get(id).name, icon: vfs.get(id).icon ?? 'folder', action: () => os.openNode(id) })); } }, { label: 'Key Caps', icon: 'keyboard', action: () => os.launch('keycaps') }, { label: 'Network Browser', icon: 'network', action: () => os.launch('network') }, { label: 'Recent Applications', items: () => os.recent.map(id => vfs.get(id)).filter(n => n?.type === 'application').slice(0, Number(settings.get('recentApplications') ?? 8)).map(n => ({ label: n.name, icon: n.icon, action: () => os.openNode(n.id) })) }, { label: 'Recent Documents', items: () => os.recent.map(id => vfs.get(id)).filter(n => n?.type === 'file').slice(0, Number(settings.get('recentDocuments') ?? 8)).map(n => ({ label: n.name, icon: n.icon, action: () => os.openNode(n.id) })) }, { label: 'Scrapbook', icon: 'scrapbook', action: () => os.launch('scrapbook') }, { label: 'Sherlock 2', icon: 'sherlock', action: () => os.launch('sherlock') }, { label: 'Stickies', icon: 'stickies', action: () => os.launch('stickies') }, ...vfs.children('apple-menu').map(n => ({ label: n.name, icon: n.icon ?? 'text', action: () => os.openNode(n.id) })), sep, { label: 'Applications', icon: 'applications', items: () => [...APPLICATIONS, ...EXTRA_APPS, ...INTERNET_APPS].map(([id, label, ico]) => ({ label, icon: ico, action: () => os.launch(id) })) }];
    os.finderMenus = () => {
        const selected = os.finder.current(), has = !!selected.length;
        return [
            ['File', [{ label: 'New Folder', shortcut: '⌘N', action: 'new' }, { label: 'Open', shortcut: '⌘O', action: 'open', disabled: !has }, { label: 'Print', shortcut: '⌘P', action: 'print', disabled: !has }, { label: 'Close Window', shortcut: '⌘W', action: 'close', disabled: !os.wm.active }, sep, { label: 'Get Info', shortcut: '⌘I', action: 'info', disabled: !has }, { label: 'Label', items: LABELS.map(([label], i) => ({ label, checked: selected[0]?.label === i, disabled: !has, action: () => selected.forEach(n => vfs.update(n.id, { label: i })) })) }, { label: 'Duplicate', shortcut: '⌘D', action: () => os.finder.duplicate(), disabled: !has }, { label: 'Make Alias', shortcut: '⌘M', action: () => os.finder.makeAlias(), disabled: !has }, { label: 'Add to Favorites', action: () => { state.favorites = [...new Set([...(state.favorites ?? []), ...selected.map(n => n.id)])]; os.persist(); }, disabled: !has }, { label: 'Put Away', shortcut: '⌘Y', action: () => selected.filter(n => n.parent === 'trash').forEach(n => vfs.restore(n.id)), disabled: !selected.some(n => n.parent === 'trash') }, sep, { label: 'Find…', shortcut: '⌘F', action: 'find' }, { label: 'Show Original', action: () => { const n = vfs.resolve(selected[0]?.id); if (n) {
                            os.finder.open(n.parent);
                            os.finder.selected = new Set([n.id]);
                            os.finder.updateSelection();
                        } }, disabled: selected[0]?.type !== 'alias' }, sep, { label: 'Import Files…', action: () => os.chooseImport() }, { label: 'Export…', action: () => selected.forEach(n => os.exportNode(n.id)), disabled: !has }]],
            ['Edit', [{ label: vfs.undoStack.length ? `Undo ${vfs.undoStack.at(-1).label}` : 'Undo', shortcut: '⌘Z', action: 'undo', disabled: !vfs.undoStack.length }, { label: 'Redo', shortcut: '⇧⌘Z', action: 'redo', disabled: !vfs.redoStack.length }, sep, { label: 'Cut', shortcut: '⌘X', action: 'cut', disabled: !has }, { label: 'Copy', shortcut: '⌘C', action: 'copy', disabled: !has }, { label: 'Paste', shortcut: '⌘V', action: 'paste', disabled: !os.clipboard.files.length }, { label: 'Select All', shortcut: '⌘A', action: 'selectall' }, sep, { label: 'Show Clipboard', action: () => os.showClipboard() }, { label: 'Preferences…', action: () => os.launch('cp:general-controls') }]],
            ['View', [...['icons', 'list', 'buttons'].map(view => ({ label: `as ${view}`, checked: os.finder.activeView?.view === view, action: () => os.finder.setView(view) })), sep, { label: 'as Window', checked: !os.wm.active?.collapsed, action: () => { if (os.wm.active?.collapsed)
                            os.wm.collapse(os.wm.active); } }, { label: 'as Pop-up Window', action: () => { const w = os.wm.active; if (w) {
                            w.y = root.clientHeight - 23;
                            w.collapsed = true;
                            os.wm.layout(w);
                        } } }, sep, { label: 'Clean Up', action: () => os.finder.cleanUp() }, { label: 'Arrange', items: ['name', 'modified', 'size', 'kind', 'label'].map(sort => ({ label: `by ${sort === 'modified' ? 'date' : sort}`, action: () => { const view = os.finder.activeView; if (view) {
                                view.sort = sort;
                                view.freeform = false;
                                os.finder.render(view);
                                os.finder.remember(view);
                            } } })) }, { label: 'View Options…', action: () => os.viewOptions() }]],
            ['Special', [{ label: 'Empty Trash…', action: 'emptytrash', disabled: !vfs.children('trash').length }, sep, { label: 'Sleep', action: () => os.sleep() }, { label: 'Restart', action: () => os.restart() }, { label: 'Shut Down', action: () => os.shutdown() }, sep, { label: 'Back Up Disk…', action: () => os.backup() }, { label: 'Restore Disk…', action: () => os.restoreDisk() }, { label: 'Enter Full Screen', action: () => os.fullscreen() }]],
        ];
    };
    os.updateMenus = () => { if (os.disposed)
        return; menubar.replaceChildren(); const add = (title, items, extra = {}) => { const b = el('button', { class: `menu-button ${extra.className ?? ''}`, 'aria-label': extra.label ?? title, 'aria-haspopup': 'menu', ...(extra.html ? { html: extra.html } : { text: title }) }); b.addEventListener('click', e => { e.stopPropagation(); if (os.wm.topModal())
        return; os.menu.toggle(b, typeof items === 'function' ? items() : items); }); b.addEventListener('pointerenter', () => { if (os.menu.menus.length && os.menu.button !== b) {
        const rect = b.getBoundingClientRect();
        os.menu.open(typeof items === 'function' ? items() : items, rect.left, 20, b);
    } }); menubar.append(b); return b; }; add('Apple', () => os.appleItems(), { className: 'apple-menu', html: appleIcon() }); const active = os.wm.active; const appmenus = os.activeApp !== 'finder' && active?.menus ? active.menus() : os.activeApp !== 'finder' ? os.standardMenus() : os.finderMenus(); for (const [title, items] of appmenus)
        add(title, typeof items === 'function' ? items() : items); add('Help', () => [{ label: settings.get('balloonHelp') ? 'Hide Balloons' : 'Show Balloons', action: () => settings.set('balloonHelp', !settings.get('balloonHelp')) }, sep, { label: 'Mac Help', shortcut: '⌘?', action: () => os.launch('help') }, { label: `About ${os.running.get(os.activeApp)?.title ?? 'Finder'}…`, action: () => os.activeApp === 'finder' ? os.about() : os.alert(`${os.running.get(os.activeApp)?.title}\nPart of the Platinum Macintosh browser system.`) }], { className: 'menu-help' }); menubar.append(el('div', { class: 'menu-spacer' })); const clock = el('button', { class: 'menu-clock', 'aria-label': 'Date and Time', onClick: () => os.launch('cp:date-time') }); menubar.append(clock); os.clock = clock; os.tick(); add('Applications', () => os.appItems(), { className: 'application-menu', html: icon(os.running.get(os.activeApp)?.icon ?? 'finder', 16) + `<span>${h(os.running.get(os.activeApp)?.title ?? 'Finder')}</span>` }); };
    os.standardMenus = () => [['File', [{ label: 'New', shortcut: '⌘N', action: 'new' }, { label: 'Open…', shortcut: '⌘O', action: 'open' }, { label: 'Close', shortcut: '⌘W', action: 'close' }, sep, { label: 'Save', shortcut: '⌘S', action: 'save' }, { label: 'Save As…', action: 'saveas' }, sep, { label: 'Print…', shortcut: '⌘P', action: 'print' }, sep, { label: 'Quit', shortcut: '⌘Q', action: 'quit' }]], ['Edit', [{ label: 'Undo', shortcut: '⌘Z', action: 'undo' }, sep, { label: 'Cut', shortcut: '⌘X', action: 'cut' }, { label: 'Copy', shortcut: '⌘C', action: 'copy' }, { label: 'Paste', shortcut: '⌘V', action: 'paste' }, { label: 'Select All', shortcut: '⌘A', action: 'selectall' }]]];
    os.dispatch = async (command) => { const win = os.wm.active; if (win?.commands?.[command])
        return win.commands[command](); if (command === 'close')
        return win && os.wm.close(win); if (command === 'quit')
        return os.quit(os.activeApp); if (command === 'find')
        return os.launch('sherlock'); if (command === 'info')
        return os.finder.current().forEach(n => os.showInfo(n.id)); if (command === 'emptytrash') {
        if (await os.confirm('Are you sure you want to permanently remove the items in the Trash?', 'Empty Trash'))
            vfs.emptyTrash();
        return;
    } if (os.activeApp === 'finder') {
        const f = os.finder;
        if (command === 'new')
            return f.newFolder();
        if (command === 'open')
            return f.current().forEach(n => os.openNode(n.id));
        if (command === 'cut')
            return f.copy(true);
        if (command === 'copy')
            return f.copy();
        if (command === 'paste')
            return f.paste();
        if (command === 'selectall')
            return f.selectAll();
        if (command === 'undo')
            return vfs.undo();
        if (command === 'redo')
            return vfs.redo();
        if (command === 'print')
            return os.printHTML(f.current().map(n => `<h2>${h(n.name)}</h2><pre>${h(n.content ?? '')}</pre>`).join(''));
    }
    else {
        if (command === 'new')
            return os.launch(os.activeApp, { new: true });
        if (command === 'open') {
            const node = await os.fileDialog();
            if (node)
                return os.openNode(node.id);
        }
        if (['undo', 'redo', 'cut', 'copy', 'paste', 'selectall'].includes(command)) {
            if (command === 'paste') {
                const text = await os.clipboard.readText();
                document.execCommand('insertText', false, text);
            }
            else {
                if (command === 'copy' || command === 'cut')
                    os.clipboard.writeText(window.getSelection()?.toString() ?? '');
                document.execCommand(command === 'selectall' ? 'selectAll' : command);
            }
        }
    } };
    os.showClipboard = () => { const win = os.wm.create({ id: 'clipboard', appId: 'finder', title: 'Clipboard', width: 380, height: 250 }); win.body.replaceChildren(el('div', { class: 'scrapbook-page', text: os.clipboard.files.length ? os.clipboard.files.map(id => vfs.path(id)).join('\n') : os.clipboard.text || 'The Clipboard is empty.' })); };
    os.viewOptions = () => { const win = os.wm.create({ id: 'view-options', title: 'View Options', appId: 'finder', width: 310, height: 220, resizable: false }); const panel = el('div', { class: 'panel' }); panel.append(el('h3', { text: 'View Options' }), ...['icons', 'list', 'buttons'].map(v => button(`View as ${v}`, () => os.finder.setView(v), { style: { display: 'block', marginBottom: '10px' } })), checkbox('Use color labels', settings.get('labelColor'), value => settings.set('labelColor', value))); win.body.replaceChildren(panel); };
    os.fullscreen = async () => { if (document.fullscreenElement)
        await document.exitFullscreen();
    else
        await root.requestFullscreen?.(); };
    os.switcher = () => { const win = os.wm.create({ id: 'switcher', appId: 'finder', title: 'Application Switcher', width: Math.min(650, os.running.size * 86 + 30), height: 105, resizable: false }); const body = el('div', { class: 'process-switcher' }); for (const app of os.running.values())
        body.append(el('button', { class: app.id === os.activeApp ? 'selected' : '', html: icon(app.icon, 32) + `<span>${h(app.title)}</span>`, onClick: () => { os.wm.showApp(app.id); os.activeApp = app.id; os.updateMenus(); } })); win.body.replaceChildren(body); };
    os.tick = () => { if (!os.clock)
        return; const now = new Date(Date.now() + (settings.get('clockOffset') || 0)); const options = { hour: 'numeric', minute: '2-digit', hour12: !settings.get('clock24') }; if (settings.get('showSeconds'))
        options.second = '2-digit'; if (settings.get('timezone'))
        options.timeZone = settings.get('timezone'); try {
        os.clock.textContent = (settings.get('showDate') ? now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + '  ' : '') + now.toLocaleTimeString('en-US', options);
    }
    catch {
        os.clock.textContent = now.toLocaleTimeString();
    } };
    os.applySettings = () => { os.wm.shouldCollapse = () => settings.get('titleCollapse', true); root.classList.toggle('reduce-motion', settings.get('reduceMotion')); root.classList.toggle('hide-label-colors', settings.get('labelColor', true) === false); document.documentElement.style.setProperty('--view-font', settings.get('viewFont') === 'Chicago' ? 'Chicago,ChicagoFLF,sans-serif' : settings.get('viewFont') === 'Monaco' ? 'Monaco,monospace' : 'Geneva,Arial,sans-serif'); document.documentElement.style.setProperty('--accent', settings.get('accent')); document.documentElement.style.setProperty('--selection', settings.get('accent') === '#333399' ? '#ccccff' : settings.get('accent') + '55'); document.documentElement.style.setProperty('--system', settings.get('font') === 'Geneva' ? 'Geneva,Arial,sans-serif' : settings.get('font') === 'Chicago' ? 'Chicago,ChicagoFLF,sans-serif' : 'Charcoal,Chicago,ChicagoFLF,sans-serif'); root.classList.toggle('large-text', settings.get('largeText')); root.classList.toggle('high-contrast', settings.get('highContrast')); os.renderer?.set({ ...patternOptions(settings.get('pattern'), settings.get('desktopColor')), brightness: settings.get('brightness') }); os.renderStrip(); os.tick(); };
    os.renderStrip = () => { os.strip?.remove(); if (!settings.get('controlStrip'))
        return; const strip = el('div', { class: `control-strip ${settings.get('stripCollapsed') ? 'collapsed-strip' : ''}`, 'aria-label': 'Control Strip' }); const module = (label, ico, action, arrow = true) => el('button', { class: 'strip-module', title: label, 'aria-label': label, html: icon(ico, 16) + (arrow ? '<span class="strip-arrow">▼</span>' : ''), onClick: action }); strip.append(el('button', { class: 'strip-module strip-toggle', text: settings.get('stripCollapsed') ? '▶' : '◀', title: 'Collapse Control Strip', 'aria-label': 'Collapse Control Strip', onClick: () => settings.set('stripCollapsed', !settings.get('stripCollapsed')) })); strip.append(module('AppleTalk', 'network', e => os.menu.open([{ label: 'AppleTalk Active', checked: settings.get('appleTalk'), action: () => settings.set('appleTalk', !settings.get('appleTalk')) }, { label: 'Open AppleTalk', action: () => os.launch('cp:appletalk') }], e.clientX, root.clientHeight - 90)), module('File Sharing', 'folder', () => os.launch('cp:file-sharing')), module('CD Audio', 'cd', () => os.launch('applecd')), module('Sound Volume', 'sound', e => os.menu.open([...[100, 75, 50, 25, 0].map(v => ({ label: v ? `${v}%` : 'Mute', checked: Math.round(settings.get('volume') * 100) === v, action: () => { settings.set('volume', v / 100); settings.set('sound', v > 0); os.sound.beep(); } })), sep, { label: 'Open Sound', action: () => os.launch('cp:sound') }], e.clientX, root.clientHeight - 175)), module('Monitors', 'monitor', () => os.launch('cp:monitors')), module('Desktop Appearance', 'appearance', () => os.launch('cp:appearance')), module('Keyboard', 'keyboard', () => os.launch('keycaps')), module('Location Manager', 'network', () => os.launch('cp:location-manager')), module('Keychain', 'key', () => os.launch('cp:keychain')), module('Energy Saver', 'energy', () => os.launch('cp:energy-saver')), module('Control Panels', 'control', () => os.finder.open('control-panels')), el('span', { class: 'strip-end' })); root.append(strip); os.strip = strip; };
    os.wm.on('focus', win => { os.activeApp = win?.appId ?? 'finder'; if (win && os.registry.has(win.appId))
        os.running.set(win.appId, os.registry.get(win.appId)); os.updateMenus?.(); });
    os.wm.on('layout', win => { const view = [...os.finder.views.values()].find(v => v.win === win); if (view)
        os.finder.remember(view); });
    vfs.on('change', () => os.persist());
    settings.on('change', ({ key }) => { os.applySettings(); os.persist(); if (key === 'renderer')
        os.changeRenderer(settings.get('renderer')); });
    os.changeRenderer = async (preference) => { os.renderer?.dispose(); os.renderer = new SurfaceRenderer(wallpaper, { preference, ...patternOptions(settings.get('pattern'), settings.get('desktopColor')), brightness: settings.get('brightness') }); os.renderer.on('backend', backend => os.events.emit('renderer', backend)); await os.renderer.initialize(); };
    os.updateMenus();
    os.applySettings();
    const rendererPreference = new URLSearchParams(location.search).get('renderer') ?? settings.get('renderer');
    await os.changeRenderer(rendererPreference);
    document.addEventListener('keydown', event => { if (event.defaultPrevented)
        return; if (os.menu.menus.length)
        return; if (event.target.closest('input,textarea') && (event.metaKey || event.ctrlKey) && ['a', 'c', 'v', 'x', 'z'].includes(event.key.toLowerCase()))
        return; if (os.wm.active?.element.getAttribute('aria-modal') === 'true')
        return; if (event.target.closest('input,textarea,[contenteditable=true]') && !event.metaKey && !event.ctrlKey)
        return; if (event.key === 'Escape') {
        os.menu.close();
        return;
    } const cmd = event.metaKey || event.ctrlKey; if (cmd && event.key === 'Tab') {
        event.preventDefault();
        const apps = [...os.running.keys()];
        const at = apps.indexOf(os.activeApp), next = apps[(at + (event.shiftKey ? -1 : 1) + apps.length) % apps.length];
        os.wm.showApp(next);
        os.activeApp = next;
        os.updateMenus();
        return;
    } if (cmd) {
        const map = { n: 'new', o: 'open', s: event.shiftKey ? 'saveas' : 'save', w: 'close', q: 'quit', f: 'find', i: 'info', d: 'duplicate', a: 'selectall', z: event.shiftKey ? 'redo' : 'undo', c: 'copy', v: 'paste', x: 'cut', p: 'print', '?': 'help' };
        const command = map[event.key.toLowerCase()];
        if (command) {
            event.preventDefault();
            if (command === 'help')
                os.launch('help');
            else if (command === 'duplicate' && os.activeApp === 'finder')
                os.finder.duplicate();
            else
                os.run(command);
            return;
        }
    } if (os.activeApp === 'finder' && !event.target.closest('input,textarea,[contenteditable]'))
        os.finder.key(event); }, { signal: lifecycle.signal });
    root.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files'))
        e.preventDefault(); }, { signal: lifecycle.signal });
    root.addEventListener('drop', e => { if (e.defaultPrevented)
        return; if (e.dataTransfer.files.length) {
        e.preventDefault();
        os.run(() => os.importFiles(e.dataTransfer.files, 'desktop'));
    } }, { signal: lifecycle.signal });
    root.addEventListener('contextmenu', e => e.preventDefault(), { signal: lifecycle.signal });
    window.addEventListener('resize', () => os.finder.render(os.finder.desktopView), { signal: lifecycle.signal });
    document.addEventListener('pointerdown', () => os.sound.init().catch(() => { }), { signal: lifecycle.signal, once: true });
    os.lastActivity = Date.now();
    for (const event of ['pointerdown', 'pointermove', 'keydown'])
        root.addEventListener(event, () => { os.lastActivity = Date.now(); }, { signal: lifecycle.signal });
    const clockTimer = setInterval(() => { os.tick(); const minutes = Number(settings.get('screenSaver')); if (minutes > 0 && !os.sleeping && Date.now() - os.lastActivity >= minutes * 60000)
        os.sleep(); }, 1000);
    const updateTimer = setInterval(async () => { if (!settings.get('checkUpdates'))
        return; try {
        const response = await fetch('/version.json', { cache: 'no-store' });
        if (response.ok) {
            const data = await response.json();
            settings.set('lastUpdateCheck', Date.now());
            settings.set('availableVersion', data.version);
        }
    }
    catch { } }, 300000);
    let balloonTimer, balloon;
    root.addEventListener('pointerover', e => { if (!settings.get('balloonHelp'))
        return; const title = e.target.closest('[title]')?.title; if (!title)
        return; clearTimeout(balloonTimer); balloonTimer = setTimeout(() => { balloon?.remove(); balloon = el('div', { class: 'balloon', text: title, style: { left: clamp(e.clientX, 4, innerWidth - 250) + 'px', top: clamp(e.clientY + 20, 24, innerHeight - 70) + 'px' } }); root.append(balloon); }, 700); }, { signal: lifecycle.signal });
    root.addEventListener('pointerout', () => { clearTimeout(balloonTimer); balloon?.remove(); }, { signal: lifecycle.signal });
    os.finder.open('disk', { x: Math.max(20, Math.round(root.clientWidth * .075)), y: 72, width: 490, height: 300 });
    if (!state.hasBooted) {
        os.launch('stickies', { initial: true });
        os.launch('simpletext', { node: vfs.get('welcome'), welcome: true, x: Math.max(36, Math.round(root.clientWidth * .28)), y: 176 });
        state.hasBooted = true;
        os.persist();
    }
    else if (state.stickies?.length)
        os.launch('stickies', { restore: true });
    for (const draftId of Object.keys(state.textDrafts ?? {}).slice(0, 20))
        os.launch('simpletext', { node: vfs.get(draftId), draftId });
    for (const name of ['pointerdown', 'click', 'dblclick', 'contextmenu', 'drop'])
        root.addEventListener(name, e => { const modal = os.wm.topModal(); if (modal && !modal.element.contains(e.target)) {
            e.preventDefault();
            e.stopImmediatePropagation();
        } }, { capture: true, signal: lifecycle.signal });
    window.addEventListener('pagehide', () => { if (!os.replacing)
        void os.persistNow(false); }, { signal: lifecycle.signal });
    document.addEventListener('focusin', e => { const modal = os.wm.topModal(); if (modal && !modal.element.contains(e.target))
        modal.element.querySelector('input,button,textarea,select')?.focus(); }, { signal: lifecycle.signal });
    registerAgentTools(os, lifecycle.signal);
    window.platinum = os;
    store.on('unpersisted', () => { if (os.storageWarningShown)
        return; os.storageWarningShown = true; void os.alert('This browser and the cloud could not save your latest changes. Keep this desktop open and choose Special → Back Up Disk to download a copy.'); });
    store.on('conflict', async () => { if (os.conflictShown)
        return; os.conflictShown = true; await os.alert('This Macintosh disk changed in another browser window. Your changes are still saved on this device. Back up this disk before refreshing, or use System Profiler to resolve the conflict.'); });
    return () => { if (!os.replacing)
        store.schedule({ filesystem: vfs.export(), settings: settings.export(), state: structuredClone(state) }); os.disposed = true; lifecycle.abort(); clearInterval(clockTimer); clearInterval(updateTimer); clearTimeout(balloonTimer); balloon?.remove(); os.persist.cancel(); os.renderer.dispose(); os.finder.dispose(); os.menu.dispose(); os.wm.dispose(); os.sound.dispose(); store.dispose(); delete window.platinum; root.replaceChildren(); };
}
