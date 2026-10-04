import { EventBus, uid } from '@platinum/core';
/** Versioned cloud snapshots, an offline mirror, and a separate recovery journal per tab. */
export class DiskStore extends EventBus {
    constructor() {
        super();
        this.database = null;
        this.databasePromise = null;
        this.version = 0;
        this.pending = null;
        this.saving = null;
        this.conflict = false;
        this.status = 'Opening disk';
        this.timer = null;
        this.cacheQueue = Promise.resolve();
        this.disposed = false;
        this.diskId = localStorage.getItem('platinum.diskId') || uid();
        localStorage.setItem('platinum.diskId', this.diskId);
        this.sessionId = sessionStorage.getItem('platinum.sessionId') || uid();
        sessionStorage.setItem('platinum.sessionId', this.sessionId);
        this.journalKey = `journal:${this.diskId}:${this.sessionId}`;
        this.headers = { 'content-type': 'application/json', 'x-platinum-disk': this.diskId };
        this.abort = new AbortController();
        window.addEventListener('online', () => this.flush(), { signal: this.abort.signal });
    }
    setStatus(status) { this.status = status; this.emit('status', status); }
    async db() {
        if (this.database)
            return this.database;
        if (!this.databasePromise)
            this.databasePromise = new Promise((resolve, reject) => {
                const request = indexedDB.open('platinum-macintosh', 1);
                request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
                request.onsuccess = () => { this.database = request.result; resolve(this.database); };
                request.onerror = () => { this.databasePromise = null; reject(request.error); };
            });
        return this.databasePromise;
    }
    async localGet() {
        try {
            const db = await this.db();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction('snapshots'), store = tx.objectStore('snapshots');
                const journal = store.get(this.journalKey), mirror = store.get(this.diskId);
                const all = store.getAll(), keys = store.getAllKeys();
                tx.oncomplete = () => {
                    this.recoveries = all.result.map((value, index) => ({ value, key: keys.result[index] }))
                        .filter(item => item.key !== this.journalKey && String(item.key).startsWith(`journal:${this.diskId}:`) && item.value?.dirty)
                        .sort((a, b) => (b.value.updated ?? 0) - (a.value.updated ?? 0));
                    if (journal.result?.dirty) {
                        resolve(journal.result);
                        return;
                    }
                    resolve(mirror.result);
                };
                tx.onerror = () => reject(tx.error);
            });
        }
        catch {
            return null;
        }
    }
    localPut(value) {
        const copy = structuredClone({ ...value, updated: Date.now(), generation: uid() });
        this.cacheQueue = this.cacheQueue.catch(() => { }).then(async () => {
            const db = await this.db();
            await new Promise((resolve, reject) => {
                const tx = db.transaction('snapshots', 'readwrite'), store = tx.objectStore('snapshots');
                if (copy.dirty)
                    store.put(copy, this.journalKey);
                else {
                    store.put(copy, this.diskId);
                    store.delete(this.journalKey);
                    if (this.adoptedRecovery) {
                        const recovery = this.adoptedRecovery, read = store.get(recovery.key);
                        read.onsuccess = () => { if (read.result?.generation === recovery.value.generation && read.result?.updated === recovery.value.updated)
                            store.delete(recovery.key); };
                    }
                }
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
            this.cacheFailed = false;
            return true;
        }).catch(error => { this.cacheFailed = true; this.setStatus('Local cache unavailable'); this.emit('error', error); return false; });
        return this.cacheQueue;
    }
    async load() {
        const local = await this.localGet();
        this.version = local?.version ?? 0;
        try {
            const response = await fetch('/api/disk', { headers: this.headers, signal: AbortSignal.timeout(4500) });
            if (!response.ok)
                throw new Error('Cloud disk unavailable');
            const remote = await response.json();
            if (local?.dirty) {
                this.pending = local.payload;
                if (remote.payload && local.version !== remote.version) {
                    this.conflict = true;
                    this.setStatus('Disk changed in another window');
                    return local.payload;
                }
                this.version = remote.version;
                this.setStatus('Saving local changes');
                void this.flush();
                return local.payload;
            }
            this.version = remote.version;
            if (remote.payload) {
                await this.localPut({ ...remote, dirty: false });
                this.setStatus('All changes saved');
                return remote.payload;
            }
            if (local?.payload) {
                this.pending = local.payload;
                void this.flush();
                return local.payload;
            }
            this.setStatus('Ready');
            return null;
        }
        catch {
            if (local?.dirty)
                this.pending = local.payload;
            this.setStatus('Saved on this device');
            return local?.payload ?? null;
        }
    }
    schedule(payload) {
        this.pending = structuredClone(payload);
        const cached = this.localPut({ payload: this.pending, version: this.version, dirty: true });
        this.setStatus(this.conflict ? 'Disk changed in another window' : 'Saving…');
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), 850);
        return cached;
    }
    async flush() {
        clearTimeout(this.timer);
        if (this.saving)
            return this.saving;
        if (this.conflict || !this.pending)
            return !this.conflict;
        this.saving = (async () => {
            while (this.pending && !this.conflict) {
                const payload = this.pending;
                this.pending = null;
                try {
                    await this.cacheQueue;
                    const response = await fetch('/api/disk', { method: 'PUT', headers: this.headers, body: JSON.stringify({ expectedVersion: this.version, payload }), signal: AbortSignal.timeout(15000) });
                    if (response.status === 409) {
                        this.conflict = true;
                        this.pending = this.pending ?? payload;
                        await this.localPut({ payload: this.pending, version: this.version, dirty: true });
                        this.setStatus('Disk changed in another window');
                        this.emit('conflict', this.pending);
                        return false;
                    }
                    if (!response.ok)
                        throw new Error(`Disk save failed (${response.status})`);
                    const result = await response.json();
                    this.version = result.version;
                    await this.localPut({ payload: this.pending ?? payload, version: this.version, dirty: !!this.pending });
                    this.setStatus(this.pending ? 'Saving…' : 'All changes saved');
                }
                catch {
                    this.pending = this.pending ?? payload;
                    const cached = await this.localPut({ payload: this.pending, version: this.version, dirty: true });
                    this.setStatus(cached === false ? 'Unsaved changes — download a backup' : 'Saved on this device');
                    if (cached === false)
                        this.emit('unpersisted', this.pending);
                    return false;
                }
            }
            return true;
        })();
        try {
            return await this.saving;
        }
        finally {
            this.saving = null;
        }
    }
    async resolveConflict() {
        const response = await fetch('/api/disk', { headers: this.headers });
        if (!response.ok)
            throw new Error('Could not read the cloud disk.');
        return response.json();
    }
    async adoptCloudSnapshot(snapshot) {
        clearTimeout(this.timer);
        if (this.saving)
            await this.saving;
        this.pending = null;
        this.version = snapshot.version;
        this.conflict = false;
        await this.localPut({ ...snapshot, dirty: false });
        this.setStatus('All changes saved');
    }
    dispose() { this.disposed = true; clearTimeout(this.timer); this.abort.abort(); this.cacheQueue.finally(() => this.database?.close()); }
}
