import { FileEntry } from './workspace.js';

/**
 * Path index entry from database
 */
export interface PathIndexEntry {
    path: string;
    contentId: string;
    objectType: string;
    size: number;
    mtime: string;
    trackedAt: string;
}

/**
 * Modified file entry
 */
export interface ModifiedEntry {
    path: string;
    oldContentId: string;
    newContentId: string;
    file: FileEntry;
}

/**
 * Renamed file entry
 */
export interface RenameEntry {
    oldPath: string;
    newPath: string;
    contentId: string;
}

/**
 * Change set detected in workspace
 */
export interface ChangeSet {
    added: FileEntry[];
    modified: ModifiedEntry[];
    deleted: PathIndexEntry[];
    renamed: RenameEntry[];
}

/**
 * Change detector - detects changes between workspace and path_index
 */
export class ChangeDetector {
    /**
     * Detect changes between workspace files and path index
     */
    detectChanges(
        workspaceFiles: FileEntry[],
        pathIndex: PathIndexEntry[]
    ): ChangeSet {
        const changes: ChangeSet = {
            added: [],
            modified: [],
            deleted: [],
            renamed: [],
        };

        // Create maps for efficient lookup
        const workspaceMap = new Map<string, FileEntry>();
        for (const file of workspaceFiles) {
            workspaceMap.set(file.path, file);
        }

        const indexMap = new Map<string, PathIndexEntry>();
        for (const entry of pathIndex) {
            indexMap.set(entry.path, entry);
        }

        // Find added and modified files
        for (const file of workspaceFiles) {
            const indexed = indexMap.get(file.path);

            if (!indexed) {
                // New file
                changes.added.push(file);
            } else if (indexed.contentId !== file.contentId) {
                // Modified file
                changes.modified.push({
                    path: file.path,
                    oldContentId: indexed.contentId,
                    newContentId: file.contentId,
                    file,
                });
            }
            // else: unchanged file, skip
        }

        // Find deleted files
        for (const entry of pathIndex) {
            if (!workspaceMap.has(entry.path)) {
                changes.deleted.push(entry);
            }
        }

        // Detect renames
        changes.renamed = this.detectRenames(changes.deleted, changes.added);

        // Remove renamed files from added/deleted
        const renamedOldPaths = new Set(changes.renamed.map(r => r.oldPath));
        const renamedNewPaths = new Set(changes.renamed.map(r => r.newPath));

        changes.deleted = changes.deleted.filter(d => !renamedOldPaths.has(d.path));
        changes.added = changes.added.filter(a => !renamedNewPaths.has(a.path));

        return changes;
    }

    /**
     * Detect file renames by matching content IDs
     * Similar to Git's rename detection
     */
    private detectRenames(
        deleted: PathIndexEntry[],
        added: FileEntry[]
    ): RenameEntry[] {
        const renames: RenameEntry[] = [];

        // Build content ID map for deleted files
        const deletedByContent = new Map<string, PathIndexEntry[]>();
        for (const entry of deleted) {
            const list = deletedByContent.get(entry.contentId) || [];
            list.push(entry);
            deletedByContent.set(entry.contentId, list);
        }

        // Match added files with deleted files by content ID
        for (const file of added) {
            const candidates = deletedByContent.get(file.contentId);
            if (candidates && candidates.length > 0) {
                // Found a match - this is a rename
                const oldEntry = candidates[0];
                renames.push({
                    oldPath: oldEntry.path,
                    newPath: file.path,
                    contentId: file.contentId,
                });

                // Remove from candidates to avoid duplicate matches
                candidates.shift();
                if (candidates.length === 0) {
                    deletedByContent.delete(file.contentId);
                }
            }
        }

        return renames;
    }

    /**
     * Check if there are any changes
     */
    hasChanges(changes: ChangeSet): boolean {
        return (
            changes.added.length > 0 ||
            changes.modified.length > 0 ||
            changes.deleted.length > 0 ||
            changes.renamed.length > 0
        );
    }
}
