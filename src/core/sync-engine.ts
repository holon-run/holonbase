import { HolonDatabase } from '../storage/database.js';
import { SourceManager } from './source-manager.js';
import { ContentProcessor } from '../processors/content.js';
import { PatchManager } from './patch.js';
import { ChangeDetector, ChangeSet } from './changes.js';
import { ConfigManager } from '../utils/config.js';

export interface SyncResult {
    sourceName: string;
    added: number;
    modified: number;
    deleted: number;
    renamed: number;
}

/**
 * Sync Engine - synchronizes data sources with the knowledge base
 */
export class SyncEngine {
    constructor(
        private db: HolonDatabase,
        private sourceManager: SourceManager,
        private processor: ContentProcessor,
        private patchManager: PatchManager,
        private config: ConfigManager
    ) { }

    /**
     * Synchronize a specific data source
     */
    async syncSource(sourceName: string, message?: string): Promise<SyncResult> {
        const adapter = this.sourceManager.getSource(sourceName);
        const files = await adapter.scan();

        // Get current path index for this source
        const pathIndex = this.db.getAllPathIndex(sourceName);

        // Detect changes
        const detector = new ChangeDetector();
        const changes = detector.detectChanges(files, pathIndex);

        const result: SyncResult = {
            sourceName,
            added: changes.added.length,
            modified: changes.modified.length,
            deleted: changes.deleted.length,
            renamed: changes.renamed.length,
        };

        if (!detector.hasChanges(changes)) {
            return result;
        }

        const agent = this.config.getDefaultAgent() || 'user/local';
        const currentView = this.config.getCurrentView() || 'main';
        const commitMessage = message || `Sync source: ${sourceName}`;

        // 1. Handle Added Files
        for (const file of changes.added) {
            const buffer = await adapter.readFile(file.path);
            const processed = await this.processor.process(file, buffer);

            this.patchManager.commit({
                op: 'add',
                agent,
                target: file.path,
                source: sourceName,
                payload: {
                    object: {
                        type: processed.type,
                        content: processed.content
                    }
                },
                note: commitMessage
            }, currentView);

            this.db.upsertPathIndex(
                file.path,
                sourceName,
                file.hash,
                processed.type,
                file.size,
                file.mtime
            );
        }

        // 2. Handle Modified Files
        for (const modified of changes.modified) {
            const buffer = await adapter.readFile(modified.file.path);
            const processed = await this.processor.process(modified.file, buffer);

            this.patchManager.commit({
                op: 'update',
                agent,
                target: modified.path,
                source: sourceName,
                payload: {
                    changes: processed.content
                },
                note: commitMessage
            }, currentView);

            this.db.upsertPathIndex(
                modified.path,
                sourceName,
                modified.newContentId,
                processed.type,
                modified.file.size,
                modified.file.mtime
            );
        }

        // 3. Handle Deleted Files
        for (const deleted of changes.deleted) {
            this.patchManager.commit({
                op: 'delete',
                agent,
                target: deleted.path,
                source: sourceName,
                note: commitMessage
            }, currentView);

            this.db.deletePathIndex(deleted.path, sourceName);
        }

        // 4. Handle Renamed Files
        for (const renamed of changes.renamed) {
            // Logically rename is delete + add, but we can track it better in patches
            // For now, simpler implementation matching existing commit.ts

            this.patchManager.commit({
                op: 'delete',
                agent,
                target: renamed.oldPath,
                source: sourceName,
                note: `${commitMessage} (Rename part 1: delete)`
            }, currentView);
            this.db.deletePathIndex(renamed.oldPath, sourceName);

            const file = files.find(f => f.path === renamed.newPath);
            if (file) {
                const buffer = await adapter.readFile(file.path);
                const processed = await this.processor.process(file, buffer);

                this.patchManager.commit({
                    op: 'add',
                    agent,
                    target: renamed.newPath,
                    source: sourceName,
                    payload: {
                        object: {
                            type: processed.type,
                            content: processed.content
                        }
                    },
                    note: `${commitMessage} (Rename part 2: add)`
                }, currentView);

                this.db.upsertPathIndex(
                    renamed.newPath,
                    sourceName,
                    renamed.contentId,
                    processed.type,
                    file.size,
                    file.mtime
                );
            }
        }

        // Update last sync time
        this.db.updateSourceLastSync(sourceName);

        return result;
    }

    /**
     * Synchronize all data sources
     */
    async syncAll(message?: string): Promise<SyncResult[]> {
        const sources = this.sourceManager.listSources();
        const results: SyncResult[] = [];
        for (const source of sources) {
            const result = await this.syncSource(source.name, message);
            results.push(result);
        }
        return results;
    }
}
