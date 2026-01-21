import { join } from 'path';
import { readFileSync } from 'fs';
import { HolonDatabase } from '../storage/database.js';
import { PatchManager } from '../core/patch.js';
import { findHolonbaseRoot } from '../utils/repo.js';
import { ConfigManager } from '../utils/config.js';
import { WorkspaceScanner } from '../core/workspace.js';
import { ChangeDetector } from '../core/changes.js';

export interface CommitOptions {
    message?: string;
}

export async function commitPatch(options: CommitOptions): Promise<void> {
    // Find repository root
    const repoRoot = findHolonbaseRoot(process.cwd());
    if (!repoRoot) {
        throw new Error('Not a holonbase repository (or any parent up to mount point)');
    }

    const dbPath = join(repoRoot, '.holonbase', 'holonbase.db');
    const configPath = join(repoRoot, '.holonbase', 'config.json');

    const db = new HolonDatabase(dbPath);
    const config = new ConfigManager(configPath);
    const patchManager = new PatchManager(db);

    // Get current view
    const currentView = config.getCurrentView();

    // Scan workspace
    const scanner = new WorkspaceScanner(repoRoot);
    const workspaceFiles = scanner.scanDirectory();

    // Get path index
    const pathIndex = db.getAllPathIndex();

    // Detect changes
    const detector = new ChangeDetector();
    const changes = detector.detectChanges(workspaceFiles, pathIndex);

    // Check if there are changes
    if (!detector.hasChanges(changes)) {
        console.log('Nothing to commit, working directory clean');
        db.close();
        return;
    }

    const message = options.message || 'Update workspace';
    const agent = config.getDefaultAgent() || 'user/local';

    let patchCount = 0;

    // Process added files
    for (const file of changes.added) {
        // Read file content
        const content = readFileSync(file.absolutePath, 'utf-8');

        // Create add patch
        const patch = patchManager.commit(
            {
                op: 'add',
                agent,
                target: file.path,
                payload: {
                    object: {
                        type: file.type,
                        content: {
                            title: file.path,
                            body: content,
                        },
                    },
                },
                note: message,
            },
            currentView
        );

        // Update path index
        db.upsertPathIndex(file.path, file.contentId, file.type, file.size, file.mtime);
        patchCount++;
    }

    // Process modified files
    for (const modified of changes.modified) {
        // Read file content
        const content = readFileSync(modified.file.absolutePath, 'utf-8');

        // Create update patch
        const patch = patchManager.commit(
            {
                op: 'update',
                agent,
                target: modified.path,
                payload: {
                    changes: {
                        body: content,
                    },
                    oldValues: {
                        contentId: modified.oldContentId,
                    },
                },
                note: message,
            },
            currentView
        );

        // Update path index
        db.upsertPathIndex(
            modified.file.path,
            modified.file.contentId,
            modified.file.type,
            modified.file.size,
            modified.file.mtime
        );
        patchCount++;
    }

    // Process deleted files
    for (const deleted of changes.deleted) {
        // Create delete patch
        const patch = patchManager.commit(
            {
                op: 'delete',
                agent,
                target: deleted.path,
                note: message,
            },
            currentView
        );

        // Remove from path index
        db.deletePathIndex(deleted.path);
        patchCount++;
    }

    // Process renamed files
    for (const renamed of changes.renamed) {
        // For now, treat rename as delete + add
        // TODO: Add proper rename patch support

        // Delete old path
        db.deletePathIndex(renamed.oldPath);

        // Add new path
        const file = workspaceFiles.find(f => f.path === renamed.newPath);
        if (file) {
            const content = readFileSync(file.absolutePath, 'utf-8');

            const patch = patchManager.commit(
                {
                    op: 'add',
                    agent,
                    target: file.path,
                    payload: {
                        object: {
                            type: file.type,
                            content: {
                                title: file.path,
                                body: content,
                            },
                        },
                    },
                    note: `${message} (renamed from ${renamed.oldPath})`,
                },
                currentView
            );

            db.upsertPathIndex(file.path, file.contentId, file.type, file.size, file.mtime);
            patchCount++;
        }
    }

    console.log(`✓ Committed ${patchCount} change${patchCount > 1 ? 's' : ''}`);
    console.log(`  View: ${currentView}`);
    if (changes.added.length > 0) {
        console.log(`  Added: ${changes.added.length} file${changes.added.length > 1 ? 's' : ''}`);
    }
    if (changes.modified.length > 0) {
        console.log(
            `  Modified: ${changes.modified.length} file${changes.modified.length > 1 ? 's' : ''}`
        );
    }
    if (changes.deleted.length > 0) {
        console.log(
            `  Deleted: ${changes.deleted.length} file${changes.deleted.length > 1 ? 's' : ''}`
        );
    }
    if (changes.renamed.length > 0) {
        console.log(
            `  Renamed: ${changes.renamed.length} file${changes.renamed.length > 1 ? 's' : ''}`
        );
    }

    db.close();
}
