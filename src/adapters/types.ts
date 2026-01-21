/**
 * File entry in source
 */
export interface FileEntry {
    path: string;           // relative path from source root
    absolutePath: string;   // local path if applicable
    type: 'note' | 'file';
    hash: string;           // content hash (SHA256)
    size: number;
    mtime: string;          // ISO 8601 timestamp
}

/**
 * Change event from source
 */
export interface ChangeEvent {
    type: 'added' | 'modified' | 'deleted' | 'renamed';
    path: string;
    oldPath?: string;
    file?: FileEntry;
}

/**
 * Source adapter interface
 */
export interface SourceAdapter {
    readonly type: 'local' | 'git' | 'gdrive' | 'web' | 'api';

    /**
     * Scan the source for all files
     */
    scan(): Promise<FileEntry[]>;

    /**
     * Read file content
     */
    readFile(path: string): Promise<Buffer>;

    /**
     * Watch for changes (optional)
     */
    watch?(callback: (changes: ChangeEvent[]) => void): void;

    /**
     * Get root path or identifier
     */
    getRoot(): string;
}
