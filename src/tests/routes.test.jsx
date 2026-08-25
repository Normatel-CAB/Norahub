import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import PrivateRoute from '../components/PrivateRoute';
import * as firebaseAuth from 'firebase/auth';
import * as firebaseFirestore from 'firebase/firestore';

const Protected = () => <div>Área protegida</div>;
const LoginPage = () => <div>Login</div>;

function renderRoute(path, userMock = null, profileMock = null) {
  if (userMock) {
    firebaseAuth.onAuthStateChanged.mockImplementation((auth, cb) => {
      cb(userMock);
      return vi.fn();
    });
    if (profileMock) {
      firebaseFirestore.onSnapshot.mockImplementation((ref, cb) => {
        cb({ exists: () => true, data: () => profileMock });
        return vi.fn();
      });
    }
  } else {
    firebaseAuth.onAuthStateChanged.mockImplementation((auth, cb) => {
      cb(null);
      return vi.fn();
    });
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
  beforeEach(() => vi.clearAllMocks());

  it('redireciona para /login quando não autenticado', async () => {
    renderRoute('/protegida');
    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument();
    });
  });

  it('renderiza o conteúdo quando autenticado', async () => {
    renderRoute('/protegida', { uid: 'u1' }, { funcao: 'colaborador', statusAcesso: 'ativo' });
    await waitFor(() => {
      expect(screen.getByText('Área protegida')).toBeInTheDocument();
    });
  });

  it('bloqueia rota /admin para colaborador comum', async () => {
    firebaseFirestore.getDocs.mockResolvedValue({ empty: true, docs: [] });
    renderRoute('/admin', { uid: 'u2' }, { funcao: 'colaborador', statusAcesso: 'ativo' });
    await waitFor(() => {
      expect(screen.queryByText('Área protegida')).not.toBeInTheDocument();
    });
  });

  it('permite rota /admin para admin', async () => {
    renderRoute('/admin', { uid: 'u3' }, { funcao: 'admin', statusAcesso: 'ativo' });
    await waitFor(() => {
      expect(screen.getByText('Área protegida')).toBeInTheDocument();
    });
  });

  it('permite rota /admin para gerente', async () => {
    renderRoute('/admin', { uid: 'u4' }, { funcao: 'Gerente de Projeto', statusAcesso: 'ativo' });
    await waitFor(() => {
      expect(screen.getByText('Área protegida')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
