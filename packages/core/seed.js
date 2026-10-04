export const CONTROL_PANELS = [
    ['appearance', 'Appearance', 'appearance'], ['apple-menu-options', 'Apple Menu Options', 'control'], ['appletalk', 'AppleTalk', 'network'], ['color-sync', 'ColorSync', 'color'], ['control-strip', 'Control Strip', 'control'], ['date-time', 'Date & Time', 'clock'], ['dial-assist', 'Dial Assist', 'network'], ['easy-access', 'Easy Access', 'access'], ['energy-saver', 'Energy Saver', 'energy'], ['extensions-manager', 'Extensions Manager', 'extensions'], ['file-sharing', 'File Sharing', 'network'], ['file-exchange', 'File Exchange', 'disk'], ['general-controls', 'General Controls', 'control'], ['internet', 'Internet', 'internet'], ['keyboard', 'Keyboard', 'keyboard'], ['keychain', 'Keychain Access', 'key'], ['launcher', 'Launcher', 'launcher'], ['location-manager', 'Location Manager', 'network'], ['memory', 'Memory', 'memory'], ['modem', 'Modem', 'network'], ['monitors', 'Monitors', 'monitor'], ['mouse', 'Mouse', 'mouse'], ['multiple-users', 'Multiple Users', 'users'], ['numbers', 'Numbers', 'calculator'], ['quicktime-settings', 'QuickTime Settings', 'quicktime'], ['remote-access', 'Remote Access', 'network'], ['software-update', 'Software Update', 'disk'], ['sound', 'Sound', 'sound'], ['speech', 'Speech', 'sound'], ['startup-disk', 'Startup Disk', 'disk'], ['tcp-ip', 'TCP/IP', 'network'], ['text', 'Text', 'text'], ['web-sharing', 'Web Sharing', 'internet']
];
export const APPLICATIONS = [
    ['simpletext', 'SimpleText', 'text'], ['sherlock', 'Sherlock 2', 'sherlock'], ['stickies', 'Stickies', 'stickies'], ['calculator', 'Calculator', 'calculator'], ['scrapbook', 'Scrapbook', 'scrapbook'], ['keycaps', 'Key Caps', 'keyboard'], ['quicktime', 'QuickTime Player', 'quicktime'], ['applecd', 'AppleCD Audio Player', 'cd'], ['simplesound', 'SimpleSound', 'sound'], ['graphing', 'Graphing Calculator', 'graph'], ['dvd', 'Apple DVD Player', 'cd'], ['video', 'Apple Video Player', 'video'], ['scripter', 'Script Editor', 'script'], ['profiler', 'Apple System Profiler', 'computer'], ['help', 'Mac Help', 'help'], ['network', 'Network Browser', 'network'], ['chooser', 'Chooser', 'chooser']
];
export const EXTRA_APPS = [['notepad', 'Note Pad', 'notepad'], ['puzzle', 'Puzzle', 'puzzle'], ['paint', 'Drawing Pad', 'paint'], ['disk-first-aid', 'Disk First Aid', 'firstaid'], ['drive-setup', 'Drive Setup', 'disk'], ['disk-copy', 'Disk Copy', 'disk'], ['fontbook', 'Font Viewer', 'text']];
export const INTERNET_APPS = [['browser', 'Internet Explorer', 'internet'], ['mail', 'Outlook Express', 'mail']];
const welcome = `Welcome to Mac OS 9\n\nYour Macintosh is ready.\n\nDouble-click Macintosh HD to explore your disk. Open the Apple menu to find your applications and control panels.\n\nA place for everything\nCreate folders, write a document in SimpleText, keep a thought in Stickies, or find a file with Sherlock 2. Drag files between windows to organize them.\n\nMake yourself at home\nOpen Appearance to choose a desktop picture and highlight color. Try the Control Strip at the lower left for quick access to sound and display settings.\n\nYour work is saved\nDocuments and preferences are saved automatically to this Macintosh disk. Use File → Export to download a document, or Special → Back Up Disk to keep a complete copy.\n\nA few useful shortcuts\n⌘N   New folder or document\n⌘O   Open the selected item\n⌘S   Save a document\n⌘W   Close a window\n⌘F   Find a file\n⌘I   Get Info\n⌘Q   Quit the current application\n\nOn Windows and Linux, use Control instead of Command.\n\nFor a tour and implementation details, choose Mac Help from the Help menu.\n`;
const readme = `Macintosh HD\n\nApplications — Your everyday Macintosh applications.\nDocuments — Your work, in one place.\nSystem Folder — Control Panels, Fonts, Extensions, and Preferences.\nApple Extras — Additional utilities and classic desk accessories.\nInternet — Internet Explorer and Outlook Express.\nUtilities — Disk utilities and Apple System Profiler.\n\nThis is a browser-native recreation of Mac OS 9. It opens its own documents and browser-supported text, image, audio, and video files. Original PowerPC/68k Macintosh executables, classic extensions, drivers, and hardware protocols require a machine emulator. See Mac Help for exact supported behavior.\n`;
export function createSeed() {
    const now = Date.now(), nodes = [];
    const add = (id, parent, name, type, extra = {}) => { const n = { id, parent, name, type, created: now, modified: now, label: 0, size: 0, ...extra }; if (n.content)
        n.size = new TextEncoder().encode(n.content).byteLength; nodes.push(n); return n; };
    add('disk', null, 'Macintosh HD', 'disk', { icon: 'disk' });
    add('desktop', null, 'Desktop', 'folder');
    add('trash', null, 'Trash', 'folder', { icon: 'trash' });
    for (const [id, name, icon] of [['system', 'System Folder', 'system'], ['applications', 'Applications', 'applications'], ['documents', 'Documents', 'folder'], ['extras', 'Apple Extras', 'extras'], ['internet-folder', 'Internet', 'internet-folder'], ['utilities', 'Utilities', 'utilities'], ['webpages', 'Web Pages', 'folder']])
        add(id, 'disk', name, 'folder', { icon });
    for (const [id, name, icon] of [['control-panels', 'Control Panels', 'control'], ['apple-menu', 'Apple Menu Items', 'apple'], ['extensions', 'Extensions', 'extensions'], ['preferences', 'Preferences', 'folder'], ['fonts', 'Fonts', 'text'], ['startup-items', 'Startup Items', 'folder'], ['shutdown-items', 'Shutdown Items', 'folder']])
        add(id, 'system', name, 'folder', { icon });
    add('pictures', 'documents', 'Pictures', 'folder');
    add('sounds', 'documents', 'Sounds', 'folder');
    for (const [id, name, icon] of APPLICATIONS)
        add(`app-${id}`, 'applications', name, 'application', { appId: id, icon, kind: 'application', size: 32768 });
    for (const [id, name, icon] of EXTRA_APPS)
        add(`app-${id}`, ['disk-first-aid', 'drive-setup', 'disk-copy', 'profiler'].includes(id) ? 'utilities' : 'extras', name, 'application', { appId: id, icon, kind: 'application', size: 32768 });
    for (const [id, name, icon] of INTERNET_APPS)
        add(`app-${id}`, 'internet-folder', name, 'application', { appId: id, icon, kind: 'application', size: 65536 });
    for (const [id, name, icon] of CONTROL_PANELS)
        add(`cp-${id}`, 'control-panels', name, 'application', { appId: `cp:${id}`, icon, kind: 'control panel', size: 16384 });
    for (const [name, icon] of [['Appearance Extension', 'appearance'], ['AppleScript', 'script'], ['CarbonLib', 'extensions'], ['ColorSync Extension', 'color'], ['DrawSprocketLib', 'extensions'], ['File Sharing Extension', 'network'], ['Open Transport', 'network'], ['QuickTime', 'quicktime'], ['QuickTime Musical Instruments', 'sound'], ['Shared Library Manager', 'extensions'], ['Sound Manager', 'sound'], ['Text Encoding Converter', 'text'], ['USB Device Extension', 'extensions']])
        add(`ext-${name}`, 'extensions', name, 'file', { kind: 'extension', icon, meta: { enabled: true }, size: 65536 });
    for (const name of ['Chicago', 'Charcoal', 'Geneva', 'Monaco', 'Times', 'Helvetica', 'Courier'])
        add(`font-${name}`, 'fonts', name, 'file', { kind: 'font', icon: 'text', content: name, size: 20480 });
    add('welcome', 'documents', 'Welcome to Mac OS 9', 'file', { kind: 'text', icon: 'text', content: welcome, meta: { font: 'Geneva', fontSize: 13 } });
    add('readme', 'disk', 'Read Me', 'file', { kind: 'text', icon: 'text', content: readme });
    add('welcome-alias', 'desktop', 'Welcome to Mac OS 9', 'alias', { target: 'welcome', icon: 'text', position: { x: -104, y: 196 } });
    add('internet-alias', 'desktop', 'Browse the Internet', 'alias', { target: 'app-browser', icon: 'internet', position: { x: -104, y: 118 } });
    add('docs-alias', 'desktop', 'Documents', 'alias', { target: 'documents', icon: 'folder', position: { x: -104, y: 274 } });
    add('sample-script', 'documents', 'Make a folder', 'file', { kind: 'script', icon: 'script', content: 'tell application "Finder"\n  make new folder at desktop with properties {name:"My New Folder"}\nend tell\ndisplay dialog "Your new folder is ready." buttons {"OK"}' });
    add('sample-html', 'webpages', 'My Home Page.html', 'file', { kind: 'html', icon: 'internet', mime: 'text/html', content: '<!doctype html><html><head><title>My Home Page</title></head><body style="font-family:Georgia;background:#ffffee;text-align:center;padding:40px"><h1>Welcome to my home page!</h1><hr><p>Made on a Macintosh.</p><p>Edit this page in SimpleText and open it in Internet Explorer.</p></body></html>' });
    return { version: 1, revision: 0, nodes };
}
