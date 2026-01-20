import { describe, it, expect } from 'vitest';
import { computeDiff, formatDiff } from '../src/core/diff.js';

describe('Diff Engine', () => {
    describe('computeDiff', () => {
        it('should detect added objects', () => {
            const from = new Map();
            const to = new Map([
                ['obj1', { type: 'concept', content: { name: 'Test' } }],
            ]);

            const diff = computeDiff(from, to);

            expect(diff.added.length).toBe(1);
            expect(diff.added[0].objectId).toBe('obj1');
            expect(diff.removed.length).toBe(0);
            expect(diff.modified.length).toBe(0);
        });

        it('should detect removed objects', () => {
            const from = new Map([
                ['obj1', { type: 'concept', content: { name: 'Test' } }],
            ]);
            const to = new Map();

            const diff = computeDiff(from, to);

            expect(diff.added.length).toBe(0);
            expect(diff.removed.length).toBe(1);
            expect(diff.removed[0].objectId).toBe('obj1');
            expect(diff.modified.length).toBe(0);
        });

        it('should detect modified objects', () => {
            const from = new Map([
                ['obj1', { type: 'concept', content: { name: 'Test', value: 1 } }],
            ]);
            const to = new Map([
                ['obj1', { type: 'concept', content: { name: 'Test', value: 2 } }],
            ]);

            const diff = computeDiff(from, to);

            expect(diff.added.length).toBe(0);
            expect(diff.removed.length).toBe(0);
            expect(diff.modified.length).toBe(1);
            expect(diff.modified[0].objectId).toBe('obj1');
            expect(diff.modified[0].changes.length).toBe(1);
            expect(diff.modified[0].changes[0].path).toBe('value');
            expect(diff.modified[0].changes[0].oldValue).toBe(1);
            expect(diff.modified[0].changes[0].newValue).toBe(2);
        });

        it('should detect nested field changes', () => {
            const from = new Map([
                [
                    'obj1',
                    {
                        type: 'concept',
                        content: {
                            meta: { version: 1, author: 'alice' },
                        },
                    },
                ],
            ]);
            const to = new Map([
                [
                    'obj1',
                    {
                        type: 'concept',
                        content: {
                            meta: { version: 2, author: 'alice' },
                        },
                    },
                ],
            ]);

            const diff = computeDiff(from, to);

            expect(diff.modified.length).toBe(1);
            expect(diff.modified[0].changes.length).toBe(1);
            expect(diff.modified[0].changes[0].path).toBe('meta.version');
            expect(diff.modified[0].changes[0].oldValue).toBe(1);
            expect(diff.modified[0].changes[0].newValue).toBe(2);
        });

        it('should detect added and removed fields', () => {
            const from = new Map([
                ['obj1', { type: 'concept', content: { name: 'Test', oldField: 'old' } }],
            ]);
            const to = new Map([
                ['obj1', { type: 'concept', content: { name: 'Test', newField: 'new' } }],
            ]);

            const diff = computeDiff(from, to);

            expect(diff.modified.length).toBe(1);
            expect(diff.modified[0].changes.length).toBe(2);

            const changes = diff.modified[0].changes;
            const removedField = changes.find(c => c.path === 'oldField');
            const addedField = changes.find(c => c.path === 'newField');

            expect(removedField?.oldValue).toBe('old');
            expect(removedField?.newValue).toBeUndefined();
            expect(addedField?.oldValue).toBeUndefined();
            expect(addedField?.newValue).toBe('new');
        });

        it('should handle array changes', () => {
            const from = new Map([
                ['obj1', { type: 'concept', content: { tags: ['a', 'b'] } }],
            ]);
            const to = new Map([
                ['obj1', { type: 'concept', content: { tags: ['a', 'b', 'c'] } }],
            ]);

            const diff = computeDiff(from, to);

            expect(diff.modified.length).toBe(1);
            expect(diff.modified[0].changes.length).toBe(1);
            expect(diff.modified[0].changes[0].path).toBe('tags');
        });

        it('should return empty diff for identical states', () => {
            const state = new Map([
                ['obj1', { type: 'concept', content: { name: 'Test' } }],
            ]);

            const diff = computeDiff(state, state);

            expect(diff.added.length).toBe(0);
            expect(diff.removed.length).toBe(0);
            expect(diff.modified.length).toBe(0);
        });
    });

    describe('formatDiff', () => {
        it('should format added objects', () => {
            const diff = {
                added: [{ objectId: 'obj1', type: 'concept', content: { name: 'Test' } }],
                removed: [],
                modified: [],
            };

            const formatted = formatDiff(diff);

            expect(formatted).toContain('=== Added Objects ===');
            expect(formatted).toContain('+ [concept] obj1');
        });

        it('should format removed objects', () => {
            const diff = {
                added: [],
                removed: [{ objectId: 'obj1', type: 'concept', content: { name: 'Test' } }],
                modified: [],
            };

            const formatted = formatDiff(diff);

            expect(formatted).toContain('=== Removed Objects ===');
            expect(formatted).toContain('- [concept] obj1');
        });

        it('should format modified objects', () => {
            const diff = {
                added: [],
                removed: [],
                modified: [
                    {
                        objectId: 'obj1',
                        type: 'concept',
                        changes: [{ path: 'name', oldValue: 'Old', newValue: 'New' }],
                    },
                ],
            };

            const formatted = formatDiff(diff);

            expect(formatted).toContain('=== Modified Objects ===');
            expect(formatted).toContain('~ [concept] obj1');
            expect(formatted).toContain('name:');
            expect(formatted).toContain('- "Old"');
            expect(formatted).toContain('+ "New"');
        });

        it('should show "No differences found" for empty diff', () => {
            const diff = {
                added: [],
                removed: [],
                modified: [],
            };

            const formatted = formatDiff(diff);

            expect(formatted).toContain('No differences found');
        });
    });
});
