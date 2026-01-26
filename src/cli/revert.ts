import { HolonDatabase } from '../storage/database.js';
import { PatchManager } from '../core/patch.js';
import { PatchContent } from '../types/index.js';
import { getDatabasePath, ensureHolonHome, HolonHomeError } from '../utils/home.js';

export async function revertPatch(): Promise<void> {
    // Ensure holonbase home is initialized
    try {
        await ensureHolonHome();
    } catch (error) {
        if (error instanceof HolonHomeError) {
            console.error(error.message);
            process.exit(1);
        }
        throw error;
    }

    const dbPath = getDatabasePath();

    const db = new HolonDatabase(dbPath);
    db.initialize();
    const patchManager = new PatchManager(db);

    // Get HEAD patch ID from global config
    const headPatchId = db.getConfig('head');

    if (!headPatchId) {
        console.error('Nothing to revert');
        db.close();
        process.exit(1);
    }

    // Get HEAD patch
    const headPatch = db.getObject(headPatchId);
    if (!headPatch) {
        console.error('HEAD patch not found');
        db.close();
        process.exit(1);
    }

    const content = headPatch.content as PatchContent;

    // Create reverse patch
    const reversePatchInput = createReversePatch(content, headPatch.id);

    if (!reversePatchInput) {
        console.error(`Cannot revert operation: ${content.op}`);
        console.error('This operation type is not yet supported for revert');
        db.close();
        process.exit(1);
    }

    // Commit the reverse patch
    const reversePatch = patchManager.commit(reversePatchInput);

    console.log(`Reverted patch ${headPatch.id.substring(0, 8)}`);
    console.log(`Created reverse patch ${reversePatch.id.substring(0, 8)}`);
    console.log(`  Operation: ${reversePatch.content.op}`);
    console.log(`  Target: ${reversePatch.content.target}`);

    db.close();
}

function createReversePatch(content: PatchContent, originalPatchId: string): any | null {
    const agent = content.agent + '/revert';

    switch (content.op) {
        case 'add':
            // Reverse of add is delete
            return {
                op: 'delete',
                agent,
                target: content.target,
                note: `Revert add operation from ${originalPatchId.substring(0, 8)}`,
            };

        case 'delete':
            // Reverse of delete is add (if we have the original object)
            if (content.payload?.originalObject) {
                return {
                    op: 'add',
                    agent,
                    target: content.target,
                    payload: {
                        object: content.payload.originalObject,
                    },
                    note: `Revert delete operation from ${originalPatchId.substring(0, 8)}`,
                };
            }
            return null;

        case 'update':
            // Reverse of update is update with old values
            if (content.payload?.oldValues) {
                return {
                    op: 'update',
                    agent,
                    target: content.target,
                    payload: {
                        changes: content.payload.oldValues,
                    },
                    note: `Revert update operation from ${originalPatchId.substring(0, 8)}`,
                };
            }
            return null;

        case 'link':
            // Reverse of link is delete the relation
            return {
                op: 'delete',
                agent,
                target: content.target,
                note: `Revert link operation from ${originalPatchId.substring(0, 8)}`,
            };

        case 'merge':
            // Merge revert is complex, not supported yet
            return null;

        default:
            return null;
    }
}
