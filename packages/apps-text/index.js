import { uid, download, debounce, escapeHTML } from '@platinum/core';
import { el, h, button, icon, select } from '@platinum/ui';
import { separator as sep } from '@platinum/ui/menus';
const fontStack = name => ({ Geneva: 'Geneva,Arial,sans-serif', Chicago: 'Chicago,ChicagoFLF,sans-serif', Times: 'Times,Georgia,serif', Helvetica: 'Helvetica,Arial,sans-serif', Courier: 'Courier,monospace', Monaco: 'Monaco,monospace' }[name] ?? name);
const FONTS = ['Geneva', 'Chicago', 'Times', 'Helvetica', 'Courier', 'Monaco'];
const COLORS = [['Yellow', '#fff59a'], ['Pink', '#f4c1ce'], ['Blue', '#bdd9f2'], ['Green', '#c9e4aa'], ['Purple', '#d8c7ea'], ['Gray', '#ddd']];
function safeRichText(html) { const template = document.createElement('template'); template.innerHTML = html; const allowed = new Set(['B', 'I', 'U', 'S', 'BR', 'P', 'DIV', 'H1', 'H2', 'H3', 'STRONG', 'EM', 'SPAN', 'FONT', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE']); const walk = node => { for (const child of [...node.children]) {
    if (!allowed.has(child.tagName)) {
        child.replaceWith(document.createTextNode(child.textContent ?? ''));
        continue;
    }
    const styles = {};
    for (const key of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration', 'textAlign', 'color', 'backgroundColor'])
        if (child.style[key] && !/url|expression/i.test(child.style[key]))
            styles[key] = child.style[key];
    const color = child.getAttribute('color'), face = child.getAttribute('face'), size = child.getAttribute('size');
    for (const attr of [...child.attributes])
        child.removeAttribute(attr.name);
    Object.assign(child.style, styles);
    if (color && CSS.supports('color', color))
        child.style.color = color;
    if (face && /^[\w ,'-]+$/.test(face))
        child.style.fontFamily = face;
    if (size && /^[1-7]$/.test(size))
        child.setAttribute('size', size);
    walk(child);
} }; walk(template.content); return template.innerHTML; }
export function registerTextApps(os) {
    os.register('simpletext', 'SimpleText', 'text', (options = {}) => {
        const node = options.node;
        const existing = node && os.wm.windows.find(w => w.appId === 'simpletext' && w.nodeId === node.id);
        if (existing)
            return existing;
        const win = os.wm.create({ appId: 'simpletext', title: node?.name ?? 'Untitled', width: 560, height: 408, x: options.x, y: options.y, minWidth: 300, minHeight: 160 });
        win.nodeId = node?.id;
        const draftId = options.draftId ?? node?.id ?? uid();
        os.state.textDrafts ??= {};
        const draft = os.state.textDrafts[draftId];
        let dirty = !!draft, baseName = node?.name ?? draft?.name ?? 'Untitled';
        let selectionRange = null;
        const layout = el('div', { class: 'vertical-layout' }), toolbar = el('div', { class: 'window-toolbar simpletext-toolbar' });
        const editor = el('div', { class: 'simpletext-editor', contentEditable: 'true', role: 'textbox', 'aria-label': baseName, 'aria-multiline': 'true', spellcheck: false });
        editor.style.fontFamily = fontStack(node?.meta?.font ?? 'Geneva');
        editor.style.fontSize = (node?.meta?.fontSize ?? 13) + 'px';
        if (draft?.html)
            editor.innerHTML = safeRichText(draft.html);
        else if (node?.meta?.richText)
            editor.innerHTML = safeRichText(node.meta.richText);
        else if (node?.id === 'welcome') {
            editor.innerHTML = `<div class="welcome-mark">${icon('finder', 48)}<h1>Welcome to Mac OS 9</h1></div><div class="document-rule"></div><p>Your Macintosh is ready.</p><p>Double-click <b>Macintosh HD</b> to explore your disk. The <b>Apple menu</b> puts your applications and control panels close at hand.</p><h2>A place for everything</h2><p>Write something in SimpleText. Keep a thought in Stickies. Find a file with Sherlock. Drag your documents into folders to make yourself at home.</p><h2>Make it your Macintosh</h2><p>Open <b>Appearance</b> to choose a desktop picture and colors. The <b>Control Strip</b> below gives you quick access to sound and display settings.</p><h2>Pick up where you left off</h2><p>Your documents, notes, and preferences stay with this Macintosh. Save a document with <b>⌘S</b>, or choose <b>Special → Back Up Disk</b> to keep a complete copy.</p><p>Find a tour, keyboard shortcuts, and supported features in <b>Mac Help</b>.</p>`;
        }
        else
            editor.textContent = node?.content ?? '';
        const status = el('div', { class: 'status-bar' });
        const update = () => { status.textContent = `${editor.innerText.length.toLocaleString()} characters`; win.setTitle(baseName + (dirty ? ' •' : '')); };
        const mark = () => { dirty = true; os.state.textDrafts[draftId] = { html: safeRichText(editor.innerHTML), name: baseName }; os.persist(); update(); };
        editor.addEventListener('input', mark);
        editor.addEventListener('mouseup', () => { const s = getSelection(); if (s.rangeCount && editor.contains(s.anchorNode))
            selectionRange = s.getRangeAt(0).cloneRange(); });
        editor.addEventListener('keyup', () => { const s = getSelection(); if (s.rangeCount && editor.contains(s.anchorNode))
            selectionRange = s.getRangeAt(0).cloneRange(); });
        editor.addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); mark(); });
        const format = (command, value) => { editor.focus(); if (selectionRange) {
            const s = getSelection();
            s.removeAllRanges();
            s.addRange(selectionRange);
        } document.execCommand(command, false, command === 'fontName' ? fontStack(value) : value); mark(); };
        const font = select(FONTS, node?.meta?.font ?? 'Geneva', value => format('fontName', value), { 'aria-label': 'Font' });
        const size = select([9, 10, 12, 14, 18, 24, 36], 13, value => { format('fontSize', String({ 9: 1, 10: 2, 12: 3, 14: 4, 18: 5, 24: 6, 36: 7 }[value] ?? 3)); }, { 'aria-label': 'Font size' });
        size.value = '12';
        toolbar.append(font, size, button('B', () => format('bold'), { title: 'Bold', 'aria-label': 'Bold', style: { fontWeight: 'bold' } }), button('I', () => format('italic'), { title: 'Italic', 'aria-label': 'Italic', style: { fontStyle: 'italic' } }), button('U', () => format('underline'), { title: 'Underline', 'aria-label': 'Underline', style: { textDecoration: 'underline' } }), el('span', { style: { flex: 1 } }), button('Save', () => os.run(() => save()), { title: 'Save document' }));
        layout.append(toolbar, editor, status);
        win.body.append(layout);
        async function save(saveAs = false) { const saved = await os.saveDocument({ nodeId: win.nodeId, name: baseName, content: editor.innerText, kind: 'text', saveAs, meta: { font: font.value, fontSize: parseInt(editor.style.fontSize) || 13, richText: safeRichText(editor.innerHTML) } }); if (!saved)
            return false; win.nodeId = saved.id; baseName = saved.name; dirty = false; delete os.state.textDrafts[draftId]; editor.setAttribute('aria-label', baseName); os.persist(); update(); return true; }
        const copy = async (cut = false) => { const value = getSelection()?.toString() ?? ''; await os.clipboard.writeText(value); if (cut) {
            editor.focus();
            document.execCommand('delete');
            mark();
        } };
        const find = async (replace) => { const term = await os.prompt(replace ? 'Find text to replace:' : 'Find text:', '', 'Find'); if (!term)
            return; const source = editor.innerText, index = source.toLowerCase().indexOf(term.toLowerCase()); if (index < 0) {
            await os.alert(`“${term}” was not found.`);
            return;
        } if (replace) {
            const value = await os.prompt('Replace with:', '', 'Replace');
            if (value == null)
                return;
            editor.textContent = source.replaceAll(term, value);
            mark();
            return;
        } const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT); let offset = 0, n; while (n = walker.nextNode()) {
            if (index < offset + n.textContent.length) {
                const range = document.createRange();
                range.setStart(n, index - offset);
                range.setEnd(n, Math.min(n.textContent.length, index - offset + term.length));
                getSelection().removeAllRanges();
                getSelection().addRange(range);
                editor.focus();
                selectionRange = range;
                break;
            }
            offset += n.textContent.length;
        } };
        const speak = text => { if (!('speechSynthesis' in window))
            return os.alert('Speech synthesis is unavailable in this browser.'); speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.rate = os.settings.get('speechRate') ?? 1; const voice = speechSynthesis.getVoices().find(v => v.name === os.settings.get('voice')); if (voice)
            utterance.voice = voice; speechSynthesis.speak(utterance); };
        win.commands = { new: () => os.launch('simpletext', { new: true }), open: async () => { const n = await os.fileDialog(); if (n)
                os.openNode(n.id); }, save: () => save(), saveas: () => save(true), print: () => os.printHTML(safeRichText(editor.innerHTML)), find: () => find(false), undo: () => { editor.focus(); document.execCommand('undo'); mark(); }, redo: () => { editor.focus(); document.execCommand('redo'); mark(); }, copy: () => copy(), cut: () => copy(true), paste: async () => { editor.focus(); document.execCommand('insertText', false, await os.clipboard.readText()); mark(); }, selectall: () => { editor.focus(); document.execCommand('selectAll'); } };
        win.menus = () => [...os.standardMenus(), ['Font', FONTS.map(name => ({ label: name, checked: font.value === name, action: () => { font.value = name; format('fontName', name); } }))], ['Size', [9, 10, 12, 14, 18, 24, 36, 48, 72].map(value => ({ label: String(value), action: () => { editor.style.fontSize = value + 'px'; mark(); } }))], ['Style', [{ label: 'Plain Text', action: () => format('removeFormat') }, sep, ...[['Bold', 'bold'], ['Italic', 'italic'], ['Underline', 'underline'], ['Outline', 'strikeThrough']].map(([label, command]) => ({ label, action: () => format(command) })), sep, { label: 'Align Left', action: () => format('justifyLeft') }, { label: 'Center', action: () => format('justifyCenter') }, { label: 'Align Right', action: () => format('justifyRight') }, sep, { label: 'Find…', action: () => find(false) }, { label: 'Replace…', action: () => find(true) }]], ['Sound', [{ label: 'Speak All', action: () => speak(editor.innerText) }, { label: 'Speak Selection', action: () => speak(getSelection()?.toString() ?? '') }, { label: 'Stop Speaking', action: () => speechSynthesis?.cancel() }, { label: 'Voices', items: () => speechSynthesis.getVoices().slice(0, 30).map(v => ({ label: v.name, checked: os.settings.get('voice') === v.name, action: () => os.settings.set('voice', v.name) })) }]]];
        win.beforeClose = async () => { if (!dirty)
            return true; const result = await os.dialog({ message: `Save changes to “${baseName}” before closing?`, buttons: ['Save', "Don’t Save", 'Cancel'] }); if (result.index === 2)
            return false; if (result.index === 0)
            return save(); delete os.state.textDrafts[draftId]; os.persist(); return true; };
        win.onClose = () => { if (!dirty)
            delete os.state.textDrafts[draftId]; };
        update();
        return win;
    });
    os.register('stickies', 'Stickies', 'stickies', (options = {}) => {
        os.state.stickies ??= [];
        const notes = os.state.stickies;
        const createNote = (note) => { const found = os.wm.windows.find(w => w.id === `sticky-${note.id}`); if (found)
            return found; const win = os.wm.create({ id: `sticky-${note.id}`, appId: 'stickies', title: 'Stickies', className: 'sticky-window', x: note.x ?? 60, y: note.y ?? 430, width: note.width ?? 230, height: note.height ?? 166, minWidth: 140, minHeight: 85 }); win.element.style.background = note.color ?? COLORS[0][1]; const area = el('textarea', { class: 'sticky-text', value: note.text, 'aria-label': 'Sticky note', spellcheck: false }); if (note.font)
            area.style.fontFamily = note.font; if (note.fontSize)
            area.style.fontSize = note.fontSize + 'px'; win.body.append(area); const record = () => { note.text = area.value; note.x = win.x; note.y = win.y; note.width = win.width; note.height = win.height; os.persist(); }; area.addEventListener('input', record); win.onResize = record; const off = os.wm.on('layout', w => { if (w === win)
            record(); }); const recolor = color => { note.color = color; win.element.style.background = color; os.persist(); }; win.commands = { new: () => os.launch('stickies', { new: true }), save: () => os.saveDocument({ name: 'Untitled Note', content: area.value }), saveas: () => os.saveDocument({ name: 'Untitled Note', content: area.value }), print: () => os.printHTML(`<pre>${h(area.value)}</pre>`), copy: () => os.clipboard.writeText(area.value.slice(area.selectionStart, area.selectionEnd) || area.value), cut: () => { const a = area.selectionStart, b = area.selectionEnd; os.clipboard.writeText(area.value.slice(a, b)); area.setRangeText('', a, b, 'end'); record(); }, paste: async () => { area.setRangeText(await os.clipboard.readText(), area.selectionStart, area.selectionEnd, 'end'); record(); }, selectall: () => { area.focus(); area.select(); } }; win.menus = () => [...os.standardMenus(), ['Color', COLORS.map(([label, color]) => ({ label, checked: note.color === color, action: () => recolor(color) }))], ['Font', FONTS.map(label => ({ label, action: () => { area.style.fontFamily = label; note.font = label; os.persist(); } }))], ['Size', [10, 12, 14, 18, 24].map(value => ({ label: String(value), action: () => { area.style.fontSize = value + 'px'; note.fontSize = value; os.persist(); } }))]]; win.beforeClose = async () => { record(); return true; }; win.onClose = () => { record(); off(); }; return win; };
        if (options.new || !notes.length) {
            const note = { id: uid(), text: options.initial ? 'A few things to try…\n\n• Open the Apple menu\n• Make a new folder\n• Change your desktop\n• Leave yourself a note' : '', color: COLORS[0][1], x: Math.max(20, os.root.clientWidth * .065) + notes.length * 18, y: Math.min(431, os.root.clientHeight - 205) + notes.length * 15 };
            notes.push(note);
            os.persist();
            return createNote(note);
        }
        if (options.restore || options.initial) {
            let last;
            for (const n of notes)
                last = createNote(n);
            return last;
        }
        const existing = os.wm.windows.filter(w => w.appId === 'stickies');
        if (existing.length)
            return existing.at(-1);
        return createNote(notes[0]);
    });
    os.register('notepad', 'Note Pad', 'notepad', () => { const existing = os.wm.windows.find(w => w.appId === 'notepad'); if (existing)
        return existing; os.state.notepad ??= { pages: [''], index: 0 }; const data = os.state.notepad; const win = os.wm.create({ id: 'notepad', title: 'Note Pad', appId: 'notepad', width: 350, height: 310 }); const layout = el('div', { class: 'notepad' }), area = el('textarea', { 'aria-label': 'Note Pad text', value: data.pages[data.index] ?? '', spellcheck: false }); const page = el('span'); const show = () => { area.value = data.pages[data.index]; page.textContent = `Page ${data.index + 1} of ${data.pages.length}`; os.persist(); }; const next = () => { if (data.index === data.pages.length - 1)
        data.pages.push(''); data.index++; show(); }; const footer = el('div', { class: 'notepad-bottom' }, button('◀', () => { data.index = Math.max(0, data.index - 1); show(); }, { 'aria-label': 'Previous page', style: { minWidth: '30px', padding: '0' } }), page, button('▶', next, { 'aria-label': 'Next page', style: { minWidth: '30px', padding: '0' } })); area.addEventListener('input', () => { data.pages[data.index] = area.value; os.persist(); }); layout.append(area, footer); win.body.append(layout); win.commands = { new: next, save: () => os.saveDocument({ name: `Note Pad — page ${data.index + 1}`, content: area.value }), print: () => os.printHTML(`<pre>${h(area.value)}</pre>`), copy: () => os.clipboard.writeText(area.value.slice(area.selectionStart, area.selectionEnd) || area.value), paste: async () => { area.setRangeText(await os.clipboard.readText()); data.pages[data.index] = area.value; os.persist(); }, selectall: () => { area.focus(); area.select(); } }; win.menus = () => [...os.standardMenus(), ['Page', [{ label: 'Previous Page', action: () => { data.index = Math.max(0, data.index - 1); show(); }, disabled: data.index === 0 }, { label: 'Next Page', action: next }, { label: 'Delete Page', action: () => { data.pages.splice(data.index, 1); if (!data.pages.length)
                        data.pages.push(''); data.index = Math.min(data.index, data.pages.length - 1); show(); } }]]]; show(); return win; });
    os.register('scrapbook', 'Scrapbook', 'scrapbook', () => { const existing = os.wm.windows.find(w => w.appId === 'scrapbook'); if (existing)
        return existing; os.state.scrapbook ??= []; const scraps = os.state.scrapbook; let index = 0; const win = os.wm.create({ id: 'scrapbook', title: 'Scrapbook', appId: 'scrapbook', width: 430, height: 330 }); const layout = el('div', { class: 'vertical-layout' }), page = el('div', { class: 'scrapbook-page' }), counter = el('span'); const show = () => { page.replaceChildren(); const scrap = scraps[index]; if (scrap?.kind === 'image')
        page.append(el('img', { src: scrap.content, alt: 'Scrapbook picture' }));
    else
        page.textContent = scrap?.content ?? 'The Scrapbook is empty.\n\nCopy text from a document, then choose Edit → Paste to add it.'; counter.textContent = `${scraps.length ? index + 1 : 0} of ${scraps.length}`; }; const paste = async () => { const text = await os.clipboard.readText(); if (text) {
        scraps.push({ id: uid(), kind: 'text', content: text });
        index = scraps.length - 1;
        os.persist();
        show();
    } }; const addImage = () => { const input = el('input', { type: 'file', accept: 'image/*' }); input.onchange = async () => { if (!input.files[0])
        return; const file = input.files[0]; if (file.size > 10 * 1024 * 1024)
        return os.alert('Choose an image smaller than 10 MB.'); const reader = new FileReader(); reader.onload = () => { scraps.push({ id: uid(), kind: 'image', content: reader.result }); index = scraps.length - 1; show(); os.persist(); }; reader.readAsDataURL(file); }; input.click(); }; const toolbar = el('div', { class: 'window-toolbar' }, button('Paste', paste), button('Add Picture…', addImage), button('Remove', () => { scraps.splice(index, 1); index = Math.max(0, index - 1); show(); os.persist(); })); const footer = el('div', { class: 'notepad-bottom' }, button('◀', () => { index = Math.max(0, index - 1); show(); }, { 'aria-label': 'Previous scrap' }), counter, button('▶', () => { index = Math.min(scraps.length - 1, index + 1); show(); }, { 'aria-label': 'Next scrap' })); layout.append(toolbar, page, footer); win.body.append(layout); win.commands = { paste, copy: () => os.clipboard.writeText(scraps[index]?.content ?? ''), save: () => scraps[index] && os.saveDocument({ name: 'Scrapbook clipping', content: scraps[index].content, kind: scraps[index].kind }), print: () => os.printHTML(scraps[index]?.kind === 'image' ? `<img src="${scraps[index].content}">` : `<pre>${h(scraps[index]?.content ?? '')}</pre>`) }; show(); return win; });
}
