import { join } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { findHolonbaseRoot } from '../utils/repo.js';

export interface ListOptions {
    type?: string;
}

export function listObjects(options: ListOptions): void {
    const repoRoot = findHolonbaseRoot(process.cwd());
    if (!repoRoot) {
        throw new Error('Not a holonbase repository');
    }

    const dbPath = join(repoRoot, '.holonbase', 'holonbase.db');
    const db = new HolonDatabase(dbPath);

    const objects = db.getAllStateViewObjects(options.type);

    if (objects.length === 0) {
        console.log('No objects found');
        db.close();
        return;
    }

    // Table header
    console.log('ID'.padEnd(18) + 'TYPE'.padEnd(12) + 'UPDATED');
    console.log('-'.repeat(60));

    for (const obj of objects) {
        const id = obj.id.substring(0, 16);
        const type = obj.type;
        const updated = obj.updatedAt;

        console.log(id.padEnd(18) + type.padEnd(12) + updated);
    }

    console.log(`\nTotal: ${objects.length} objects`);

    db.close();
}
