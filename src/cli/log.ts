import { HolonDatabase } from '../storage/database.js';
import { getDatabasePath, ensureHolonHome, HolonHomeError } from '../utils/home.js';

export interface LogOptions {
    limit?: number;
    objectId?: string;
}

export async function logPatches(options: LogOptions): Promise<void> {
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

    // If objectId is provided, show patches for that object
    const patches = options.objectId
        ? db.getPatchesByTarget(options.objectId)
        : db.getAllPatches(options.limit);

    if (patches.length === 0) {
        if (options.objectId) {
            console.log(`No patches found for object: ${options.objectId}`);
        } else {
            console.log('No patches yet');
        }
        db.close();
        return;
    }

    // Show header if filtering by object
    if (options.objectId) {
        console.log(`Patch history for object: ${options.objectId}\n`);
    }

    for (const patch of patches) {
        console.log(`\nPatch: ${patch.id}`);
        console.log(`Date: ${patch.createdAt}`);
        console.log(`Agent: ${patch.content.agent}`);
        console.log(`Operation: ${patch.content.op} -> ${patch.content.target}`);

        if (patch.content.note) {
            console.log(`\n    ${patch.content.note}`);
        }

        if (patch.content.confidence !== undefined) {
            console.log(`Confidence: ${patch.content.confidence}`);
        }

        console.log('---');
    }

    db.close();
}
