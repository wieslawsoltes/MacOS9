import { uid, download, clamp } from '@platinum/core';
import { CONTROL_PANELS, APPLICATIONS } from '@platinum/core/seed';
import { el, h, button, icon, field, checkbox, select, tabs } from '@platinum/ui';
const cfg = (os, key, value) => os.settings.get(key) ?? value;
function range(os, key, min, max, step = 1) { const input = el('input', { type: 'range', class: 'mac-range', min, max, step, value: cfg(os, key, min), 'aria-label': key, style: { flex: 1 } }); input.addEventListener('input', () => os.settings.set(key, Number(input.value))); return input; }
function option(os, key, choices, fallback) { return select(choices, cfg(os, key, fallback ?? (Array.isArray(choices[0]) ? choices[0][0] : choices[0])), value => os.settings.set(key, value), { 'aria-label': key }); }
function textOption(os, key, fallback = '', type = 'text') { const input = el('input', { class: 'mac-input', type, value: cfg(os, key, fallback), 'aria-label': key }); input.addEventListener('change', () => os.settings.set(key, input.value)); return input; }
function check(os, label, key, fallback = false) { return checkbox(label, cfg(os, key, fallback), value => os.settings.set(key, value)); }
function group(title, ...nodes) { return el('fieldset', {}, el('legend', { text: title }), ...nodes); }
function paragraph(text) { return el('p', { text }); }
export function registerControlPanels(os) {
    for (const [id, title, ico] of CONTROL_PANELS)
        os.register(`cp:${id}`, title, ico, () => {
            const existing = os.wm.windows.find(w => w.id === `control-${id}`);
            if (existing)
                return existing;
            if (id === 'appearance')
                return appearance(os);
            if (id === 'keychain')
                return keychain(os);
            if (id === 'launcher')
                return launcher(os);
            const win = os.wm.create({ id: `control-${id}`, appId: `cp:${id}`, title, width: id === 'extensions-manager' ? 530 : 455, height: id === 'extensions-manager' ? 448 : 365, resizable: id === 'extensions-manager' || id === 'multiple-users', minWidth: 330, minHeight: 240 });
            const panel = el('div', { class: 'panel' });
            panel.append(el('div', { class: 'info-header' }, el('span', { html: icon(ico, 32) }), el('h2', { text: title, style: { margin: 0 } })));
            win.body.append(panel);
            const set = (key, value) => os.settings.set(key, value);
            switch (id) {
                case 'date-time': {
                    const date = el('input', { class: 'mac-input', type: 'datetime-local', 'aria-label': 'Date and time', value: new Date(Date.now() + (cfg(os, 'clockOffset', 0)) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) });
                    panel.append(group('Current Date and Time', field('Date and time:', date), el('div', { class: 'panel-actions', style: { margin: '8px 0' } }, button('Set Time', () => { const value = Date.parse(date.value); if (Number.isFinite(value))
                        set('clockOffset', value - Date.now()); }), button('Use Current Time', () => { set('clockOffset', 0); date.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16); }))), group('Menu Bar Clock', check(os, 'Use a 24-hour clock', 'clock24'), check(os, 'Show seconds', 'showSeconds'), check(os, 'Show date', 'showDate'), field('Time zone:', option(os, 'timezone', [['', 'System time zone'], ['Europe/Warsaw', 'Warsaw'], ['Europe/London', 'London'], ['America/New_York', 'New York'], ['America/Los_Angeles', 'Cupertino'], ['Asia/Tokyo', 'Tokyo'], ['UTC', 'UTC']], ''))));
                    break;
                }
                case 'sound': {
                    const list = el('div', { class: 'listbox', style: { height: '120px' } });
                    const sounds = ['Simple Beep', 'Basso', 'Boing', 'Chu Toy', 'Glass', 'Indigo', 'Laugh', 'Logjam', 'Purr', 'Sosumi', 'Submarine', 'Temple'];
                    for (const name of sounds)
                        list.append(el('div', { class: 'listbox-row' + (cfg(os, 'alertSound', 'Simple Beep') === name ? ' selected' : ''), text: name, onClick: e => { set('alertSound', name); os.sound.beep(name); list.querySelectorAll('.selected').forEach(x => x.classList.remove('selected')); e.currentTarget.classList.add('selected'); } }));
                    panel.append(field('Output volume:', range(os, 'volume', 0, 1, .01)), check(os, 'Play system sounds', 'sound', true), group('Alert Sound', list), el('div', { class: 'panel-actions' }, button('Play Alert', () => os.sound.beep(cfg(os, 'alertSound', 'Simple Beep'))), button('Record Sound…', () => os.launch('simplesound'))));
                    break;
                }
                case 'speech': {
                    const voices = speechSynthesis?.getVoices?.() ?? [];
                    const sample = el('input', { class: 'mac-input', value: 'Hello. Welcome to your Macintosh.', 'aria-label': 'Speech sample', style: { width: '100%' } });
                    panel.append(group('Default Voice', field('Voice:', option(os, 'voice', voices.length ? voices.map(v => [v.name, v.name]) : [['', 'System default']], '')), field('Speaking rate:', range(os, 'speechRate', .5, 2, .1))), sample, el('div', { class: 'panel-actions' }, button('Speak', () => { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(sample.value); u.voice = speechSynthesis.getVoices().find(v => v.name === os.settings.get('voice')) ?? null; u.rate = cfg(os, 'speechRate', 1); speechSynthesis.speak(u); }), button('Stop', () => speechSynthesis.cancel())), check(os, 'Speak alert text', 'speakAlerts'));
                    break;
                }
                case 'mouse': {
                    const sample = button('Double-click here', () => { const now = performance.now(); if (now - last < os.settings.get('doubleClick')) {
                        sample.textContent = 'Double-click!';
                        os.sound.beep();
                        setTimeout(() => sample.textContent = 'Double-click here', 750);
                    } last = now; }, { style: { margin: '10px auto', display: 'block' } });
                    let last = 0;
                    panel.append(group('Double-Click Speed', field('Interval:', range(os, 'doubleClick', 200, 1000, 50)), sample), group('Mouse Tracking', field('Tracking:', range(os, 'mouseSpeed', 1, 10))), paragraph('Double-click speed is used when opening Finder icons. Pointer movement is supplied by your browser.'));
                    break;
                }
                case 'keyboard':
                    panel.append(group('Key Repeat', field('Rate:', range(os, 'repeatRate', 10, 100, 5)), field('Delay:', range(os, 'repeatDelay', 100, 1500, 100))), field('Keyboard layout:', option(os, 'keyboardLayout', ['US', 'British', 'Polish', 'German', 'French'], 'US')), el('div', { class: 'panel-actions' }, button('Open Key Caps', () => os.launch('keycaps'))));
                    break;
                case 'easy-access':
                    panel.append(group('Keyboard', check(os, 'Sticky Keys', 'stickyKeys'), check(os, 'Speak alerts', 'speakAlerts')), group('Display', check(os, 'Larger text in applications', 'largeText'), check(os, 'Increase contrast', 'highContrast'), check(os, 'Reduce motion', 'reduceMotion')), paragraph('Keyboard, text, and display preferences apply across your Macintosh desktop.'));
                    break;
                case 'control-strip':
                    panel.append(check(os, 'Show Control Strip', 'controlStrip', true), check(os, 'Collapse Control Strip', 'stripCollapsed'), group('Control Strip Modules', paragraph('Sound, monitors, desktop appearance, keyboard, sharing, location, keychain, and energy settings are available from the strip.')), el('div', { class: 'panel-actions' }, button('Show All Modules', () => { set('controlStrip', true); set('stripCollapsed', false); })));
                    break;
                case 'monitors': {
                    const info = el('p', { text: `Current desktop: ${os.root.clientWidth} × ${os.root.clientHeight} pixels` });
                    panel.append(info, group('Display', field('Graphics:', option(os, 'renderer', [['auto', 'Automatic (WebGPU preferred)'], ['webgpu', 'WebGPU with fallbacks'], ['webgl2', 'WebGL2 with Canvas fallback'], ['canvas2d', 'Canvas 2D']], 'auto')), field('Brightness:', range(os, 'brightness', .25, 1, .05))), group('Color', field('Colors:', option(os, 'colorDepth', ['Millions', 'Thousands', '256 Colors'], 'Millions'))), el('div', { class: 'panel-actions' }, button('Full Screen', () => os.run(() => os.fullscreen())), button('System Profiler…', () => os.launch('profiler'))), paragraph('The desktop follows the browser window. Resize the window or enter full screen to change its size.'));
                    break;
                }
                case 'energy-saver': {
                    panel.append(group('Sleep', field('Idle sleep:', option(os, 'screenSaver', [[0, 'Never'], [1, 'After 1 minute'], [5, 'After 5 minutes'], [15, 'After 15 minutes'], [30, 'After 30 minutes']], 0))), check(os, 'Reduce animation', 'reduceMotion'), el('div', { class: 'panel-actions' }, button('Sleep Now', () => os.sleep())), paragraph('Sleep dims this desktop and stops new interaction until you wake it. Click or press a key to wake.'));
                    break;
                }
                case 'memory':
                    panel.append(paragraph(`Built-in Memory: ${os.settings.get('memoryMB')} MB`), group('Application Memory', field('Memory:', select([64, 128, 256, 512, 1024], os.settings.get('memoryMB'), v => set('memoryMB', Number(v)))), check(os, 'Virtual Memory', 'virtualMemory', true)), group('Disk Cache', field('Cache (K):', select([1024, 2048, 4096, 8192, 16384], os.settings.get('diskCache'), v => set('diskCache', Number(v))))), paragraph('These allocations describe the virtual Macintosh. The browser manages actual memory and storage.'));
                    break;
                case 'apple-menu-options':
                    panel.append(check(os, 'Submenus', 'appleSubmenus', true), group('Recent Items', field('Applications:', option(os, 'recentApplications', [5, 8, 10, 15], 8)), field('Documents:', option(os, 'recentDocuments', [5, 8, 10, 15], 8))), el('div', { class: 'panel-actions' }, button('Clear Recent Items', () => { os.recent.length = 0; os.persist(); os.updateMenus(); })), paragraph('Place aliases in System Folder → Apple Menu Items to add your own menu entries.'));
                    break;
                case 'general-controls':
                    panel.append(group('Desktop', check(os, 'Show balloon help', 'balloonHelp'), check(os, 'Show Control Strip', 'controlStrip', true), check(os, 'Use color labels', 'labelColor', true)), group('Documents', field('Default folder:', option(os, 'defaultFolder', [['documents', 'Documents'], ['desktop', 'Desktop']], 'documents'))), el('div', { class: 'panel-actions' }, button('Clean Up Desktop', () => { os.finder.activeView = os.finder.desktopView; os.finder.cleanUp(); }), button('Open Preferences', () => os.finder.open('preferences'))));
                    break;
                case 'internet':
                    panel.append(field('Name:', textOption(os, 'ownerName', 'Macintosh User')), field('Email:', textOption(os, 'email', '', 'email')), field('Home page:', textOption(os, 'homepage', 'about:home')), group('Default Applications', field('Web:', el('span', { text: 'Internet Explorer' })), field('Email:', el('span', { text: 'Outlook Express' }))), el('div', { class: 'panel-actions' }, button('Open Browser', () => os.launch('browser')), button('Open Mail', () => os.launch('mail'))));
                    break;
                case 'appletalk':
                    panel.append(check(os, 'AppleTalk Active', 'appleTalk'), group('AppleTalk', field('Connect via:', option(os, 'appleTalkPort', ['Ethernet', 'Remote Only'], 'Ethernet')), field('Zone:', textOption(os, 'appleTalkZone', 'Local Zone'))), el('div', { class: 'panel-actions' }, button('Network Browser…', () => os.launch('network'))), paragraph('AppleTalk settings describe the virtual network. Browsing uses the local virtual share.'));
                    break;
                case 'tcp-ip': {
                    const method = option(os, 'ipMethod', ['Using DHCP Server', 'Manually'], 'Using DHCP Server');
                    const ip = textOption(os, 'ipAddress', '192.168.0.2'), mask = textOption(os, 'subnet', '255.255.255.0'), router = textOption(os, 'router', '192.168.0.1'), dns = textOption(os, 'dns', '1.1.1.1');
                    const validate = () => { const valid = value => value.split('.').length === 4 && value.split('.').every(x => /^\d{1,3}$/.test(x) && Number(x) <= 255); for (const input of [ip, mask, router, dns])
                        if (!valid(input.value))
                            return os.alert('Enter four numbers from 0 to 255, separated by periods.'); os.alert('The virtual TCP/IP configuration has been saved.'); };
                    panel.append(field('Connect via:', option(os, 'networkPort', ['Ethernet', 'PPP'], 'Ethernet')), field('Configure:', method), field('IP address:', ip), field('Subnet mask:', mask), field('Router address:', router), field('Name server:', dns), el('div', { class: 'panel-actions' }, button('Validate', validate)), el('p', { class: 'subtle', text: 'Web access uses your browser’s existing connection.', style: { fontSize: '11px' } }));
                    break;
                }
                case 'modem':
                    panel.append(field('Connect via:', option(os, 'modemPort', ['Internal Modem', 'Modem Port', 'Printer Port'], 'Internal Modem')), field('Modem:', option(os, 'modemType', ['Apple Internal 56K Modem', 'Apple Personal Modem'], 'Apple Internal 56K Modem')), group('Dialing', check(os, 'Sound on', 'modemSound', true), field('Dialing:', option(os, 'dialing', ['Tone', 'Pulse'], 'Tone')), check(os, 'Wait for dial tone', 'dialTone', true)), paragraph('Modem options are stored for the virtual connection profile. A browser cannot dial a physical modem.'));
                    break;
                case 'remote-access': {
                    const status = el('p', { text: os.settings.get('remoteConnected') ? 'Virtual session active' : 'Not connected' });
                    const connect = button(os.settings.get('remoteConnected') ? 'Disconnect' : 'Connect', () => { set('remoteConnected', !os.settings.get('remoteConnected')); status.textContent = os.settings.get('remoteConnected') ? 'Virtual session active — web traffic still uses your browser connection.' : 'Not connected'; connect.textContent = os.settings.get('remoteConnected') ? 'Disconnect' : 'Connect'; });
                    panel.append(field('Name:', textOption(os, 'remoteName', '')), field('Number:', textOption(os, 'remoteNumber', '')), group('Connection Profile', field('Protocol:', option(os, 'remoteProtocol', ['PPP', 'AppleTalk Remote Access'], 'PPP')), status), el('div', { class: 'panel-actions' }, connect, button('TCP/IP…', () => os.launch('cp:tcp-ip'))));
                    break;
                }
                case 'dial-assist': {
                    const country = textOption(os, 'dialCountry', '48'), area = textOption(os, 'dialArea', ''), prefix = textOption(os, 'dialPrefix', ''), number = el('input', { class: 'mac-input', placeholder: 'Phone number', 'aria-label': 'Number to preview' }), preview = el('p');
                    const refresh = () => preview.textContent = `Dial: ${prefix.value}${country.value}${area.value}${number.value}`;
                    for (const input of [country, area, prefix, number])
                        input.addEventListener('input', refresh);
                    panel.append(field('Country code:', country), field('Area code:', area), field('Outside line:', prefix), field('Phone number:', number), group('Dialing Preview', preview));
                    refresh();
                    break;
                }
                case 'file-sharing':
                    panel.append(field('Owner Name:', textOption(os, 'ownerName', 'Macintosh User')), field('Computer Name:', textOption(os, 'computerName', 'My Macintosh')), group('File Sharing', check(os, 'File Sharing on', 'fileSharing'), paragraph('Shared Files is a virtual network volume stored on this Macintosh disk.')), el('div', { class: 'panel-actions' }, button('Open Network Browser', () => os.launch('network')), button('Users & Groups…', () => os.launch('cp:multiple-users'))));
                    break;
                case 'web-sharing': {
                    const folder = option(os, 'webFolder', [['webpages', 'Web Pages'], ['documents', 'Documents']], 'webpages');
                    panel.append(check(os, 'Web Sharing on', 'webSharing'), field('Web folder:', folder), paragraph('Preview HTML documents in your virtual web folder using Internet Explorer.'), el('div', { class: 'panel-actions' }, button('Open Web Folder', () => os.finder.open(os.settings.get('webFolder') ?? 'webpages')), button('View Home Page', () => { const node = os.vfs.children(os.settings.get('webFolder') ?? 'webpages').find(n => n.kind === 'html'); if (node)
                        os.launch('browser', { node });
                    else
                        os.alert('There is no HTML document in this folder.'); })));
                    break;
                }
                case 'location-manager': {
                    os.state.locations ??= [{ name: 'Automatic', settings: { ...os.settings.export() } }];
                    const list = el('div', { class: 'listbox', style: { height: '140px' } });
                    const refresh = () => list.replaceChildren(...os.state.locations.map(location => el('div', { class: 'listbox-row', text: location.name, onDblclick: () => { os.settings.patch(location.settings); set('location', location.name); os.alert(`Switched to “${location.name}”.`); } })));
                    panel.append(paragraph('Save a set of desktop and connection preferences. Double-click a location to use it.'), list, el('div', { class: 'panel-actions' }, button('New Location…', async () => { const name = await os.prompt('Location name:', 'Untitled Location'); if (name) {
                        os.state.locations.push({ name, settings: os.settings.export() });
                        os.persist();
                        refresh();
                    } })));
                    refresh();
                    break;
                }
                case 'file-exchange': {
                    os.state.fileAssociations ??= { txt: 'simpletext', html: 'browser', png: 'picture', jpg: 'picture', mp3: 'quicktime', mp4: 'quicktime', applescript: 'scripter' };
                    const list = el('div', { class: 'listbox', style: { height: '165px' } });
                    const refresh = () => list.replaceChildren(...Object.entries(os.state.fileAssociations).map(([ext, app]) => el('div', { class: 'listbox-row' }, el('span', { text: '.' + ext, style: { width: '80px' } }), select([...os.registry.values()].filter(a => !a.id.startsWith('cp:')).map(a => [a.id, a.title]), app, v => { os.state.fileAssociations[ext] = v; os.persist(); }))));
                    panel.append(paragraph('Choose which application opens each file extension.'), list, el('div', { class: 'panel-actions' }, button('Add…', async () => { const ext = await os.prompt('File extension:', 'txt'); if (ext && /^[a-z0-9]{1,12}$/i.test(ext)) {
                        os.state.fileAssociations[ext.toLowerCase()] = 'simpletext';
                        os.persist();
                        refresh();
                    } })));
                    refresh();
                    break;
                }
                case 'color-sync': {
                    const preview = el('div', { style: { height: '66px', margin: '15px 0', display: 'flex', border: '1px solid #333' } });
                    for (const color of ['#fff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff', '#000'])
                        preview.append(el('div', { style: { flex: 1, background: color } }));
                    panel.append(field('Display Profile:', option(os, 'displayProfile', ['sRGB', 'Apple RGB', 'Generic RGB'], 'Apple RGB')), field('Input Profile:', option(os, 'inputProfile', ['Generic RGB', 'sRGB'], 'Generic RGB')), field('Output Profile:', option(os, 'outputProfile', ['Generic CMYK', 'sRGB'], 'Generic CMYK')), preview, paragraph('Color profiles are modeled preferences. The browser manages physical display color.'));
                    break;
                }
                case 'numbers': {
                    const decimal = option(os, 'decimalSeparator', [['.', 'Period (.)'], [',', 'Comma (,)']], '.'), grouping = option(os, 'groupSeparator', [[',', 'Comma (,)'], ['.', 'Period (.)'], [' ', 'Space']], ','), currency = option(os, 'currency', ['$', '€', 'zł', '£', '¥'], '$'), sample = el('div', { class: 'listbox', style: { padding: '15px', marginTop: '20px', fontSize: '16px' } });
                    const refresh = () => sample.textContent = `${currency.value} 1${grouping.value}234${decimal.value}56`;
                    for (const control of [decimal, grouping, currency])
                        control.addEventListener('change', refresh);
                    panel.append(field('Decimal:', decimal), field('Thousands:', grouping), field('Currency:', currency), group('Number Sample', sample));
                    refresh();
                    break;
                }
                case 'text': {
                    const language = option(os, 'sortLanguage', ['English', 'Polish', 'German', 'French', 'Japanese'], 'English'), sample = el('div', { class: 'listbox', style: { height: '160px', padding: '10px' } });
                    const refresh = () => { const locale = { English: 'en', Polish: 'pl', German: 'de', French: 'fr', Japanese: 'ja' }[language.value]; sample.textContent = ['Apple', 'Żółw', 'Österreich', 'Zebra', 'Étude', 'Łódź', 'Résumé'].sort((a, b) => a.localeCompare(b, locale)).join('\n'); sample.style.whiteSpace = 'pre'; };
                    language.addEventListener('change', refresh);
                    panel.append(field('Sorting:', language), group('Sorting Example', sample));
                    refresh();
                    break;
                }
                case 'quicktime-settings':
                    panel.append(group('Playback', field('Default volume:', range(os, 'volume', 0, 1, .01)), check(os, 'Enable sound', 'sound', true)), group('Connection', field('Speed:', option(os, 'quicktimeConnection', ['28.8 Kbps Modem', '56 Kbps Modem', 'ISDN', 'LAN / Broadband'], 'LAN / Broadband'))), el('div', { class: 'panel-actions' }, button('Open QuickTime Player', () => os.launch('quicktime'))));
                    break;
                case 'startup-disk': {
                    const list = el('div', { class: 'listbox', style: { height: '165px' } });
                    for (const disk of [...os.vfs.nodes.values()].filter(n => n.type === 'disk'))
                        list.append(el('div', { class: 'listbox-row' + (os.settings.get('startupDisk') === disk.id ? ' selected' : ''), html: icon('disk', 32) + `<span>${h(disk.name)}</span>`, onClick: e => { set('startupDisk', disk.id); list.querySelectorAll('.selected').forEach(x => x.classList.remove('selected')); e.currentTarget.classList.add('selected'); } }));
                    panel.append(paragraph('Select the disk to open after restarting this Macintosh.'), list, el('div', { class: 'panel-actions' }, button('Restart', () => os.restart())));
                    break;
                }
                case 'software-update': {
                    const status = el('div', { class: 'listbox', style: { padding: '14px', margin: '12px 0', minHeight: '85px' }, text: 'Platinum version 1.0.0' });
                    panel.append(paragraph('Check for the currently published version of this Macintosh recreation.'), status, check(os, 'Check while this desktop is open', 'checkUpdates'), el('div', { class: 'panel-actions' }, button('Update Now', async () => { status.textContent = 'Checking for updates…'; try {
                        const response = await fetch('/version.json', { cache: 'no-store' });
                        if (!response.ok)
                            throw new Error();
                        const data = await response.json();
                        status.textContent = data.version === '1.0.0' ? 'Your software is up to date.\nPlatinum 1.0.0' : `Version ${data.version} is available. Reload the desktop to update.`;
                        set('lastUpdateCheck', Date.now());
                    }
                    catch {
                        status.textContent = 'The update server could not be reached. Try again later.';
                    } })));
                    break;
                }
                case 'extensions-manager': {
                    const list = el('div', { class: 'extension-list' }), search = el('input', { class: 'mac-input', placeholder: 'Find an extension', 'aria-label': 'Filter extensions', style: { width: '100%' } });
                    os.state.extensionSets ??= {};
                    const render = () => { list.replaceChildren(); for (const n of os.vfs.children('extensions').filter(n => n.name.toLowerCase().includes(search.value.toLowerCase())))
                        list.append(el('div', { class: 'extension-row' }, checkbox('', n.meta?.enabled !== false, v => os.vfs.update(n.id, { meta: { ...n.meta, enabled: v } })), el('span', { html: icon(n.icon ?? 'extensions', 16) }), el('span', { text: n.name, style: { flex: 1 } }), el('span', { text: 'System 9.0', class: 'subtle' }))); };
                    search.addEventListener('input', render);
                    const sets = select([['current', 'My Settings'], ['all', 'Mac OS 9 All'], ['base', 'Mac OS 9 Base'], ...Object.keys(os.state.extensionSets).map(k => [k, k])], 'current', value => { if (value === 'current')
                        return; const saved = os.state.extensionSets[value]; os.vfs.mutate('Change extensions set', () => os.vfs.children('extensions').forEach((n, i) => os.vfs.update(n.id, { meta: { ...n.meta, enabled: saved ? !!saved[n.id] : value === 'all' || i < 5 } }))); render(); }, { 'aria-label': 'Selected extension set' });
                    panel.append(field('Selected Set:', sets), search, list, el('div', { class: 'panel-actions', style: { marginTop: '6px' } }, button('Duplicate Set…', async () => { const name = await os.prompt('Name this extension set:', 'My Settings'); if (name) {
                        os.state.extensionSets[name] = Object.fromEntries(os.vfs.children('extensions').map(n => [n.id, n.meta?.enabled !== false]));
                        os.persist();
                        sets.append(el('option', { value: name, text: name }));
                        sets.value = name;
                    } }), button('Restart', () => os.restart())));
                    render();
                    break;
                }
                case 'multiple-users': {
                    os.state.users ??= [{ id: 'owner', name: os.settings.get('ownerName'), home: 'documents', preferences: os.settings.export() }];
                    const list = el('div', { class: 'listbox', style: { height: '150px' } });
                    let chosen = os.state.users[0];
                    const render = () => { list.replaceChildren(...os.state.users.map(user => el('div', { class: 'listbox-row' + (user === chosen ? ' selected' : ''), html: icon('users', 24) + `<span>${h(user.name)}</span>`, onClick: () => { chosen = user; render(); } }))); };
                    panel.append(paragraph('Desktop profiles keep separate preferences and home folders. System files are shared.'), list, el('div', { class: 'panel-actions' }, button('New User…', async () => { const name = await os.prompt('User name:', 'New User'); if (name) {
                        let users = os.vfs.children('disk').find(n => n.name === 'Users');
                        if (!users)
                            users = os.vfs.create('disk', 'Users', { type: 'folder', icon: 'users' });
                        const home = os.vfs.create(users.id, os.vfs.uniqueName(users.id, name), { type: 'folder', icon: 'folder' });
                        chosen = { id: uid(), name, home: home.id, preferences: os.settings.export() };
                        os.state.users.push(chosen);
                        os.persist();
                        render();
                    } }), button('Log In', () => { const previous = os.state.users.find(u => u.id === os.state.activeUser); if (previous)
                        previous.preferences = os.settings.export(); os.state.activeUser = chosen.id; os.settings.patch(chosen.preferences); set('ownerName', chosen.name); set('defaultFolder', chosen.home); os.finder.open(chosen.home); os.persist(); })));
                    render();
                    break;
                }
                default: panel.append(paragraph('This control panel stores preferences for your Macintosh.'));
            }
            win.commands = { save: () => os.persist(), print: () => os.printHTML(panel.innerHTML) };
            return win;
        });
}
function appearance(os) {
    const win = os.wm.create({ id: 'control-appearance', appId: 'cp:appearance', title: 'Appearance', width: 477, height: 377, resizable: false });
    const layout = el('div', { class: 'vertical-layout' }), content = el('div', { class: 'panel flex-1' });
    const patterns = [['macos', 'Mac OS'], ['gray', 'Gray'], ['teal', 'Teal'], ['pinstripes', 'Stripes'], ['checker', 'Tiles'], ['solid', 'Solid'], ['black', 'Black'], ['white', 'White']];
    const preview = () => { const p = el('div', { class: 'appearance-preview' }); const mode = os.settings.get('pattern'); if (mode === 'macos') {
        p.style.backgroundImage = 'url(/assets/platinum-desktop-reference.png)';
        p.style.backgroundSize = '640px 480px';
        p.style.backgroundPosition = '0 -20px';
    }
    else
        p.style.background = mode === 'teal' ? '#3c9292' : mode === 'gray' ? '#aaa' : mode === 'black' ? '#111' : mode === 'white' ? '#fff' : os.settings.get('desktopColor'); p.innerHTML = '<div class="preview-menubar">  File Edit View</div><div class="preview-window"><div class="preview-title">Sample Window</div><div class="preview-body">This is a sample window.<br><span class="preview-selected">Selected text</span></div></div>'; return p; };
    const show = tab => {
        content.replaceChildren();
        if (tab === 'Themes') {
            const themeList = el('div', { class: 'listbox', style: { height: '142px' } });
            const themes = [['Mac OS Default', '#333399', 'macos'], ['Blueberry', '#333399', 'pinstripes'], ['Bondi', '#006666', 'teal'], ['Graphite', '#555555', 'gray'], ['Tangerine', '#aa5500', 'solid'], ['Grape', '#663399', 'checker']];
            for (const [name, accent, pattern] of themes)
                themeList.append(el('div', { class: 'listbox-row', text: name, onClick: e => { os.settings.patch({ accent, pattern, desktopColor: name === 'Tangerine' ? '#cc9966' : '#666699' }); themeList.querySelectorAll('.selected').forEach(x => x.classList.remove('selected')); e.currentTarget.classList.add('selected'); } }));
            content.append(paragraph('Choose a coordinated appearance for your Macintosh.'), themeList, el('div', { class: 'panel-actions' }, button('Save Theme…', async () => { const name = await os.prompt('Theme name:', 'My Theme'); if (name) {
                os.state.themes ??= {};
                os.state.themes[name] = os.settings.export();
                os.persist();
            } })));
            if (os.state.themes)
                content.append(select([['', 'Saved themes…'], ...Object.keys(os.state.themes).map(k => [k, k])], '', value => { if (value)
                    os.settings.patch(os.state.themes[value]); }));
        }
        if (tab === 'Appearance') {
            content.append(preview(), field('Appearance:', el('span', { text: 'Apple Platinum' })), field('Highlight color:', select([['#333399', 'Blue'], ['#663399', 'Purple'], ['#006666', 'Teal'], ['#336633', 'Green'], ['#aa3300', 'Orange'], ['#555555', 'Graphite']], os.settings.get('accent'), value => { os.settings.set('accent', value); show(tab); })));
        }
        if (tab === 'Fonts') {
            content.append(field('Large System Font:', option(os, 'font', ['system', 'Chicago', 'Geneva'], 'system')), field('Small System Font:', el('span', { text: 'Geneva' })), field('Views Font:', option(os, 'viewFont', ['Geneva', 'Chicago', 'Helvetica', 'Monaco'], 'Geneva')), group('Sample', el('p', { text: 'The quick brown fox jumps over the lazy dog.', style: { fontFamily: os.settings.get('font') === 'system' ? 'var(--system)' : os.settings.get('font'), fontSize: '16px' } })), check(os, 'Larger application text', 'largeText'));
        }
        if (tab === 'Desktop') {
            const grid = el('div', { class: 'pattern-grid' });
            for (const [id, name] of patterns) {
                const b = el('button', { class: 'pattern-choice' + (os.settings.get('pattern') === id ? ' selected' : ''), 'aria-label': `${name} desktop`, onClick: () => { os.settings.set('pattern', id); show(tab); } }, el('span', { text: name }));
                if (id === 'macos') {
                    b.style.backgroundImage = 'url(/assets/platinum-desktop-reference.png)';
                    b.style.backgroundSize = '640px 480px';
                    b.style.backgroundPosition = '0 -20px';
                }
                else if (id === 'gray')
                    b.style.background = '#aaa';
                else if (id === 'teal')
                    b.style.background = '#3c9292';
                else if (id === 'pinstripes')
                    b.style.background = 'repeating-linear-gradient(#7777aa 0px,#7777aa 3px,#aaaacc 3px,#aaaacc 4px)';
                else if (id === 'checker')
                    b.style.background = 'repeating-conic-gradient(#7777aa 0 25%,#aaaacc 0 50%) 0/12px 12px';
                else
                    b.style.background = id === 'black' ? '#111' : id === 'white' ? '#fff' : os.settings.get('desktopColor');
                grid.append(b);
            }
            const color = el('input', { type: 'color', value: os.settings.get('desktopColor'), 'aria-label': 'Desktop color' });
            color.addEventListener('input', () => { os.settings.patch({ pattern: 'solid', desktopColor: color.value }); });
            content.append(preview(), grid, field('Desktop color:', color));
        }
        if (tab === 'Sound') {
            content.append(paragraph('Platinum sounds provide feedback as you use your Macintosh.'), check(os, 'Play sound effects', 'sound', true), field('Volume:', range(os, 'volume', 0, 1, .01)), el('div', { class: 'panel-actions' }, button('Play Sample', () => os.sound.chime()), button('Sound…', () => os.launch('cp:sound'))));
        }
        if (tab === 'Options') {
            content.append(check(os, 'Double-click title bar to collapse', 'titleCollapse', true), check(os, 'Show color labels', 'labelColor', true), check(os, 'Show balloon help', 'balloonHelp'), check(os, 'Reduce motion', 'reduceMotion'), group('Desktop', check(os, 'Show Control Strip', 'controlStrip', true)), el('div', { class: 'panel-actions' }, button('Restore Defaults', () => { os.settings.patch({ pattern: 'macos', accent: '#333399', desktopColor: '#666699', font: 'system', brightness: 1, largeText: false, highContrast: false }); show(tab); })));
        }
    };
    layout.append(tabs(['Themes', 'Appearance', 'Fonts', 'Desktop', 'Sound', 'Options'], show), content);
    win.body.append(layout);
    show('Appearance');
    return win;
}
function launcher(os) { const win = os.wm.create({ id: 'control-launcher', appId: 'cp:launcher', title: 'Launcher', width: 515, height: 328 }); const layout = el('div', { class: 'vertical-layout' }), grid = el('div', { class: 'launcher-grid flex-1' }); const show = group => { grid.replaceChildren(); const list = group === 'Applications' ? APPLICATIONS : group === 'Internet' ? [['browser', 'Internet Explorer', 'internet'], ['mail', 'Outlook Express', 'mail'], ['sherlock', 'Sherlock 2', 'sherlock']] : [['cp:appearance', 'Appearance', 'appearance'], ['cp:sound', 'Sound', 'sound'], ['cp:date-time', 'Date & Time', 'clock'], ['profiler', 'System Profiler', 'computer'], ['disk-first-aid', 'Disk First Aid', 'firstaid']]; for (const [id, title, ico] of list)
    grid.append(el('button', { class: 'launcher-button', html: icon(ico, 32) + `<span>${h(title)}</span>`, onClick: () => os.launch(id) })); }; layout.append(tabs(['Applications', 'Internet', 'Utilities'], show), grid); win.body.append(layout); show('Applications'); return win; }
function bytes64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function un64(value) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
function keychain(os) { const win = os.wm.create({ id: 'control-keychain', appId: 'cp:keychain', title: 'Keychain Access', width: 490, height: 365 }); const panel = el('div', { class: 'panel' }); let key = null, entries = [], selected = null; const derive = async (password, salt) => { const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }; const persist = async () => { const iv = crypto.getRandomValues(new Uint8Array(12)), data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(entries))); os.state.keychain = { ...os.state.keychain, iv: bytes64(iv), data: bytes64(new Uint8Array(data)) }; os.persist(); }; const render = () => { panel.replaceChildren(el('div', { class: 'info-header' }, el('span', { html: icon('key', 32) }), el('h2', { text: 'Keychain Access', style: { margin: 0 } }))); if (!crypto.subtle) {
    panel.append(paragraph('Keychain encryption requires a secure browser connection.'));
    return;
} if (!key) {
    const existing = !!os.state.keychain?.data;
    const password = el('input', { class: 'mac-input', type: 'password', 'aria-label': 'Keychain password', autocomplete: existing ? 'current-password' : 'new-password', style: { width: '100%' } });
    panel.append(paragraph(existing ? 'Enter the password to unlock your keychain.' : 'Create a password for your new keychain. The password is not stored.'), password, el('div', { class: 'panel-actions' }, button(existing ? 'Unlock' : 'Create', async () => { if (password.value.length < 6)
        return os.alert('Use a password of at least six characters.'); try {
        const salt = existing ? un64(os.state.keychain.salt) : crypto.getRandomValues(new Uint8Array(16));
        const candidate = await derive(password.value, salt);
        if (existing) {
            const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: un64(os.state.keychain.iv) }, candidate, un64(os.state.keychain.data));
            entries = JSON.parse(new TextDecoder().decode(data));
        }
        else {
            entries = [];
            os.state.keychain = { salt: bytes64(salt) };
        }
        key = candidate;
        password.value = '';
        if (!existing)
            await persist();
        render();
    }
    catch {
        password.value = '';
        await os.alert('The keychain could not be unlocked. Check the password.');
    } })), el('p', { class: 'subtle', text: 'AES-GCM encrypted records. Keep your password; it cannot be recovered.', style: { fontSize: '11px', marginTop: '15px' } }));
    return;
} const list = el('div', { class: 'listbox', style: { height: '165px' } }); for (const entry of entries)
    list.append(el('div', { class: 'listbox-row' + (entry.id === selected ? ' selected' : ''), text: `${entry.name} — ${entry.account}`, onClick: () => { selected = entry.id; render(); } })); panel.append(list, el('div', { class: 'panel-actions', style: { justifyContent: 'space-between' } }, button('Lock', () => { key = null; entries = []; render(); }), button('Add…', () => { const dialog = os.wm.create({ title: 'New Keychain Item', modal: true, appId: 'cp:keychain', width: 385, height: 237, resizable: false }); dialog.element.setAttribute('aria-modal', 'true'); const content = el('div', { class: 'panel' }), name = el('input', { class: 'mac-input', 'aria-label': 'Item name' }), account = el('input', { class: 'mac-input', 'aria-label': 'Account' }), password = el('input', { class: 'mac-input', type: 'password', 'aria-label': 'Item password', autocomplete: 'new-password' }); content.append(field('Name:', name), field('Account:', account), field('Password:', password), el('div', { class: 'panel-actions' }, button('Cancel', () => dialog.close()), button('Add', async () => { if (!name.value.trim())
    return; entries.push({ id: uid(), name: name.value, account: account.value, password: password.value }); password.value = ''; await persist(); os.wm.close(dialog, true); render(); }))); dialog.body.append(content); }), button('Copy Password', async () => { const entry = entries.find(e => e.id === selected); if (entry)
    await os.clipboard.writeText(entry.password); }), button('Delete', async () => { if (!selected)
    return; entries = entries.filter(e => e.id !== selected); selected = null; await persist(); render(); }))); }; win.body.append(panel); win.onClose = () => { key = null; entries = []; }; render(); return win; }
