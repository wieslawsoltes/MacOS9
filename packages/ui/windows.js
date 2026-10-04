import { EventBus, uid, clamp } from '@platinum/core';
import { el, icon, gripDrag } from './index.js';
export class WindowManager extends EventBus {
    constructor(root) { super(); this.root = root; this.windows = []; this.active = null; this.z = 10; this.controller = new AbortController(); window.addEventListener('resize', () => this.constrainAll(), { signal: this.controller.signal }); }
    create(options = {}) {
        const id = options.id ?? uid();
        const existing = this.windows.find(w => w.id === id);
        if (existing) {
            this.focus(existing);
            return existing;
        }
        const bounds = this.bounds();
        let width = Math.min(options.width ?? 460, bounds.w - 12), height = Math.min(options.height ?? 330, bounds.h - 40);
        const cascade = (this.windows.length % 7) * 22;
        const win = { ...options, id, appId: options.appId ?? 'finder', title: options.title ?? 'Untitled', width, height, x: clamp(options.x ?? 60 + cascade, 2, Math.max(2, bounds.w - width - 3)), y: clamp(options.y ?? 60 + cascade, 23, Math.max(23, bounds.h - height - 25)), resizable: options.resizable !== false, collapsed: false, hidden: false, closed: false, zoomed: false };
        win.element = el('section', { class: `mac-window ${options.className ?? ''}`, role: 'dialog', 'aria-label': win.title, tabIndex: -1, 'data-window-id': id, 'data-app-id': win.appId, 'aria-modal': options.modal ? 'true' : null });
        win.titlebar = el('div', { class: 'window-titlebar' });
        win.closeButton = el('button', { class: 'window-close window-box', 'aria-label': `Close ${win.title}`, title: 'Close', onClick: () => this.close(win) });
        win.titleElement = el('span', { class: 'window-title', text: win.title });
        win.titlebar.append(win.closeButton, el('div', { class: 'title-stripes' }), win.titleElement, el('div', { class: 'title-stripes' }));
        if (win.resizable)
            win.titlebar.append(el('button', { class: 'window-zoom window-box', title: 'Zoom', 'aria-label': `Zoom ${win.title}`, onClick: () => this.zoom(win) }));
        win.titlebar.append(el('button', { class: 'window-collapse window-box', title: 'Collapse', 'aria-label': `Collapse ${win.title}`, onClick: () => this.collapse(win) }));
        win.body = el('div', { class: 'window-body' });
        win.element.append(win.titlebar, win.body);
        if (win.resizable) {
            win.grow = el('div', { class: 'window-grow', role: 'separator', 'aria-label': 'Resize window', tabIndex: 0 });
            win.element.append(win.grow);
            gripDrag(win.grow, (dx, dy, start) => { win.width = clamp(start.width + dx, Math.min(options.minWidth ?? 200, bounds.w - 12), this.bounds().w - win.x - 2); win.height = clamp(start.height + dy, options.minHeight ?? 100, this.bounds().h - win.y - 3); win.zoomed = false; this.layout(win); win.onResize?.(); }, () => this.emit('layout', win), { start: () => ({ width: win.width, height: win.height }) });
            win.grow.addEventListener('keydown', e => { if (e.key.startsWith('Arrow')) {
                e.preventDefault();
                win.width += e.key === 'ArrowRight' ? 10 : e.key === 'ArrowLeft' ? -10 : 0;
                win.height += e.key === 'ArrowDown' ? 10 : e.key === 'ArrowUp' ? -10 : 0;
                this.layout(win);
                win.onResize?.();
            } });
        }
        gripDrag(win.titlebar, (dx, dy, start) => { win.x = clamp(start.x + dx, 2, Math.max(2, this.bounds().w - win.width)); win.y = clamp(start.y + dy, 21, this.bounds().h - 24); this.layout(win); }, () => this.emit('layout', win), { start: () => { this.focus(win); return { x: win.x, y: win.y }; } });
        win.titlebar.addEventListener('dblclick', e => { if (!e.target.closest('button') && this.shouldCollapse?.() !== false && !win.modal)
            this.collapse(win); });
        win.element.addEventListener('pointerdown', e => { const modal = this.topModal(); if (modal && modal !== win) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        } this.focus(win); }, { capture: true });
        win.setTitle = title => { win.title = title; win.titleElement.textContent = title; win.element.setAttribute('aria-label', title); win.closeButton.setAttribute('aria-label', `Close ${title}`); this.emit('title', win); };
        win.setContent = content => { win.body.replaceChildren(content); };
        win.focus = () => this.focus(win);
        win.close = () => this.close(win);
        this.windows.push(win);
        this.root.append(win.element);
        this.layout(win);
        this.focus(win);
        this.emit('open', win);
        return win;
    }
    bounds() { return { w: this.root.clientWidth || innerWidth, h: this.root.clientHeight || innerHeight }; }
    layout(win) { Object.assign(win.element.style, { left: `${Math.round(win.x)}px`, top: `${Math.round(win.y)}px`, width: `${Math.round(win.width)}px`, height: `${win.collapsed ? 21 : Math.round(win.height)}px`, zIndex: String(win.z ?? 10) }); win.element.classList.toggle('collapsed', win.collapsed); win.element.hidden = win.hidden; }
    topModal() { return this.windows.filter(w => !w.closed && w.element.getAttribute('aria-modal') === 'true').sort((a, b) => b.z - a.z)[0] ?? null; }
    focus(win) { if (!win || win.closed)
        return; const modal = this.topModal(); if (modal && modal !== win && !win.modal)
        return; for (const other of this.windows)
        other.element.classList.toggle('active', other === win); win.hidden = false; win.z = ++this.z; win.element.hidden = false; win.element.style.zIndex = win.z; this.active = win; this.emit('focus', win); }
    focusDesktop() { if (this.topModal())
        return; for (const win of this.windows)
        win.element.classList.remove('active'); this.active = null; this.emit('focus', null); }
    async close(win, force = false) {
        if (win.closed)
            return true;
        if (win.closing && !force)
            return false;
        if (!force && this.topModal() && this.topModal() !== win)
            return false;
        win.closing = true;
        try {
            if (!force && win.beforeClose && (await win.beforeClose()) === false)
                return false;
            win.closed = true;
            win.onClose?.();
            win.element.remove();
            this.windows = this.windows.filter(w => w !== win);
            if (this.active === win) {
                this.active = null;
                const next = this.windows.filter(w => !w.hidden).sort((a, b) => b.z - a.z)[0];
                if (next)
                    this.focus(next);
                else
                    this.focusDesktop();
            }
            this.emit('close', win);
            return true;
        }
        finally {
            win.closing = false;
        }
    }
    collapse(win) { win.collapsed = !win.collapsed; this.layout(win); this.emit('layout', win); }
    zoom(win) { if (win.zoomed) {
        Object.assign(win, win.restoreBounds);
        win.zoomed = false;
    }
    else {
        win.restoreBounds = { x: win.x, y: win.y, width: win.width, height: win.height };
        win.x = 4;
        win.y = 23;
        win.width = this.bounds().w - 8;
        win.height = this.bounds().h - 52;
        win.collapsed = false;
        win.zoomed = true;
    } this.layout(win); win.onResize?.(); this.emit('layout', win); }
    hideApp(appId) { for (const win of this.windows.filter(w => w.appId === appId)) {
        win.hidden = true;
        win.element.hidden = true;
    } const next = this.windows.filter(w => !w.hidden).sort((a, b) => b.z - a.z)[0]; if (next)
        this.focus(next);
    else
        this.focusDesktop(); }
    showApp(appId) { const windows = this.windows.filter(w => w.appId === appId).sort((a, b) => (a.z ?? 0) - (b.z ?? 0)); for (const w of windows) {
        w.hidden = false;
        this.layout(w);
        this.focus(w);
    } }
    showAll() { for (const w of this.windows) {
        w.hidden = false;
        this.layout(w);
    } }
    constrainAll() { for (const win of this.windows) {
        win.width = Math.min(win.width, this.bounds().w - 8);
        win.height = Math.min(win.height, this.bounds().h - 28);
        win.x = clamp(win.x, 2, Math.max(2, this.bounds().w - win.width - 2));
        win.y = clamp(win.y, 21, Math.max(21, this.bounds().h - win.height - 3));
        this.layout(win);
        win.onResize?.();
    } }
    dispose() { this.controller.abort(); for (const w of [...this.windows])
        this.close(w, true); this.clear(); }
}
