import { existsSync, mkdirSync, constants } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { access } from 'fs/promises';

/**
 * Error thrown when HOLONBASE_HOME is invalid or unwritable
 */
export class HolonHomeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HolonHomeError';
    }
}

/**
 * Get the HOLONBASE_HOME directory path
 *
 * Resolution order:
 * 1. HOLONBASE_HOME environment variable
 * 2. Default to ~/.holonbase
 *
 * @returns The absolute path to the holonbase home directory
 */
export function getHolonHome(): string {
    const envHome = process.env.HOLONBASE_HOME;
    if (envHome) {
        // Normalize to absolute path to avoid CWD-dependent behavior
        return resolve(envHome);
    }
    return join(homedir(), '.holonbase');
}

/**
 * Ensure the holonbase home directory exists and is writable
 *
 * @param homePath The path to check/verify
 * @throws HolonHomeError if the path is invalid or unwritable
 */
export async function ensureHolonHome(homePath: string = getHolonHome()): Promise<void> {
    // Check if path exists
    if (!existsSync(homePath)) {
        try {
            // Create directory with parents
            mkdirSync(homePath, { recursive: true });
        } catch (error) {
            throw new HolonHomeError(
                `Failed to create HOLONBASE_HOME at '${homePath}': ${(error as Error).message}`
            );
        }
        // Fall through to verify the created directory
    }

    // Verify it's a directory
    try {
        const stats = await import('fs/promises').then(fs => fs.stat(homePath));
        if (!stats.isDirectory()) {
            throw new HolonHomeError(
                `HOLONBASE_HOME path '${homePath}' exists but is not a directory`
            );
        }
    } catch (error) {
        if (error instanceof HolonHomeError) {
            throw error;
        }
        throw new HolonHomeError(
            `Failed to access HOLONBASE_HOME at '${homePath}': ${(error as Error).message}`
        );
    }

    // Verify it's writable and executable (both required for directory operations)
    try {
        await access(homePath, constants.W_OK | constants.X_OK);
    } catch {
        throw new HolonHomeError(
            `HOLONBASE_HOME at '${homePath}' is not writable or not executable. ` +
            `Check permissions and try again.`
        );
    }
}

/**
 * Get the database path within HOLONBASE_HOME
 *
 * @returns The absolute path to holonbase.db
 */
export function getDatabasePath(): string {
    return join(getHolonHome(), 'holonbase.db');
}

/**
 * Get the config file path within HOLONBASE_HOME
 *
 * @returns The absolute path to config.json
 */
export function getConfigPath(): string {
    return join(getHolonHome(), 'config.json');
}

/**
 * Get a path relative to HOLONBASE_HOME
 *
 * @param relativePath The relative path within HOLONBASE_HOME
 * @returns The absolute path
 */
export function getHomePath(relativePath: string): string {
    return join(getHolonHome(), relativePath);
}

/**
 * Check if holonbase has been initialized (database exists)
 *
 * @returns true if initialized, false otherwise
 */
export function isInitialized(): boolean {
    const dbPath = getDatabasePath();
    return existsSync(dbPath);
}
