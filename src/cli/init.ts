import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { ConfigManager } from '../utils/config.js';

export interface InitOptions {
    path: string;
}

export function initRepository(options: InitOptions): void {
    const holonDir = join(options.path, '.holonbase');

    // Check if already initialized
    if (existsSync(holonDir)) {
        throw new Error('Repository already initialized');
    }

    // Create .holonbase directory
    mkdirSync(holonDir, { recursive: true });

    // Create subdirectories
    mkdirSync(join(holonDir, 'files'), { recursive: true });
    mkdirSync(join(holonDir, 'exports'), { recursive: true });

    // Initialize config using ConfigManager
    const configPath = join(holonDir, 'config.json');
    const config = new ConfigManager(configPath);
    config.save();

    // Initialize database
    const dbPath = join(holonDir, 'holonbase.db');
    const db = new HolonDatabase(dbPath);
    db.initialize();
    db.close();

    console.log(`Initialized empty Holonbase repository in ${holonDir}`);
}
