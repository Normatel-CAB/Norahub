import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Capa from './pages/Capa';
import Tutoriais from './pages/Tutoriais';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import EsqueceuSenha from './pages/EsqueceuSenha';
import SolicitacaoCompras from './pages/SolicitacaoCompras';
import SelecaoProjeto from './pages/SelecaoProjeto';
import PainelProjeto from './pages/PainelProjeto';
import AdminDashboard from './pages/AdminDashboard';
import AdminCargos from './pages/AdminCargos';
import AprovacaoCompras from './pages/AprovacaoCompras';
import Gerencia from './pages/Gerencia';
import GerenciaUsuarios from './pages/GerenciaUsuarios';
import GerenciaProjetos from './pages/GerenciaProjetos';
import GerenciaCargos from './pages/GerenciaCargos';
import Perfil from './pages/Perfil';
import GerenciamentoArquivos from './pages/GerenciamentoArquivos';
import VisualizadorArquivo from './pages/VisualizadorArquivo';
import VisualizadorDashboard from './pages/VisualizadorDashboard';
import ConstrutorFormulario from './pages/ConstrutorFormulario';
import Dashboard from './pages/Dashboard';
import MeusFavoritos from './pages/MeusFavoritos';
import PrivateRoute from './components/PrivateRoute';
import InstallPWA from './components/InstallPWA';
import GlobalSearch from './components/GlobalSearch';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import Chatbot from './components/Chatbot';
import PageTransition from './components/PageTransition';
import { useState, useEffect } from 'react';

function App() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <BrowserRouter>
      <PageTransition>
        <InstallPWA />
        <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        <KeyboardShortcuts />
        <Chatbot />
        <Routes>
          <Route path="/" element={<Capa />} />
          
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/esqueceu-senha" element={<EsqueceuSenha />} />
          <Route path="/tutoriais" element={<Tutoriais />} />
          <Route path="/favoritos" element={<PrivateRoute><MeusFavoritos /></PrivateRoute>} />

          {/* Rota Protegida: Só entra se tiver login */}
          <Route 
            path="/selecao-projeto" 
            element={
              <PrivateRoute>
                <SelecaoProjeto />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/painel-projeto" 
            element={
              <PrivateRoute>
                <PainelProjeto />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/gerenciamento-arquivos" 
            element={
              <PrivateRoute>
                <GerenciamentoArquivos />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/visualizador-arquivo" 
            element={
              <PrivateRoute>
                <VisualizadorArquivo />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/visualizador-dashboard" 
            element={
              <PrivateRoute>
                <VisualizadorDashboard />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/construtor-formulario" 
            element={
              <PrivateRoute>
                <ConstrutorFormulario />
              </PrivateRoute>
            } 
          />

          {/* As páginas de ação direta continuam públicas ou protegidas conforme sua lógica */}
          <Route path="/solicitacao-compras" element={<SolicitacaoCompras />} />
          <Route path="/aprovacao-compras" element={<AprovacaoCompras />} />

          <Route path="/perfil" element={<PrivateRoute><Perfil /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/admin-selection" element={<Navigate to="/admin" replace />} />
          <Route path="/gerencia" element={<PrivateRoute><Gerencia /></PrivateRoute>} />
          <Route path="/gerencia-usuarios" element={<PrivateRoute><GerenciaUsuarios /></PrivateRoute>} />
          <Route path="/gerencia-projetos" element={<PrivateRoute><GerenciaProjetos /></PrivateRoute>} />
          <Route path="/gerencia-cargos" element={<PrivateRoute><GerenciaCargos /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute requiredRole="admin"><AdminDashboard /></PrivateRoute>} />
          <Route path="/admin-cargos" element={<PrivateRoute requiredRole="admin"><AdminCargos /></PrivateRoute>} />
        </Routes>
      </PageTransition>
    </BrowserRouter>
  );
}

export default App;