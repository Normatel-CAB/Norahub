import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { supabase } from './mocks/supabaseMock';

// Mock do cliente Supabase para todos os testes — substitui o antigo mock
// de firebase/auth + firebase/firestore.
vi.mock('../services/supabase', () => ({ supabase }));

// Suprimir logs de console nos testes
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
