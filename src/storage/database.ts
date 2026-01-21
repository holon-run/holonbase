import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export class HolonDatabase {
    private db: Database.Database;

    constructor(dbPath: string) {
        // Ensure directory exists
        const dir = dirname(dbPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
    }

    /**
     * Initialize database schema
     */
    initialize(): void {
        this.db.exec(`
      -- Data sources
      CREATE TABLE IF NOT EXISTS sources (
        name TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        config JSON NOT NULL,
        last_sync TEXT,
        created_at TEXT NOT NULL
      );

      -- Unified object storage
      CREATE TABLE IF NOT EXISTS objects (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content JSON NOT NULL,
        source TEXT,
        hash TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        embedding BLOB
      );

      CREATE INDEX IF NOT EXISTS idx_objects_type ON objects(type);
      CREATE INDEX IF NOT EXISTS idx_objects_source ON objects(source);
      CREATE INDEX IF NOT EXISTS idx_objects_hash ON objects(hash);

      -- Patch-specific indexes
      CREATE INDEX IF NOT EXISTS idx_patch_parent ON objects(
        json_extract(content, '$.parentId')
      ) WHERE type = 'patch';

      CREATE INDEX IF NOT EXISTS idx_patch_target ON objects(
        json_extract(content, '$.target')
      ) WHERE type = 'patch';

      CREATE INDEX IF NOT EXISTS idx_patch_agent ON objects(
        json_extract(content, '$.agent')
      ) WHERE type = 'patch';

      -- State view cache (materialized view)
      CREATE TABLE IF NOT EXISTS state_view (
        object_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content JSON NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_state_view_type ON state_view(type);

      -- Configuration
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Views (workspace branches)
      CREATE TABLE IF NOT EXISTS views (
        name TEXT PRIMARY KEY,
        head_patch_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Path index for multi-source tracking
      CREATE TABLE IF NOT EXISTS path_index (
        path TEXT NOT NULL,
        source TEXT NOT NULL,
        content_id TEXT NOT NULL,
        object_type TEXT NOT NULL,
        size INTEGER,
        mtime TEXT,
        tracked_at TEXT NOT NULL,
        PRIMARY KEY (path, source)
      );

      CREATE INDEX IF NOT EXISTS idx_path_index_content ON path_index(content_id);
      CREATE INDEX IF NOT EXISTS idx_path_index_source ON path_index(source);

      -- Initialize HEAD if not exists
      INSERT OR IGNORE INTO config (key, value) VALUES ('head', '');
      
      -- Initialize main view if not exists
      INSERT OR IGNORE INTO views (name, head_patch_id, created_at, updated_at)
      VALUES ('main', '', datetime('now'), datetime('now'));
    `);
    }

    /**
     * Insert an object
     */
    insertObject(
        id: string,
        type: string,
        content: any,
        createdAt: string,
        source?: string,
        hash?: string
    ): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(
            'INSERT INTO objects (id, type, content, source, hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        stmt.run(id, type, JSON.stringify(content), source || null, hash || null, createdAt, now);
    }

    /**
     * Get an object by ID
     */
    getObject(id: string): any | null {
        const stmt = this.db.prepare('SELECT * FROM objects WHERE id = ?');
        const row = stmt.get(id) as any;
        if (!row) return null;
        return {
            id: row.id,
            type: row.type,
            content: JSON.parse(row.content),
            createdAt: row.created_at,
        };
    }

    /**
     * Get all objects of a specific type
     */
    getObjectsByType(type: string): any[] {
        const stmt = this.db.prepare('SELECT * FROM objects WHERE type = ?');
        const rows = stmt.all(type) as any[];
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            content: JSON.parse(row.content),
            createdAt: row.created_at,
        }));
    }

    /**
     * Get patches by target object ID
     */
    getPatchesByTarget(targetId: string): any[] {
        const stmt = this.db.prepare(`
      SELECT * FROM objects 
      WHERE type = 'patch' 
      AND json_extract(content, '$.target') = ?
      ORDER BY created_at ASC
    `);
        const rows = stmt.all(targetId) as any[];
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            content: JSON.parse(row.content),
            createdAt: row.created_at,
        }));
    }

    /**
     * Get all patches ordered by timestamp
     */
    getAllPatches(limit?: number): any[] {
        const sql = `
      SELECT * FROM objects 
      WHERE type = 'patch' 
      ORDER BY created_at DESC
      ${limit ? `LIMIT ${limit}` : ''}
    `;
        const rows = this.db.prepare(sql).all() as any[];
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            content: JSON.parse(row.content),
            createdAt: row.created_at,
        }));
    }

    /**
     * Get config value
     */
    getConfig(key: string): string | null {
        const stmt = this.db.prepare('SELECT value FROM config WHERE key = ?');
        const row = stmt.get(key) as any;
        return row ? row.value : null;
    }

    /**
     * Set config value
     */
    setConfig(key: string, value: string): void {
        const stmt = this.db.prepare(
            'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)'
        );
        stmt.run(key, value);
    }

    /**
     * Update state view
     */
    upsertStateView(
        objectId: string,
        type: string,
        content: any,
        isDeleted: boolean,
        updatedAt: string
    ): void {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO state_view 
      (object_id, type, content, is_deleted, updated_at) 
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(objectId, type, JSON.stringify(content), isDeleted ? 1 : 0, updatedAt);
    }

    /**
     * Get state view object
     */
    getStateViewObject(objectId: string): any | null {
        const stmt = this.db.prepare(
            'SELECT * FROM state_view WHERE object_id = ? AND is_deleted = 0'
        );
        const row = stmt.get(objectId) as any;
        if (!row) return null;
        return {
            id: row.object_id,
            type: row.type,
            content: JSON.parse(row.content),
            updatedAt: row.updated_at,
        };
    }

    /**
     * Get all state view objects
     */
    getAllStateViewObjects(type?: string): any[] {
        const sql = type
            ? 'SELECT * FROM state_view WHERE type = ? AND is_deleted = 0'
            : 'SELECT * FROM state_view WHERE is_deleted = 0';
        const stmt = this.db.prepare(sql);
        const rows = (type ? stmt.all(type) : stmt.all()) as any[];
        return rows.map(row => ({
            id: row.object_id,
            type: row.type,
            content: JSON.parse(row.content),
            updatedAt: row.updated_at,
        }));
    }

    /**
     * Create a new view
     */
    createView(name: string, headPatchId: string): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(
            'INSERT INTO views (name, head_patch_id, created_at, updated_at) VALUES (?, ?, ?, ?)'
        );
        stmt.run(name, headPatchId, now, now);
    }

    /**
     * Get a view by name
     */
    getView(name: string): any | null {
        const stmt = this.db.prepare('SELECT * FROM views WHERE name = ?');
        const row = stmt.get(name) as any;
        if (!row) return null;
        return {
            name: row.name,
            headPatchId: row.head_patch_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    /**
     * Get all views
     */
    getAllViews(): any[] {
        const stmt = this.db.prepare('SELECT * FROM views ORDER BY name');
        const rows = stmt.all() as any[];
        return rows.map(row => ({
            name: row.name,
            headPatchId: row.head_patch_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    }

    /**
     * Update view's HEAD
     */
    updateView(name: string, headPatchId: string): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(
            'UPDATE views SET head_patch_id = ?, updated_at = ? WHERE name = ?'
        );
        stmt.run(headPatchId, now, name);
    }

    /**
     * Delete a view
     */
    deleteView(name: string): void {
        const stmt = this.db.prepare('DELETE FROM views WHERE name = ?');
        stmt.run(name);
    }

    /**
     * Insert or update path index entry
     */
    upsertPathIndex(
        path: string,
        source: string,
        contentId: string,
        objectType: string,
        size: number,
        mtime: string
    ): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO path_index 
      (path, source, content_id, object_type, size, mtime, tracked_at) 
      VALUES (?, ?, ?, ?, ?, ?, COALESCE(
        (SELECT tracked_at FROM path_index WHERE path = ? AND source = ?),
        ?
      ))
    `);
        stmt.run(path, source, contentId, objectType, size, mtime, path, source, now);
    }

    /**
     * Get path index entry by path and source
     */
    getPathIndex(path: string, source: string): any | null {
        const stmt = this.db.prepare('SELECT * FROM path_index WHERE path = ? AND source = ?');
        const row = stmt.get(path, source) as any;
        if (!row) return null;
        return {
            path: row.path,
            source: row.source,
            contentId: row.content_id,
            objectType: row.object_type,
            size: row.size,
            mtime: row.mtime,
            trackedAt: row.tracked_at,
        };
    }

    /**
     * Get all path index entries (optionally filtered by source)
     */
    getAllPathIndex(source?: string): any[] {
        const sql = source
            ? 'SELECT * FROM path_index WHERE source = ? ORDER BY path'
            : 'SELECT * FROM path_index ORDER BY path';
        const stmt = this.db.prepare(sql);
        const rows = (source ? stmt.all(source) : stmt.all()) as any[];
        return rows.map(row => ({
            path: row.path,
            source: row.source,
            contentId: row.content_id,
            objectType: row.object_type,
            size: row.size,
            mtime: row.mtime,
            trackedAt: row.tracked_at,
        }));
    }

    /**
     * Delete path index entry
     */
    deletePathIndex(path: string, source: string): void {
        const stmt = this.db.prepare('DELETE FROM path_index WHERE path = ? AND source = ?');
        stmt.run(path, source);
    }

    /**
     * Get paths by content ID (for rename detection)
     */
    getPathsByContentId(contentId: string): string[] {
        const stmt = this.db.prepare('SELECT path FROM path_index WHERE content_id = ?');
        const rows = stmt.all(contentId) as any[];
        return rows.map(row => row.path);
    }

    /**
     * Insert a source
     */
    insertSource(name: string, type: string, config: any): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(
            'INSERT INTO sources (name, type, config, created_at) VALUES (?, ?, ?, ?)'
        );
        stmt.run(name, type, JSON.stringify(config), now);
    }

    /**
     * Get a source by name
     */
    getSource(name: string): any | null {
        const stmt = this.db.prepare('SELECT * FROM sources WHERE name = ?');
        const row = stmt.get(name) as any;
        if (!row) return null;
        return {
            name: row.name,
            type: row.type,
            config: JSON.parse(row.config),
            lastSync: row.last_sync,
            createdAt: row.created_at,
        };
    }

    /**
     * Get all sources
     */
    getAllSources(): any[] {
        const stmt = this.db.prepare('SELECT * FROM sources ORDER BY name');
        const rows = stmt.all() as any[];
        return rows.map(row => ({
            name: row.name,
            type: row.type,
            config: JSON.parse(row.config),
            lastSync: row.last_sync,
            createdAt: row.created_at,
        }));
    }

    /**
     * Update source last sync time
     */
    updateSourceLastSync(name: string): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare('UPDATE sources SET last_sync = ? WHERE name = ?');
        stmt.run(now, name);
    }

    /**
     * Delete a source
     */
    deleteSource(name: string): void {
        const stmt = this.db.prepare('DELETE FROM sources WHERE name = ?');
        stmt.run(name);
    }

    /**
     * Close database
     */
    close(): void {
        this.db.close();
    }
}
