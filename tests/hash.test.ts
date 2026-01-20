import { describe, it, expect } from 'vitest';
import { computeHash, computeShortHash } from '../src/utils/hash.js';

describe('Hash Utils', () => {
    describe('computeHash', () => {
        it('should compute consistent hash for same object', () => {
            const obj = { name: 'test', value: 123 };
            const hash1 = computeHash(obj);
            const hash2 = computeHash(obj);
            expect(hash1).toBe(hash2);
        });

        it('should compute same hash regardless of key order', () => {
            const obj1 = { a: 1, b: 2, c: 3 };
            const obj2 = { c: 3, a: 1, b: 2 };
            expect(computeHash(obj1)).toBe(computeHash(obj2));
        });

        it('should compute different hash for different objects', () => {
            const obj1 = { name: 'test1' };
            const obj2 = { name: 'test2' };
            expect(computeHash(obj1)).not.toBe(computeHash(obj2));
        });

        it('should handle nested objects', () => {
            const obj = {
                outer: {
                    inner: {
                        value: 'deep',
                    },
                },
            };
            const hash = computeHash(obj);
            expect(hash).toBeTruthy();
            expect(hash.length).toBe(64); // SHA256 produces 64 hex chars
        });

        it('should handle arrays', () => {
            const obj1 = { arr: [1, 2, 3] };
            const obj2 = { arr: [1, 2, 3] };
            const obj3 = { arr: [3, 2, 1] };

            expect(computeHash(obj1)).toBe(computeHash(obj2));
            expect(computeHash(obj1)).not.toBe(computeHash(obj3));
        });

        it('should handle null and undefined', () => {
            const obj1 = { value: null };
            const obj2 = { value: undefined };

            expect(computeHash(obj1)).toBeTruthy();
            expect(computeHash(obj1)).not.toBe(computeHash(obj2));
        });
    });

    describe('computeShortHash', () => {
        it('should return first 16 characters', () => {
            const obj = { test: 'value' };
            const shortHash = computeShortHash(obj);
            const fullHash = computeHash(obj);

            expect(shortHash.length).toBe(16);
            expect(fullHash.startsWith(shortHash)).toBe(true);
        });
    });
});
