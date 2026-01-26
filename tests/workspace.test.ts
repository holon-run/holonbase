import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { HolonDatabase } from '../src/storage/database.js';
import { PatchManager } from '../src/core/patch.js';

// Use a test-specific HOLONBASE_HOME for isolation
const TEST_DIR = join(process.cwd(), 'tests', 'tmp', 'workspace');
const HOLON_DIR = TEST_DIR; // In global KB mode, HOLONBASE_HOME is the directory itself
const DB_PATH = join(HOLON_DIR, 'holonbase.db');

describe('Workspace Tests', () => {
    beforeEach(() => {
        if (existsSync(TEST_DIR)) {
            rmSync(TEST_DIR, { recursive: true });
        }
        mkdirSync(HOLON_DIR, { recursive: true });
    });

    afterEach(() => {
        if (existsSync(TEST_DIR)) {
            rmSync(TEST_DIR, { recursive: true });
        }
    });

    describe('Global HEAD Management', () => {
        it('should initialize with empty HEAD', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();

            const head = db.getConfig('head');
            expect(head).toBe('');

            db.close();
        });

        it('should update HEAD on commit', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();
            const patchManager = new PatchManager(db);

            const patch = patchManager.commit({
                op: 'add',
                agent: 'user/alice',
                target: 'concept-001',
                payload: {
                    object: {
                        type: 'concept',
                        content: { name: 'Test' },
                    },
                },
            });

            const head = db.getConfig('head');
            expect(head).toBe(patch.id);

            db.close();
        });
    });

    describe('Patch Chaining', () => {
        it('should chain patches from HEAD', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();
            const patchManager = new PatchManager(db);

            // First commit
            const patch1 = patchManager.commit({
                op: 'add',
                agent: 'user/alice',
                target: 'concept-001',
                payload: {
                    object: {
                        type: 'concept',
                        content: { name: 'Concept 1' },
                    },
                },
            });

            // Second commit should chain from first
            const patch2 = patchManager.commit({
                op: 'add',
                agent: 'user/alice',
                target: 'concept-002',
                payload: {
                    object: {
                        type: 'concept',
                        content: { name: 'Concept 2' },
                    },
                },
            });

            expect(patch2.content.parentId).toBe(patch1.id);
            expect(db.getConfig('head')).toBe(patch2.id);

            db.close();
        });
    });

    describe('Revert Operations', () => {
        it('should revert add operation with delete', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();
            const patchManager = new PatchManager(db);

            // Add a concept
            const addPatch = patchManager.commit({
                op: 'add',
                agent: 'user/alice',
                target: 'concept-001',
                payload: {
                    object: {
                        type: 'concept',
                        content: { name: 'Test' },
                    },
                },
            });

            // Verify object exists
            expect(db.getStateViewObject('concept-001')).toBeTruthy();

            // Revert by creating delete patch
            const revertPatch = patchManager.commit({
                op: 'delete',
                agent: 'user/alice/revert',
                target: 'concept-001',
                note: `Revert add operation from ${addPatch.id.substring(0, 8)}`,
            });

            // Verify object deleted
            expect(db.getStateViewObject('concept-001')).toBeNull();
            expect(revertPatch.content.parentId).toBe(addPatch.id);

            db.close();
        });

        it('should revert link operation with delete', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();
            const patchManager = new PatchManager(db);

            // Create a link
            const linkPatch = patchManager.commit({
                op: 'link',
                agent: 'user/alice',
                target: 'relation-001',
                payload: {
                    relation: {
                        sourceId: 'concept-1',
                        targetId: 'concept-2',
                        relationType: 'related_to',
                    },
                },
            });

            // Verify relation exists
            expect(db.getStateViewObject('relation-001')).toBeTruthy();

            // Revert by deleting the relation
            patchManager.commit({
                op: 'delete',
                agent: 'user/alice/revert',
                target: 'relation-001',
                note: `Revert link operation from ${linkPatch.id.substring(0, 8)}`,
            });

            // Verify relation deleted
            expect(db.getStateViewObject('relation-001')).toBeNull();

            db.close();
        });
    });
});
