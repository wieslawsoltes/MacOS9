import { EventBus, uid } from './index.js';
const ROOTS = new Set(['disk', 'desktop', 'trash']);
const TYPES = new Set(['disk', 'folder', 'file', 'application', 'alias']);
const clone = (x) => structuredClone(x);
/** Transactional hierarchical filesystem. Identifiers survive renames and moves. */
export class VirtualFileSystem extends EventBus {
    constructor(snapshot) { super(); this.nodes = new Map(); this.undoStack = []; this.redoStack = []; this.revision = 0; this.depth = 0; if (snapshot)
        this.load(snapshot); }
    load(snapshot) { const result = VirtualFileSystem.validate(snapshot); if (!result.valid)
        throw new Error(`The disk cannot be opened: ${result.errors.join('; ')}`); this.nodes = new Map(snapshot.nodes.map(node => [node.id, clone(node)])); this.revision = snapshot.revision || 0; this.undoStack = []; this.redoStack = []; this.emit('change', { label: 'Load disk', revision: this.revision }); }
    export() { return { version: 1, revision: this.revision, nodes: [...this.nodes.values()].map(clone) }; }
    get(id) { return this.nodes.get(id) || null; }
    require(id) { const node = this.get(id); if (!node)
        throw new Error('The item could not be found.'); return node; }
    children(parent) { return [...this.nodes.values()].filter(node => node.parent === parent); }
    resolve(id) { const visited = new Set(); let node = this.get(id); while (node?.type === 'alias') {
        if (visited.has(node.id))
            return null;
        visited.add(node.id);
        node = this.get(node.target);
    } return node; }
    path(id) { const parts = [], visited = new Set(); let node = this.get(id); while (node && !visited.has(node.id)) {
        visited.add(node.id);
        parts.unshift(node.name);
        node = this.get(node.parent);
    } return parts.join(':'); }
    findPath(path) { const parts = path.replace(/^\/+|\/+$/g, '').split(/[:/]/).filter(Boolean); let node = this.get('disk'); if (parts[0]?.toLowerCase() === node.name.toLowerCase())
        parts.shift(); for (const name of parts) {
        node = this.children(node.id).find(n => n.name.toLowerCase() === name.toLowerCase());
        if (!node)
            return null;
    } return node; }
    isDescendant(id, ancestor) { let node = this.get(id); const seen = new Set(); while (node && !seen.has(node.id)) {
        if (node.id === ancestor)
            return true;
        seen.add(node.id);
        node = this.get(node.parent);
    } return false; }
    uniqueName(parent, name, exclude) { const exists = n => this.children(parent).some(x => x.id !== exclude && x.name.toLocaleLowerCase() === n.toLocaleLowerCase()); if (!exists(name))
        return name; let i = 2; while (exists(`${name} ${i}`))
        i++; return `${name} ${i}`; }
    assertName(name) { if (typeof name !== 'string' || !name.trim() || /[:\u0000-\u001f]/.test(name) || name.length > 255)
        throw new Error('Use a name of 1–255 characters, without a colon.'); return name.trim(); }
    assertFolder(id) { const p = this.require(id); if (!['disk', 'folder'].includes(p.type))
        throw new Error('Choose a folder.'); if (p.locked)
        throw new Error('This folder is locked.'); return p; }
    mutate(label, operation) { if (this.depth)
        return operation(); const before = this.export(); this.depth++; try {
        const result = operation();
        this.revision++;
        this.undoStack.push({ label, snapshot: before });
        if (this.undoStack.length > 40)
            this.undoStack.shift();
        this.redoStack = [];
        this.emit('change', { label, revision: this.revision });
        return result;
    }
    catch (error) {
        this.nodes = new Map(before.nodes.map(n => [n.id, n]));
        throw error;
    }
    finally {
        this.depth--;
    } }
    create(parent, name, options = {}) { return this.mutate('New item', () => { this.assertFolder(parent); name = this.assertName(name); if (this.children(parent).some(n => n.name.toLowerCase() === name.toLowerCase()))
        throw new Error('An item with that name already exists in this folder.'); const now = Date.now(); const node = { id: uid(), parent, name, type: 'file', kind: 'text', content: '', size: 0, created: now, modified: now, label: 0, ...options }; if (!TYPES.has(node.type))
        throw new Error('Unknown file type.'); if (this.get(node.id))
        throw new Error('The item identifier is already in use.'); this.nodes.set(node.id, node); return node; }); }
    rename(id, name) { return this.mutate('Rename', () => { const n = this.require(id); if (n.locked)
        throw new Error('This item is locked.'); name = this.assertName(name); if (this.children(n.parent).some(x => x.id !== id && x.name.toLowerCase() === name.toLowerCase()))
        throw new Error('That name is already in use.'); n.name = name; n.modified = Date.now(); return n; }); }
    write(id, content, extra = {}) { return this.mutate('Save', () => { const n = this.require(id); if (n.type !== 'file')
        throw new Error('Choose a document, not a folder or application.'); if (n.locked)
        throw new Error('This document is locked.'); n.content = content; n.size = typeof content === 'string' ? new TextEncoder().encode(content).byteLength : 0; Object.assign(n, extra); n.modified = Date.now(); return n; }); }
    update(id, patch) { return this.mutate('Change item', () => { const n = this.require(id); for (const key of ['label', 'locked', 'comment', 'icon', 'meta', 'position', 'kind', 'mime'])
        if (key in patch)
            n[key] = clone(patch[key]); n.modified = Date.now(); return n; }); }
    move(id, parent) { return this.mutate('Move', () => { const n = this.require(id); this.assertFolder(parent); if (ROOTS.has(id))
        throw new Error('A disk or system location cannot be moved.'); if (n.locked)
        throw new Error('This item is locked.'); if (this.isDescendant(parent, id))
        throw new Error('A folder cannot be put inside itself.'); if (n.parent === parent)
        return n; n.name = this.uniqueName(parent, n.name); n.parent = parent; n.modified = Date.now(); delete n.position; return n; }); }
    copy(id, parent, name) { return this.mutate('Duplicate', () => { this.assertFolder(parent); const source = this.require(id); if (ROOTS.has(id))
        throw new Error('Choose a file or folder to duplicate.'); if (this.isDescendant(parent, id))
        throw new Error('A folder cannot be copied into itself.'); const duplicate = (original, newParent, newName) => { const n = clone(original); n.id = uid(); n.parent = newParent; n.name = newName; n.locked = false; n.created = n.modified = Date.now(); delete n.position; this.nodes.set(n.id, n); for (const child of this.children(original.id))
        duplicate(child, n.id, child.name); return n; }; return duplicate(source, parent, this.uniqueName(parent, name ?? `${source.name} copy`)); }); }
    alias(id, parent = 'desktop') { const n = this.require(id); return this.create(parent, this.uniqueName(parent, `${n.name} alias`), { type: 'alias', target: id, icon: n.icon, kind: n.kind }); }
    trash(id) { return this.mutate('Move to Trash', () => { const n = this.require(id); if (ROOTS.has(id))
        throw new Error('This system location cannot be put in the Trash.'); if (n.parent === 'trash')
        return n; const originalParent = n.parent; this.move(id, 'trash'); n.originalParent = originalParent; return n; }); }
    restore(id) { return this.mutate('Put Away', () => { const n = this.require(id); const target = this.get(n.originalParent)?.id ?? 'desktop'; this.move(id, target); delete n.originalParent; return n; }); }
    remove(id) { return this.mutate('Delete', () => { const n = this.require(id); if (ROOTS.has(id))
        throw new Error('This system location cannot be erased.'); if (n.locked)
        throw new Error('This item is locked.'); const all = [...this.nodes.keys()].filter(x => this.isDescendant(x, id)); for (const child of all)
        this.nodes.delete(child); }); }
    emptyTrash() { return this.mutate('Empty Trash', () => { for (const n of this.children('trash'))
        this.remove(n.id); }); }
    undo() { const change = this.undoStack.pop(); if (!change)
        return false; this.redoStack.push({ label: change.label, snapshot: this.export() }); this.nodes = new Map(change.snapshot.nodes.map(n => [n.id, clone(n)])); this.revision++; this.emit('change', { label: `Undo ${change.label}`, revision: this.revision }); return true; }
    redo() { const change = this.redoStack.pop(); if (!change)
        return false; this.undoStack.push({ label: change.label, snapshot: this.export() }); this.nodes = new Map(change.snapshot.nodes.map(n => [n.id, clone(n)])); this.revision++; this.emit('change', { label: `Redo ${change.label}`, revision: this.revision }); return true; }
    search(query, { contents = false, kind, scope, label } = {}) { const needle = query.toLocaleLowerCase(); return [...this.nodes.values()].filter(n => !ROOTS.has(n.id) && !this.isDescendant(n.id, 'trash') && (!kind || n.type === kind || n.kind === kind) && (!scope || this.isDescendant(n.id, scope)) && (label == null || n.label === label) && (n.name.toLocaleLowerCase().includes(needle) || (contents && typeof n.content === 'string' && n.content.toLocaleLowerCase().includes(needle)))); }
    size(id) { return [...this.nodes.values()].filter(n => this.isDescendant(n.id, id)).reduce((sum, n) => sum + (n.size || 0), 0); }
    static validate(snapshot) { const errors = []; if (snapshot?.version !== 1 || !Array.isArray(snapshot.nodes) || snapshot.nodes.length > 25000)
        return { valid: false, errors: ['Invalid disk format'] }; const ids = new Map(); for (const n of snapshot.nodes) {
        if (!n || typeof n.id !== 'string' || typeof n.name !== 'string' || !TYPES.has(n.type)) {
            errors.push('Invalid item');
            continue;
        }
        if (ids.has(n.id))
            errors.push('Duplicate item identifier');
        ids.set(n.id, n);
    } for (const id of ROOTS)
        if (!ids.has(id))
            errors.push(`Missing ${id}`); const names = new Set(); for (const n of ids.values()) {
        if (n.parent && !ids.has(n.parent))
            errors.push(`Missing parent for ${n.name}`);
        if (n.parent && ids.has(n.parent) && !['folder', 'disk'].includes(ids.get(n.parent).type))
            errors.push(`Invalid parent for ${n.name}`);
        const seen = new Set();
        let p = n;
        while (p) {
            if (seen.has(p.id)) {
                errors.push(`Circular folder ${n.name}`);
                break;
            }
            seen.add(p.id);
            p = ids.get(p.parent);
        }
        const key = `${n.parent}/${n.name.toLocaleLowerCase()}`;
        if (names.has(key))
            errors.push(`Duplicate name ${n.name}`);
        names.add(key);
    } return { valid: errors.length === 0, errors: [...new Set(errors)] }; }
}
