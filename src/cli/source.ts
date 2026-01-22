import { resolve } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { SourceManager } from '../core/source-manager.js';
import { getDatabasePath, ensureHolonHome, HolonHomeError } from '../utils/home.js';

/**
 * Handle source command
 */
export async function handleSource(args: string[], options: any): Promise<void> {
    const action = args[0];
    const name = args[1];

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
    const sourceManager = new SourceManager(db);

    try {
        switch (action) {
            case 'add':
                if (!name) {
                    console.error('Usage: holonbase source add <name> --type local --path <path>');
                    process.exit(1);
                }
                const type = options.type || 'local';
                const config: any = {};
                if (type === 'local') {
                    config.path = resolve(options.path || process.cwd());
                }
                await sourceManager.addSource(name, type, config);
                console.log(`✓ Added source '${name}' (${type})`);
                break;

            case 'list':
                const sources = sourceManager.listSources();
                if (sources.length === 0) {
                    console.log('No data sources configured');
                } else {
                    console.log('Data sources:');
                    sources.forEach(s => {
                        const syncInfo = s.lastSync ? ` (last sync: ${s.lastSync})` : ' (never synced)';
                        console.log(`  ${s.name.padEnd(15)} [${s.type}] ${syncInfo}`);
                        if (s.type === 'local') {
                            console.log(`    path: ${s.config.path}`);
                        }
                    });
                }
                break;

            case 'remove':
                if (!name) {
                    console.error('Usage: holonbase source remove <name>');
                    process.exit(1);
                }
                await sourceManager.removeSource(name);
                console.log(`✓ Removed source '${name}'`);
                break;

            default:
                console.error('Unknown source action. Use: add, list, remove');
                process.exit(1);
        }
    } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(1);
    } finally {
        db.close();
    }
}
