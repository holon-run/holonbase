import { describe, it, expect } from 'vitest';
import { PatchInputSchema, HolonObjectSchema } from '../src/types/index.js';

describe('Type Validation', () => {
    describe('PatchInputSchema', () => {
        it('should validate valid patch input', () => {
            const validPatch = {
                op: 'add',
                agent: 'user/alice',
                target: 'concept-001',
                payload: {
                    object: {
                        type: 'concept',
                        content: { name: 'Test' },
                    },
                },
                confidence: 0.9,
                note: 'Test patch',
            };

            const result = PatchInputSchema.safeParse(validPatch);
            expect(result.success).toBe(true);
        });

        it('should reject patch with invalid op', () => {
            const invalidPatch = {
                op: 'invalid_op',
                agent: 'user/alice',
                target: 'concept-001',
            };

            const result = PatchInputSchema.safeParse(invalidPatch);
            expect(result.success).toBe(false);
        });

        it('should reject patch with missing required fields', () => {
            const invalidPatch = {
                op: 'add',
                // missing agent and target
            };

            const result = PatchInputSchema.safeParse(invalidPatch);
            expect(result.success).toBe(false);
        });

        it('should reject patch with invalid confidence', () => {
            const invalidPatch = {
                op: 'add',
                agent: 'user/alice',
                target: 'concept-001',
                confidence: 1.5, // > 1
            };

            const result = PatchInputSchema.safeParse(invalidPatch);
            expect(result.success).toBe(false);
        });

        it('should accept all valid operations', () => {
            const ops = ['add', 'update', 'delete', 'link', 'merge'];

            for (const op of ops) {
                const patch = {
                    op,
                    agent: 'user/alice',
                    target: 'obj-001',
                };

                const result = PatchInputSchema.safeParse(patch);
                expect(result.success).toBe(true);
            }
        });
    });

    describe('HolonObjectSchema', () => {
        it('should validate valid object', () => {
            const validObject = {
                id: 'abc123',
                type: 'concept',
                content: { name: 'Test' },
                createdAt: new Date().toISOString(),
            };

            const result = HolonObjectSchema.safeParse(validObject);
            expect(result.success).toBe(true);
        });

        it('should reject object with invalid type', () => {
            const invalidObject = {
                id: 'abc123',
                type: 'invalid_type',
                content: {},
                createdAt: new Date().toISOString(),
            };

            const result = HolonObjectSchema.safeParse(invalidObject);
            expect(result.success).toBe(false);
        });

        it('should reject object with invalid datetime', () => {
            const invalidObject = {
                id: 'abc123',
                type: 'concept',
                content: {},
                createdAt: 'not-a-datetime',
            };

            const result = HolonObjectSchema.safeParse(invalidObject);
            expect(result.success).toBe(false);
        });

        it('should accept all valid object types', () => {
            const types = ['concept', 'claim', 'relation', 'note', 'evidence', 'file', 'patch'];

            for (const type of types) {
                const obj = {
                    id: 'abc123',
                    type,
                    content: {},
                    createdAt: new Date().toISOString(),
                };

                const result = HolonObjectSchema.safeParse(obj);
                expect(result.success).toBe(true);
            }
        });
    });
});
