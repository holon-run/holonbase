import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { getDatabasePath, getHomePath, ensureHolonHome, HolonHomeError } from '../utils/home.js';

export interface ExportOptions {
    format: 'json' | 'jsonl';
    output?: string;
}

export async function exportRepository(options: ExportOptions): Promise<void> {
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

    // Get all objects
    const patches = db.getAllPatches();
    const objects = db.getAllStateViewObjects();

    const timestamp = new Date().toISOString().split('T')[0];
    const exportDir = join(getHomePath('exports'), timestamp);

    // Create export directory if not exists
    mkdirSync(exportDir, { recursive: true });

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
