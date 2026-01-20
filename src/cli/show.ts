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

    // If not found, try state_view table (for current state objects)
    if (!obj) {
        obj = db.getStateViewObject(id);
    }

    if (!obj) {
        console.error(`Object ${id} not found`);
        db.close();
        process.exit(1);
    }

    // Always output pure JSON
    console.log(JSON.stringify(obj, null, 2));

    db.close();
}
