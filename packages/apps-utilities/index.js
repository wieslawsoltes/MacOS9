import { uid, formatBytes, download, clamp, debounce } from '@platinum/core';
import { VirtualFileSystem } from '@platinum/core/filesystem';
import { el, button, h, icon, field, checkbox, select, tabs } from '@platinum/ui';
import { separator as sep } from '@platinum/ui/menus';
import { SurfaceRenderer } from '@platinum/renderer';
import { compileExpression, CalculatorEngine } from './math.js';
import { compileScript, runScript } from './scripting.js';
import { openHelp } from './help.js';
const once = (os, id, make) => { const existing = os.wm.windows.find(w => w.id === id); return existing ?? make(); };
export function registerUtilities(os) {
    os.register('help', 'Mac Help', 'help', options => openHelp(os, options));
    os.register('calculator', 'Calculator', 'calculator', () => once(os, 'calculator', () => { const win = os.wm.create({ id: 'calculator', title: 'Calculator', appId: 'calculator', width: 182, height: 266, resizable: false }); const engine = new CalculatorEngine(), panel = el('div', { class: 'calculator' }), display = el('div', { class: 'calculator-display', text: '0', role: 'status', 'aria-label': 'Calculator display' }), keys = el('div', { class: 'calculator-keys' }); const press = value => { display.textContent = engine.input(value); }; for (const value of ['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '='])
        keys.append(button(value, () => press(value), { class: 'mac-button' + (value === '0' ? ' zero' : ''), 'aria-label': ({ '÷': 'Divide', '×': 'Multiply', '−': 'Subtract', '+': 'Add', '=': 'Equals', 'C': 'Clear', '±': 'Change sign', '%': 'Percent' }[value] ?? value) })); panel.append(display, keys); win.body.append(panel); const key = e => { if (os.wm.active !== win || e.ctrlKey || e.metaKey || os.menu.menus.length)
        return; const value = ({ 'Enter': '=', 'Escape': 'C', 'Backspace': '⌫', '*': '×', '/': '÷', '-': '−' }[e.key] ?? e.key); if (/[0-9.+%=]/.test(value) || ['C', '⌫', '×', '÷', '−'].includes(value)) {
        e.preventDefault();
        press(value);
    } }; document.addEventListener('keydown', key); win.onClose = () => document.removeEventListener('keydown', key); win.commands = { copy: () => os.clipboard.writeText(engine.display), paste: async () => { const value = Number(await os.clipboard.readText()); if (Number.isFinite(value)) {
            engine.display = String(value);
            engine.replace = true;
            display.textContent = engine.display;
        } }, new: () => press('C') }; win.menus = () => [['File', [{ label: 'Close', shortcut: '⌘W', action: 'close' }, sep, { label: 'Quit', shortcut: '⌘Q', action: 'quit' }]], ['Edit', [{ label: 'Copy', shortcut: '⌘C', action: 'copy' }, { label: 'Paste', shortcut: '⌘V', action: 'paste' }, sep, { label: 'Clear', action: () => press('C') }]]]; return win; }));
    os.register('sherlock', 'Sherlock 2', 'sherlock', () => once(os, 'sherlock', () => { const win = os.wm.create({ id: 'sherlock', title: 'Sherlock 2', appId: 'sherlock', width: 615, height: 410, minWidth: 370, minHeight: 240 }); const layout = el('div', { class: 'sherlock' }), channels = el('div', { class: 'sherlock-channels' }); let channel = 'Files', contents = false, scope = 'disk'; const query = el('input', { class: 'mac-input', placeholder: 'What are you looking for?', 'aria-label': 'Search for files', type: 'search' }), options = el('div', { class: 'sherlock-options' }), results = el('div', { class: 'sherlock-results' }), status = el('div', { class: 'sherlock-footer', text: 'Search your Macintosh by name or contents.' }); const renderOptions = () => { options.replaceChildren(); if (channel === 'Files')
        options.append(checkbox('Search contents', contents, v => contents = v), el('span', { text: 'in:' }), select([['disk', 'Macintosh HD'], ['desktop', 'Desktop'], ['documents', 'Documents'], ['applications', 'Applications']], scope, v => scope = v, { 'aria-label': 'Search location' }));
    else
        options.textContent = `${channel} search opens in your browser.`; }; const search = () => { results.replaceChildren(); if (channel !== 'Files') {
        const q = query.value.trim();
        if (!q)
            return;
        const prefix = channel === 'Apple' ? 'site:apple.com ' : channel === 'News' ? 'news ' : channel === 'Shopping' ? 'buy ' : '';
        results.append(el('div', { class: 'panel' }, el('p', { text: `Search the web for “${q}”.` }), el('a', { href: `https://www.google.com/search?q=${encodeURIComponent(prefix + q)}`, target: '_blank', rel: 'noopener noreferrer', text: 'Open search results in browser' }), el('p', { class: 'subtle', text: 'The original Sherlock services are no longer connected.', style: { marginTop: '14px' } })));
        status.textContent = 'Ready to search the Internet.';
        return;
    } const found = os.vfs.search(query.value, { contents, scope }); const table = el('table'), head = el('thead', { html: '<tr><th>Name</th><th>Kind</th><th>Location</th></tr>' }), body = el('tbody'); found.forEach(n => { const row = el('tr', { html: `<td>${icon(n.icon ?? (n.type === 'folder' ? 'folder' : 'text'), 16)} ${h(n.name)}</td><td>${h(os.finder.kind(n))}</td><td>${h(os.vfs.path(n.parent))}</td>`, tabIndex: 0 }); row.addEventListener('dblclick', () => os.run(() => os.openNode(n.id))); row.addEventListener('keydown', e => { if (e.key === 'Enter')
        os.openNode(n.id); }); row.addEventListener('contextmenu', e => { e.preventDefault(); os.menu.open([{ label: 'Open', action: () => os.openNode(n.id) }, { label: 'Show in Finder', action: () => { os.finder.open(n.parent); os.finder.selected = new Set([n.id]); os.finder.updateSelection(); } }, { label: 'Get Info', action: () => os.showInfo(n.id) }], e.clientX, e.clientY); }); body.append(row); }); table.append(head, body); results.append(table); if (!found.length)
        results.append(el('div', { class: 'panel subtle', text: 'No items found. Try another name or search the contents.' })); status.textContent = `${found.length} item${found.length === 1 ? '' : 's'} found`; }; for (const [name, ico] of [['Files', 'folder'], ['Internet', 'internet'], ['People', 'users'], ['Apple', 'finder'], ['Shopping', 'mail'], ['News', 'text'], ['Reference', 'scrapbook']]) {
        const b = el('button', { class: `sherlock-channel ${name === 'Files' ? 'selected' : ''}`, html: `${icon(ico, 24)}<span>${name}</span>`, onClick: () => { channel = name; channels.querySelectorAll('button').forEach(x => x.classList.toggle('selected', x === b)); query.setAttribute('aria-label', name === 'Files' ? 'Search for files' : `Search ${name}`); renderOptions(); results.replaceChildren(); } });
        channels.append(b);
    } const queryRow = el('div', { class: 'sherlock-query' }, el('span', { text: 'Find:' }), query, button('Search', search, { class: 'mac-button primary' })); query.addEventListener('keydown', e => { if (e.key === 'Enter')
        search(); }); layout.append(channels, queryRow, options, results, status); win.body.append(layout); renderOptions(); win.commands = { find: () => query.focus(), new: () => { query.value = ''; results.replaceChildren(); }, print: () => os.printHTML(results.innerHTML) }; win.menus = () => [['File', [{ label: 'Search', shortcut: '⌘F', action: search }, { label: 'Close', shortcut: '⌘W', action: 'close' }, sep, { label: 'Quit', shortcut: '⌘Q', action: 'quit' }]], ['Edit', [{ label: 'Select All', shortcut: '⌘A', action: () => { query.focus(); query.select(); } }]], ['Find', [{ label: 'By Name', checked: !contents, action: () => { contents = false; renderOptions(); } }, { label: 'By Contents', checked: contents, action: () => { contents = true; renderOptions(); } }]]]; return win; }));
    os.register('keycaps', 'Key Caps', 'keyboard', () => once(os, 'keycaps', () => { const win = os.wm.create({ id: 'keycaps', appId: 'keycaps', title: 'Key Caps', width: 586, height: 280, minWidth: 335, minHeight: 230 }); const panel = el('div', { class: 'vertical-layout' }), input = el('input', { class: 'mac-input', 'aria-label': 'Key Caps text', style: { margin: '10px', height: '30px' } }), board = el('div', { class: 'keycaps-board' }); let shifted = false, option = false; const rows = [['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'delete'], ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'], ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '\'', 'return'], ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'shift'], ['ctrl', 'option', '⌘', 'space', '⌘', 'option', '←', '↑', '↓', '→']]; const shiftMap = { '`': '~', '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')', '-': '_', '=': '+', '[': '{', ']': '}', '\\': '|', ';': ':', "'": '"', ',': '<', '.': '>', '/': '?' }; const optionMap = { a: 'å', s: 'ß', d: '∂', f: 'ƒ', g: '©', h: '˙', j: '∆', k: '˚', l: '¬', q: 'œ', w: '∑', e: '´', r: '®', t: '†', y: '¥', u: '¨', i: 'ˆ', o: 'ø', p: 'π', z: 'Ω', x: '≈', c: 'ç', v: '√', b: '∫', n: '˜', m: 'µ', '1': '¡', '2': '™', '3': '£', '4': '¢', '5': '∞', '8': '•' }; const label = key => option ? (optionMap[key] ?? key) : shifted ? (shiftMap[key] ?? key.toUpperCase()) : key; const refresh = () => board.querySelectorAll('[data-key]').forEach(b => { const key = b.dataset.key; if (key.length === 1)
        b.textContent = label(key); b.classList.toggle('active', (key === 'shift' && shifted) || (key === 'option' && option)); }); const insert = key => { if (key === 'shift' || key === 'caps') {
        shifted = !shifted;
        refresh();
        return;
    } if (key === 'option') {
        option = !option;
        refresh();
        return;
    } if (key === 'delete') {
        input.setRangeText('', Math.max(0, input.selectionStart - 1), input.selectionEnd, 'end');
        return;
    } if (['ctrl', '⌘', '←', '↑', '↓', '→'].includes(key))
        return; input.setRangeText(key === 'space' ? ' ' : key === 'return' ? '\n' : key === 'tab' ? '\t' : label(key), input.selectionStart, input.selectionEnd, 'end'); }; for (const keys of rows) {
        const row = el('div', { class: 'keycaps-row' });
        for (const key of keys)
            row.append(el('button', { class: `keycap ${key === 'space' ? 'space' : key.length > 1 ? 'wide' : ''}`, 'data-key': key, text: key, onClick: () => insert(key) }));
        board.append(row);
    } const font = select(['Geneva', 'Chicago', 'Times', 'Courier', 'Monaco'], 'Geneva', v => { input.style.fontFamily = v; board.style.fontFamily = v; }, { 'aria-label': 'Keyboard font' }); panel.append(el('div', { class: 'window-toolbar' }, font, button('Copy', () => os.clipboard.writeText(input.value)), button('Clear', () => input.value = '')), input, board); win.body.append(panel); const keys = e => { if (os.activeApp !== 'keycaps')
        return; shifted = e.shiftKey; option = e.altKey; refresh(); for (const b of board.querySelectorAll('[data-key]'))
        if (b.dataset.key === e.key.toLowerCase())
            b.classList.toggle('active', e.type === 'keydown'); }; document.addEventListener('keydown', keys); document.addEventListener('keyup', keys); win.onClose = () => { document.removeEventListener('keydown', keys); document.removeEventListener('keyup', keys); }; win.commands = { copy: () => os.clipboard.writeText(input.value), paste: async () => { input.value += await os.clipboard.readText(); }, selectall: () => { input.focus(); input.select(); } }; return win; }));
    os.register('graphing', 'Graphing Calculator', 'graph', () => once(os, 'graphing', () => { const win = os.wm.create({ id: 'graphing', title: 'Graphing Calculator', appId: 'graphing', width: 620, height: 437, minWidth: 350, minHeight: 220 }); const layout = el('div', { class: 'vertical-layout' }), toolbar = el('div', { class: 'window-toolbar' }), expression = el('input', { class: 'mac-input', value: os.state.graphExpression ?? 'sin(x)', style: { flex: 1 }, 'aria-label': 'Graph expression' }), stage = el('div', { class: 'graph-container' }), status = el('div', { class: 'status-bar' }); let extent = 8, centerX = 0, centerY = 0, evaluate = compileExpression(expression.value), threeD = false; const source = document.createElement('canvas'); const renderer = new SurfaceRenderer(stage, { source, tile: [600, 360], preference: os.settings.get('renderer') }); const render = () => { const w = Math.max(100, stage.clientWidth), hh = Math.max(100, stage.clientHeight); source.width = w; source.height = hh; const ctx = source.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh); const scale = w / (extent * 2), x0 = w / 2 - centerX * scale, y0 = hh / 2 + centerY * scale; if (threeD) {
        ctx.strokeStyle = '#4444bb';
        const steps = 30, size = extent, project = (x, y, z) => ({ x: w / 2 + (x - y) * w / (4 * size), y: hh * .58 + (x + y) * hh / (8 * size) - z * hh / (4 * size) });
        for (let j = -steps; j <= steps; j++) {
            ctx.beginPath();
            for (let i = -steps; i <= steps; i++) {
                const x = i * size / steps, y = j * size / steps, z = clamp(evaluate(x, y), -size, size), p = project(x, y, z);
                i === -steps ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }
        for (let i = -steps; i <= steps; i++) {
            ctx.beginPath();
            for (let j = -steps; j <= steps; j++) {
                const x = i * size / steps, y = j * size / steps, z = clamp(evaluate(x, y), -size, size), p = project(x, y, z);
                j === -steps ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }
    }
    else {
        const step = Math.pow(10, Math.floor(Math.log10(extent / 3)));
        ctx.lineWidth = 1;
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        for (let x = Math.floor((centerX - extent) / step) * step; x < centerX + extent; x += step) {
            const px = Math.round(x0 + x * scale) + .5;
            ctx.strokeStyle = '#e6e6e6';
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, hh);
            ctx.stroke();
            if (x !== 0) {
                ctx.fillStyle = '#888';
                ctx.fillText(Number(x.toFixed(4)), px, clamp(y0 + 13, 13, hh - 4));
            }
        }
        for (let y = centerY - hh / (2 * scale); y < centerY + hh / (2 * scale); y += step) {
            const v = Math.round(y / step) * step, py = Math.round(y0 - v * scale) + .5;
            ctx.strokeStyle = '#e6e6e6';
            ctx.beginPath();
            ctx.moveTo(0, py);
            ctx.lineTo(w, py);
            ctx.stroke();
        }
        ctx.strokeStyle = '#555';
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0, hh);
        ctx.moveTo(0, y0);
        ctx.lineTo(w, y0);
        ctx.stroke();
        ctx.strokeStyle = '#3333bb';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        let prev = null;
        for (let px = 0; px < w; px++) {
            const x = (px - x0) / scale, y = evaluate(x, 0), py = y0 - y * scale;
            if (!Number.isFinite(y) || py < -hh * 2 || py > hh * 3) {
                prev = null;
                continue;
            }
            if (prev === null || Math.abs(py - prev) > hh)
                ctx.moveTo(px, py);
            else
                ctx.lineTo(px, py);
            prev = py;
        }
        ctx.stroke();
    } renderer.tile = [w, hh]; renderer.updateSource(source); status.textContent = `${threeD ? '3D surface' : 'y = ' + expression.value}     −${extent.toPrecision(3)} … ${extent.toPrecision(3)}`; }; const plot = () => { try {
        evaluate = compileExpression(expression.value);
        os.state.graphExpression = expression.value;
        os.persist();
        render();
    }
    catch (error) {
        status.textContent = error.message;
    } }; toolbar.append(el('span', { text: 'y =' }), expression, button('Graph', plot), button('−', () => { extent *= 1.3; render(); }, { 'aria-label': 'Zoom out' }), button('+', () => { extent /= 1.3; render(); }, { 'aria-label': 'Zoom in' })); layout.append(toolbar, stage, status); win.body.append(layout); let drag; stage.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx: centerX, cy: centerY }; stage.setPointerCapture(e.pointerId); }); stage.addEventListener('pointermove', e => { if (!drag)
        return; const scale = stage.clientWidth / (extent * 2); centerX = drag.cx - (e.clientX - drag.x) / scale; centerY = drag.cy + (e.clientY - drag.y) / scale; render(); }); stage.addEventListener('pointerup', () => drag = null); stage.addEventListener('wheel', e => { e.preventDefault(); extent = clamp(extent * (e.deltaY > 0 ? 1.12 : .88), .01, 10000); render(); }, { passive: false }); expression.addEventListener('keydown', e => { if (e.key === 'Enter')
        plot(); }); win.onResize = render; win.onClose = () => renderer.dispose(); win.commands = { save: async () => os.saveDocument({ name: 'Graph.png', content: source.toDataURL(), kind: 'image', iconName: 'paint', mime: 'image/png' }), print: () => os.printHTML(`<img src="${source.toDataURL()}">`) }; win.menus = () => [...os.standardMenus(), ['Graph', [{ label: 'Plot', action: plot }, { label: 'Reset View', action: () => { centerX = centerY = 0; extent = 8; render(); } }, sep, { label: '2D Function', checked: !threeD, action: () => { threeD = false; render(); } }, { label: '3D Surface', checked: threeD, action: () => { threeD = true; expression.value = 'sin(sqrt(x^2+y^2))'; plot(); } }, sep, ...['sin(x)', 'cos(x)', 'x^2', '1/x', 'sin(x)*exp(-abs(x)/5)', 'sqrt(25-x^2)'].map(value => ({ label: value, action: () => { expression.value = value; threeD = false; plot(); } }))]]]; source.width = 600; source.height = 360; source.getContext('2d').fillRect(0, 0, 600, 360); renderer.initialize().then(render).catch(e => status.textContent = e.message); return win; }));
    os.register('puzzle', 'Puzzle', 'puzzle', () => once(os, 'puzzle', () => { const win = os.wm.create({ id: 'puzzle', title: 'Puzzle', appId: 'puzzle', width: 252, height: 317, resizable: false }); const panel = el('div', { class: 'panel', style: { padding: '6px' } }), board = el('div', { class: 'puzzle-board' }), status = el('div', { class: 'status-bar' }); let values = Array.from({ length: 16 }, (_, i) => (i + 1) % 16), moves = 0, history = [], solving; const draw = () => { board.replaceChildren(...values.map((value, index) => el('button', { class: 'puzzle-tile' + (!value ? ' empty' : ''), text: value || '', 'aria-label': value ? `Tile ${value}` : 'Empty space', onClick: () => move(index) }))); status.textContent = values.every((v, i) => v === (i + 1) % 16) ? 'Solved!' : `${moves} moves`; }; const move = (index, record = true) => { const empty = values.indexOf(0); if (Math.abs(Math.floor(index / 4) - Math.floor(empty / 4)) + Math.abs(index % 4 - empty % 4) !== 1)
        return; if (record)
        history.push(empty); [values[index], values[empty]] = [values[empty], values[index]]; moves++; draw(); }; const shuffle = () => { clearInterval(solving); values = Array.from({ length: 16 }, (_, i) => (i + 1) % 16); history = []; for (let i = 0; i < 100; i++) {
        const empty = values.indexOf(0), neighbors = [empty - 4, empty + 4, empty % 4 ? empty - 1 : -1, empty % 4 < 3 ? empty + 1 : -1].filter(x => x >= 0 && x < 16);
        move(neighbors[Math.floor(Math.random() * neighbors.length)]);
    } moves = 0; draw(); }; panel.append(board, el('div', { class: 'panel-actions', style: { justifyContent: 'center', marginTop: 0 } }, button('Shuffle', shuffle), button('Solve', () => { clearInterval(solving); solving = setInterval(() => { if (!history.length) {
        clearInterval(solving);
        draw();
        return;
    } move(history.pop(), false); }, 35); })), status); win.body.append(panel); win.onClose = () => clearInterval(solving); win.commands = { new: shuffle }; shuffle(); return win; }));
    os.register('scripter', 'Script Editor', 'script', options => { const node = options?.node; const win = os.wm.create({ appId: 'scripter', title: node?.name ?? 'Untitled Script', width: 590, height: 405, minWidth: 340, minHeight: 210 }); let nodeId = node?.id, controller, dirty = false; const layout = el('div', { class: 'vertical-layout' }), source = el('textarea', { class: 'script-editor', 'aria-label': 'AppleScript source', spellcheck: false, value: node?.content ?? 'tell application "Finder"\n  make new folder at desktop with properties {name:"My Folder"}\nend tell\ndisplay dialog "Your folder is ready." buttons {"OK"}' }), result = el('div', { class: 'script-result', text: 'Ready.' }); source.addEventListener('input', () => dirty = true); const compile = () => { try {
        const lines = compileScript(source.value);
        result.textContent = `Compiled ${lines.length} statements.`;
    }
    catch (e) {
        result.textContent = e.message;
    } }; const run = async () => { controller?.abort(); controller = new AbortController(); result.textContent = 'Running…'; try {
        const output = await runScript(source.value, os, { signal: controller.signal, onResult: value => result.textContent = value });
        result.textContent = output;
    }
    catch (e) {
        result.textContent = e.message;
    } }; const save = async (as) => { const n = await os.saveDocument({ nodeId, name: 'Untitled Script', content: source.value, kind: 'script', iconName: 'script', saveAs: as }); if (n) {
        nodeId = n.id;
        win.setTitle(n.name);
        dirty = false;
        return true;
    } return false; }; layout.append(el('div', { class: 'window-toolbar' }, button('Compile', compile), button('Run', run), button('Stop', () => controller?.abort()), el('span', { style: { flex: 1 } }), button('Save', () => save())), source, result); win.body.append(layout); win.commands = { save: () => save(), saveas: () => save(true), new: () => os.launch('scripter'), print: () => os.printHTML(`<pre>${h(source.value)}</pre>`) }; win.menus = () => [...os.standardMenus(), ['Script', [{ label: 'Compile', action: compile }, { label: 'Run', action: run }, { label: 'Stop', action: () => controller?.abort() }]]]; win.onClose = () => controller?.abort(); win.beforeClose = async () => { if (!dirty)
        return true; const r = await os.dialog({ message: 'Save changes to this script?', buttons: ['Save', "Don’t Save", 'Cancel'] }); return r.index === 2 ? false : r.index === 0 ? save() : true; }; return win; });
    os.register('profiler', 'Apple System Profiler', 'computer', () => once(os, 'system-profiler', () => { const win = os.wm.create({ id: 'system-profiler', title: 'Apple System Profiler', appId: 'profiler', width: 610, height: 425 }); const layout = el('div', { class: 'vertical-layout' }), content = el('div', { class: 'panel flex-1' }); const show = tab => { content.replaceChildren(); const data = tab === 'System Profile' ? [['System', 'Mac OS 9.0 — Platinum recreation'], ['Computer name', os.settings.get('computerName')], ['Machine model', 'Power Macintosh (browser model)'], ['Memory', `${os.settings.get('memoryMB')} MB modeled application memory`], ['Virtual memory', os.settings.get('virtualMemory') ? 'On' : 'Off'], ['Graphics backend', os.renderer?.backend ?? 'Initializing'], ['Graphics scheduling', 'On demand; no idle animation loop'], ['Logical display', `${os.root.clientWidth} × ${os.root.clientHeight}`], ['Device pixel ratio', String(devicePixelRatio)], ['Disk persistence', os.store.status], ['Uptime', `${Math.floor((Date.now() - os.started) / 60000)} minutes`]] : tab === 'Devices and Volumes' ? [['Macintosh HD', 'Virtual disk; mac9disk format'], ['Items', String(os.vfs.nodes.size)], ['Used', formatBytes(os.vfs.size('disk'))], ['Input', 'Browser keyboard and pointing device'], ['Sound', 'Web Audio; system volume preference'], ['Printers', 'Browser print service']] : tab === 'Applications' ? [...os.running.values()].map(a => [a.title, 'Running']) : os.vfs.children('extensions').map(n => [n.name, n.meta?.enabled === false ? 'Disabled' : 'Enabled']); const dl = el('dl', { class: 'profiler-grid' }); for (const [label, value] of data)
        dl.append(el('dt', { text: label }), el('dd', { text: value })); content.append(dl); if (tab === 'System Profile') {
        content.append(el('div', { class: 'panel-actions' }, button('Save Report…', () => download(data.map(([k, v]) => `${k}: ${v}`).join('\n'), 'System Profile.txt', 'text/plain')), button('Sync Disk', async () => { await os.store.flush(); show(tab); })));
        if (os.store.recoveries?.length)
            content.append(button('Recover Local Edits…', async () => { const records = os.store.recoveries.slice(0, 5); const result = await os.dialog({ title: 'Recover Local Edits', message: 'Other sessions left unsynchronized copies. Recover only the copy you want to use. Your current disk will be downloaded first.\n' + records.map((r, i) => `${i + 1}. ${new Date(r.value.updated ?? 0).toLocaleString()} — ${r.value.payload?.filesystem?.nodes?.length ?? 0} items`).join('\n'), buttons: [...records.map((_, i) => `Recover ${i + 1}`), 'Cancel'], defaultButton: records.length }); if (result.index < records.length) {
                const record = records[result.index];
                await os.replaceSnapshot(record.value.payload, null, record);
            } }));
        if (os.store.conflict || os.conflictShown)
            content.append(button('Resolve Disk Conflict…', async () => { if (!await os.confirm('Back up your local disk and reload the saved cloud version?', 'Reload Cloud Disk'))
                return; const remote = await os.store.resolveConflict(); if (remote.payload)
                await os.replaceSnapshot(remote.payload, remote); }));
    } }; layout.append(tabs(['System Profile', 'Devices and Volumes', 'Applications', 'Extensions'], show), content); win.body.append(layout); show('System Profile'); return win; }));
    os.register('fontbook', 'Font Viewer', 'text', options => { const win = os.wm.create({ appId: 'fontbook', title: 'Font Viewer', width: 500, height: 370 }); const panel = el('div', { class: 'panel' }), preview = el('div', { contentEditable: 'true', role: 'textbox', 'aria-label': 'Font preview', text: 'The quick brown fox jumps over the lazy dog.\n\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 !@#$%&*()', style: { fontSize: '22px', lineHeight: '1.6', whiteSpace: 'pre-wrap', background: '#fff', border: '1px solid #777', padding: '18px', marginTop: '15px' } }); const family = options?.node?.name ?? 'Geneva'; preview.style.fontFamily = family; panel.append(field('Font:', select(['Geneva', 'Chicago', 'Times', 'Helvetica', 'Courier', 'Monaco'], family, value => preview.style.fontFamily = value)), field('Size:', select([9, 12, 14, 18, 24, 36, 48], 24, value => preview.style.fontSize = value + 'px')), preview); win.body.append(panel); win.commands = { print: () => os.printHTML(preview.outerHTML) }; return win; });
    os.register('disk-first-aid', 'Disk First Aid', 'firstaid', () => once(os, 'disk-first-aid', () => { const win = os.wm.create({ id: 'disk-first-aid', appId: 'disk-first-aid', title: 'Disk First Aid', width: 455, height: 350, resizable: false }); const panel = el('div', { class: 'panel' }), log = el('pre', { class: 'listbox', style: { height: '165px', padding: '10px', whiteSpace: 'pre-wrap' }, text: 'Select a volume, then click Verify to check its directory.' }); const verify = () => { const result = VirtualFileSystem.validate(os.vfs.export()), aliases = [...os.vfs.nodes.values()].filter(n => n.type === 'alias' && !os.vfs.resolve(n.id)); log.textContent = `Checking “Macintosh HD”…\nChecking directory structure…\nChecking parent relationships…\nChecking unique names…\nChecking aliases…\n\n${result.valid ? 'The volume appears to be OK.' : result.errors.join('\n')}${aliases.length ? `\n${aliases.length} alias(es) have missing originals.` : ''}`; }; panel.append(el('div', { class: 'info-header' }, el('span', { html: icon('disk', 32) }), el('strong', { text: 'Macintosh HD' })), log, el('div', { class: 'panel-actions' }, button('Verify', verify), button('Repair', () => { const aliases = [...os.vfs.nodes.values()].filter(n => n.type === 'alias' && !os.vfs.resolve(n.id)); for (const n of aliases)
        os.vfs.trash(n.id); verify(); log.textContent += aliases.length ? `\nMoved ${aliases.length} broken aliases to Trash.` : '\nNo repairs were needed.'; }))); win.body.append(panel); return win; }));
    const mountShare = () => { const existing = os.vfs.children('desktop').find(n => n.meta?.shared); if (existing) {
        os.finder.open(existing.id);
        return;
    } const disk = os.vfs.create('desktop', 'Shared Files', { type: 'disk', icon: 'network', meta: { shared: true } }); os.vfs.create(disk.id, 'Welcome to Shared Files', { type: 'file', kind: 'text', icon: 'text', content: 'This is a virtual shared folder inside your Macintosh disk.\n\nFiles here are part of your persistent disk. It does not connect to an AppleTalk or AFP server.' }); os.finder.open(disk.id); };
    os.register('network', 'Network Browser', 'network', () => once(os, 'network-browser', () => { const win = os.wm.create({ id: 'network-browser', appId: 'network', title: 'Network Browser', width: 460, height: 315 }); const panel = el('div', { class: 'panel' }), address = el('input', { class: 'mac-input', value: 'macnet://shared', 'aria-label': 'Server address', style: { width: '100%' } }); panel.append(el('h3', { text: 'Connect to a server' }), el('p', { text: 'Choose a virtual server or enter a web address.' }), el('div', { class: 'listbox', style: { height: '105px' } }, el('div', { class: 'listbox-row selected', html: icon('network', 24) + '<span>Local Network — Shared Files</span>', onDblclick: mountShare })), el('p', { text: 'Address:', style: { margin: '12px 0 3px' } }), address, el('div', { class: 'panel-actions' }, button('Connect', () => { if (address.value === 'macnet://shared')
        mountShare();
    else if (/^https?:\/\//i.test(address.value))
        os.launch('browser', { url: address.value });
    else
        os.alert('Use macnet://shared for the virtual share, or an http/https web address. AppleTalk and AFP are not available in a browser.'); }))); win.body.append(panel); return win; }));
    os.register('chooser', 'Chooser', 'chooser', () => once(os, 'chooser', () => { const win = os.wm.create({ id: 'chooser', title: 'Chooser', appId: 'chooser', width: 490, height: 355, resizable: false }); const panel = el('div', { class: 'panel' }), row = el('div', { style: { display: 'flex', gap: '15px' } }), devices = el('div', { class: 'listbox', style: { width: '160px', height: '185px' } }), detail = el('div', { style: { flex: 1 } }); const show = name => { detail.replaceChildren(el('p', { text: name === 'AppleShare' ? 'Select a file server:' : 'Select a printer:' }), el('div', { class: 'listbox', style: { height: '115px' } }, el('div', { class: 'listbox-row selected', text: name === 'AppleShare' ? 'Shared Files' : 'LaserWriter — Browser Printer' })), button(name === 'AppleShare' ? 'Connect' : 'Print Test Page', () => name === 'AppleShare' ? mountShare() : os.printHTML('<h1>LaserWriter</h1><p>Platinum Macintosh printer test page.</p><p>Printing is provided by your browser.</p>'))); }; for (const name of ['AppleShare', 'LaserWriter 8'])
        devices.append(el('div', { class: 'listbox-row', html: icon(name === 'AppleShare' ? 'network' : 'computer', 32) + `<span>${name}</span>`, onClick: e => { devices.querySelectorAll('.selected').forEach(x => x.classList.remove('selected')); e.currentTarget.classList.add('selected'); show(name); } })); row.append(devices, detail); panel.append(row, el('hr'), checkbox('AppleTalk Active', os.settings.get('appleTalk'), v => os.settings.set('appleTalk', v)), el('p', { class: 'subtle', text: 'This Chooser configures virtual services for this Macintosh.', style: { marginTop: '10px', fontSize: '11px' } })); win.body.append(panel); show('LaserWriter 8'); return win; }));
    os.register('drive-setup', 'Drive Setup', 'disk', () => once(os, 'drive-setup', () => { const win = os.wm.create({ id: 'drive-setup', title: 'Drive Setup', appId: 'drive-setup', width: 475, height: 335 }); const panel = el('div', { class: 'panel' }), list = el('div', { class: 'listbox', style: { height: '175px' } }); const render = () => { list.replaceChildren(...[...os.vfs.nodes.values()].filter(n => n.type === 'disk').map(n => el('div', { class: 'listbox-row', html: icon('disk', 24) + `<span>${h(n.name)} — Virtual disk</span>` }))); }; panel.append(el('p', { text: 'Create a new virtual disk on your Macintosh desktop.' }), list, el('div', { class: 'panel-actions' }, button('Initialize…', async () => { const name = await os.prompt('Name the new virtual disk:', 'Untitled'); if (name)
        os.run(() => { const n = os.vfs.create('desktop', name, { type: 'disk', icon: 'disk', meta: { capacity: 2147483648 } }); render(); os.finder.open(n.id); }); }))); win.body.append(panel); render(); return win; }));
    os.register('disk-copy', 'Disk Copy', 'disk', () => once(os, 'disk-copy', () => { const win = os.wm.create({ id: 'disk-copy', title: 'Disk Copy', appId: 'disk-copy', width: 430, height: 285, resizable: false }); const panel = el('div', { class: 'panel' }); panel.append(el('div', { class: 'info-header' }, el('span', { html: icon('disk', 48) }), el('div', {}, el('h3', { text: 'Disk Copy' }), el('p', { text: 'Back up and restore your Macintosh.' }))), el('p', { text: 'Images use the portable mac9disk JSON format. They contain your complete virtual filesystem, notes, and preferences.' }), el('div', { class: 'panel-actions', style: { justifyContent: 'center', flexWrap: 'wrap' } }, button('Create Image…', () => os.backup()), button('Restore Image…', () => os.restoreDisk()), button('New Blank Disk…', () => os.launch('drive-setup')))); win.body.append(panel); return win; }));
}
