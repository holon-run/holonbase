import { existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Find the root of the holonbase repository
 * Searches up the directory tree for .holonbase directory
 */
export function findHolonbaseRoot(startPath: string): string | null {
    let currentPath = startPath;

    while (true) {
        const holonbasePath = join(currentPath, '.holonbase');
        if (existsSync(holonbasePath)) {
            return currentPath;
        }

        const parentPath = dirname(currentPath);
        if (parentPath === currentPath) {
            // Reached root
            return null;
        }
        currentPath = parentPath;
    }
}
