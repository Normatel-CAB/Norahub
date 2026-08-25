import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Firebase para todos os testes
vi.mock('../services/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn(),
  },
  db: {},
  storage: {},
  functions: {},
}));

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  onAuthStateChanged:         vi.fn((auth, cb) => { cb(null); return vi.fn(); }),
  setPersistence:             vi.fn(() => Promise.resolve()),
  browserLocalPersistence:    'local',
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut:                    vi.fn(() => Promise.resolve()),
  signInWithPopup:            vi.fn(),
  signInWithRedirect:         vi.fn(),
  getRedirectResult:          vi.fn(() => Promise.resolve(null)),
  OAuthProvider:              vi.fn().mockImplementation(() => ({
    setCustomParameters: vi.fn(),
  })),
}));

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  doc:             vi.fn(),
  getDoc:          vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  getDocs:         vi.fn(() => Promise.resolve({ docs: [], empty: true })),
  setDoc:          vi.fn(() => Promise.resolve()),
  updateDoc:       vi.fn(() => Promise.resolve()),
  addDoc:          vi.fn(() => Promise.resolve({ id: 'mock-id' })),
  deleteDoc:       vi.fn(() => Promise.resolve()),
  onSnapshot:      vi.fn((ref, cb) => { cb({ exists: () => false, data: () => ({}) }); return vi.fn(); }),
  collection:      vi.fn(),
  query:           vi.fn(),
  where:           vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
}));

// Mock firebase/functions
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: {} }))),
}));

// Suprimir logs de console nos testes
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
