import { uid, download, clamp, fileAsDataURL } from '@platinum/core';
import { el, h, icon, button, select } from '@platinum/ui';
import { separator as sep } from '@platinum/ui/menus';
import { SurfaceRenderer } from '@platinum/renderer';
const time = value => `${Math.floor((value || 0) / 60).toString().padStart(2, '0')}:${Math.floor((value || 0) % 60).toString().padStart(2, '0')}`;
const once = (os, id, make) => os.wm.windows.find(w => w.id === id) ?? make();
function waveFile(frequencies, seconds = 7) { const rate = 22050, count = Math.floor(rate * seconds), buffer = new ArrayBuffer(44 + count * 2), view = new DataView(buffer), str = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0))); str(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); str(8, 'WAVE'); str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, count * 2, true); for (let i = 0; i < count; i++) {
    const t = i / rate, beat = t % (.5), idx = Math.floor(t / .5) % frequencies.length;
    const f = frequencies[idx];
    const envelope = Math.exp(-beat * 6) * Math.min(t * 5, 1) * Math.min((seconds - t) * 3, 1);
    const sample = (Math.sin(t * f * Math.PI * 2) + Math.sin(t * f * .5 * Math.PI * 2) * .35 + Math.sin(t * f * 2 * Math.PI * 2) * .12) * .3 * envelope;
    view.setInt16(44 + i * 2, clamp(sample, -1, 1) * 32767, true);
} return new Blob([buffer], { type: 'audio/wav' }); }
export function registerMediaApps(os) {
    os.register('picture', 'PictureViewer', 'paint', options => { const node = options?.node; const existing = node && os.wm.windows.find(w => w.appId === 'picture' && w.nodeId === node.id); if (existing)
        return existing; const win = os.wm.create({ title: node?.name ?? 'PictureViewer', appId: 'picture', width: 590, height: 440, minWidth: 260, minHeight: 200 }); win.nodeId = node?.id; let current = node, zoom = 0, rotation = 0; const layout = el('div', { class: 'vertical-layout' }), stage = el('div', { class: 'media-screen', style: { background: '#777', overflow: 'auto' } }), image = el('img', { alt: node?.name ?? 'Picture' }), status = el('div', { class: 'status-bar' }); const show = () => { if (!current) {
        stage.replaceChildren(el('div', { class: 'media-placeholder', text: 'Choose Open to view a picture.' }));
        return;
    } image.src = current.content; image.alt = current.name; image.style.objectFit = zoom === 0 ? 'contain' : 'none'; image.style.width = zoom === 0 ? '100%' : Math.round((image.naturalWidth || 600) * zoom) + 'px'; image.style.height = zoom === 0 ? '100%' : Math.round((image.naturalHeight || 400) * zoom) + 'px'; image.style.maxWidth = 'none'; image.style.transform = `rotate(${rotation}deg)`; stage.replaceChildren(image); win.setTitle(current.name); win.nodeId = current.id; status.textContent = `${image.naturalWidth || '—'} × ${image.naturalHeight || '—'} pixels     ${zoom ? Math.round(zoom * 100) + '%' : 'Fit to window'}`; }; image.addEventListener('load', () => { if (zoom) {
        image.style.width = Math.round(image.naturalWidth * zoom) + 'px';
        image.style.height = Math.round(image.naturalHeight * zoom) + 'px';
    } status.textContent = `${image.naturalWidth} × ${image.naturalHeight} pixels     ${zoom ? Math.round(zoom * 100) + '%' : 'Fit to window'}`; }); const open = async () => { const n = await os.fileDialog({ kinds: ['image'] }); if (n) {
        current = n;
        show();
    } }; const step = delta => { const files = os.vfs.children(current?.parent ?? 'pictures').filter(n => n.kind === 'image'); if (!files.length)
        return; current = files[(files.findIndex(n => n.id === current?.id) + delta + files.length) % files.length]; show(); }; layout.append(el('div', { class: 'window-toolbar' }, button('Open…', open), button('◀', () => step(-1), { 'aria-label': 'Previous picture' }), button('▶', () => step(1), { 'aria-label': 'Next picture' }), button('Fit', () => { zoom = 0; show(); }), button('100%', () => { zoom = 1; show(); }), button('−', () => { zoom = Math.max(.1, (zoom || 1) / 1.25); show(); }, { 'aria-label': 'Zoom out' }), button('+', () => { zoom = Math.min(5, (zoom || 1) * 1.25); show(); }, { 'aria-label': 'Zoom in' })), stage, status); win.body.append(layout); win.commands = { open, save: () => current && os.exportNode(current.id), print: () => current && os.printHTML(`<img src="${current.content}">`) }; win.menus = () => [...os.standardMenus(), ['View', [{ label: 'Fit to Window', checked: zoom === 0, action: () => { zoom = 0; show(); } }, { label: 'Actual Size', checked: zoom === 1, action: () => { zoom = 1; show(); } }, { label: 'Rotate Clockwise', action: () => { rotation = (rotation + 90) % 360; show(); } }, { label: 'Next Picture', action: () => step(1) }, { label: 'Previous Picture', action: () => step(-1) }]]]; show(); return win; });
    const openMedia = (appId, title, options = {}) => { const node = options.node; const win = os.wm.create({ title: node?.name ?? title, appId, width: 470, height: 350, minWidth: 280, minHeight: 200, className: 'quicktime-window' }); let current = node, media = document.createElement('video'); media.playsInline = true; media.preload = 'metadata'; const unbindMedia = os.sound.bindMedia(media); const layout = el('div', { class: 'media-player' }), screen = el('div', { class: 'media-screen' }), display = el('span', { class: 'media-time', text: '00:00' }), seek = el('input', { type: 'range', class: 'media-seek', min: 0, max: 100, step: .1, value: 0, 'aria-label': 'Movie position' }), volume = el('input', { type: 'range', class: 'media-volume', min: 0, max: 1, step: .01, value: os.settings.get('volume'), 'aria-label': 'Movie volume' }), play = button('▶', () => toggle(), { 'aria-label': 'Play' }), drawer = el('div', { class: 'media-drawer hidden' }); const placeholder = () => el('div', { class: 'media-placeholder' }, el('span', { html: icon('quicktime', 64) }), el('span', { text: appId === 'dvd' ? 'Open a browser-compatible movie.' : 'QuickTime' }), button('Open Movie…', () => open())); const load = n => { current = n; media.pause(); media.src = n.content; media.load(); win.setTitle(n.name); screen.replaceChildren(media); if (n.kind === 'audio') {
        media.style.display = 'none';
        screen.append(el('div', { class: 'media-placeholder' }, el('span', { html: icon('sound', 64) }), el('span', { text: n.name })));
    }
    else
        media.style.display = 'block'; play.textContent = '▶'; play.setAttribute('aria-label', 'Play'); }; const open = async () => { const n = await os.fileDialog({ kinds: ['audio', 'video'] }); if (n)
        load(n); }; const toggle = async () => { if (!current) {
        await open();
        return;
    } if (media.paused) {
        try {
            await media.play();
        }
        catch {
            os.alert('This media could not be played. Its codec may not be supported by your browser.');
        }
    }
    else
        media.pause(); }; media.addEventListener('play', () => { play.textContent = '❚❚'; play.setAttribute('aria-label', 'Pause'); }); media.addEventListener('pause', () => { play.textContent = '▶'; play.setAttribute('aria-label', 'Play'); }); media.addEventListener('timeupdate', () => { display.textContent = time(media.currentTime); if (Number.isFinite(media.duration))
        seek.value = media.currentTime / media.duration * 100; }); media.addEventListener('ended', () => { play.textContent = '▶'; seek.value = 100; }); media.addEventListener('error', () => { if (current)
        screen.replaceChildren(el('div', { class: 'media-placeholder' }, el('span', { text: 'This movie could not be opened.' }), el('span', { text: 'Choose a file supported by your browser.' }), button('Open…', open))); }); seek.addEventListener('input', () => { if (Number.isFinite(media.duration))
        media.currentTime = Number(seek.value) * media.duration / 100; }); volume.addEventListener('input', () => media.volume = Number(volume.value)); const favorites = () => { os.state.movieFavorites ??= []; drawer.classList.toggle('hidden'); drawer.replaceChildren(button('Add Current', () => { if (current && !os.state.movieFavorites.includes(current.id)) {
        os.state.movieFavorites.push(current.id);
        os.persist();
        favorites();
        favorites();
    } }), ...os.state.movieFavorites.map(id => os.vfs.get(id)).filter(Boolean).map(n => button(n.name, () => load(n)))); }; layout.append(el('div', { class: 'window-toolbar', style: { padding: '0 0 5px', background: 'transparent' } }, button('Open…', open), button('Info', () => os.alert(current ? `${current.name}\nDuration: ${time(media.duration)}\n${media.videoWidth ? `${media.videoWidth} × ${media.videoHeight} pixels` : 'Audio'}\nType: ${current.mime || current.kind}` : 'No movie is open.', title)), el('span', { style: { flex: 1 } }), button('Favorites', favorites)), screen, el('div', { class: 'media-controls' }, button('|◀', () => { media.currentTime = 0; }, { 'aria-label': 'Beginning' }), play, display, seek, el('span', { html: icon('sound', 16) }), volume), drawer); win.body.append(layout); if (node)
        load(node);
    else
        screen.append(placeholder()); win.commands = { open, save: () => current && os.exportNode(current.id) }; win.menus = () => [['File', [{ label: 'Open Movie…', shortcut: '⌘O', action: open }, { label: 'Open URL…', action: async () => { const url = await os.prompt('Movie URL:', 'https://'); if (url && /^https?:\/\//i.test(url))
                        load({ name: url, content: url, kind: 'video' }); } }, { label: 'Close', shortcut: '⌘W', action: 'close' }, sep, { label: 'Quit', shortcut: '⌘Q', action: 'quit' }]], ['Movie', [{ label: media.paused ? 'Play' : 'Pause', action: toggle }, { label: 'Go to Beginning', action: () => media.currentTime = 0 }, { label: 'Loop', checked: media.loop, action: () => media.loop = !media.loop }, { label: 'Double Size', action: () => { win.width *= 1.5; win.height *= 1.5; os.wm.constrainAll(); } }, { label: 'Favorites', action: favorites }]]]; win.onClose = () => { unbindMedia(); media.pause(); media.removeAttribute('src'); media.load(); }; return win; };
    os.register('quicktime', 'QuickTime Player', 'quicktime', options => openMedia('quicktime', 'QuickTime Player', options));
    os.register('dvd', 'Apple DVD Player', 'cd', options => openMedia('dvd', 'Apple DVD Player', options));
    os.register('applecd', 'AppleCD Audio Player', 'cd', () => once(os, 'applecd', () => { const win = os.wm.create({ id: 'applecd', title: 'AppleCD Audio Player', appId: 'applecd', width: 380, height: 320, resizable: false }); const playlist = [{ name: 'Platinum Morning', notes: [261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66] }, { name: 'After the Rain', notes: [220, 261.63, 329.63, 392, 329.63, 261.63, 293.66, 349.23] }, { name: 'A Little Macintosh', notes: [392, 440, 523.25, 659.25, 587.33, 523.25, 440, 392] }]; const urls = playlist.map(track => URL.createObjectURL(waveFile(track.notes, 12))); let index = 0, repeat = false, shuffle = false; const audio = new Audio(), panel = el('div', { class: 'panel', style: { background: '#ccc' } }), track = el('span', { text: '01' }), clock = el('span', { text: '00:00' }), name = el('div', { class: 'cd-track' }), list = el('div', { class: 'listbox', style: { height: '93px', margin: '10px 0' } }), play = button('▶', () => toggle(), { 'aria-label': 'Play CD' }); const unbindAudio = os.sound.bindMedia(audio); const show = () => { track.textContent = String(index + 1).padStart(2, '0'); name.textContent = playlist[index]?.name ?? 'No disc'; for (const row of list.children)
        row.classList.toggle('selected', Number(row.dataset.index) === index); }; const load = i => { if (!playlist.length)
        return; index = (i + playlist.length) % playlist.length; audio.src = urls[index]; show(); }; const toggle = async () => { if (!playlist.length)
        return; if (!audio.src)
        load(index); if (audio.paused)
        await audio.play();
    else
        audio.pause(); }; const step = async (d) => { const playing = !audio.paused; load(shuffle ? Math.floor(Math.random() * playlist.length) : index + d); if (playing)
        await audio.play(); }; const renderList = () => list.replaceChildren(...playlist.map((n, i) => el('div', { class: 'listbox-row', 'data-index': i, text: `${i + 1}. ${n.name}`, onClick: () => { load(i); audio.play().catch(() => { }); } }))); audio.addEventListener('timeupdate', () => clock.textContent = time(audio.currentTime)); audio.addEventListener('play', () => play.textContent = '❚❚'); audio.addEventListener('pause', () => play.textContent = '▶'); audio.addEventListener('ended', () => { if (repeat || index < playlist.length - 1) {
        load(index + 1);
        audio.play();
    } }); const add = async () => { const n = await os.fileDialog({ kinds: ['audio'] }); if (n) {
        playlist.push({ name: n.name });
        urls.push(n.content);
        renderList();
        show();
    } }; panel.append(el('div', { class: 'info-header', style: { marginBottom: '5px' } }, el('span', { html: icon('cd', 24) }), el('strong', { text: 'Platinum Audio CD' })), el('div', { class: 'cd-display' }, track, clock), name, list, el('div', { class: 'media-controls' }, button('|◀', () => step(-1), { 'aria-label': 'Previous track' }), play, button('■', () => { audio.pause(); audio.currentTime = 0; }, { 'aria-label': 'Stop CD' }), button('▶|', () => step(1), { 'aria-label': 'Next track' }), button('Add…', add))); win.body.append(panel); win.menus = () => [['File', [{ label: 'Add Audio File…', action: add }, { label: 'Close', shortcut: '⌘W', action: 'close' }, sep, { label: 'Quit', shortcut: '⌘Q', action: 'quit' }]], ['CD', [{ label: 'Play / Pause', action: toggle }, { label: 'Next Track', action: () => step(1) }, { label: 'Previous Track', action: () => step(-1) }, { label: 'Shuffle', checked: shuffle, action: () => shuffle = !shuffle }, { label: 'Repeat', checked: repeat, action: () => repeat = !repeat }, sep, { label: 'Eject', action: () => { audio.pause(); audio.removeAttribute('src'); playlist.length = 0; list.replaceChildren(); name.textContent = 'No disc'; } }]]]; win.onClose = () => { unbindAudio(); audio.pause(); urls.filter(url => url.startsWith('blob:')).forEach(URL.revokeObjectURL); }; renderList(); load(0); return win; }));
    os.register('simplesound', 'SimpleSound', 'sound', () => once(os, 'simple-sound', () => { const win = os.wm.create({ id: 'simple-sound', title: 'SimpleSound', appId: 'simplesound', width: 390, height: 260, resizable: false }); const panel = el('div', { class: 'panel' }), status = el('div', { class: 'cd-display', text: '00:00', style: { justifyContent: 'center' } }), message = el('p', { text: 'Record a sound using your microphone.' }); let recorder, stream, blob, url, audio, started, timer; const stop = () => { if (recorder?.state === 'recording')
        recorder.stop(); stream?.getTracks().forEach(t => t.stop()); clearInterval(timer); }; const record = async () => { try {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
            throw new Error('Recording is not available in this browser.');
        stop();
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = e => { if (e.data.size)
            chunks.push(e.data); };
        recorder.onstop = () => { blob = new Blob(chunks, { type: recorder.mimeType }); if (url)
            URL.revokeObjectURL(url); url = URL.createObjectURL(blob); audio = new Audio(url); message.textContent = 'Your recording is ready to play or save.'; stream.getTracks().forEach(t => t.stop()); };
        recorder.start();
        started = Date.now();
        timer = setInterval(() => { status.textContent = time((Date.now() - started) / 1000); if (Date.now() - started > 120000)
            stop(); }, 250);
        message.textContent = 'Recording… Click Stop when you are finished.';
    }
    catch (e) {
        message.textContent = e.message;
    } }; const save = async () => { if (!blob)
        return os.alert('Record a sound first.'); const content = await fileAsDataURL(blob); await os.saveDocument({ name: 'Untitled Sound.webm', content, kind: 'audio', iconName: 'sound', mime: blob.type }); }; panel.append(el('div', { class: 'info-header' }, el('span', { html: icon('sound', 32) }), el('strong', { text: 'Sound Recorder' })), status, message, el('div', { class: 'media-controls' }, button('● Record', record), button('■ Stop', stop), button('▶ Play', () => audio?.play()), button('Save…', save))); win.body.append(panel); win.commands = { save }; win.onClose = () => { stop(); audio?.pause(); if (url)
        URL.revokeObjectURL(url); }; return win; }));
    os.register('video', 'Apple Video Player', 'video', () => once(os, 'apple-video', () => { const win = os.wm.create({ id: 'apple-video', title: 'Apple Video Player', appId: 'video', width: 520, height: 390 }); const layout = el('div', { class: 'media-player' }), screen = el('div', { class: 'media-screen' }), video = el('video', { autoplay: true, muted: true, playsInline: true }), status = el('span', { text: 'Camera is off.', style: { font: '11px var(--text)' } }); let stream; const start = async () => { try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        screen.replaceChildren(video);
        status.textContent = 'Camera preview';
    }
    catch (e) {
        status.textContent = 'Camera access was not available.';
    } }; const stop = () => { stream?.getTracks().forEach(t => t.stop()); video.srcObject = null; status.textContent = 'Camera is off.'; }; const capture = async () => { if (!video.videoWidth)
        return; const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight; c.getContext('2d').drawImage(video, 0, 0); await os.saveDocument({ name: 'Video Snapshot.png', content: c.toDataURL(), kind: 'image', iconName: 'paint', mime: 'image/png' }); }; screen.append(el('div', { class: 'media-placeholder' }, el('span', { html: icon('video', 48) }), el('span', { text: 'Preview video from your camera.' }))); layout.append(screen, el('div', { class: 'media-controls' }, button('Start Camera', start), button('Stop', stop), button('Snapshot…', capture)), status); win.body.append(layout); win.onClose = stop; return win; }));
    os.register('paint', 'Drawing Pad', 'paint', options => {
        const win = os.wm.create({ title: 'Untitled Drawing', appId: 'paint', width: 730, height: 520, minWidth: 350, minHeight: 270 });
        const layout = el('div', { class: 'vertical-layout' }), tools = el('div', { class: 'paint-tools' }), stage = el('div', { class: 'paint-stage' }), source = document.createElement('canvas');
        source.width = 640;
        source.height = 400;
        const ctx = source.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 640, 400);
        let tool = 'pencil', color = '#000000', width = 2, drag = null, snapshot, history = [], redo = [], nodeId, dirty = false;
        const renderer = new SurfaceRenderer(stage, { source, tile: [640, 400], preference: os.settings.get('renderer') });
        const update = () => { renderer.updateSource(source); dirty = true; };
        const checkpoint = () => { history.push(ctx.getImageData(0, 0, 640, 400)); if (history.length > 25)
            history.shift(); redo = []; };
        const restore = image => { ctx.putImageData(image, 0, 0); update(); };
        const undo = () => { const image = history.pop(); if (image) {
            redo.push(ctx.getImageData(0, 0, 640, 400));
            restore(image);
        } };
        const redoAction = () => { const image = redo.pop(); if (image) {
            history.push(ctx.getImageData(0, 0, 640, 400));
            restore(image);
        } };
        const actions = [['pencil', '✎', 'Pencil'], ['brush', '●', 'Brush'], ['eraser', '▱', 'Eraser'], ['line', '╱', 'Line'], ['rect', '□', 'Rectangle'], ['ellipse', '○', 'Ellipse'], ['fill', '▣', 'Fill'], ['text', 'T', 'Text']];
        for (const [id, label, title] of actions)
            tools.append(button(label, () => { tool = id; tools.querySelectorAll('button').forEach(b => b.classList.toggle('pressed', b.dataset.tool === id)); }, { title, 'aria-label': title, 'data-tool': id, class: 'mac-button' + (id === 'pencil' ? ' pressed' : '') }));
        const palette = el('div', { class: 'paint-palette' });
        for (const value of ['#000000', '#777777', '#cccccc', '#ffffff', '#800000', '#ff0000', '#ff8000', '#ffff00', '#008000', '#00cc66', '#00bbbb', '#0000ff', '#000080', '#8000aa', '#ff80cc', '#996633'])
            palette.append(el('button', { class: 'color-chip' + (value === color ? ' selected' : ''), style: { background: value }, 'aria-label': `Color ${value}`, onClick: e => { color = value; palette.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b === e.currentTarget)); } }));
        const point = e => { const r = stage.getBoundingClientRect(); return { x: clamp(Math.round((e.clientX - r.left) * 640 / r.width), 0, 639), y: clamp(Math.round((e.clientY - r.top) * 400 / r.height), 0, 399) }; };
        const flood = (x, y) => { const image = ctx.getImageData(0, 0, 640, 400), data = image.data, p = (y * 640 + x) * 4, target = Array.from(data.slice(p, p + 4)), fill = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16), 255]; if (target.every((v, i) => v === fill[i]))
            return; const stack = [y * 640 + x], seen = new Uint8Array(640 * 400); while (stack.length) {
            const pos = stack.pop();
            if (seen[pos])
                continue;
            seen[pos] = 1;
            const i = pos * 4;
            if (!target.every((v, j) => data[i + j] === v))
                continue;
            data.set(fill, i);
            const xx = pos % 640;
            if (xx > 0)
                stack.push(pos - 1);
            if (xx < 639)
                stack.push(pos + 1);
            if (pos >= 640)
                stack.push(pos - 640);
            if (pos < 640 * 399)
                stack.push(pos + 640);
        } ctx.putImageData(image, 0, 0); };
        stage.addEventListener('pointerdown', async (e) => { if (e.button !== 0)
            return; e.preventDefault(); const p = point(e); checkpoint(); if (tool === 'text') {
            const text = await os.prompt('Text to draw:');
            if (text) {
                ctx.font = `${width * 4 + 12}px Arial`;
                ctx.fillStyle = color;
                ctx.fillText(text, p.x, p.y);
                update();
            }
            return;
        } if (tool === 'fill') {
            flood(p.x, p.y);
            update();
            return;
        } drag = p; snapshot = ctx.getImageData(0, 0, 640, 400); stage.setPointerCapture(e.pointerId); ctx.strokeStyle = tool === 'eraser' ? '#fff' : color; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = tool === 'eraser' ? width * 6 : tool === 'brush' ? width * 3 : width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + .1, p.y + .1); ctx.stroke(); update(); });
        stage.addEventListener('pointermove', e => { if (!drag)
            return; const p = point(e); ctx.strokeStyle = tool === 'eraser' ? '#fff' : color; ctx.lineWidth = tool === 'eraser' ? width * 6 : tool === 'brush' ? width * 3 : width; if (['line', 'rect', 'ellipse'].includes(tool)) {
            ctx.putImageData(snapshot, 0, 0);
            ctx.beginPath();
            if (tool === 'line') {
                ctx.moveTo(drag.x, drag.y);
                ctx.lineTo(p.x, p.y);
            }
            else if (tool === 'rect')
                ctx.rect(drag.x, drag.y, p.x - drag.x, p.y - drag.y);
            else
                ctx.ellipse((drag.x + p.x) / 2, (drag.y + p.y) / 2, Math.abs(p.x - drag.x) / 2, Math.abs(p.y - drag.y) / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        else {
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
        } update(); });
        stage.addEventListener('pointerup', () => drag = null);
        stage.addEventListener('pointercancel', () => drag = null);
        const save = async (as) => { const n = await os.saveDocument({ nodeId, name: 'Untitled Drawing.png', content: source.toDataURL(), kind: 'image', iconName: 'paint', mime: 'image/png', saveAs: as }); if (n) {
            nodeId = n.id;
            win.setTitle(n.name);
            dirty = false;
            return true;
        } return false; };
        const open = async () => { const n = await os.fileDialog({ kinds: ['image'] }); if (!n)
            return; const image = new Image(); image.src = n.content; await image.decode(); checkpoint(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 640, 400); ctx.drawImage(image, 0, 0, Math.min(640, image.width), Math.min(400, image.height)); nodeId = n.id; win.setTitle(n.name); update(); dirty = false; };
        layout.append(el('div', { class: 'window-toolbar' }, button('Undo', undo), button('Clear', async () => { if (await os.confirm('Clear the drawing?', 'Clear')) {
            checkpoint();
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, 640, 400);
            update();
        } }), el('span', { text: 'Size:' }), select([1, 2, 4, 8, 12], 2, v => width = Number(v), { 'aria-label': 'Brush size' }), el('span', { style: { flex: 1 } }), button('Save…', () => save())), el('div', { class: 'paint-container' }, tools, stage), palette, el('div', { class: 'status-bar', text: '640 × 400 pixels' }));
        win.body.append(layout);
        win.commands = { save: () => save(), saveas: () => save(true), open, undo, redo: redoAction, print: () => os.printHTML(`<img src="${source.toDataURL()}">`) };
        win.menus = () => [...os.standardMenus(), ['Tools', actions.map(([id, , label]) => ({ label, checked: tool === id, action: () => tool = id }))]];
        win.beforeClose = async () => { if (!dirty)
            return true; const r = await os.dialog({ message: 'Save this drawing before closing?', buttons: ['Save', "Don’t Save", 'Cancel'] }); return r.index === 2 ? false : r.index === 0 ? save() : true; };
        win.onClose = () => renderer.dispose();
        renderer.initialize().catch(e => os.alert(e.message));
        return win;
    });
}
