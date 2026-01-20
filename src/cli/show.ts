import { join } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { findHolonbaseRoot } from '../utils/repo.js';

export function showObject(id: string): void {
    const repoRoot = findHolonbaseRoot(process.cwd());
    if (!repoRoot) {
        throw new Error('Not a holonbase repository');
    }

    const dbPath = join(repoRoot, '.holonbase', 'holonbase.db');
    const db = new HolonDatabase(dbPath);

    // First try to find in objects table (for patches and raw objects)
    let obj = db.getObject(id);
    let isFromObjects = true;

    // If not found, try state_view table (for current state objects)
    if (!obj) {
        obj = db.getStateViewObject(id);
        isFromObjects = false;
    }

    if (!obj) {
        console.error(`Object ${id} not found`);
        db.close();
        process.exit(1);
    }

    // Display the object
    console.log(JSON.stringify(obj, null, 2));

    // If it's a state object, show related patches
    if (!isFromObjects && obj.type !== 'patch') {
        const patches = db.getPatchesByTarget(id);
        if (patches.length > 0) {
            console.log(`\n--- History (${patches.length} patches) ---`);
            for (const patch of patches) {
                console.log(`${patch.id.substring(0, 16)} | ${patch.content.op.padEnd(6)} | ${patch.content.agent} | ${patch.createdAt}`);
            }
        }
    }

    db.close();
}
