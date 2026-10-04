/** Platform-independent services shared by every Platinum application. */
export class EventBus {
    #listeners = new Map();
    on(type, fn, signal) {
        const set = this.#listeners.get(type) ?? new Set();
        set.add(fn);
        this.#listeners.set(type, set);
        const off = () => { set.delete(fn); if (!set.size)
            this.#listeners.delete(type); };
        signal?.addEventListener('abort', off, { once: true });
        return off;
    }
    emit(type, value) { for (const fn of [...(this.#listeners.get(type) ?? [])])
        fn(value); }
    clear() { this.#listeners.clear(); }
}
export const DEFAULT_SETTINGS = Object.freeze({
    pattern: 'macos', desktopColor: '#666699', accent: '#333399', sound: true,
    volume: 0.6, brightness: 1, font: 'system', fontSize: 12, clock24: false,
    showSeconds: false, showDate: false, mouseSpeed: 5, doubleClick: 500,
    stickyKeys: false, largeText: false, highContrast: false, reduceMotion: false,
    controlStrip: true, stripCollapsed: false, renderer: 'auto', labelColor: true,
    timezone: '', clockOffset: 0, screenSaver: 0, computerName: 'My Macintosh',
    ownerName: 'Macintosh User', fileSharing: false, webSharing: false,
    appleTalk: false, virtualMemory: true, memoryMB: 256, diskCache: 8192,
    keyboardLayout: 'US', repeatDelay: 500, repeatRate: 40, resolution: 'auto',
    startupDisk: 'disk', speakAlerts: false, balloonHelp: false, fullScreen: false,
});
export class Settings extends EventBus {
    constructor(initial = {}) { super(); this.values = { ...DEFAULT_SETTINGS, ...initial }; }
    get(key) { return this.values[key]; }
    set(key, value) { if (Object.is(this.values[key], value))
        return; this.values[key] = value; this.emit('change', { key, value }); }
    patch(values) { for (const [key, value] of Object.entries(values))
        this.set(key, value); }
    export() { return structuredClone(this.values); }
}
export class ClipboardService extends EventBus {
    constructor() { super(); this.files = []; this.cut = false; this.text = ''; }
    setFiles(ids, cut = false) { this.files = [...ids]; this.cut = cut; this.emit('change', { kind: 'files' }); }
    async writeText(text) { this.text = String(text); this.files = []; try {
        await navigator.clipboard?.writeText(this.text);
    }
    catch { } this.emit('change', { kind: 'text' }); }
    async readText() { try {
        const value = await navigator.clipboard?.readText();
        if (value != null)
            this.text = value;
    }
    catch { } return this.text; }
}
export class SoundService {
    constructor(settings) { this.settings = settings; this.context = null; this.media = new Set(); this.offSettings = settings.on('change', ({ key }) => { if (key === 'sound' || key === 'volume') for (const element of this.media) { element.muted = !settings.get('sound'); element.volume = settings.get('volume'); } }); }
    bindMedia(element) { this.media.add(element); element.volume = this.settings.get('volume'); element.muted = !this.settings.get('sound'); return () => this.media.delete(element); }
    async init() { if (!this.context)
        this.context = new (window.AudioContext || window.webkitAudioContext)(); if (this.context.state === 'suspended')
        await this.context.resume(); return this.context; }
    async tone(frequency = 660, seconds = 0.15, type = 'sine', gain = 0.12) {
        if (!this.settings.get('sound'))
            return;
        try {
            const ctx = await this.init();
            const osc = ctx.createOscillator(), vol = ctx.createGain();
            osc.type = type;
            osc.frequency.value = frequency;
            vol.gain.setValueAtTime(0, ctx.currentTime);
            vol.gain.linearRampToValueAtTime(gain * this.settings.get('volume'), ctx.currentTime + 0.012);
            vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
            osc.connect(vol).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + seconds + 0.02);
        }
        catch { }
    }
    beep(name = 'Simple Beep') {
        const tones = { 'Simple Beep': [660, .14, 'sine'], Basso: [180, .25, 'sine'], Boing: [330, .35, 'triangle'], Click: [1500, .035, 'square'], Droplet: [1100, .12, 'sine'], Indigo: [520, .35, 'sine'], Quack: [480, .16, 'sawtooth'], Sosumi: [880, .22, 'sine'], WildEep: [1320, .25, 'triangle'] };
        return this.tone(...(tones[name] || tones['Simple Beep']));
    }
    chime() { for (const f of [261.63, 329.63, 392, 523.25])
        this.tone(f, 1.4, 'sine', .09); }
    dispose() { this.offSettings?.(); for (const element of this.media) element.pause(); this.media.clear(); this.context?.close(); }
}
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `p${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const formatBytes = (n) => n < 1024 ? `${n} bytes` : n < 1048576 ? `${Math.ceil(n / 1024).toLocaleString()}K` : `${(n / 1048576).toFixed(1)} MB`;
export const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function download(data, name, type = 'application/octet-stream') { const blob = data instanceof Blob ? data : new Blob([data], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
export function fileAsDataURL(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
export function debounce(fn, ms) { let timer; const wrapped = (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }; wrapped.cancel = () => clearTimeout(timer); return wrapped; }
