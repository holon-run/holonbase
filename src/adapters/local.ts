import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';
import { computeHash } from '../utils/hash.js';
import { parseIgnoreFile, shouldIgnore, DEFAULT_IGNORE_PATTERNS } from '../utils/ignore.js';
import { SourceAdapter, FileEntry, ChangeEvent } from './types.js';

/**
 * Local file system adapter
 */
export class LocalAdapter implements SourceAdapter {
    readonly type = 'local';
    private rootPath: string;
    private ignorePatterns: string[];

    constructor(rootPath: string) {
        this.rootPath = rootPath;
        this.ignorePatterns = [...DEFAULT_IGNORE_PATTERNS];

        // Load .holonignore if exists
        const ignorePath = join(rootPath, '.holonignore');
        if (existsSync(ignorePath)) {
            const content = readFileSync(ignorePath, 'utf-8');
            const patterns = parseIgnoreFile(content);
            this.ignorePatterns.push(...patterns);
        }
    }

    /**
     * Get root path
     */
    getRoot(): string {
        return this.rootPath;
    }

    /**
     * Scan directory and return all trackable files
     */
    async scan(): Promise<FileEntry[]> {
        const files: FileEntry[] = [];
        this.scanRecursive(this.rootPath, files);
        return files;
    }

    /**
     * Read file content
     */
    async readFile(path: string): Promise<Buffer> {
        const absolutePath = join(this.rootPath, path);
        return readFileSync(absolutePath);
    }

    /**
     * Recursively scan directory
     */
    private scanRecursive(dir: string, files: FileEntry[]): void {
        const entries = readdirSync(dir);

        for (const entry of entries) {
            const absolutePath = join(dir, entry);
            const relativePath = relative(this.rootPath, absolutePath);

            // Skip if should be ignored
            if (shouldIgnore(relativePath, this.ignorePatterns)) {
                continue;
            }

            const stats = statSync(absolutePath);

            if (stats.isDirectory()) {
                // Recurse into subdirectory
                this.scanRecursive(absolutePath, files);
            } else if (stats.isFile()) {
                // Detect file type
                const type = this.detectFileType(relativePath);
                if (!type) continue; // Skip unsupported files

                // Calculate content hash
                const content = readFileSync(absolutePath);
                const hash = computeHash(content);

                files.push({
                    path: relativePath,
                    absolutePath,
                    type,
                    hash,
                    size: stats.size,
                    mtime: stats.mtime.toISOString(),
                });
            }
        }
    }

    /**
     * Detect file type based on extension
     */
    private detectFileType(path: string): 'note' | 'file' | null {
        const ext = extname(path).toLowerCase();

        // Note types (text-based content)
        const noteExtensions = ['.md', '.txt', '.org', '.markdown'];
        if (noteExtensions.includes(ext)) {
            return 'note';
        }

        // File types (binary or reference files)
        const fileExtensions = [
            '.pdf', '.doc', '.docx',
            '.png', '.jpg', '.jpeg', '.gif', '.svg',
            '.mp3', '.mp4', '.wav', '.avi',
            '.zip', '.tar', '.gz',
            '.json', '.xml', '.yaml', '.yml',
        ];
        if (fileExtensions.includes(ext)) {
            return 'file';
        }

        // Unknown type - skip
        return null;
    }
}
