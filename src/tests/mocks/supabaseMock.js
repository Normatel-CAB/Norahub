import { vi } from 'vitest';

// Mock leve e encadeável do cliente Supabase (`@supabase/supabase-js`) pros
// testes — substitui o antigo mock de `firebase/auth` + `firebase/firestore`.
// Cada teste configura o resultado de uma tabela via `setTableResult`.

export const tableResults = {};

export function setTableResult(table, result) {
  tableResults[table] = result;
}

export function resetTableResults() {
  for (const k of Object.keys(tableResults)) delete tableResults[k];
}

function createQueryBuilder(table) {
  const getResult = () => tableResults[table] ?? { data: null, error: null };
  const builder = {};
  const chainMethods = [
    'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not', 'or',
    'ilike', 'contains', 'order', 'limit', 'range', 'update', 'insert', 'upsert', 'delete',
  ];
  chainMethods.forEach(m => { builder[m] = vi.fn(() => builder); });
  builder.maybeSingle = vi.fn(() => Promise.resolve(getResult()));
  builder.single = vi.fn(() => Promise.resolve(getResult()));
  // Awaitable diretamente (ex: `await supabase.from('x').select('*')`)
  builder.then = (resolve, reject) => Promise.resolve(getResult()).then(resolve, reject);
  builder.catch = (reject) => Promise.resolve(getResult()).catch(reject);
  return builder;
}

function createChannel() {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  };
  return channel;
}

export const authListeners = [];

export const supabase = {
  auth: {
    getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
    onAuthStateChange: vi.fn((cb) => {
      authListeners.push(cb);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    signInWithPassword: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    signInWithOAuth: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    signUp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    resetPasswordForEmail: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    updateUser: vi.fn(() => Promise.resolve({ data: {}, error: null })),
  },
  from: vi.fn((table) => createQueryBuilder(table)),
  channel: vi.fn(() => createChannel()),
  removeChannel: vi.fn(),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      list: vi.fn(() => Promise.resolve({ data: [], error: null })),
      remove: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      move: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: '' }, error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
    })),
  },
  functions: { invoke: vi.fn(() => Promise.resolve({ data: {}, error: null })) },
};

export function resetSupabaseMock() {
  resetTableResults();
  authListeners.length = 0;
  supabase.auth.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  supabase.auth.onAuthStateChange.mockClear();
  supabase.from.mockClear();
  supabase.channel.mockClear();
  supabase.removeChannel.mockClear();
}

export function emitAuthStateChange(event, session) {
  authListeners.forEach(cb => cb(event, session));
}
