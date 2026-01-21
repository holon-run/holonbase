import { existsSync, readFileSync } from 'fs';
import { join, basename, extname } from 'path';
import { HolonDatabase } from '../storage/database.js';
import { ConfigManager } from '../utils/config.js';
import { PatchManager } from '../core/patch.js';
import { computeHash } from '../utils/hash.js';

interface ImportOptions {
    file: string;
    type?: 'note' | 'file' | 'evidence';
    agent?: string;
    title?: string;
}

export function importDocument(options: ImportOptions): void {
    const holonDir = join(process.cwd(), '.holonbase');

    if (!existsSync(holonDir)) {
        console.error('Not a holonbase repository. Run `holonbase init` first.');
        process.exit(1);
    }

    if (!existsSync(options.file)) {
        console.error(`File not found: ${options.file}`);
        process.exit(1);
    }

    const dbPath = join(holonDir, 'holonbase.db');
    const configPath = join(holonDir, 'config.json');

    const db = new HolonDatabase(dbPath);
    const config = new ConfigManager(configPath);
    const patchManager = new PatchManager(db);

    // Determine import type
    const importType = options.type || detectType(options.file);
    const agent = options.agent || config.getDefaultAgent() || 'user/import';
    const currentView = config.getCurrentView();

    try {
        let patch;

        if (importType === 'note') {
            patch = importAsNote(options.file, agent, options.title);
        } else if (importType === 'file') {
            patch = importAsFile(options.file, agent, options.title);
        } else if (importType === 'evidence') {
            patch = importAsEvidence(options.file, agent, options.title);
        } else {
            console.error(`Unsupported import type: ${importType}`);
            process.exit(1);
        }

        // Commit the patch
        const result = patchManager.commit(patch, currentView);

        console.log('✓ Document imported successfully');
        console.log(`  Object ID: ${result.id.substring(0, 16)}...`);
        console.log(`  Type: ${importType}`);
        console.log(`  File: ${options.file}`);
        console.log(`  Patch ID: ${result.id.substring(0, 8)}`);

    } catch (error) {
        console.error('Import failed:', (error as Error).message);
        process.exit(1);
    } finally {
        db.close();
    }
}

function detectType(filePath: string): 'note' | 'file' | 'evidence' {
    const ext = extname(filePath).toLowerCase();

    // Text-based formats → note
    if (['.md', '.txt', '.org'].includes(ext)) {
        return 'note';
    }

    // URL/reference files → evidence
    if (['.url', '.webloc'].includes(ext)) {
        return 'evidence';
    }

    // Everything else → file
    return 'file';
}

function importAsNote(filePath: string, agent: string, title?: string) {
    const content = readFileSync(filePath, 'utf-8');
    const fileName = basename(filePath, extname(filePath));

    const noteContent = {
        title: title || fileName,
        body: content,
    };

    const objectId = computeHash({
        type: 'note',
        content: noteContent,
    });

    return {
        op: 'add' as const,
        agent,
        target: objectId,
        payload: {
            object: {
                type: 'note',
                content: noteContent,
            },
        },
        note: `Imported from ${filePath}`,
    };
}

function importAsFile(filePath: string, agent: string, title?: string) {
    const stats = require('fs').statSync(filePath);
    const fileName = basename(filePath);
    const ext = extname(filePath);

    // Compute file hash
    const fileContent = readFileSync(filePath);
    const fileHash = computeHash(fileContent);

    const fileContentObj = {
        path: filePath,
        hash: fileHash,
        mimeType: getMimeType(ext),
        title: title || fileName,
        size: stats.size,
    };

    const objectId = computeHash({
        type: 'file',
        content: fileContentObj,
    });

    return {
        op: 'add' as const,
        agent,
        target: objectId,
        payload: {
            object: {
                type: 'file',
                content: fileContentObj,
            },
        },
        note: `Imported file reference from ${filePath}`,
    };
}

function importAsEvidence(filePath: string, agent: string, title?: string) {
    const content = readFileSync(filePath, 'utf-8');
    const fileName = basename(filePath, extname(filePath));

    // Try to extract URL from content
    const urlMatch = content.match(/https?:\/\/[^\s]+/);
    const uri = urlMatch ? urlMatch[0] : filePath;

    const evidenceContent = {
        type: 'url' as const,
        uri,
        title: title || fileName,
        description: content.substring(0, 200),
    };

    const objectId = computeHash({
        type: 'evidence',
        content: evidenceContent,
    });

    return {
        op: 'add' as const,
        agent,
        target: objectId,
        payload: {
            object: {
                type: 'evidence',
                content: evidenceContent,
            },
        },
        note: `Imported evidence from ${filePath}`,
    };
}

function getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.html': 'text/html',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
    };

    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}
