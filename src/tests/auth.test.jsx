import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import * as firebaseAuth from 'firebase/auth';
import * as firebaseFirestore from 'firebase/firestore';

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
    vi.clearAllMocks();
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
    firebaseAuth.onAuthStateChanged.mockImplementation((auth, cb) => {
      cb(null);
      return vi.fn();
    });
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
    const mockUser = { uid: 'uid123', email: 'test@test.com' };
    firebaseAuth.onAuthStateChanged.mockImplementation((auth, cb) => {
      cb(mockUser);
      return vi.fn();
    });
    firebaseFirestore.onSnapshot.mockImplementation((ref, cb) => {
      cb({ exists: () => true, data: () => ({ nome: 'Test', funcao: 'colaborador', email: 'test@test.com' }) });
      return vi.fn();
    });

    const Probe = () => {
      const { currentUser, userProfile } = useAuth();
      return (
        <div>
          <span data-testid="uid">{currentUser?.uid ?? 'none'}</span>
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
    let authCallback;
    const mockUser = { uid: 'uid123' };
    firebaseAuth.onAuthStateChanged.mockImplementation((auth, cb) => {
      authCallback = cb;
      cb(mockUser);
      return vi.fn();
    });
    firebaseFirestore.onSnapshot.mockImplementation((ref, cb) => {
      cb({ exists: () => true, data: () => ({ funcao: 'colaborador' }) });
      return vi.fn();
    });

    const Probe = () => {
      const { currentUser } = useAuth();
      return <div data-testid="user">{currentUser ? 'logged' : 'guest'}</div>;
    };
    const { rerender } = renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('logged'));

    // Simula logout
    authCallback(null);
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
