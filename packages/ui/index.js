import { escapeHTML, clamp } from '@platinum/core';
export const h = escapeHTML;
export function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (value == null)
            continue;
        if (key === 'class')
            node.className = value;
        else if (key === 'html')
            node.innerHTML = value;
        else if (key === 'text')
            node.textContent = value;
        else if (key === 'style' && typeof value === 'object')
            Object.assign(node.style, value);
        else if (key.startsWith('on') && typeof value === 'function')
            node.addEventListener(key.slice(2).toLowerCase(), value);
        else if (key in node && typeof value !== 'object')
            node[key] = value;
        else
            node.setAttribute(key, String(value));
    }
    for (const child of children.flat())
        if (child != null)
            node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    return node;
}
export const button = (label, action, extra = {}) => el('button', { class: 'mac-button', text: label, onClick: action, ...extra });
export function field(label, input) { return el('label', { class: 'field-row' }, el('span', { text: label }), input); }
export function checkbox(label, checked, onchange) { const input = el('input', { type: 'checkbox', checked, onChange: () => onchange(input.checked) }); return el('label', { class: 'mac-check' }, input, el('span', { text: label })); }
export function select(options, value, onchange, attributes = {}) { const control = el('select', { class: 'mac-select', ...attributes }); for (const item of options) {
    const [key, label] = Array.isArray(item) ? item : [item, item];
    control.append(el('option', { value: key, text: label }));
} control.value = value; control.addEventListener('change', () => onchange(control.value)); return control; }
export function tabs(labels, onchange) { let value = labels[0]; const row = el('div', { class: 'mac-tabs', role: 'tablist' }); labels.forEach(label => { const b = button(label, () => { value = label; [...row.children].forEach(x => { x.classList.toggle('selected', x === b); x.setAttribute('aria-selected', String(x === b)); }); onchange(label); }, { class: `mac-tab ${label === value ? 'selected' : ''}`, role: 'tab', 'aria-selected': label === value }); row.append(b); }); return row; }
const bitmap = { folder: 'nineicons-folder', disk: 'nineicons-harddisk', trash: 'nineicons-trash', 'trash-full': 'nineicons-trash-full', text: 'nineicons-text-editor', internet: 'nineicons-internet', mail: 'nineicons-mail', calculator: 'nineicons-calculator' };
const original = { system: 'system-folder', applications: 'applications', sherlock: 'sherlock', appearance: 'appearance', control: 'control-panels', launcher: 'launcher' };
const svg = (body) => `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${body}</svg>`;
const page = '<path d="M7 1h14l6 6v24H7z" fill="#fff" stroke="#111"/><path d="M21 1v7h6" fill="#ccc" stroke="#111"/>';
const fallback = {
    stickies: svg('<path d="M3 3h26v26H3z" fill="#ffff9b" stroke="#111"/><path d="M4 4h24v4H4z" fill="#eece52"/><path d="M8 13h16M8 17h12M8 21h14" stroke="#ae9654"/>'),
    notepad: svg('<path d="M4 3h25v27H4z" fill="#fffbd3" stroke="#111"/><path d="M5 4h23v6H5z" fill="#bbb"/><path d="M8 1v6m5-6v6m5-6v6m5-6v6M7 15h17M7 20h17M7 25h11" stroke="#666"/>'),
    computer: svg('<path d="M5 1h23v24H5z" fill="#ddd" stroke="#111"/><path d="M8 4h17v16H8z" fill="#aaaad9" stroke="#111"/><path d="M12 8v3m9-3v3m-9 4q4 4 9 0M20 23h5" fill="none" stroke="#111"/><path d="M3 28h27v3H3zM12 25v3h11v-3" fill="#aaa" stroke="#111"/>'),
    finder: svg('<path d="M1 1h30v30H1z" fill="#ddd" stroke="#111"/><path d="M2 2h15l-4 16h4v12H2z" fill="#9999e3"/><path d="M9 7v5m14-5v5M7 20q8 8 18 0M17 2l-4 16h4v12" fill="none" stroke="#111"/>'),
    quicktime: svg('<circle cx="16" cy="15" r="13" fill="#eee" stroke="#555"/><circle cx="16" cy="15" r="9" fill="#8bbacb" stroke="#005ba2" stroke-width="3"/><path d="M17 15l10 14h-7L13 17z" fill="#1245ac"/>'),
    cd: svg('<circle cx="16" cy="16" r="14" fill="#dedeee" stroke="#333"/><path d="M4 8l9 6L9 4M27 8l-9 6 7-10M5 24l9-6-5 10M28 24l-10-6 7 10" fill="#a6bfed"/><circle cx="16" cy="16" r="4" fill="#fff" stroke="#777"/>'),
    sound: svg('<path d="M3 12h7l9-8v25l-9-8H3z" fill="#aaa" stroke="#111"/><path d="M10 12v9M22 9q9 7 0 14m3-19q13 12 0 25" fill="none" stroke="#444" stroke-width="2"/>'),
    keyboard: svg('<path d="M1 9h29l1 18H1z" fill="#ccc" stroke="#222"/><path d="M3 12h25M3 16h25M3 20h25M5 10v12M10 10v12M15 10v12M20 10v12M25 10v12M7 24h17" stroke="#555"/>'),
    graph: svg('<path d="M2 1h27v30H2z" fill="#fff" stroke="#111"/><path d="M4 17h22M15 4v24" stroke="#999"/><path d="M4 22l4-7 4 6 5-14 4 7 6-10" fill="none" stroke="#144bbb" stroke-width="2"/>'),
    scrapbook: svg('<path d="M5 1h23v30H5z" fill="#aba5ce" stroke="#111"/><path d="M8 1v30M4 5h6M4 11h6M4 18h6M4 25h6" stroke="#444"/><path d="M13 6h11v8H13z" fill="#ffffd4"/><path d="M14 20l3-4 4 4 3-3v9H13z" fill="#bbefb2" stroke="#666"/>'),
    script: svg(page + '<path d="M11 13h12M11 17h9M11 21h12M11 25h6" stroke="#777"/><path d="M21 18l-2 9 4-2 7-16-3-1z" fill="#dec577" stroke="#333"/>'),
    help: svg('<path d="M5 2h22v28H5z" fill="#dedede" stroke="#111"/><path d="M11 10q0-6 7-5 9 3 0 10v5m0 3v3" stroke="#333399" stroke-width="4" fill="none"/>'),
    paint: svg('<path d="M4 6h24v24H4z" fill="#eee" stroke="#333"/><path d="M5 26l7-10 4 4 5-12 6 18" fill="#88bda7"/><path d="M18 17L27 1l3 2-9 17-6 6z" fill="#d1a65e" stroke="#222"/>'),
    memory: svg('<path d="M6 6h20v20H6z" fill="#333" stroke="#111"/><path d="M10 0v6m6-6v6m6-6v6M10 26v6m6-6v6m6-6v6M0 10h6m-6 6h6m-6 6h6M26 10h6m-6 6h6m-6 6h6" stroke="#999" stroke-width="2"/><path d="M11 11h10v10H11z" fill="#777"/>'),
    clock: svg('<circle cx="16" cy="16" r="14" fill="#eee" stroke="#111"/><path d="M16 4v3m12 9h-3M16 28v-3M4 16h3m9-9v10h7" fill="none" stroke="#111" stroke-width="2"/>'),
    key: svg('<circle cx="10" cy="10" r="7" fill="#e6c456" stroke="#222"/><circle cx="10" cy="10" r="2" fill="#ddd"/><path d="M13 15l12 14 4-4-3-3-2 2-2-2 2-2-8-8" fill="#e6c456" stroke="#222"/>'),
    network: svg('<path d="M2 3h11v10H2zM19 3h11v10H19zM11 22h11v9H11z" fill="#bbbbee" stroke="#222"/><path d="M7 13v4h17v-4M16 17v5" fill="none" stroke="#333" stroke-width="2"/>'),
    puzzle: svg('<path d="M2 2h28v28H2z" fill="#bbbbee" stroke="#111"/><path d="M11 2v28M21 2v28M2 11h28M2 21h28" stroke="#555"/><path d="M22 22h8v8h-8z" fill="#999"/><path d="M5 5h3m7 0h3m7 0h3M5 15h3m7 0h3m7 0h3M5 25h3m7 0h3" stroke="#333"/>'),
};
fallback.monitor = fallback.computer;
fallback.video = fallback.quicktime;
fallback.firstaid = fallback.disk = svg('<path d="M2 5h28v24H2z" fill="#ddd" stroke="#111"/><path d="M11 8h10v18H11zM7 13h18v9H7z" fill="#d33"/>');
fallback.extensions = fallback.memory;
fallback.mouse = fallback.keyboard;
fallback.energy = fallback.clock;
fallback.color = fallback.graph;
fallback.access = fallback.computer;
fallback.users = fallback.finder;
fallback.chooser = fallback.network;
fallback.extras = fallback.folder;
fallback.utilities = fallback.memory;
export function icon(name = 'folder', size = 32) {
    const small = size <= 16 ? 16 : 32;
    if (bitmap[name])
        return `<img class="pixel-icon" src="/assets/${bitmap[name]}-${name === 'calculator' ? 32 : small}.png" width="${size}" height="${size}" alt="" draggable="false">`;
    if (original[name])
        return `<img class="pixel-icon original-icon" src="/assets/original-${original[name]}.png" width="${size}" height="${size}" alt="" draggable="false">`;
    if (name === 'internet-folder')
        return `<span class="composite-icon" style="width:${size}px;height:${size}px">${icon('folder', size)}<span>${icon('internet', Math.round(size * .6))}</span></span>`;
    return `<span class="vector-icon" style="width:${size}px;height:${size}px">${fallback[name] || fallback.computer}</span>`;
}
export function appleIcon() { return '<svg class="apple-icon" viewBox="0 0 18 19" aria-hidden="true"><defs><linearGradient id="apple-rainbow" x2="0" y2="1"><stop stop-color="#60b533" offset="0%"/><stop stop-color="#60b533" offset="30%"/><stop stop-color="#fbd61b" offset="30%"/><stop stop-color="#fbd61b" offset="46%"/><stop stop-color="#f79b28" offset="46%"/><stop stop-color="#f79b28" offset="61%"/><stop stop-color="#de3c32" offset="61%"/><stop stop-color="#de3c32" offset="74%"/><stop stop-color="#8c4ca1" offset="74%"/><stop stop-color="#8c4ca1" offset="87%"/><stop stop-color="#39a9cf" offset="87%"/></linearGradient></defs><path d="M10 4c0-2 1-3 3-3 0 2-1 3-3 3M9 5C5 2 2 6 3 11c1 5 4 7 6 5 2 2 5 0 6-4-3-1-3-4-1-5-1-3-3-3-5-2z" fill="url(#apple-rainbow)" stroke="#222" stroke-width=".65"/></svg>'; }
export function gripDrag(handle, onmove, onend, { start } = {}) {
    const down = e => { if (e.button !== 0 || e.target.closest('button,input,select'))
        return; e.preventDefault(); const first = { x: e.clientX, y: e.clientY }; const value = start?.(e); handle.setPointerCapture?.(e.pointerId); const move = ev => onmove(ev.clientX - first.x, ev.clientY - first.y, value, ev); const up = ev => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); onend?.(ev, value); }; handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up); };
    handle.addEventListener('pointerdown', down);
    return () => handle.removeEventListener('pointerdown', down);
}
export { clamp };
