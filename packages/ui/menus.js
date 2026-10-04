import { el, h, icon, clamp } from './index.js';
export class MenuManager {
    constructor(root, run) { this.root = root; this.run = run; this.menus = []; this.button = null; this.controller = new AbortController(); document.addEventListener('pointerdown', e => { if (!e.target.closest('.menu-popup,.menu-button'))
        this.close(); }, { signal: this.controller.signal }); document.addEventListener('keydown', e => this.key(e), { signal: this.controller.signal }); }
    open(items, x, y, button = null, level = 0) {
        if (level === 0) {
            this.close();
            this.button = button;
            button?.classList.add('open');
        }
        else
            this.closeFrom(level);
        const menu = el('div', { class: 'menu-popup', role: 'menu', style: { left: `x`, top: `y` } });
        const record = { menu, items, selected: -1 };
        this.menus[level] = record;
        items.forEach((item, index) => {
            if (!item || item.separator) {
                menu.append(el('div', { class: 'menu-separator', role: 'separator' }));
                return;
            }
            const row = el('button', { class: `menu-item ${item.disabled ? 'disabled' : ''}`, role: 'menuitem', disabled: !!item.disabled, 'data-menu-index': index, html: `<span class="menu-check">${item.checked ? '✓' : ''}</span>${item.icon ? icon(item.icon, 16) : ''}<span class="menu-label">${h(item.label)}</span><span class="menu-shortcut">${item.shortcut ? h(item.shortcut) : item.items ? '▶' : ''}</span>` });
            row.addEventListener('pointerenter', () => { record.selected = index; this.highlight(record); if (item.items) {
                const rect = row.getBoundingClientRect();
                this.open(typeof item.items === 'function' ? item.items() : item.items, rect.right - 2, rect.top - 3, null, level + 1);
            }
            else
                this.closeFrom(level + 1); });
            row.addEventListener('click', e => { e.stopPropagation(); if (item.disabled)
                return; if (item.items) {
                const rect = row.getBoundingClientRect();
                this.open(typeof item.items === 'function' ? item.items() : item.items, rect.right - 2, rect.top - 3, null, level + 1);
                return;
            } this.close(); this.run(item.action ?? item.id); });
            menu.append(row);
        });
        this.root.append(menu);
        const rect = menu.getBoundingClientRect();
        menu.style.left = `${clamp(x, 2, innerWidth - rect.width - 2)}px`;
        menu.style.top = `${clamp(y, 20, innerHeight - rect.height - 2)}px`;
        return menu;
    }
    toggle(button, items) { if (this.button === button) {
        this.close();
        return;
    } const rect = button.getBoundingClientRect(); this.open(items, rect.left, 20, button); }
    closeFrom(level) { while (this.menus.length > level)
        this.menus.pop()?.menu.remove(); }
    close() { this.closeFrom(0); this.button?.classList.remove('open'); this.button = null; }
    highlight(record) { [...record.menu.querySelectorAll('.menu-item')].forEach(r => r.classList.toggle('highlighted', Number(r.dataset.menuIndex) === record.selected)); }
    key(e) { if (!this.menus.length)
        return; const record = this.menus.at(-1); if (e.key === 'Escape') {
        this.close();
        e.preventDefault();
        return;
    } if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        const valid = record.items.map((item, index) => item && !item.separator && !item.disabled ? index : -1).filter(i => i >= 0);
        const current = valid.indexOf(record.selected);
        record.selected = valid[(current + (e.key === 'ArrowDown' ? 1 : -1) + valid.length) % valid.length];
        this.highlight(record);
    }
    else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (this.menus.length > 1)
            this.closeFrom(this.menus.length - 1);
    }
    else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        record.menu.querySelector(`[data-menu-index="${record.selected}"]`)?.click();
    } }
    dispose() { this.close(); this.controller.abort(); }
}
export const separator = { separator: true };
