import { join } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { SourceManager } from '../core/source-manager.js';
import { ContentProcessor } from '../processors/content.js';
import { PatchManager } from '../core/patch.js';
import { SyncEngine, SyncResult } from '../core/sync-engine.js';
import { findHolonbaseRoot } from '../utils/repo.js';
import { ConfigManager } from '../utils/config.js';

export interface SyncOptions {
    message?: string;
    source?: string;
}

/**
 * Sync command handler
 */
export async function syncCommand(options: SyncOptions): Promise<void> {
    const repoRoot = findHolonbaseRoot(process.cwd());
    if (!repoRoot) {
        throw new Error('Not a holonbase repository (or any parent up to mount point)');
    }

    const holonDir = join(repoRoot, '.holonbase');
    const dbPath = join(holonDir, 'holonbase.db');
    const configPath = join(holonDir, 'config.json');

    const db = new HolonDatabase(dbPath);
    const config = new ConfigManager(configPath);
    const sourceManager = new SourceManager(db);
    const processor = new ContentProcessor();
    const patchManager = new PatchManager(db);
    const syncEngine = new SyncEngine(db, sourceManager, processor, patchManager, config);

    try {
        let results: SyncResult[];
        if (options.source) {
            const result = await syncEngine.syncSource(options.source, options.message);
            results = [result];
        } else {
            results = await syncEngine.syncAll(options.message);
        }

        let totalChanges = 0;
        console.log('Sync results:');
        for (const res of results) {
            const count = res.added + res.modified + res.deleted + res.renamed;
            totalChanges += count;
            if (count > 0 || options.source) {
                console.log(`  ${res.sourceName.padEnd(15)}: ${count} changes (${res.added} added, ${res.modified} modified, ${res.deleted} deleted, ${res.renamed} renamed)`);
            }
        }

        if (totalChanges === 0) {
            console.log('  No changes detected in any source');
        } else {
            console.log(`\n✓ Total: ${totalChanges} changes synced`);
        }
    } finally {
        db.close();
    }
}
