import { HolonObject } from '../types/index.js';

export interface DiffResult {
    added: ObjectDiff[];
    removed: ObjectDiff[];
    modified: ObjectModification[];
}

export interface ObjectDiff {
    objectId: string;
    type: string;
    content: any;
}

export interface ObjectModification {
    objectId: string;
    type: string;
    changes: FieldChange[];
}

export interface FieldChange {
    path: string;
    oldValue: any;
    newValue: any;
}

/**
 * Compute diff between two state views
 */
export function computeDiff(
    fromObjects: Map<string, any>,
    toObjects: Map<string, any>
): DiffResult {
    const diff: DiffResult = {
        added: [],
        removed: [],
        modified: [],
    };

    // Find added and modified objects
    for (const [id, toObj] of toObjects) {
        const fromObj = fromObjects.get(id);

        if (!fromObj) {
            // Object was added
            diff.added.push({
                objectId: id,
                type: toObj.type,
                content: toObj.content,
            });
        } else if (!deepEqual(fromObj.content, toObj.content)) {
            // Object was modified
            const changes = computeFieldChanges(fromObj.content, toObj.content);
            diff.modified.push({
                objectId: id,
                type: toObj.type,
                changes,
            });
        }
    }

    // Find removed objects
    for (const [id, fromObj] of fromObjects) {
        if (!toObjects.has(id)) {
            diff.removed.push({
                objectId: id,
                type: fromObj.type,
                content: fromObj.content,
            });
        }
    }

    return diff;
}

/**
 * Compute field-level changes between two objects
 */
function computeFieldChanges(oldObj: any, newObj: any, path = ''): FieldChange[] {
    const changes: FieldChange[] = [];

    // Get all keys from both objects
    const allKeys = new Set([
        ...Object.keys(oldObj || {}),
        ...Object.keys(newObj || {}),
    ]);

    for (const key of allKeys) {
        const currentPath = path ? `${path}.${key}` : key;
        const oldValue = oldObj?.[key];
        const newValue = newObj?.[key];

        if (oldValue === undefined && newValue !== undefined) {
            // Field added
            changes.push({
                path: currentPath,
                oldValue: undefined,
                newValue,
            });
        } else if (oldValue !== undefined && newValue === undefined) {
            // Field removed
            changes.push({
                path: currentPath,
                oldValue,
                newValue: undefined,
            });
        } else if (typeof oldValue === 'object' && typeof newValue === 'object') {
            // Recurse for nested objects
            if (Array.isArray(oldValue) && Array.isArray(newValue)) {
                // For arrays, treat as simple value comparison
                if (!deepEqual(oldValue, newValue)) {
                    changes.push({
                        path: currentPath,
                        oldValue,
                        newValue,
                    });
                }
            } else {
                // For objects, recurse
                const nestedChanges = computeFieldChanges(oldValue, newValue, currentPath);
                changes.push(...nestedChanges);
            }
        } else if (oldValue !== newValue) {
            // Value changed
            changes.push({
                path: currentPath,
                oldValue,
                newValue,
            });
        }
    }

    return changes;
}

/**
 * Deep equality check
 */
function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            return a.every((val, idx) => deepEqual(val, b[idx]));
        }

        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;

        return keysA.every(key => deepEqual(a[key], b[key]));
    }

    return false;
}

/**
 * Format diff result for display
 */
export function formatDiff(diff: DiffResult): string {
    const lines: string[] = [];

    if (diff.added.length > 0) {
        lines.push('=== Added Objects ===');
        for (const obj of diff.added) {
            lines.push(`+ [${obj.type}] ${obj.objectId}`);
            lines.push(`  ${JSON.stringify(obj.content, null, 2).split('\n').join('\n  ')}`);
        }
        lines.push('');
    }

    if (diff.removed.length > 0) {
        lines.push('=== Removed Objects ===');
        for (const obj of diff.removed) {
            lines.push(`- [${obj.type}] ${obj.objectId}`);
        }
        lines.push('');
    }

    if (diff.modified.length > 0) {
        lines.push('=== Modified Objects ===');
        for (const mod of diff.modified) {
            lines.push(`~ [${mod.type}] ${mod.objectId}`);
            for (const change of mod.changes) {
                lines.push(`  ${change.path}:`);
                if (change.oldValue !== undefined) {
                    lines.push(`    - ${JSON.stringify(change.oldValue)}`);
                }
                if (change.newValue !== undefined) {
                    lines.push(`    + ${JSON.stringify(change.newValue)}`);
                }
            }
            lines.push('');
        }
    }

    if (diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0) {
        lines.push('No differences found');
    }

    return lines.join('\n');
}
