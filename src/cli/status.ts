import { existsSync } from 'fs';
import { join } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { ConfigManager } from '../utils/config.js';

export function showStatus(): void {
    const holonDir = join(process.cwd(), '.holonbase');

    if (!existsSync(holonDir)) {
        console.error('Not a holonbase repository (or any parent up to mount point)');
        console.error('Run "holonbase init" to initialize a repository');
        process.exit(1);
    }

    const dbPath = join(holonDir, 'holonbase.db');
    const configPath = join(holonDir, 'config.json');

    const db = new HolonDatabase(dbPath);
    const config = new ConfigManager(configPath);

    const currentView = config.getCurrentView();
    const view = db.getView(currentView);

    if (!view) {
        console.error(`Current view '${currentView}' not found`);
        db.close();
        process.exit(1);
    }

    // Get HEAD patch info
    let headInfo = 'none';
    if (view.headPatchId) {
        const headPatch = db.getObject(view.headPatchId);
        if (headPatch) {
            const timeAgo = getTimeAgo(headPatch.createdAt);
            headInfo = `${view.headPatchId.substring(0, 8)} (${timeAgo})`;
        }
    }

    // Count objects by type
    const allObjects = db.getAllStateViewObjects();
    const objectCounts: Record<string, number> = {};
    allObjects.forEach(obj => {
        objectCounts[obj.type] = (objectCounts[obj.type] || 0) + 1;
    });

    console.log(`Repository: ${holonDir}`);
    console.log(`View: ${currentView}`);
    console.log(`HEAD: ${headInfo}`);
    console.log('');
    console.log('Objects:');

    const types = ['concept', 'claim', 'relation', 'note', 'evidence', 'file'];
    types.forEach(type => {
        const count = objectCounts[type] || 0;
        if (count > 0) {
            console.log(`  ${type}s: ${count}`);
        }
    });
    console.log(`  ${'─'.repeat(20)}`);
    console.log(`  total: ${allObjects.length}`);

    db.close();
}

function getTimeAgo(isoString: string): string {
    const now = new Date();
    const then = new Date(isoString);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}
