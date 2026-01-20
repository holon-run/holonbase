import { join } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { findHolonbaseRoot } from '../utils/repo.js';

export interface LogOptions {
    limit?: number;
}

export function logPatches(options: LogOptions): void {
    const repoRoot = findHolonbaseRoot(process.cwd());
    if (!repoRoot) {
        throw new Error('Not a holonbase repository');
    }

    const dbPath = join(repoRoot, '.holonbase', 'holonbase.db');
    const db = new HolonDatabase(dbPath);

    const patches = db.getAllPatches(options.limit);

    if (patches.length === 0) {
        console.log('No patches yet');
        db.close();
        return;
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
