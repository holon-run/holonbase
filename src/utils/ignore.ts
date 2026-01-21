/**
 * Utilities for parsing and matching .holonignore patterns
 * Similar to .gitignore
 */

/**
 * Parse .holonignore file content into pattern list
 */
export function parseIgnoreFile(content: string): string[] {
    return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')); // Remove empty lines and comments
}

/**
 * Check if a path should be ignored based on patterns
 * Supports:
 * - Glob patterns: *.tmp, *.log
 * - Directory patterns: node_modules/, .git/
 * - Negation: !important.tmp
 */
export function shouldIgnore(path: string, patterns: string[]): boolean {
    let ignored = false;

    for (const pattern of patterns) {
        // Handle negation patterns
        if (pattern.startsWith('!')) {
            const negPattern = pattern.slice(1);
            if (matchPattern(path, negPattern)) {
                ignored = false;
            }
            continue;
        }

        // Check if pattern matches
        if (matchPattern(path, pattern)) {
            ignored = true;
        }
    }

    return ignored;
}

/**
 * Match a path against a pattern
 * Supports basic glob patterns and directory matching
 */
function matchPattern(path: string, pattern: string): boolean {
    // Directory pattern (ends with /)
    if (pattern.endsWith('/')) {
        const dir = pattern.slice(0, -1);
        return path === dir || path.startsWith(dir + '/');
    }

    // Convert glob pattern to regex
    const regexPattern = pattern
        .replace(/\./g, '\\.')      // Escape dots
        .replace(/\*/g, '[^/]*')    // * matches anything except /
        .replace(/\?/g, '[^/]')     // ? matches single char except /
        .replace(/\*\*/g, '.*');    // ** matches anything including /

    const regex = new RegExp(`^${regexPattern}$`);

    // Check if path matches
    if (regex.test(path)) {
        return true;
    }

    // Also check if any parent directory matches
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
        const partial = parts.slice(0, i).join('/');
        if (regex.test(partial)) {
            return true;
        }
    }

    return false;
}

/**
 * Default ignore patterns
 */
export const DEFAULT_IGNORE_PATTERNS = [
    '.holonbase/',
    '.git/',
    'node_modules/',
    '.DS_Store',
    'Thumbs.db',
    '*.tmp',
    '*.bak',
    '*.swp',
    '*~',
];
