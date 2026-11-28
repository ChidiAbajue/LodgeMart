import { beforeEach, vi } from 'vitest';
import { fakeFetch, monnify } from './fakeMonnify.js';

// Every test file talks to a fake Monnify; real network access is blocked.
vi.stubGlobal('fetch', fakeFetch);
beforeEach(() => monnify.reset());
