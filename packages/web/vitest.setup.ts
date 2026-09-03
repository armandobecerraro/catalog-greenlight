import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock';
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => undefined;
}

const memory = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => {
    memory.clear();
  }
};

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorageStub
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: localStorageStub
  });
}

beforeEach(() => {
  localStorageStub.clear();
  if (typeof document !== 'undefined') {
    document.documentElement.lang = 'en';
  }
});
