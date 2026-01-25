import { HolonDatabase } from '../storage/database.js';
import { getDatabasePath, ensureHolonHome, HolonHomeError } from '../utils/home.js';

export async function showObject(id: string): Promise<void> {
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
