import { createHash } from 'crypto';

/**
 * Compute SHA256 hash of an object
 * Uses canonical JSON serialization for deterministic hashing
 */
export function computeHash(obj: any): string {
    const canonical = canonicalize(obj);
    return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Canonicalize JSON for deterministic hashing
 * - Sort object keys
 * - No whitespace
 */
function canonicalize(obj: any): string {
    if (obj === null) return 'null';
    if (typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) {
        return '[' + obj.map(canonicalize).join(',') + ']';
    }

    const keys = Object.keys(obj).sort();
    const pairs = keys.map(key => `"${key}":${canonicalize(obj[key])}`);
    return '{' + pairs.join(',') + '}';
}

/**
 * Compute short hash (first 16 characters)
 */
export function computeShortHash(obj: any): string {
    return computeHash(obj).substring(0, 16);
}
