import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { HolonDatabase } from '../storage/database.js';

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

    // Create config.json
    const config = {
        version: '0.1.0-alpha',
        language: 'en',
        createdAt: new Date().toISOString(),
    };
    writeFileSync(
        join(holonDir, 'config.json'),
        JSON.stringify(config, null, 2)
    );

    // Initialize database
    const dbPath = join(holonDir, 'holonbase.db');
    const db = new HolonDatabase(dbPath);
    db.initialize();
    db.close();

    console.log(`Initialized empty Holonbase repository in ${holonDir}`);
}
