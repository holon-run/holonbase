import { readFileSync } from 'fs';
import { join } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { PatchManager } from '../core/patch.js';
import { PatchInputSchema } from '../types/index.js';
import { findHolonbaseRoot } from '../utils/repo.js';

export interface CommitOptions {
    file?: string;
    stdin?: boolean;
}

export function commitPatch(options: CommitOptions): void {
    // Find repository root
    const repoRoot = findHolonbaseRoot(process.cwd());
    if (!repoRoot) {
        throw new Error('Not a holonbase repository (or any parent up to mount point)');
    }

    // Read patch input
    let patchJson: string;
    if (options.stdin) {
        // Read from stdin
        patchJson = readFileSync(0, 'utf-8');
    } else if (options.file) {
        patchJson = readFileSync(options.file, 'utf-8');
    } else {
        throw new Error('Must provide either --file or read from stdin');
    }

    // Parse and validate
    const patchInput = JSON.parse(patchJson);
    const validated = PatchInputSchema.parse(patchInput);

    // Open database
    const dbPath = join(repoRoot, '.holonbase', 'holonbase.db');
    const db = new HolonDatabase(dbPath);
    const patchManager = new PatchManager(db);

    // Commit patch
    const patch = patchManager.commit(validated);

    console.log(`Committed patch ${patch.id}`);
    console.log(`  Operation: ${patch.content.op}`);
    console.log(`  Target: ${patch.content.target}`);
    console.log(`  Agent: ${patch.content.agent}`);

    db.close();
}
