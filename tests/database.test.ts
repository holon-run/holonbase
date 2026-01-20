import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { HolonDatabase } from '../src/storage/database.js';

const TEST_DB_DIR = join(process.cwd(), 'tests', 'tmp');
const TEST_DB_PATH = join(TEST_DB_DIR, 'test.db');

describe('Database', () => {
    let db: HolonDatabase;

    beforeEach(() => {
        // Create test directory
        if (!existsSync(TEST_DB_DIR)) {
            mkdirSync(TEST_DB_DIR, { recursive: true });
        }

        // Remove existing test db
        if (existsSync(TEST_DB_PATH)) {
            rmSync(TEST_DB_PATH);
        }

        db = new HolonDatabase(TEST_DB_PATH);
        db.initialize();
    });

    afterEach(() => {
        db.close();
        // Clean up
        if (existsSync(TEST_DB_PATH)) {
            rmSync(TEST_DB_PATH);
        }
    });

    describe('Object Operations', () => {
        it('should insert and retrieve object', () => {
            const id = 'test-001';
            const type = 'concept';
            const content = { name: 'Test Concept' };
            const createdAt = new Date().toISOString();

            db.insertObject(id, type, content, createdAt);

            const retrieved = db.getObject(id);

            expect(retrieved).toBeTruthy();
            expect(retrieved.id).toBe(id);
            expect(retrieved.type).toBe(type);
            expect(retrieved.content).toEqual(content);
        });

        it('should return null for non-existent object', () => {
            const retrieved = db.getObject('non-existent');
            expect(retrieved).toBeNull();
        });

        it('should retrieve objects by type', () => {
            db.insertObject('concept-1', 'concept', { name: 'C1' }, new Date().toISOString());
            db.insertObject('concept-2', 'concept', { name: 'C2' }, new Date().toISOString());
            db.insertObject('claim-1', 'claim', { statement: 'S1' }, new Date().toISOString());

            const concepts = db.getObjectsByType('concept');
            const claims = db.getObjectsByType('claim');

            expect(concepts.length).toBe(2);
            expect(claims.length).toBe(1);
        });
    });

    describe('Patch Operations', () => {
        it('should retrieve patches by target', () => {
            const target = 'concept-001';
            const now = new Date().toISOString();

            db.insertObject('patch-1', 'patch', { op: 'add', target, agent: 'user' }, now);
            db.insertObject('patch-2', 'patch', { op: 'update', target, agent: 'user' }, now);
            db.insertObject('patch-3', 'patch', { op: 'add', target: 'other', agent: 'user' }, now);

            const patches = db.getPatchesByTarget(target);

            expect(patches.length).toBe(2);
            expect(patches.every(p => p.content.target === target)).toBe(true);
        });

        it('should retrieve all patches ordered by date', () => {
            const now = Date.now();

            db.insertObject('patch-1', 'patch', { op: 'add', target: 'obj1', agent: 'user' }, new Date(now).toISOString());
            db.insertObject('patch-2', 'patch', { op: 'add', target: 'obj2', agent: 'user' }, new Date(now + 1000).toISOString());
            db.insertObject('patch-3', 'patch', { op: 'add', target: 'obj3', agent: 'user' }, new Date(now + 2000).toISOString());

            const patches = db.getAllPatches();

            expect(patches.length).toBe(3);
            // Should be in descending order (newest first)
            expect(patches[0].id).toBe('patch-3');
            expect(patches[2].id).toBe('patch-1');
        });

        it('should limit number of patches returned', () => {
            const now = new Date().toISOString();

            for (let i = 0; i < 10; i++) {
                db.insertObject(`patch-${i}`, 'patch', { op: 'add', target: `obj${i}`, agent: 'user' }, now);
            }

            const patches = db.getAllPatches(5);

            expect(patches.length).toBe(5);
        });
    });

    describe('Config Operations', () => {
        it('should set and get config values', () => {
            db.setConfig('test-key', 'test-value');

            const value = db.getConfig('test-key');

            expect(value).toBe('test-value');
        });

        it('should return null for non-existent config', () => {
            const value = db.getConfig('non-existent');
            expect(value).toBeNull();
        });

        it('should update existing config', () => {
            db.setConfig('key', 'value1');
            db.setConfig('key', 'value2');

            const value = db.getConfig('key');

            expect(value).toBe('value2');
        });

        it('should initialize HEAD config', () => {
            const head = db.getConfig('head');
            expect(head).toBe('');
        });
    });

    describe('State View Operations', () => {
        it('should upsert and retrieve state view object', () => {
            const objectId = 'concept-001';
            const type = 'concept';
            const content = { name: 'Test' };
            const updatedAt = new Date().toISOString();

            db.upsertStateView(objectId, type, content, false, updatedAt);

            const retrieved = db.getStateViewObject(objectId);

            expect(retrieved).toBeTruthy();
            expect(retrieved.id).toBe(objectId);
            expect(retrieved.type).toBe(type);
            expect(retrieved.content).toEqual(content);
        });

        it('should not retrieve deleted objects', () => {
            const objectId = 'concept-001';
            const updatedAt = new Date().toISOString();

            db.upsertStateView(objectId, 'concept', { name: 'Test' }, true, updatedAt);

            const retrieved = db.getStateViewObject(objectId);

            expect(retrieved).toBeNull();
        });

        it('should retrieve all state view objects', () => {
            const now = new Date().toISOString();

            db.upsertStateView('obj1', 'concept', { name: 'C1' }, false, now);
            db.upsertStateView('obj2', 'claim', { statement: 'S1' }, false, now);
            db.upsertStateView('obj3', 'concept', { name: 'C2' }, true, now); // deleted

            const all = db.getAllStateViewObjects();
            const concepts = db.getAllStateViewObjects('concept');

            expect(all.length).toBe(2); // Excludes deleted
            expect(concepts.length).toBe(1);
        });
    });
});
