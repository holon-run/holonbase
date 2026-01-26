import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ConfigManager } from '../src/utils/config.js';

const TEST_DIR = join(process.cwd(), 'tests', 'tmp', 'config');
const CONFIG_PATH = join(TEST_DIR, 'config.json');

describe('ConfigManager Tests', () => {
    beforeEach(() => {
        if (existsSync(TEST_DIR)) {
            rmSync(TEST_DIR, { recursive: true });
        }
        mkdirSync(TEST_DIR, { recursive: true });
    });

    afterEach(() => {
        if (existsSync(TEST_DIR)) {
            rmSync(TEST_DIR, { recursive: true });
        }
    });

    describe('Initialization', () => {
        it('should create default config if file does not exist', () => {
            const config = new ConfigManager(CONFIG_PATH);

            expect(config.getDefaultAgent()).toBeUndefined();
        });

        it('should load existing config', () => {
            // Create a config file
            const existingConfig = {
                version: '0.1',
                defaultAgent: 'user/alice',
            };
            writeFileSync(CONFIG_PATH, JSON.stringify(existingConfig));

            const config = new ConfigManager(CONFIG_PATH);

            expect(config.getDefaultAgent()).toBe('user/alice');
        });
    });

    describe('Default Agent Management', () => {
        it('should get and set default agent', () => {
            const config = new ConfigManager(CONFIG_PATH);

            expect(config.getDefaultAgent()).toBeUndefined();

            config.setDefaultAgent('user/bob');
            expect(config.getDefaultAgent()).toBe('user/bob');
        });

        it('should persist default agent to file', () => {
            const config1 = new ConfigManager(CONFIG_PATH);
            config1.setDefaultAgent('agent/ai');

            // Load config again
            const config2 = new ConfigManager(CONFIG_PATH);
            expect(config2.getDefaultAgent()).toBe('agent/ai');
        });
    });

    describe('Config Retrieval', () => {
        it('should return complete config object', () => {
            const config = new ConfigManager(CONFIG_PATH);
            config.setDefaultAgent('user/test');

            const fullConfig = config.getConfig();

            expect(fullConfig.version).toBe('0.1');
            expect(fullConfig.defaultAgent).toBe('user/test');
        });
    });
});
