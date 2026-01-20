import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { HolonDatabase } from '../src/storage/database.js';
import { PatchManager } from '../src/core/patch.js';

const TEST_DIR = join(process.cwd(), 'tests', 'tmp', 'integration');
const HOLON_DIR = join(TEST_DIR, '.holonbase');
const DB_PATH = join(HOLON_DIR, 'holonbase.db');

describe('Integration Tests', () => {
    beforeEach(() => {
        // Clean up and create test directory
        if (existsSync(TEST_DIR)) {
            rmSync(TEST_DIR, { recursive: true });
        }
        mkdirSync(HOLON_DIR, { recursive: true });
    });

    afterEach(() => {
        // Clean up
        if (existsSync(TEST_DIR)) {
            rmSync(TEST_DIR, { recursive: true });
        }
    });

    describe('Complete Workflow', () => {
        it('should handle complete patch workflow', () => {
            // Initialize database
            const db = new HolonDatabase(DB_PATH);
            db.initialize();
            const patchManager = new PatchManager(db);

            // 1. Add a concept
            const patch1 = patchManager.commit({
                op: 'add',
                agent: 'user/alice',
                target: 'concept-001',
                payload: {
                    object: {
                        type: 'concept',
                        content: {
                            name: 'Quantum Entanglement',
                            definition: 'A quantum phenomenon',
                        },
                    },
                },
                confidence: 0.9,
                note: 'Initial concept',
            });

            expect(patch1.id).toBeTruthy();
            expect(patch1.type).toBe('patch');
            expect(patchManager.getHead()).toBe(patch1.id);

            // 2. Add a claim
            const patch2 = patchManager.commit({
                op: 'add',
                agent: 'agent/extractor',
                target: 'claim-001',
                payload: {
                    object: {
                        type: 'claim',
                        content: {
                            statement: 'Quantum entanglement is spooky',
                            confidence: 0.7,
                        },
                    },
                },
            });

            expect(patch2.content.parentId).toBe(patch1.id);
            expect(patchManager.getHead()).toBe(patch2.id);

            // 3. Link with relation
            const patch3 = patchManager.commit({
                op: 'link',
                agent: 'user/alice',
                target: 'relation-001',
                payload: {
                    relation: {
                        sourceId: 'claim-001',
                        targetId: 'concept-001',
                        relationType: 'about',
                    },
                },
            });

            expect(patch3.content.parentId).toBe(patch2.id);

            // 4. Update concept
            const patch4 = patchManager.commit({
                op: 'update',
                agent: 'user/alice',
                target: 'concept-001',
                payload: {
                    changes: {
                        definition: 'A quantum phenomenon where particles remain connected',
                    },
                },
                note: 'Updated definition',
            });

            // Verify patch chain
            const allPatches = patchManager.getAllPatches();
            expect(allPatches.length).toBe(4);

            // Verify state view
            const concept = db.getStateViewObject('concept-001');
            expect(concept).toBeTruthy();
            expect(concept.content.name).toBe('Quantum Entanglement');
            expect(concept.content.definition).toBe('A quantum phenomenon where particles remain connected');

            const claim = db.getStateViewObject('claim-001');
            expect(claim).toBeTruthy();

            const relation = db.getStateViewObject('relation-001');
            expect(relation).toBeTruthy();
            expect(relation.content.relationType).toBe('about');

            // Verify all objects
            const allObjects = db.getAllStateViewObjects();
            expect(allObjects.length).toBe(3);

            db.close();
        });

        it('should handle delete operation', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();
            const patchManager = new PatchManager(db);

            // Add object
            patchManager.commit({
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

            let obj = db.getStateViewObject('concept-001');
            expect(obj).toBeTruthy();

            // Delete object
            patchManager.commit({
                op: 'delete',
                agent: 'user/alice',
                target: 'concept-001',
            });

            obj = db.getStateViewObject('concept-001');
            expect(obj).toBeNull();

            // Verify patches still exist
            const patches = patchManager.getAllPatches();
            expect(patches.length).toBe(2);

            db.close();
        });

        it('should handle merge operation', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();
            const patchManager = new PatchManager(db);

            // Add two concepts
            patchManager.commit({
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

            patchManager.commit({
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

            expect(db.getAllStateViewObjects().length).toBe(2);

            // Merge them
            patchManager.commit({
                op: 'merge',
                agent: 'user/alice',
                target: 'concept-merged',
                payload: {
                    merge: {
                        sourceIds: ['concept-001', 'concept-002'],
                        targetId: 'concept-merged',
                    },
                },
            });

            // Source objects should be deleted
            expect(db.getStateViewObject('concept-001')).toBeNull();
            expect(db.getStateViewObject('concept-002')).toBeNull();

            db.close();
        });

        it('should maintain patch history correctly', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();
            const patchManager = new PatchManager(db);

            const patchIds: string[] = [];

            // Create a chain of patches
            for (let i = 0; i < 5; i++) {
                const patch = patchManager.commit({
                    op: 'add',
                    agent: 'user/alice',
                    target: `obj-${i}`,
                    payload: {
                        object: {
                            type: 'concept',
                            content: { name: `Concept ${i}` },
                        },
                    },
                });
                patchIds.push(patch.id);
            }

            // Verify patch chain
            for (let i = 1; i < patchIds.length; i++) {
                const patch = patchManager.getPatch(patchIds[i]);
                expect(patch?.content.parentId).toBe(patchIds[i - 1]);
            }

            // First patch should have no parent
            const firstPatch = patchManager.getPatch(patchIds[0]);
            expect(firstPatch?.content.parentId).toBeUndefined();

            // HEAD should point to last patch
            expect(patchManager.getHead()).toBe(patchIds[patchIds.length - 1]);

            db.close();
        });

        it('should retrieve patches by target object', () => {
            const db = new HolonDatabase(DB_PATH);
            db.initialize();
            const patchManager = new PatchManager(db);

            const target = 'concept-001';

            // Add object
            patchManager.commit({
                op: 'add',
                agent: 'user/alice',
                target,
                payload: {
                    object: {
                        type: 'concept',
                        content: { name: 'Test', version: 1 },
                    },
                },
            });

            // Update object multiple times
            patchManager.commit({
                op: 'update',
                agent: 'user/alice',
                target,
                payload: {
                    changes: { version: 2 },
                },
            });

            patchManager.commit({
                op: 'update',
                agent: 'user/alice',
                target,
                payload: {
                    changes: { version: 3 },
                },
            });

            // Add another object
            patchManager.commit({
                op: 'add',
                agent: 'user/alice',
                target: 'concept-002',
                payload: {
                    object: {
                        type: 'concept',
                        content: { name: 'Other' },
                    },
                },
            });

            // Get patches for target
            const targetPatches = patchManager.getPatchesByTarget(target);

            expect(targetPatches.length).toBe(3);
            expect(targetPatches.every(p => p.content.target === target)).toBe(true);

            db.close();
        });
    });
});
