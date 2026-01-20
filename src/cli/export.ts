import { writeFileSync } from 'fs';
import { join } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { findHolonbaseRoot } from '../utils/repo.js';

export interface ExportOptions {
    format: 'json' | 'jsonl';
    output?: string;
}

export function exportRepository(options: ExportOptions): void {
    const repoRoot = findHolonbaseRoot(process.cwd());
    if (!repoRoot) {
        throw new Error('Not a holonbase repository');
    }

    const dbPath = join(repoRoot, '.holonbase', 'holonbase.db');
    const db = new HolonDatabase(dbPath);

    // Get all objects
    const patches = db.getAllPatches();
    const objects = db.getAllStateViewObjects();

    const timestamp = new Date().toISOString().split('T')[0];
    const exportDir = join(repoRoot, '.holonbase', 'exports', timestamp);

    // Determine output path
    const outputPath = options.output || exportDir;

    if (options.format === 'jsonl') {
        // Export as JSONL
        const patchesPath = join(outputPath, 'patches.jsonl');
        const objectsPath = join(outputPath, 'objects.jsonl');

        const patchesJsonl = patches.map(p => JSON.stringify(p)).join('\n');
        const objectsJsonl = objects.map(o => JSON.stringify(o)).join('\n');

        writeFileSync(patchesPath, patchesJsonl);
        writeFileSync(objectsPath, objectsJsonl);

        console.log(`Exported to ${outputPath}`);
        console.log(`  - patches.jsonl (${patches.length} patches)`);
        console.log(`  - objects.jsonl (${objects.length} objects)`);
    } else {
        // Export as JSON
        const dataPath = join(outputPath, 'export.json');
        const data = {
            patches,
            objects,
            exportedAt: new Date().toISOString(),
        };

        writeFileSync(dataPath, JSON.stringify(data, null, 2));

        console.log(`Exported to ${dataPath}`);
        console.log(`  - ${patches.length} patches`);
        console.log(`  - ${objects.length} objects`);
    }

    db.close();
}
