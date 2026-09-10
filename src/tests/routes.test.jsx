import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import PrivateRoute from '../components/PrivateRoute';
import { supabase, setTableResult, resetSupabaseMock } from './mocks/supabaseMock';

const Protected = () => <div>Área protegida</div>;
const LoginPage = () => <div>Login</div>;

function renderRoute(path, userMock = null, profileMock = null) {
  if (userMock) {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: userMock } } });
    setTableResult('usuarios', {
      data: { id: userMock.id, status_acesso: 'ativo', ...profileMock },
      error: null,
    });
  } else {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
  }

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/protegida"
            element={<PrivateRoute><Protected /></PrivateRoute>}
          />
          <Route
            path="/admin"
            element={<PrivateRoute requiredRole="admin"><Protected /></PrivateRoute>}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('PrivateRoute', () => {
  beforeEach(() => resetSupabaseMock());

  it('redireciona para /login quando não autenticado', async () => {
    renderRoute('/protegida');
    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument();
    });
  });

  it('renderiza o conteúdo quando autenticado', async () => {
    renderRoute('/protegida', { id: 'u1' }, { funcao: 'colaborador' });
    await waitFor(() => {
      expect(screen.getByText('Área protegida')).toBeInTheDocument();
    });
  });

  it('bloqueia rota /admin para colaborador comum', async () => {
    setTableResult('cargos', { data: null, error: null });
    renderRoute('/admin', { id: 'u2' }, { funcao: 'colaborador' });
    await waitFor(() => {
      expect(screen.queryByText('Área protegida')).not.toBeInTheDocument();
    });
  });

  it('permite rota /admin para admin', async () => {
    renderRoute('/admin', { id: 'u3' }, { funcao: 'admin' });
    await waitFor(() => {
      expect(screen.getByText('Área protegida')).toBeInTheDocument();
    });
  });

  it('permite rota /admin para gerente', async () => {
    renderRoute('/admin', { id: 'u4' }, { funcao: 'Gerente de Projeto' });
    await waitFor(() => {
      expect(screen.getByText('Área protegida')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
