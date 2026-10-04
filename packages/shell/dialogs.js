import { el, button, icon, h, select } from '@platinum/ui';
export function attachDialogs(os) {
    os.dialog = ({ title = 'Macintosh', message = '', buttons = ['OK'], input, iconName = 'computer', defaultButton = 0 }) => new Promise(resolve => {
        const height = input !== undefined ? 205 : message.length > 230 ? 220 : 170;
        const win = os.wm.create({ title, appId: os.activeApp, id: undefined, width: 430, height, resizable: false, className: 'dialog-window', modal: true, x: (os.root.clientWidth - 430) / 2, y: Math.max(55, os.root.clientHeight * .25) });
        win.element.setAttribute('aria-modal', 'true');
        const content = el('div', { class: 'dialog-content' }), text = el('div', { class: 'dialog-text' }, el('p', { text: message })), row = el('div', { class: 'dialog-message' }, el('span', { html: icon(iconName, 32) }), text);
        let field;
        if (input !== undefined) {
            field = el('input', { class: 'mac-input', value: input, 'aria-label': message });
            text.append(field);
        }
        const actions = el('div', { class: 'dialog-actions' });
        let settled = false;
        const done = (index) => { if (settled)
            return; settled = true; os.wm.close(win, true); resolve({ index, value: field?.value }); };
        buttons.forEach((label, i) => actions.append(button(label, () => done(i), { class: `mac-button ${i === defaultButton ? 'primary' : ''}` })));
        content.append(row, actions);
        win.body.append(content);
        win.onClose = () => { if (!settled) {
            settled = true;
            resolve({ index: buttons.length - 1, value: null });
        } };
        win.element.addEventListener('keydown', e => { if (e.key === 'Enter') {
            e.preventDefault();
            done(defaultButton);
        }
        else if (e.key === 'Escape') {
            e.preventDefault();
            done(buttons.length - 1);
        }
        else if (e.key === 'Tab') {
            const focusable = [...win.element.querySelectorAll('input,button')];
            const idx = focusable.indexOf(document.activeElement);
            if (e.shiftKey && idx === 0) {
                e.preventDefault();
                focusable.at(-1)?.focus();
            }
            else if (!e.shiftKey && idx === focusable.length - 1) {
                e.preventDefault();
                focusable[0]?.focus();
            }
        } });
        setTimeout(() => { (field ?? actions.children[defaultButton])?.focus(); field?.select(); }, 0);
    });
    os.alert = (message, title = 'Macintosh') => os.dialog({ title, message });
    os.confirm = async (message, accept = 'OK') => (await os.dialog({ message, buttons: [accept, 'Cancel'] })).index === 0;
    os.prompt = async (message, value = '', title = 'Macintosh') => { const r = await os.dialog({ title, message, input: value, buttons: ['OK', 'Cancel'] }); return r.index === 0 ? r.value : null; };
    os.fileDialog = ({ mode = 'open', parent = os.settings.get('defaultFolder') ?? 'documents', name = 'Untitled', kinds = null, title } = {}) => new Promise(resolve => {
        const win = os.wm.create({ appId: os.activeApp, title: title ?? (mode === 'save' ? 'Save' : 'Open'), width: 500, height: 337, resizable: false, className: 'file-dialog', modal: true, x: (os.root.clientWidth - 500) / 2, y: Math.max(50, os.root.clientHeight * .22) });
        win.element.setAttribute('aria-modal', 'true');
        let current = parent, selection = null, settled = false;
        const header = el('div', { class: 'file-dialog-header' }), path = select([], current, v => { current = v; render(); }, { 'aria-label': 'Current folder' }), disk = el('span', { html: icon('disk', 16) });
        path.style.flex = '1';
        header.append(disk, path);
        const list = el('div', { class: 'listbox file-dialog-list', tabIndex: 0, 'aria-label': 'Files' }), aside = el('div', { class: 'file-dialog-aside' }), filename = el('input', { class: 'mac-input', value: name, 'aria-label': 'Save document as' });
        const done = result => { if (settled)
            return; settled = true; os.wm.close(win, true); resolve(result); };
        const open = async () => { if (selection && ['folder', 'disk'].includes(selection.type)) {
            current = selection.id;
            selection = null;
            render();
            return;
        } if (mode === 'open') {
            if (selection)
                done(selection);
            return;
        } let newName = filename.value.trim(); try {
            os.vfs.assertName(newName);
        }
        catch (e) {
            await os.alert(e.message);
            return;
        } const existing = os.vfs.children(current).find(n => n.name.toLowerCase() === newName.toLowerCase()); if (existing && existing.type !== 'file') {
            await os.alert('A folder or application already uses that name. Choose another name.');
            return;
        } if (existing && !(await os.confirm(`“${newName}” already exists. Replace it?`, 'Replace')))
            return; done({ parent: current, name: newName, existing }); };
        const openButton = button(mode === 'save' ? 'Save' : 'Open', () => os.run(open), { class: 'mac-button primary' });
        aside.append(button('Desktop', () => { current = 'desktop'; render(); }), button('Up', () => { current = os.vfs.get(current)?.parent ?? 'disk'; render(); }), button('New Folder', async () => { const name = await os.prompt('New folder name:', 'untitled folder'); if (name)
            os.run(() => { const n = os.vfs.create(current, name, { type: 'folder', icon: 'folder' }); current = n.id; render(); }); }), el('div', { style: { flex: 1 } }), button('Cancel', () => done(null)), openButton);
        const middle = el('div', { style: { display: 'flex', height: '200px' } }, list, aside);
        win.body.append(header, middle);
        if (mode === 'save')
            win.body.append(el('div', { class: 'file-dialog-footer' }, el('span', { text: 'Save as:' }), filename));
        else
            win.body.append(el('p', { class: 'subtle', text: 'Select a document to open.', style: { font: '11px var(--text)', margin: '12px 0' } }));
        function render() { selection = null; const ancestors = []; let p = os.vfs.get(current); while (p) {
            ancestors.unshift(p);
            p = os.vfs.get(p.parent);
        } path.replaceChildren(...ancestors.map(n => el('option', { value: n.id, text: n.name }))); if (!ancestors.some(n => n.id === 'disk'))
            path.prepend(el('option', { value: 'disk', text: 'Macintosh HD' })); path.value = current; list.replaceChildren(); const files = os.vfs.children(current).sort((a, b) => (a.type === 'folder' ? 0 : 1) - (b.type === 'folder' ? 0 : 1) || a.name.localeCompare(b.name)); files.forEach(n => { const folder = ['folder', 'disk'].includes(n.type); if (kinds && !folder && !kinds.includes(n.kind))
            return; const row = el('div', { class: 'listbox-row', html: `${icon(n.icon ?? (folder ? 'folder' : 'text'), 16)}<span>${h(n.name)}</span>` }); row.addEventListener('click', () => { selection = n; list.querySelectorAll('.selected').forEach(x => x.classList.remove('selected')); row.classList.add('selected'); if (mode === 'save' && !folder)
            filename.value = n.name; openButton.disabled = false; }); row.addEventListener('dblclick', () => os.run(open)); list.append(row); }); if (!files.length)
            list.append(el('div', { class: 'listbox-row subtle', text: 'This folder is empty.' })); openButton.disabled = mode === 'open'; }
        win.onClose = () => { if (!settled) {
            settled = true;
            resolve(null);
        } };
        win.element.addEventListener('keydown', e => { if (e.key === 'Escape')
            done(null); if (e.key === 'Enter') {
            e.preventDefault();
            os.run(open);
        } });
        render();
        setTimeout(() => { if (mode === 'save') {
            filename.focus();
            filename.select();
        }
        else
            list.focus(); }, 0);
    });
    os.saveDocument = async ({ nodeId, name = 'Untitled', content, kind = 'text', iconName = 'text', meta, saveAs = false, mime }) => { let node = nodeId ? os.vfs.get(nodeId) : null; if (!node || saveAs) {
        const selected = await os.fileDialog({ mode: 'save', name: node?.name ?? name, parent: node?.parent ?? os.settings.get('defaultFolder') ?? 'documents' });
        if (!selected)
            return null;
        node = selected.existing ?? os.vfs.create(selected.parent, selected.name, { type: 'file', kind, icon: iconName, mime });
    } const saved = os.vfs.write(node.id, content, { kind, icon: iconName, ...(meta ? { meta } : {}), ...(mime ? { mime } : {}) }); await os.persistNow(false); return saved; };
}
