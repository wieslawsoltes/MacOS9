/** Small, explicit AppleScript-compatible command subset, operating through OS services. */
const supported = [/^tell application\s+"[^"]+"$/i, /^end tell$/i, /^display dialog\s+"[\s\S]*"(?:\s+buttons\s+\{.*\})?$/i, /^say\s+".*"$/i, /^beep(?:\s+\d+)?$/i, /^delay\s+[\d.]+$/i, /^set\s+\w+\s+to\s+.+$/i, /^get\s+.+$/i, /^open\s+.+$/i, /^make new folder\s+.+$/i, /^make new file\s+.+$/i, /^delete\s+.+$/i, /^activate$/i, /^repeat\s+\d+\s+times$/i, /^end repeat$/i, /^return\s+.+$/i];
export function compileScript(source) { if (source.length > 50000)
    throw new Error('Script is too large.'); const lines = source.split(/\r?\n/).map((text, index) => ({ text: text.trim(), line: index + 1 })).filter(x => x.text && !x.text.startsWith('--')); const stack = []; for (const line of lines) {
    if (!supported.some(re => re.test(line.text)))
        throw new Error(`Line ${line.line}: unsupported statement. See Mac Help → AppleScript.`);
    if (/^repeat /i.test(line.text) || /^tell /i.test(line.text))
        stack.push(line);
    if (/^end repeat|^end tell/i.test(line.text)) {
        const start = stack.pop();
        if (!start || (/repeat/i.test(start.text) !== /repeat/i.test(line.text)))
            throw new Error(`Line ${line.line}: unmatched end.`);
    }
} if (stack.length)
    throw new Error(`Line ${stack.at(-1).line}: missing end.`); return lines; }
export async function runScript(source, os, { signal, onResult } = {}) {
    const lines = compileScript(source), vars = new Map(), results = [];
    let application = 'Finder', steps = 0;
    const output = value => { results.push(String(value)); onResult?.(String(value)); };
    const textValue = raw => { const s = raw.trim(); if (s.startsWith('"') && s.endsWith('"'))
        return s.slice(1, -1); if (vars.has(s))
        return vars.get(s); if (/^\d+(?:\.\d+)?$/.test(s))
        return Number(s); return s; };
    const location = raw => /desktop/i.test(raw) ? 'desktop' : /documents/i.test(raw) ? 'documents' : os.vfs.findPath(raw.match(/"([^"]+)"/)?.[1] ?? raw)?.id ?? 'disk';
    async function execute(from, to) { for (let i = from; i < to; i++) {
        if (signal?.aborted)
            throw new Error('Script stopped.');
        if (++steps > 1000)
            throw new Error('Script exceeded 1,000 steps.');
        const text = lines[i].text;
        let match;
        if (match = text.match(/^repeat\s+(\d+)\s+times$/i)) {
            let end = i + 1, depth = 1;
            while (end < to && depth) {
                if (/^repeat /i.test(lines[end].text))
                    depth++;
                if (/^end repeat$/i.test(lines[end].text))
                    depth--;
                if (depth)
                    end++;
            }
            const count = Number(match[1]);
            if (count > 100)
                throw new Error('Repeat at most 100 times.');
            for (let n = 0; n < count; n++)
                await execute(i + 1, end);
            i = end;
            continue;
        }
        if (match = text.match(/^tell application\s+"([^"]+)"$/i)) {
            application = match[1];
            continue;
        }
        if (/^end tell|^end repeat$/i.test(text))
            continue;
        if (/^activate$/i.test(text)) {
            const app = [...os.registry.values()].find(a => a.title.toLowerCase() === application.toLowerCase());
            if (application.toLowerCase() === 'finder')
                os.wm.focusDesktop();
            else if (app)
                await os.launch(app.id);
            continue;
        }
        if (match = text.match(/^display dialog\s+"(.*?)"(?:\s+buttons\s+\{.*\})?$/i)) {
            await os.alert(match[1], application);
            output('button returned: OK');
            continue;
        }
        if (match = text.match(/^say\s+"(.*)"$/i)) {
            speechSynthesis.speak(new SpeechSynthesisUtterance(match[1]));
            continue;
        }
        if (/^beep/i.test(text)) {
            os.sound.beep();
            continue;
        }
        if (match = text.match(/^delay\s+([\d.]+)/i)) {
            await new Promise((resolve, reject) => { const timer = setTimeout(resolve, Math.min(5000, Number(match[1]) * 1000)); signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Script stopped.')); }, { once: true }); });
            continue;
        }
        if (match = text.match(/^make new (folder|file).*?at\s+(.*?)(?:\s+with properties\s+\{name:\s*"([^"]+)"\})?$/i)) {
            const parent = location(match[2]), name = match[3] ?? (match[1].toLowerCase() === 'folder' ? 'untitled folder' : 'Untitled');
            const n = os.vfs.create(parent, name, { type: match[1].toLowerCase() === 'folder' ? 'folder' : 'file', kind: 'text', icon: match[1].toLowerCase() === 'folder' ? 'folder' : 'text' });
            output(os.vfs.path(n.id));
            continue;
        }
        if (match = text.match(/^open\s+(.+)$/i)) {
            const id = location(match[1]);
            await os.openNode(id);
            output(`Opened ${os.vfs.path(id)}`);
            continue;
        }
        if (match = text.match(/^get name of every (?:file|folder|item) (?:of|in) (.+)$/i)) {
            output(os.vfs.children(location(match[1])).map(n => n.name).join(', '));
            continue;
        }
        if (match = text.match(/^get (.+)$/i)) {
            output(textValue(match[1]));
            continue;
        }
        if (match = text.match(/^set (\w+) to (.+)$/i)) {
            vars.set(match[1], textValue(match[2]));
            continue;
        }
        if (match = text.match(/^return (.+)$/i)) {
            output(textValue(match[1]));
            return;
        }
        if (match = text.match(/^delete (.+)$/i)) {
            const path = match[1].match(/"([^"]+)"/)?.[1];
            const n = path && os.vfs.findPath(path);
            if (!n)
                throw new Error('The item to delete was not found.');
            os.vfs.trash(n.id);
            output('Moved to Trash');
            continue;
        }
    } }
    await execute(0, lines.length);
    return results.join('\n') || 'Script completed.';
}
