import { formatBytes, clamp } from '@platinum/core';
import { el, icon, h } from '@platinum/ui';
import { separator } from '@platinum/ui/menus';
export const LABELS = [['None', 'transparent'], ['Essential', '#ff9999'], ['Hot', '#ffcc66'], ['In Progress', '#ffff99'], ['Cool', '#99ccff'], ['Personal', '#cc99ff'], ['Project 1', '#99dd99'], ['Project 2', '#ccc']];
export class Finder {
    constructor(os, desktop) { this.os = os; this.desktop = desktop; this.views = new Map(); this.selected = new Set(); this.activeView = null; this.typeBuffer = ''; this.typeTime = 0; this.state = os.state.finder ?? (os.state.finder = {}); this.desktopView = { id: 'desktop', parent: 'desktop', element: desktop, container: desktop, desktop: true, view: 'icons', sort: 'name', direction: 1 }; this.views.set('desktop', this.desktopView); this.wireContainer(this.desktopView); this.render(this.desktopView); this.off = os.vfs.on('change', () => { this.selected = new Set([...this.selected].filter(id => os.vfs.get(id))); for (const view of this.views.values())
        this.render(view); }); }
    currentFolder() { return this.activeView?.parent ?? 'desktop'; }
    current() { return [...this.selected].map(id => this.os.vfs.get(id)).filter(Boolean); }
    open(parent, options = {}) {
        const node = this.os.vfs.resolve(parent);
        if (!node)
            return this.os.alert('The original item for this alias could not be found.');
        parent = node.id;
        const found = this.views.get(parent);
        if (found?.win) {
            this.os.wm.focus(found.win);
            this.activeView = found;
            return found.win;
        }
        const saved = this.state[parent] ?? {};
        const win = this.os.wm.create({ id: `finder-${parent}`, title: node.name, appId: 'finder', width: options.width ?? saved.width ?? 490, height: options.height ?? saved.height ?? 316, x: options.x ?? saved.x, y: options.y ?? saved.y, minWidth: 230, minHeight: 140 });
        const info = el('div', { class: 'finder-info' }), container = el('div', { class: 'finder-content', tabIndex: 0, 'aria-label': `${node.name} folder` });
        win.body.append(info, container);
        const view = { id: parent, parent, win, element: win.body, container, info, view: saved.view ?? 'icons', sort: saved.sort ?? 'name', direction: saved.direction ?? 1, expanded: new Set(), freeform: !!saved.freeform };
        this.views.set(parent, view);
        this.activeView = view;
        this.wireContainer(view);
        win.onClose = () => { this.remember(view); this.views.delete(parent); if (this.activeView === view)
            this.activeView = this.desktopView; };
        win.onResize = () => this.remember(view);
        win.element.addEventListener('pointerdown', () => { if (this.activeView !== view) {
            this.selected.clear();
            this.activeView = view;
            this.updateSelection();
        } }, { capture: true });
        win.titleElement.prepend(el('span', { html: icon(node.icon ?? 'folder', 12), draggable: true, onDragStart: e => this.startDrag(e, [parent]) }));
        this.render(view);
        this.os.touchRecent(parent);
        return win;
    }
    remember(view) { if (!view.win)
        return; const w = view.win; this.state[view.parent] = { x: w.x, y: w.y, width: w.width, height: w.height, view: view.view, sort: view.sort, direction: view.direction, freeform: view.freeform }; this.os.persist(); }
    sorted(view) { return this.os.vfs.children(view.parent).sort((a, b) => { const key = view.sort; let v = key === 'size' ? (a.size ?? 0) - (b.size ?? 0) : key === 'modified' ? a.modified - b.modified : key === 'kind' ? this.kind(a).localeCompare(this.kind(b)) : key === 'label' ? (a.label ?? 0) - (b.label ?? 0) : a.name.localeCompare(b.name, undefined, { numeric: true }); return v * view.direction; }); }
    kind(node) { return node.type === 'alias' ? 'alias' : node.type === 'folder' ? 'folder' : node.type === 'disk' ? 'disk' : node.type === 'application' ? node.kind ?? 'application' : node.kind === 'text' ? 'SimpleText document' : node.kind ?? 'document'; }
    render(view) {
        if (view.desktop) {
            view.container.replaceChildren();
            const nodes = [this.os.vfs.get('disk'), ...this.os.vfs.children('desktop'), this.os.vfs.get('trash')].filter(Boolean);
            nodes.forEach((n, i) => { const item = this.makeIcon(n, view); const pos = n.position; let x = pos?.x ?? -104, y = pos?.y ?? (n.id === 'disk' ? 17 : n.id === 'trash' ? Math.max(360, this.desktop.clientHeight - 85) : 17 + i * 78); if (x < 0)
                x = this.desktop.clientWidth + x; x = clamp(x, 0, Math.max(0, this.desktop.clientWidth - 86)); y = clamp(y, 0, Math.max(0, this.desktop.clientHeight - 64)); Object.assign(item.style, { left: `x`, top: `y` }); item.style.left = x + 'px'; item.style.top = y + 'px'; view.container.append(item); });
            return;
        }
        const node = this.os.vfs.get(view.parent);
        if (!node) {
            this.os.wm.close(view.win, true);
            return;
        }
        view.win.setTitle(node.name);
        const nodes = this.sorted(view);
        view.info.textContent = `${nodes.length} item${nodes.length === 1 ? '' : 's'}, ${formatBytes(this.os.vfs.size('disk'))} in disk, 2 GB available`;
        const scroll = { x: view.container.scrollLeft, y: view.container.scrollTop };
        view.container.replaceChildren();
        if (view.view === 'list')
            this.renderList(view, nodes);
        else {
            const grid = el('div', { class: `finder-grid ${view.view === 'buttons' ? 'buttons' : ''} ${view.freeform ? 'freeform' : ''}` });
            view.grid = grid;
            nodes.forEach((n, i) => { const item = this.makeIcon(n, view); if (view.freeform) {
                const columns = Math.max(1, Math.floor((view.container.clientWidth - 20) / 100));
                const pos = n.position ?? { x: (i % columns) * 105 + 8, y: Math.floor(i / columns) * 78 + 10 };
                Object.assign(item.style, { left: pos.x + 'px', top: pos.y + 'px' });
                grid.style.minHeight = Math.max(200, pos.y + 90) + 'px';
            } grid.append(item); });
            view.container.append(grid);
        }
        if (!nodes.length)
            view.container.append(el('div', { class: 'empty-folder', text: view.parent === 'trash' ? 'The Trash is empty.' : '0 items' }));
        view.container.scrollLeft = scroll.x;
        view.container.scrollTop = scroll.y;
        this.updateSelection();
    }
    renderList(view, nodes) { const table = el('table', { class: 'finder-table' }), head = el('thead'), row = el('tr'); for (const [key, label] of [['name', 'Name'], ['modified', 'Date Modified'], ['size', 'Size'], ['kind', 'Kind']]) {
        row.append(el('th', { text: label + (view.sort === key ? (view.direction === 1 ? ' ▴' : ' ▾') : ''), onClick: () => { view.direction = view.sort === key ? -view.direction : 1; view.sort = key; this.render(view); this.remember(view); } }));
    } head.append(row); table.append(head); const body = el('tbody'); const add = (n, depth = 0) => { const tr = el('tr', { 'data-node-id': n.id, draggable: true }), name = el('td', { style: { paddingLeft: (6 + depth * 14) + 'px' } }); if (n.type === 'folder')
        name.append(el('button', { class: 'finder-disclosure', text: view.expanded.has(n.id) ? '▼' : '▶', 'aria-label': `Expand ${n.name}`, onClick: e => { e.stopPropagation(); view.expanded.has(n.id) ? view.expanded.delete(n.id) : view.expanded.add(n.id); this.render(view); } }));
    else
        name.append(el('span', { style: { width: '12px' } })); name.append(el('span', { html: icon(n.icon ?? (n.type === 'folder' ? 'folder' : 'text'), 16) }), el('span', { text: n.name, class: 'file-caption' })); tr.append(name, el('td', { text: new Date(n.modified).toLocaleDateString() }), el('td', { text: n.type === 'folder' ? '—' : formatBytes(n.size ?? 0) }), el('td', { text: this.kind(n) })); this.wireItem(tr, n, view); body.append(tr); if (view.expanded.has(n.id))
        this.os.vfs.children(n.id).forEach(child => add(child, depth + 1)); }; nodes.forEach(n => add(n)); table.append(body); view.container.append(table); }
    makeIcon(node, view) { const resolved = this.os.vfs.resolve(node.id); let name = node.icon ?? (node.type === 'folder' ? 'folder' : 'text'); if (node.id === 'trash' && this.os.vfs.children('trash').length)
        name = 'trash-full'; const item = el('div', { class: 'file-icon', 'data-node-id': node.id, 'data-type': node.type, role: 'button', tabIndex: 0, 'aria-label': node.name, draggable: node.id !== 'trash' }); item.append(el('span', { class: 'icon-picture', html: icon(name, 32) + (node.type === 'alias' ? '<span class="alias-arrow">↗</span>' : '') }), el('span', { class: 'file-caption', text: node.name, style: node.label ? { backgroundColor: LABELS[node.label]?.[1] } : {} })); this.wireItem(item, node, view); if (['folder', 'disk'].includes(resolved?.type) || node.id === 'trash')
        this.folderTarget(item, resolved?.id ?? node.id); return item; }
    wireItem(item, node, view) { let lastClick = 0; item.addEventListener('click', e => { if (e.target.closest('.finder-disclosure,.file-rename'))
        return; e.stopPropagation(); const now = performance.now(), double = now - lastClick < this.os.settings.get('doubleClick'); lastClick = now; if (this.activeView !== view)
        this.selected.clear(); this.activeView = view; if (e.shiftKey || e.metaKey || e.ctrlKey) {
        this.selected.has(node.id) ? this.selected.delete(node.id) : this.selected.add(node.id);
    }
    else if (!double) {
        this.selected.clear();
        this.selected.add(node.id);
    } this.updateSelection(); if (view.desktop)
        this.os.wm.focusDesktop(); if (double || (view.view === 'buttons' && !e.target.closest('.file-caption'))) {
        this.os.openNode(node.id);
        if (e.altKey && view.win)
            this.os.wm.close(view.win);
    } }); item.addEventListener('keydown', e => { if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this.activeView = view;
        this.selected = new Set([node.id]);
        this.rename();
    } }); item.addEventListener('dragstart', e => { if (!this.selected.has(node.id)) {
        this.selected = new Set([node.id]);
        this.activeView = view;
        this.updateSelection();
    } this.startDrag(e, [...this.selected]); }); item.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); this.activeView = view; if (!this.selected.has(node.id))
        this.selected = new Set([node.id]); this.updateSelection(); this.os.menu.open(this.contextItems(), e.clientX, e.clientY); }); }
    updateSelection() { for (const view of this.views.values())
        for (const item of view.container.querySelectorAll('[data-node-id]')) {
            item.classList.toggle('selected', view === this.activeView && this.selected.has(item.dataset.nodeId));
            item.classList.toggle('cut', this.os.clipboard.cut && this.os.clipboard.files.includes(item.dataset.nodeId));
        } this.os.updateMenus?.(); }
    startDrag(event, ids) { event.dataTransfer.setData('application/x-platinum-files', JSON.stringify(ids)); event.dataTransfer.setData('text/plain', ids.map(id => this.os.vfs.path(id)).join('\n')); event.dataTransfer.effectAllowed = 'copyMove'; this.dragIds = ids; }
    folderTarget(element, parent) { let timer; element.addEventListener('dragover', e => { if (!e.dataTransfer.types.includes('application/x-platinum-files'))
        return; e.preventDefault(); e.stopPropagation(); element.classList.add('drop-target'); e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move'; if (!timer && parent !== 'trash')
        timer = setTimeout(() => this.open(parent), 1200); }); element.addEventListener('dragleave', () => { element.classList.remove('drop-target'); clearTimeout(timer); timer = null; }); element.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); clearTimeout(timer); timer = null; element.classList.remove('drop-target'); this.drop(e, parent); }); }
    drop(event, parent) { this.os.run(() => { const raw = event.dataTransfer.getData('application/x-platinum-files'); if (!raw)
        return; const ids = JSON.parse(raw); this.os.vfs.mutate('Move items', () => { for (const id of ids) {
        if (id === parent)
            continue;
        if (parent === 'trash')
            this.os.vfs.trash(id);
        else if (event.altKey && (event.metaKey || event.ctrlKey))
            this.os.vfs.alias(id, parent);
        else if (event.altKey)
            this.os.vfs.copy(id, parent, this.os.vfs.get(id).name);
        else
            this.os.vfs.move(id, parent);
    } }); }); }
    wireContainer(view) {
        view.container.addEventListener('pointerdown', e => { if (e.button !== 0 || e.target.closest('[data-node-id],button,input,select,textarea,th'))
            return; this.activeView = view; if (!e.shiftKey)
            this.selected.clear(); if (view.desktop)
            this.os.wm.focusDesktop(); this.updateSelection(); const rect = view.container.getBoundingClientRect(), start = { x: e.clientX - rect.left + view.container.scrollLeft, y: e.clientY - rect.top + view.container.scrollTop }; const box = el('div', { class: 'selection-box' }); view.container.append(box); view.container.setPointerCapture(e.pointerId); const move = ev => { const x = ev.clientX - rect.left + view.container.scrollLeft, y = ev.clientY - rect.top + view.container.scrollTop; const left = Math.min(start.x, x), top = Math.min(start.y, y), width = Math.abs(x - start.x), height = Math.abs(y - start.y); Object.assign(box.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' }); for (const item of view.container.querySelectorAll('[data-node-id]')) {
            const r = item.getBoundingClientRect();
            if (r.right >= rect.left + left && r.left <= rect.left + left + width && r.bottom >= rect.top + top && r.top <= rect.top + top + height)
                this.selected.add(item.dataset.nodeId);
            else if (!e.shiftKey)
                this.selected.delete(item.dataset.nodeId);
        } this.updateSelection(); }; const up = () => { box.remove(); view.container.removeEventListener('pointermove', move); view.container.removeEventListener('pointerup', up); }; view.container.addEventListener('pointermove', move); view.container.addEventListener('pointerup', up, { once: true }); });
        view.container.addEventListener('contextmenu', e => { if (e.target.closest('[data-node-id]'))
            return; e.preventDefault(); this.activeView = view; this.selected.clear(); this.updateSelection(); this.os.menu.open(this.contextItems(), e.clientX, e.clientY); });
        view.container.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move'; });
        view.container.addEventListener('drop', e => { if (e.defaultPrevented)
            return; e.preventDefault(); if (e.dataTransfer.files.length) {
            this.os.importFiles(e.dataTransfer.files, view.parent);
            return;
        } const raw = e.dataTransfer.getData('application/x-platinum-files'); if (!raw)
            return; const ids = JSON.parse(raw); if (ids.every(id => this.os.vfs.get(id)?.parent === view.parent) && !e.altKey && view.view === 'icons') {
            const rect = view.container.getBoundingClientRect();
            this.os.vfs.mutate('Arrange icons', () => ids.forEach((id, i) => this.os.vfs.update(id, { position: { x: Math.max(0, e.clientX - rect.left - 40 + i * 14), y: Math.max(0, e.clientY - rect.top - 20 + i * 14) } })));
            if (!view.desktop)
                view.freeform = true;
            this.render(view);
            this.remember(view);
        }
        else
            this.drop(e, view.parent); });
    }
    contextItems() { const n = this.current(), selected = n.length > 0; return [{ label: 'Open', action: () => n.forEach(x => this.os.openNode(x.id)), disabled: !selected }, separator, { label: 'New Folder', action: () => this.newFolder(), disabled: this.currentFolder() === 'trash' }, { label: 'Get Info', action: () => n.forEach(x => this.os.showInfo(x.id)), disabled: !selected }, { label: 'Duplicate', action: () => this.duplicate(), disabled: !selected }, { label: 'Make Alias', action: () => this.makeAlias(), disabled: !selected }, { label: 'Label', disabled: !selected, items: LABELS.map(([label, color], i) => ({ label, checked: n[0]?.label === i, action: () => n.forEach(x => this.os.vfs.update(x.id, { label: i })) })) }, separator, { label: this.currentFolder() === 'trash' ? 'Put Away' : 'Move to Trash', action: () => this.trash(), disabled: !selected }, { label: 'Clean Up', action: () => this.cleanUp() }, { label: 'View', items: ['icons', 'list', 'buttons'].map(v => ({ label: `as ${v}`, checked: this.activeView?.view === v, action: () => this.setView(v) })) }]; }
    async newFolder() { const parent = this.currentFolder() === 'trash' ? 'desktop' : this.currentFolder(); const name = this.os.vfs.uniqueName(parent, 'untitled folder'); const n = this.os.vfs.create(parent, name, { type: 'folder', icon: 'folder' }); this.selected = new Set([n.id]); this.updateSelection(); await this.rename(); }
    async rename() { const node = this.current()[0]; if (!node)
        return; const name = await this.os.prompt('Name:', node.name, 'Rename'); if (name && name !== node.name)
        this.os.run(() => this.os.vfs.rename(node.id, name)); }
    duplicate() { this.os.run(() => this.os.vfs.mutate('Duplicate items', () => this.current().forEach(n => this.os.vfs.copy(n.id, n.parent)))); }
    makeAlias() { this.os.run(() => this.current().forEach(n => this.os.vfs.alias(n.id, n.parent))); }
    trash() { this.os.run(() => this.os.vfs.mutate(this.currentFolder() === 'trash' ? 'Put Away' : 'Move to Trash', () => this.current().forEach(n => n.parent === 'trash' ? this.os.vfs.restore(n.id) : this.os.vfs.trash(n.id)))); }
    copy(cut = false) { this.os.clipboard.setFiles([...this.selected], cut); this.updateSelection(); }
    paste() { const ids = this.os.clipboard.files; if (!ids.length)
        return; const parent = this.currentFolder(); this.os.run(() => this.os.vfs.mutate('Paste items', () => ids.forEach(id => this.os.clipboard.cut ? this.os.vfs.move(id, parent) : this.os.vfs.copy(id, parent, this.os.vfs.get(id).name)))); if (this.os.clipboard.cut)
        this.os.clipboard.setFiles([]); this.updateSelection(); }
    setView(mode) { if (!this.activeView || this.activeView.desktop)
        return; this.activeView.view = mode; this.render(this.activeView); this.remember(this.activeView); }
    cleanUp() { const view = this.activeView ?? this.desktopView; if (view.desktop) {
        this.os.vfs.mutate('Clean Up', () => this.os.vfs.children('desktop').forEach((n, i) => this.os.vfs.update(n.id, { position: { x: -104, y: 95 + i * 78 } })));
    }
    else {
        view.freeform = false;
        this.render(view);
        this.remember(view);
    } }
    selectAll() { const view = this.activeView ?? this.desktopView; this.activeView = view; this.selected = new Set(this.os.vfs.children(view.parent).map(n => n.id)); this.updateSelection(); }
    key(event) { if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        if (event.metaKey || event.ctrlKey || event.key === 'Delete')
            this.trash();
        return;
    } if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        const nodes = this.activeView?.desktop ? [this.os.vfs.get('disk'), ...this.os.vfs.children('desktop'), this.os.vfs.get('trash')] : this.sorted(this.activeView ?? this.desktopView);
        const at = nodes.findIndex(n => this.selected.has(n.id));
        const delta = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
        const n = nodes[clamp(at + delta, 0, nodes.length - 1)];
        if (n) {
            this.selected = new Set([n.id]);
            this.updateSelection();
        }
        return;
    } if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        const now = Date.now();
        this.typeBuffer = now - this.typeTime < 700 ? this.typeBuffer + event.key : event.key;
        this.typeTime = now;
        const node = this.os.vfs.children(this.currentFolder()).find(n => n.name.toLowerCase().startsWith(this.typeBuffer.toLowerCase()));
        if (node) {
            this.selected = new Set([node.id]);
            this.updateSelection();
        }
    } }
    dispose() { this.off(); }
}
