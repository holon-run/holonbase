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

    describe('Views Management', () => {
        it('should initialize with main view', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();

            const mainView = db.getView('main');
            expect(mainView).toBeTruthy();
            expect(mainView.name).toBe('main');
            expect(mainView.headPatchId).toBe('');

            db.close();
        });

        it('should create and retrieve views', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();

            db.createView('experiment', 'patch-123');

            const view = db.getView('experiment');
            expect(view).toBeTruthy();
            expect(view.name).toBe('experiment');
            expect(view.headPatchId).toBe('patch-123');

            db.close();
        });

        it('should list all views', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();

            db.createView('experiment', 'patch-123');
            db.createView('feature/test', 'patch-456');

            const views = db.getAllViews();
            expect(views.length).toBe(3); // main + 2 new views
            expect(views.map(v => v.name)).toContain('main');
            expect(views.map(v => v.name)).toContain('experiment');
            expect(views.map(v => v.name)).toContain('feature/test');

            db.close();
        });

        it('should update view HEAD', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();

            db.createView('test', 'patch-1');
            db.updateView('test', 'patch-2');

            const view = db.getView('test');
            expect(view.headPatchId).toBe('patch-2');

            db.close();
        });

        it('should delete views', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();

            db.createView('temp', 'patch-123');
            expect(db.getView('temp')).toBeTruthy();

            db.deleteView('temp');
            expect(db.getView('temp')).toBeNull();

            db.close();
        });
    });

    describe('View-based Commits', () => {
        it('should commit to specific view', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();
            const patchManager = new PatchManager(db);

            // Create a view
            db.createView('experiment', '');

            // Commit to experiment view
            const patch1 = patchManager.commit({
                op: 'add',
                agent: 'user/alice',
                target: 'concept-001',
                payload: {
                    object: {
                        type: 'concept',
                        content: { name: 'Test' },
                    },
                },
            }, 'experiment');

            // Verify view HEAD updated
            const view = db.getView('experiment');
            expect(view.headPatchId).toBe(patch1.id);

            // Main view should still be empty
            const mainView = db.getView('main');
            expect(mainView.headPatchId).toBe('');

            db.close();
        });

        it('should maintain separate patch chains for different views', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();
            const patchManager = new PatchManager(db);

            // Commit to main
            const mainPatch = patchManager.commit({
                op: 'add',
                agent: 'user/alice',
                target: 'concept-main',
                payload: {
                    object: {
                        type: 'concept',
                        content: { name: 'Main Concept' },
                    },
                },
            }, 'main');

            // Create experiment view from main
            db.createView('experiment', mainPatch.id);

            // Commit to experiment
            const expPatch = patchManager.commit({
                op: 'add',
                agent: 'user/bob',
                target: 'concept-exp',
                payload: {
                    object: {
                        type: 'concept',
                        content: { name: 'Experiment Concept' },
                    },
                },
            }, 'experiment');

            // Verify different HEADs
            const mainView = db.getView('main');
            const expView = db.getView('experiment');

            expect(mainView.headPatchId).toBe(mainPatch.id);
            expect(expView.headPatchId).toBe(expPatch.id);
            expect(expPatch.content.parentId).toBe(mainPatch.id);

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
