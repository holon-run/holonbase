import { existsSync } from 'fs';
import { join } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { ConfigManager } from '../utils/config.js';
import { WorkspaceScanner } from '../core/workspace.js';
import { ChangeDetector } from '../core/changes.js';

export function showStatus(): void {
    const holonDir = join(process.cwd(), '.holonbase');

    if (!existsSync(holonDir)) {
        console.error('Not a holonbase repository (or any parent up to mount point)');
        console.error('Run "holonbase init" to initialize a repository');
        process.exit(1);
    }

    const dbPath = join(holonDir, 'holonbase.db');
    const configPath = join(holonDir, 'config.json');

    const db = new HolonDatabase(dbPath);
    const config = new ConfigManager(configPath);

    const currentView = config.getCurrentView();
    const view = db.getView(currentView);

    if (!view) {
        console.error(`Current view '${currentView}' not found`);
        db.close();
        process.exit(1);
    }

    // Scan workspace
    const scanner = new WorkspaceScanner(process.cwd());
    const workspaceFiles = scanner.scanDirectory();

    // Get path index
    const pathIndex = db.getAllPathIndex();

    // Detect changes
    const detector = new ChangeDetector();
    const changes = detector.detectChanges(workspaceFiles, pathIndex);

    // Display status
    console.log(`On view: ${currentView}`);
    console.log('');

    // Show renamed files
    if (changes.renamed.length > 0) {
        console.log('Renamed:');
        changes.renamed.forEach(r => {
            console.log(`  ${r.oldPath} → ${r.newPath}`);
        });
        console.log('');
    }

    // Show modified files
    if (changes.modified.length > 0) {
        console.log('Modified:');
        changes.modified.forEach(m => {
            console.log(`  ${m.path}  (${m.file.type})`);
        });
        console.log('');
    }

    // Show deleted files
    if (changes.deleted.length > 0) {
        console.log('Deleted:');
        changes.deleted.forEach(d => {
            console.log(`  ${d.path}  (${d.objectType})`);
        });
        console.log('');
    }

    // Show untracked files
    if (changes.added.length > 0) {
        console.log('Untracked files:');
        console.log('  (use "holonbase commit" to track)');
        console.log('');
        changes.added.forEach(f => {
            console.log(`  ${f.path}  (${f.type})`);
        });
        console.log('');
    }

    // Summary
    if (!detector.hasChanges(changes)) {
        console.log('Nothing to commit, working directory clean');
    }

    db.close();
}
