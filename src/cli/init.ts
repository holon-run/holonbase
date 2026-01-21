import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { ConfigManager } from '../utils/config.js';
import { WorkspaceScanner } from '../core/workspace.js';
import { SourceManager } from '../core/source-manager.js';

export interface InitOptions {
    path: string;
}

const HOLONIGNORE_TEMPLATE = `# Holonbase ignore patterns
# Similar to .gitignore

# System files
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.bak
*.swp
*~

# Build outputs
node_modules/
dist/
build/

# Version control
.git/
`;

export async function initRepository(options: InitOptions): Promise<void> {
    const holonDir = join(options.path, '.holonbase');

    // Check if already initialized
    if (existsSync(holonDir)) {
        throw new Error('Repository already initialized');
    }

    // Create .holonbase directory
    mkdirSync(holonDir, { recursive: true });

    // Create .holonignore file
    const ignorePath = join(options.path, '.holonignore');
    if (!existsSync(ignorePath)) {
        writeFileSync(ignorePath, HOLONIGNORE_TEMPLATE, 'utf-8');
    }

    // Initialize config using ConfigManager
    const configPath = join(holonDir, 'config.json');
    const config = new ConfigManager(configPath);
    config.save();

    // Initialize database
    const dbPath = join(holonDir, 'holonbase.db');
    const db = new HolonDatabase(dbPath);
    db.initialize();

    // Add default local source
    const sourceManager = new SourceManager(db);
    await sourceManager.addSource('local', 'local', {
        path: resolve(options.path || process.cwd()),
    });

    db.close();

    console.log(`✓ Created .holonbase/`);
    console.log(`✓ Created .holonignore`);
    console.log(`✓ Added default local source`);
    console.log('');

    // Scan workspace and report found files
    const scanner = new WorkspaceScanner(options.path);
    const files = scanner.scanDirectory();

    // Count by type
    const noteCount = files.filter(f => f.type === 'note').length;
    const fileCount = files.filter(f => f.type === 'file').length;

    console.log(`✓ Scanned directory:`);
    if (noteCount > 0) {
        console.log(`    ${noteCount} markdown file${noteCount > 1 ? 's' : ''} (note)`);
    }
    if (fileCount > 0) {
        console.log(`    ${fileCount} file${fileCount > 1 ? 's' : ''} (file)`);
    }
    if (noteCount === 0 && fileCount === 0) {
        console.log(`    No trackable files found`);
    }
    console.log('');
    console.log(`Run 'holonbase status' to see details`);
    console.log(`Run 'holonbase commit' to start tracking`);
}
