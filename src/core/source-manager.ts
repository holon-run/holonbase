import { HolonDatabase } from '../storage/database.js';
import { SourceAdapter } from '../adapters/types.js';
import { LocalAdapter } from '../adapters/local.js';

/**
 * Configuration for a data source
 */
export interface SourceConfig {
    name: string;
    type: 'local' | 'git' | 'gdrive' | 'web' | 'api';
    config: any;
    lastSync?: string;
    createdAt: string;
}

/**
 * Manage data sources and their adapters
 */
export class SourceManager {
    constructor(private db: HolonDatabase) { }

    /**
     * Add a new data source
     */
    async addSource(name: string, type: string, config: any): Promise<void> {
        // Validate adapter creation before saving
        this.createAdapter(type, config);

        // Check if source already exists
        const existing = this.db.getSource(name);
        if (existing) {
            throw new Error(`Source '${name}' already exists`);
        }

        this.db.insertSource(name, type, config);
    }

    /**
     * Get a source by name
     */
    getSource(name: string): SourceAdapter {
        const source = this.db.getSource(name);
        if (!source) {
            throw new Error(`Source '${name}' not found`);
        }
        return this.createAdapter(source.type, source.config);
    }

    /**
     * List all data sources
     */
    listSources(): SourceConfig[] {
        return this.db.getAllSources();
    }

    /**
     * Remove a data source
     */
    async removeSource(name: string): Promise<void> {
        const source = this.db.getSource(name);
        if (!source) {
            throw new Error(`Source '${name}' not found`);
        }
        this.db.deleteSource(name);
    }

    /**
     * Create an adapter instance based on type
     */
    private createAdapter(type: string, config: any): SourceAdapter {
        switch (type) {
            case 'local':
                if (!config.path) {
                    throw new Error("Local source requires 'path' in config");
                }
                return new LocalAdapter(config.path);
            case 'git':
                // TODO: Implement GitAdapter
                throw new Error("GitAdapter not yet implemented");
            default:
                throw new Error(`Unsupported source type: ${type}`);
        }
    }
}
