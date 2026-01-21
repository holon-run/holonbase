import { existsSync } from 'fs';
import { join } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { ConfigManager } from '../utils/config.js';
import { ChangeDetector } from '../core/changes.js';
import { SourceManager } from '../core/source-manager.js';
import { findHolonbaseRoot } from '../utils/repo.js';

export async function showStatus(): Promise<void> {
    const repoRoot = findHolonbaseRoot(process.cwd());
    if (!repoRoot) {
        console.error('Not a holonbase repository (or any parent up to mount point)');
        process.exit(1);
    }

    const holonDir = join(repoRoot, '.holonbase');
    const dbPath = join(holonDir, 'holonbase.db');
    const configPath = join(holonDir, 'config.json');

    const db = new HolonDatabase(dbPath);
    const config = new ConfigManager(configPath);
    const sourceManager = new SourceManager(db);

    const currentView = config.getCurrentView() || 'main';
    const view = db.getView(currentView);

    if (!view) {
        console.error(`Current view '${currentView}' not found`);
        db.close();
        process.exit(1);
    }

    console.log(`On view: ${currentView}`);
    console.log('');

    const sources = sourceManager.listSources();
    const detector = new ChangeDetector();
    let hasAnyChanges = false;

    for (const source of sources) {
        const adapter = sourceManager.getSource(source.name);
        const files = await adapter.scan();
        const pathIndex = db.getAllPathIndex(source.name);
        const changes = detector.detectChanges(files, pathIndex);

        if (detector.hasChanges(changes)) {
            hasAnyChanges = true;
            console.log(`Changes in source '${source.name}':`);

            // Show renamed files
            if (changes.renamed.length > 0) {
                console.log('  Renamed:');
                changes.renamed.forEach(r => {
                    console.log(`    ${r.oldPath} → ${r.newPath}`);
                });
            }

            // Show modified files
            if (changes.modified.length > 0) {
                console.log('  Modified:');
                changes.modified.forEach(m => {
                    console.log(`    ${m.path}  (${m.file.type})`);
                });
            }

            // Show deleted files
            if (changes.deleted.length > 0) {
                console.log('  Deleted:');
                changes.deleted.forEach(d => {
                    console.log(`    ${d.path}  (${d.objectType})`);
                });
            }

            // Show untracked files
            if (changes.added.length > 0) {
                console.log('  Untracked files:');
                console.log('    (use "holonbase sync" to track)');
                changes.added.forEach(f => {
                    console.log(`    ${f.path}  (${f.type})`);
                });
            }
            console.log('');
        }
    }

    if (!hasAnyChanges) {
        console.log('Nothing to sync, working directory clean');
    }

    db.close();
}
