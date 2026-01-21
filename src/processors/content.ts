import { FileEntry } from '../adapters/types.js';
import { extname } from 'path';

/**
 * Holonbase Object structure for notes and files
 */
export interface ProcessedObject {
    type: 'note' | 'file';
    content: any;
}

/**
 * Content Processor - handles file-to-object conversion and metadata extraction
 */
export class ContentProcessor {
    /**
     * Process a file entry and its content into a Holonbase object
     */
    async process(file: FileEntry, buffer: Buffer): Promise<ProcessedObject> {
        if (file.type === 'note') {
            return this.processNote(file, buffer);
        } else {
            return this.processFile(file, buffer);
        }
    }

    /**
     * Process a text-based note
     */
    private processNote(file: FileEntry, buffer: Buffer): ProcessedObject {
        const text = buffer.toString('utf-8');

        // Simple title extraction: first line starting with # or first non-empty line
        let title = file.path;
        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#')) {
                title = trimmed.replace(/^#+\s*/, '');
                break;
            } else if (trimmed.length > 0) {
                title = trimmed;
                break;
            }
        }

        return {
            type: 'note',
            content: {
                path: file.path,
                hash: file.hash,
                title: title,
                body: text,
            }
        };
    }

    /**
     * Process a binary or reference file
     */
    private processFile(file: FileEntry, buffer: Buffer): ProcessedObject {
        const mimeType = this.detectMimeType(file.path);

        // Basic metadata
        const metadata: any = {
            name: file.path.split('/').pop(),
            size: file.size,
            lastModified: file.mtime,
        };

        // TODO: Implement specific extractors for PDF, DOCX, etc.
        // For now, we just record the metadata

        return {
            type: 'file',
            content: {
                path: file.path,
                hash: file.hash,
                size: file.size,
                mimeType,
                metadata,
            }
        };
    }

    /**
     * Detect MIME type based on extension
     */
    private detectMimeType(path: string): string {
        const ext = extname(path).toLowerCase();
        const mimeMap: Record<string, string> = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.json': 'application/json',
            '.xml': 'text/xml',
            '.yaml': 'text/yaml',
            '.yml': 'text/yaml',
            '.mp3': 'audio/mpeg',
            '.mp4': 'video/mp4',
            '.zip': 'application/zip',
        };
        return mimeMap[ext] || 'application/octet-stream';
    }
}
