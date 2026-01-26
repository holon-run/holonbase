import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export interface HolonConfig {
    version: string;
    defaultAgent?: string;
}

export class ConfigManager {
    private configPath: string;
    private config: HolonConfig;

    constructor(configPath: string) {
        this.configPath = configPath;
        this.config = this.load();
    }

    /**
     * Load config from file, or create default if not exists
     */
    private load(): HolonConfig {
        if (existsSync(this.configPath)) {
            const content = readFileSync(this.configPath, 'utf-8');
            return JSON.parse(content);
        }

        // Default config
        return {
            version: '0.1',
        };
    }

    /**
     * Save config to file
     */
    save(): void {
        const dir = dirname(this.configPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    }

    /**
     * Get default agent
     */
    getDefaultAgent(): string | undefined {
        return this.config.defaultAgent;
    }

    /**
     * Set default agent
     */
    setDefaultAgent(agent: string): void {
        this.config.defaultAgent = agent;
        this.save();
    }

    /**
     * Get entire config
     */
    getConfig(): HolonConfig {
        return { ...this.config };
    }
}
