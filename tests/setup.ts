import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock crypto API
const crypto = {
  randomUUID: () => 'test-uuid',
  subtle: {
    importKey: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
  },
};

// Mock window.crypto
Object.defineProperty(window, 'crypto', {
  value: crypto,
  writable: true,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
}); 