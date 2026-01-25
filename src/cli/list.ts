import { HolonDatabase } from '../storage/database.js';
import { getDatabasePath, ensureHolonHome, HolonHomeError } from '../utils/home.js';

export interface ListOptions {
    type?: string;
}

export async function listObjects(options: ListOptions): Promise<void> {
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
