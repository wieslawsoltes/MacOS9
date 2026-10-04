import { uid, download } from '@platinum/core';
import { el, h, icon, button, field } from '@platinum/ui';
import { separator as sep } from '@platinum/ui/menus';
export function registerInternetApps(os) {
    os.register('browser', 'Internet Explorer', 'internet', options => {
        const existing = !options?.new && os.wm.windows.find(w => w.appId === 'browser');
        if (existing) {
            if (options?.url)
                existing.navigate(options.url);
            if (options?.node)
                existing.navigate('macintosh:' + options.node.id);
            return existing;
        }
        const win = os.wm.create({ title: 'Internet Explorer', appId: 'browser', width: 720, height: 495, minWidth: 355, minHeight: 245 });
        const layout = el('div', { class: 'vertical-layout' }), toolbar = el('div', { class: 'browser-toolbar' }), address = el('input', { class: 'mac-input', 'aria-label': 'Address', value: '' }), viewport = el('div', { class: 'browser-viewport' }), status = el('div', { class: 'status-bar', text: 'Done' });
        let history = [], index = -1, frame = null, current = 'about:home';
        os.state.bookmarks ??= [{ title: 'Apple', url: 'https://www.apple.com' }, { title: 'Mac Help', url: 'about:help' }, { title: 'My Home Page', url: 'macintosh:sample-html' }];
        const tool = (label, symbol, action) => el('button', { class: 'browser-tool', html: `<span class="symbol">${symbol}</span><span>${label}</span>`, onClick: action, 'aria-label': label });
        const back = tool('Back', '◀', () => { if (index > 0) {
            index--;
            navigate(history[index], false);
        } }), forward = tool('Forward', '▶', () => { if (index < history.length - 1) {
            index++;
            navigate(history[index], false);
        } });
        toolbar.append(back, forward, tool('Stop', '✕', () => { if (frame)
            frame.src = 'about:blank'; status.textContent = 'Stopped'; }), tool('Refresh', '↻', () => navigate(current, false)), tool('Home', '⌂', () => navigate(os.settings.get('homepage') ?? 'about:home')), tool('Search', '⌕', () => os.launch('sherlock')), tool('Favorites', '★', () => showBookmarks()), el('span', { style: { flex: 1 } }), el('span', { html: icon('internet', 32), style: { padding: '2px 7px' } }));
        const addressRow = el('form', { class: 'browser-address' }, el('label', { text: 'Address:', htmlFor: `address-${win.id}` }));
        address.id = `address-${win.id}`;
        addressRow.append(address, button('Go', () => navigate(address.value), { type: 'button' }));
        addressRow.addEventListener('submit', e => { e.preventDefault(); navigate(address.value); });
        layout.append(toolbar, addressRow, viewport, status);
        win.body.append(layout);
        function home() { const box = el('div', { class: 'browser-home' }); box.innerHTML = `<div class="home-top">${icon('internet', 48)}<div><h1>Welcome to the Internet</h1><div>Your window to a world of possibilities.</div></div></div><div class="home-grid"><div class="home-box"><h2>Explore your Macintosh</h2><p>Your applications and documents are only a click away.</p></div><div class="home-box"><h2>Make a home page</h2><p>Open your sample page, then edit it in SimpleText.</p></div><div class="home-box"><h2>Find what you need</h2><p>Sherlock can find files on your disk or start a web search.</p></div><div class="home-box"><h2>Go somewhere new</h2><p>Type a web address above. Sites that allow embedding open here.</p></div></div>`; const boxes = box.querySelectorAll('.home-box'); boxes[0].append(button('Open Macintosh HD', () => os.finder.open('disk'))); boxes[1].append(button('My Home Page', () => navigate('macintosh:sample-html')), button('Edit Page', () => os.launch('simpletext', { node: os.vfs.get('sample-html') }))); boxes[2].append(button('Open Sherlock 2', () => os.launch('sherlock'))); boxes[3].append(button('Apple', () => navigate('https://www.apple.com'))); viewport.append(box); win.setTitle('Welcome to the Internet — Internet Explorer'); }
        function navigate(url, push = true) { url = String(url ?? '').trim(); if (!url)
            return; if (!/^[a-z][a-z0-9+.-]*:/i.test(url))
            url = 'https://' + url; if (!/^(https?:|about:|macintosh:)/i.test(url)) {
            os.alert('Use an http or https address.');
            return;
        } current = url; address.value = url; if (push) {
            history = history.slice(0, index + 1);
            history.push(url);
            index = history.length - 1;
        } back.disabled = index <= 0; forward.disabled = index >= history.length - 1; viewport.replaceChildren(); frame = null; status.textContent = 'Done'; if (url === 'about:home') {
            home();
            return;
        } if (url === 'about:help') {
            os.launch('help');
            home();
            return;
        } if (url.startsWith('macintosh:')) {
            const n = os.vfs.get(url.slice(10));
            if (!n) {
                viewport.append(el('div', { class: 'panel', text: 'The local page could not be found.' }));
                return;
            }
            frame = el('iframe', { sandbox: 'allow-scripts allow-forms allow-popups', title: n.name, srcdoc: n.content });
            viewport.append(frame);
            win.setTitle(`${n.name} — Internet Explorer`);
            return;
        } const urlObject = new URL(url); const notice = el('div', { class: 'browser-banner' }, el('span', { text: 'Some websites require a separate browser window. ' }), el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: 'Open in Browser' })); frame = el('iframe', { src: url, sandbox: 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox', referrerPolicy: 'no-referrer', title: urlObject.hostname, style: { height: 'calc(100% - 30px)' } }); frame.addEventListener('load', () => status.textContent = 'Done'); viewport.append(notice, frame); status.textContent = `Opening ${urlObject.hostname}…`; win.setTitle(`${urlObject.hostname} — Internet Explorer`); }
        function showBookmarks() { viewport.replaceChildren(); const panel = el('div', { class: 'panel' }); panel.append(el('h2', { text: 'Favorites' }), button('Add Current Page', async () => { const title = await os.prompt('Name this favorite:', current); if (title) {
            os.state.bookmarks.push({ title, url: current });
            os.persist();
            showBookmarks();
        } })); os.state.bookmarks.forEach((bookmark, i) => panel.append(el('div', { class: 'listbox-row' }, el('span', { html: icon('internet', 16) }), el('a', { href: '#', text: bookmark.title, onClick: e => { e.preventDefault(); navigate(bookmark.url); }, style: { flex: 1 } }), button('Remove', () => { os.state.bookmarks.splice(i, 1); os.persist(); showBookmarks(); }, { style: { minHeight: '18px', padding: '0 7px', fontSize: '10px' } })))); viewport.append(panel); }
        win.navigate = navigate;
        win.commands = { new: () => os.launch('browser', { new: true }), open: async () => { const n = await os.fileDialog({ kinds: ['html'] }); if (n)
                navigate('macintosh:' + n.id); }, print: () => { if (current === 'about:home')
                os.printHTML(viewport.innerHTML);
            else if (current.startsWith('macintosh:'))
                os.printHTML(`<pre>${h(os.vfs.get(current.slice(10))?.content ?? '')}</pre>`);
            else
                os.alert('Open this website in a separate browser window to print it.'); } };
        win.menus = () => [['File', [{ label: 'New Window', shortcut: '⌘N', action: 'new' }, { label: 'Open File…', shortcut: '⌘O', action: 'open' }, { label: 'Open Location…', action: () => { address.focus(); address.select(); } }, { label: 'Close Window', shortcut: '⌘W', action: 'close' }, sep, { label: 'Print…', shortcut: '⌘P', action: 'print' }, sep, { label: 'Quit', shortcut: '⌘Q', action: 'quit' }]], ['Edit', [{ label: 'Copy', shortcut: '⌘C', action: 'copy' }, { label: 'Preferences…', action: () => os.launch('cp:internet') }]], ['View', [{ label: 'Refresh', action: () => navigate(current, false) }, { label: 'Home', action: () => navigate('about:home') }, { label: 'View Source', action: () => os.launch('simpletext', { node: { name: 'Page Source', content: current.startsWith('macintosh:') ? os.vfs.get(current.slice(10))?.content ?? '' : viewport.innerHTML } }) }]], ['Favorites', () => os.state.bookmarks.map(b => ({ label: b.title, action: () => navigate(b.url) }))]];
        win.menus = (() => { const get = win.menus; return () => get().map(([title, items]) => [title, typeof items === 'function' ? items() : items]); })();
        navigate(options?.node ? 'macintosh:' + options.node.id : options?.url ?? os.settings.get('homepage') ?? 'about:home');
        return win;
    });
    os.register('mail', 'Outlook Express', 'mail', options => {
        os.state.mail ??= { messages: [{ id: 'welcome-mail', folder: 'Inbox', from: 'Macintosh', to: 'You', subject: 'Welcome to Outlook Express', body: 'Welcome to your Macintosh mailbox.\n\nThis local mailbox keeps messages and drafts on your Macintosh disk.\n\nCreate a message, save a draft, or export an .eml file. Open in Mail hands a message to your computer’s configured email app. No email account or mail server is connected to this recreation.', date: Date.now(), read: false }], contacts: [] };
        const data = os.state.mail;
        const compose = (message) => { const win = os.wm.create({ title: message?.subject || 'New Message', appId: 'mail', width: 600, height: 415, minWidth: 350, minHeight: 250 }); let draftId = message?.id, dirty = false; const layout = el('div', { class: 'vertical-layout mail-compose' }), to = el('input', { class: 'mac-input', value: message?.to ?? '', 'aria-label': 'To' }), subject = el('input', { class: 'mac-input', value: message?.subject ?? '', 'aria-label': 'Subject' }), body = el('textarea', { value: message?.body ?? '', 'aria-label': 'Message body', spellcheck: true }); for (const input of [to, subject, body])
            input.addEventListener('input', () => dirty = true); const save = () => { let entry = data.messages.find(m => m.id === draftId); if (!entry) {
            entry = { id: uid(), folder: 'Drafts' };
            data.messages.push(entry);
            draftId = entry.id;
        } Object.assign(entry, { to: to.value, from: os.settings.get('email') ?? 'Macintosh User', subject: subject.value || '(no subject)', body: body.value, date: Date.now(), read: true }); dirty = false; os.persist(); os.events.emit('mail'); win.setTitle(entry.subject); return true; }; const exportMail = () => { const clean = value => value.replace(/[\r\n]/g, ' '); const content = `From: ${clean(os.settings.get('email') ?? 'user@localhost')}\r\nTo: ${clean(to.value)}\r\nSubject: ${clean(subject.value)}\r\nDate: ${new Date().toUTCString()}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${body.value.replace(/\r?\n/g, '\r\n')}`; download(content, (subject.value || 'Message').replace(/[^\w -]/g, '') + '.eml', 'message/rfc822'); }; const handoff = () => { if (!to.value.trim())
            return os.alert('Enter a recipient in the To field.'); save(); const a = el('a', { href: `mailto:${encodeURIComponent(to.value)}?subject=${encodeURIComponent(subject.value)}&body=${encodeURIComponent(body.value)}` }); a.click(); }; layout.append(el('div', { class: 'window-toolbar' }, button('Open in Mail', handoff), button('Save Draft', save), button('Export .eml', exportMail)), field('To:', to), field('Subject:', subject), body, el('div', { class: 'status-bar', text: 'Local draft · No mail server connected' })); win.body.append(layout); win.commands = { save, saveas: exportMail, print: () => os.printHTML(`<h2>${h(subject.value)}</h2><p>To: ${h(to.value)}</p><pre>${h(body.value)}</pre>`) }; win.beforeClose = async () => { if (!dirty)
            return true; const r = await os.dialog({ message: 'Save this message as a draft?', buttons: ['Save', "Don’t Save", 'Cancel'] }); return r.index === 2 ? false : r.index === 0 ? save() : true; }; return win; };
        if (options?.compose)
            return compose(options.message);
        const existing = os.wm.windows.find(w => w.id === 'outlook');
        if (existing)
            return existing;
        const win = os.wm.create({ id: 'outlook', title: 'Outlook Express', appId: 'mail', width: 720, height: 440, minWidth: 370, minHeight: 250 }), layout = el('div', { class: 'vertical-layout' }), folders = el('div', { class: 'mail-folders' }), list = el('div', { class: 'mail-list' }), messageArea = el('div', { class: 'mail-message' }), status = el('div', { class: 'status-bar' });
        let currentFolder = 'Inbox', selected = data.messages[0]?.id;
        const showMessage = () => { const entry = data.messages.find(m => m.id === selected); messageArea.replaceChildren(); if (!entry) {
            messageArea.textContent = 'No message selected.';
            return;
        } entry.read = true; messageArea.append(el('strong', { text: entry.subject }), el('p', { text: `From: ${entry.from ?? 'You'}\nTo: ${entry.to ?? ''}\n${new Date(entry.date).toLocaleString()}`, style: { fontSize: '11px', color: '#666' } }), el('div', { text: entry.body })); };
        const render = () => { folders.replaceChildren(); for (const name of ['Inbox', 'Outbox', 'Drafts', 'Sent Items', 'Deleted Items'])
            folders.append(el('div', { class: 'mail-folder' + (name === currentFolder ? ' selected' : ''), html: icon(name === 'Inbox' ? 'mail' : 'folder', 16) + `<span>${name}</span>`, onClick: () => { currentFolder = name; selected = data.messages.find(m => m.folder === name)?.id; render(); } })); const messages = data.messages.filter(m => m.folder === currentFolder); list.replaceChildren(el('div', { class: 'mail-row', style: { background: '#ddd', fontWeight: 'bold' } }, el('span', { text: 'From' }), el('span', { text: 'Subject' })), ...messages.map(m => el('div', { class: 'mail-row' + (m.id === selected ? ' selected' : ''), style: { fontWeight: m.read ? 'normal' : 'bold' }, onClick: () => { selected = m.id; render(); }, onDblclick: () => { if (m.folder === 'Drafts')
                compose(m); } }, el('span', { text: m.from ?? 'You' }), el('span', { text: m.subject })))); if (!messages.length)
            list.append(el('div', { class: 'panel subtle', text: 'This folder is empty.' })); showMessage(); status.textContent = `${messages.length} messages · Local mailbox`; };
        const remove = () => { const message = data.messages.find(m => m.id === selected); if (!message)
            return; if (message.folder === 'Deleted Items')
            data.messages.splice(data.messages.indexOf(message), 1);
        else
            message.folder = 'Deleted Items'; selected = null; os.persist(); render(); };
        layout.append(el('div', { class: 'window-toolbar' }, button('New', () => compose()), button('Reply', () => { const m = data.messages.find(x => x.id === selected); if (m)
            compose({ to: m.from, subject: 'Re: ' + m.subject, body: '\n\n' + m.body.split('\n').map(x => '> ' + x).join('\n') }); }), button('Forward', () => { const m = data.messages.find(x => x.id === selected); if (m)
            compose({ subject: 'Fwd: ' + m.subject, body: m.body }); }), button('Delete', remove), el('span', { style: { flex: 1 } }), button('Address Book', () => contacts())), el('div', { class: 'horizontal-layout flex-1' }, folders, el('div', { class: 'mail-content' }, list, messageArea)), status);
        win.body.append(layout);
        const contacts = () => { const w = os.wm.create({ id: 'address-book', title: 'Address Book', appId: 'mail', width: 425, height: 320 }); const p = el('div', { class: 'panel' }), names = el('div', { class: 'listbox', style: { height: '185px' } }); const update = () => names.replaceChildren(...data.contacts.map(c => el('div', { class: 'listbox-row', text: `${c.name} <${c.email}>`, onDblclick: () => compose({ to: c.email }) }))); p.append(names, el('div', { class: 'panel-actions' }, button('New Contact…', async () => { const name = await os.prompt('Name:'); if (!name)
            return; const email = await os.prompt('Email address:'); if (email) {
            data.contacts.push({ name, email });
            os.persist();
            update();
        } }))); w.body.replaceChildren(p); update(); };
        win.commands = { new: () => compose(), print: () => os.printHTML(messageArea.innerHTML) };
        win.menus = () => [['File', [{ label: 'New Message', shortcut: '⌘N', action: () => compose() }, { label: 'Close', shortcut: '⌘W', action: 'close' }, sep, { label: 'Quit', shortcut: '⌘Q', action: 'quit' }]], ['Edit', [{ label: 'Delete Message', action: remove }, { label: 'Select All', shortcut: '⌘A', action: 'selectall' }]], ['Tools', [{ label: 'Address Book', action: contacts }, { label: 'Accounts…', action: () => os.launch('cp:internet') }]]];
        const off = os.events.on('mail', render);
        win.onClose = off;
        render();
        return win;
    });
}
