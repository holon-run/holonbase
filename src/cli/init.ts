import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve, basename } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { ConfigManager } from '../utils/config.js';
import { WorkspaceScanner } from '../core/workspace.js';
import { SourceManager } from '../core/source-manager.js';
import {
    getDatabasePath,
    getConfigPath,
    getHomePath,
    ensureHolonHome,
    getHolonHome,
    HolonHomeError
} from '../utils/home.js';

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
    const targetPath = resolve(options.path || process.cwd());

    // Ensure holonbase home is initialized
    let wasAlreadyInitialized = true;
    try {
        await ensureHolonHome();
        // Check if database already exists
        const dbPath = getDatabasePath();
        wasAlreadyInitialized = existsSync(dbPath);
    } catch (error) {
        if (error instanceof HolonHomeError) {
            console.error(error.message);
            process.exit(1);
        }
        throw error;
    }

    // Initialize config using ConfigManager
    const configPath = getConfigPath();
    const config = new ConfigManager(configPath);
    config.save();

    // Initialize database if not already initialized
    const dbPath = getDatabasePath();
    const db = new HolonDatabase(dbPath);

    if (!wasAlreadyInitialized) {
        db.initialize();
        console.log(`✓ Initialized holonbase at ${getHolonHome()}`);
    }

    // Generate a unique source name based on directory basename
    let sourceName = basename(targetPath);
    // If name is empty or '.', use 'default'
    if (!sourceName || sourceName === '.') {
        sourceName = 'default';
    }

    // Check if source already exists using db directly
    const existingSource = db.getSource(sourceName);

    if (existingSource) {
        console.log(`Source '${sourceName}' already exists in holonbase.`);
        db.close();
        console.log('');
        console.log(`Run 'holonbase status' to see details`);
        console.log(`Run 'holonbase sync' to update tracked files`);
        return;
    }

    // Create .holonignore file in the target directory
    const ignorePath = join(targetPath, '.holonignore');
    if (!existsSync(ignorePath)) {
        writeFileSync(ignorePath, HOLONIGNORE_TEMPLATE, 'utf-8');
        console.log(`✓ Created .holonignore in ${targetPath}`);
    }

    // Add the current directory as a source
    const sourceManager = new SourceManager(db);
    await sourceManager.addSource(sourceName, 'local', {
        path: targetPath,
    });

    db.close();

    console.log(`✓ Added source '${sourceName}' pointing to ${targetPath}`);
    console.log('');

    // Scan workspace and report found files
    const scanner = new WorkspaceScanner(targetPath);
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
    console.log(`Run 'holonbase sync' to start tracking`);
}
