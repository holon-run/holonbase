import { HolonDatabase } from '../storage/database.js';
import { ConfigManager } from '../utils/config.js';
import { getDatabasePath, getConfigPath, ensureHolonHome, HolonHomeError } from '../utils/home.js';

interface ViewOptions {
    action: 'list' | 'create' | 'switch' | 'delete';
    name?: string;
}

export async function manageView(options: ViewOptions): Promise<void> {
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
    const configPath = getConfigPath();

    const db = new HolonDatabase(dbPath);
    db.initialize();
    const config = new ConfigManager(configPath);

    switch (options.action) {
        case 'list':
            listViews(db, config);
            break;
        case 'create':
            if (!options.name) {
                console.error('View name required');
                process.exit(1);
            }
            createView(db, config, options.name);
            break;
        case 'switch':
            if (!options.name) {
                console.error('View name required');
                process.exit(1);
            }
            switchView(db, config, options.name);
            break;
        case 'delete':
            if (!options.name) {
                console.error('View name required');
                process.exit(1);
            }
            deleteView(db, config, options.name);
            break;
    }

    db.close();
}

function listViews(db: HolonDatabase, config: ConfigManager): void {
    const views = db.getAllViews();
    const currentView = config.getCurrentView();

    console.log('');
    views.forEach(view => {
        const marker = view.name === currentView ? '* ' : '  ';
        const headShort = view.headPatchId ? view.headPatchId.substring(0, 8) : 'empty';
        console.log(`${marker}${view.name.padEnd(20)} → ${headShort}`);
    });
    console.log('');
}

function createView(db: HolonDatabase, config: ConfigManager, name: string): void {
    // Check if view already exists
    const existing = db.getView(name);
    if (existing) {
        console.error(`View '${name}' already exists`);
        process.exit(1);
    }

    // Get current view's HEAD
    const currentView = config.getCurrentView();
    const current = db.getView(currentView);
    const headPatchId = current?.headPatchId || '';

    // Create new view
    db.createView(name, headPatchId);
    console.log(`Created view '${name}' at ${headPatchId ? headPatchId.substring(0, 8) : 'empty'}`);
}

function switchView(db: HolonDatabase, config: ConfigManager, name: string): void {
    // Check if view exists
    const view = db.getView(name);
    if (!view) {
        console.error(`View '${name}' does not exist`);
        process.exit(1);
    }

    // Switch to view
    config.setCurrentView(name);
    console.log(`Switched to view '${name}'`);
}

function deleteView(db: HolonDatabase, config: ConfigManager, name: string): void {
    // Cannot delete current view
    const currentView = config.getCurrentView();
    if (name === currentView) {
        console.error('Cannot delete current view');
        console.error('Switch to another view first');
        process.exit(1);
    }

    // Cannot delete main view
    if (name === 'main') {
        console.error('Cannot delete main view');
        process.exit(1);
    }

    // Check if view exists
    const view = db.getView(name);
    if (!view) {
        console.error(`View '${name}' does not exist`);
        process.exit(1);
    }

    // Delete view
    db.deleteView(name);
    console.log(`Deleted view '${name}'`);
}
