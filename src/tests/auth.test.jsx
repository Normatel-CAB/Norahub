import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { supabase, setTableResult, resetSupabaseMock, emitAuthStateChange } from './mocks/supabaseMock';

// ── Helper ────────────────────────────────────────────────────────────────────
function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

// ── AuthContext ───────────────────────────────────────────────────────────────
describe('AuthContext', () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it('inicia com loading=true e resolve para loading=false', async () => {
    const Probe = () => {
      const { loading } = useAuth();
      return <div data-testid="loading">{String(loading)}</div>;
    };
    renderWithProviders(<Probe />);
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('expõe currentUser=null quando não há sessão', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    const Probe = () => {
      const { currentUser } = useAuth();
      return <div data-testid="user">{currentUser ? 'logged' : 'guest'}</div>;
    };
    renderWithProviders(<Probe />);
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('guest');
    });
  });

  it('expõe currentUser após login', async () => {
    const mockUser = { id: 'uid123', email: 'test@test.com', app_metadata: {}, user_metadata: {} };
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: mockUser } } });
    setTableResult('usuarios', {
      data: { id: 'uid123', nome: 'Test', funcao: 'colaborador', status_acesso: 'ativo', email: 'test@test.com' },
      error: null,
    });

    const Probe = () => {
      const { currentUser, userProfile } = useAuth();
      return (
        <div>
          <span data-testid="uid">{currentUser?.id ?? 'none'}</span>
          <span data-testid="role">{userProfile?.funcao ?? 'none'}</span>
        </div>
      );
    };
    renderWithProviders(<Probe />);
    await waitFor(() => {
      expect(screen.getByTestId('uid').textContent).toBe('uid123');
      expect(screen.getByTestId('role').textContent).toBe('colaborador');
    });
  });

  it('limpa o estado ao fazer logout', async () => {
    const mockUser = { id: 'uid123', email: 'test@test.com', app_metadata: {}, user_metadata: {} };
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: mockUser } } });
    setTableResult('usuarios', {
      data: { id: 'uid123', nome: 'Test', funcao: 'colaborador', status_acesso: 'ativo' },
      error: null,
    });

    const Probe = () => {
      const { currentUser } = useAuth();
      return <div data-testid="user">{currentUser ? 'logged' : 'guest'}</div>;
    };
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('logged'));

    // Simula logout via onAuthStateChange (equivalente ao antigo callback do Firebase)
    emitAuthStateChange('SIGNED_OUT', null);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('guest'));
  });
});

// ── Password validation ───────────────────────────────────────────────────────
describe('Validação de senha', () => {
  const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

  it('rejeita senhas fracas', () => {
    expect(PASSWORD_REGEX.test('12345678')).toBe(false);
    expect(PASSWORD_REGEX.test('password')).toBe(false);
    expect(PASSWORD_REGEX.test('PASSWORD1')).toBe(false);
    expect(PASSWORD_REGEX.test('abc')).toBe(false);
  });

  it('aceita senhas fortes', () => {
    expect(PASSWORD_REGEX.test('Teste@123')).toBe(true);
    expect(PASSWORD_REGEX.test('MyP@ssw0rd!')).toBe(true);
    expect(PASSWORD_REGEX.test('C0mpl3xo#Pass')).toBe(true);
  });
});
