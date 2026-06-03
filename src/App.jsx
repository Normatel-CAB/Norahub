import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';

// Rotas críticas (carregadas sempre — login, cadastro, seleção)
import Capa from './pages/Capa';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import EsqueceuSenha from './pages/EsqueceuSenha';
import SelecaoProjeto from './pages/SelecaoProjeto';
import PainelProjeto from './pages/PainelProjeto';
import PrivateRoute from './components/PrivateRoute';
import GlobalNotice from './components/GlobalNotice';
import InstallPWA from './components/InstallPWA';
import GlobalSearch from './components/GlobalSearch';
import PageTransition from './components/PageTransition';

// Rotas lazy — carregadas sob demanda
const Tutoriais              = lazy(() => import('./pages/Tutoriais'));
const SolicitacaoCompras     = lazy(() => import('./pages/SolicitacaoCompras'));
const AprovacaoCompras       = lazy(() => import('./pages/AprovacaoCompras'));
const Gerencia               = lazy(() => import('./pages/Gerencia'));
const GerenciaUsuarios       = lazy(() => import('./pages/GerenciaUsuarios'));
const GerenciaProjetos       = lazy(() => import('./pages/GerenciaProjetos'));
const GerenciaCargos         = lazy(() => import('./pages/GerenciaCargos'));
const Perfil                 = lazy(() => import('./pages/Perfil'));
const GerenciamentoArquivos  = lazy(() => import('./pages/GerenciamentoArquivos'));
const VisualizadorArquivo    = lazy(() => import('./pages/VisualizadorArquivo'));
const VisualizadorDashboard  = lazy(() => import('./pages/VisualizadorDashboard'));
const ConstrutorFormulario   = lazy(() => import('./pages/ConstrutorFormulario'));
const Dashboard              = lazy(() => import('./pages/Dashboard'));
const MeusFavoritos          = lazy(() => import('./pages/MeusFavoritos'));
const MeuPainel              = lazy(() => import('./pages/MeuPainel'));
const AdminCarteiras         = lazy(() => import('./pages/AdminCarteiras'));
const MinhasCarteiras        = lazy(() => import('./pages/MinhasCarteiras'));
const GerenciaCarteiras      = lazy(() => import('./pages/GerenciaCarteiras'));
const LogsAuditoria          = lazy(() => import('./pages/LogsAuditoria'));
const Lixeira                = lazy(() => import('./pages/Lixeira'));
const AdminAnalytics         = lazy(() => import('./pages/AdminAnalytics'));
const AdminDashboard         = lazy(() => import('./pages/AdminDashboard'));
const AdminCargos            = lazy(() => import('./pages/AdminCargos'));

function RouteSpinner() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#57B952]" />
    </div>
  );
}

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
        <GlobalNotice />
        <InstallPWA />
        <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        <Suspense fallback={<RouteSpinner />}>
          <Routes>
            {/* ── Rotas públicas ─────────────────────────────────────────────── */}
            <Route path="/"               element={<Capa />} />
            <Route path="/login"          element={<Login />} />
            <Route path="/cadastro"       element={<Cadastro />} />
            <Route path="/esqueceu-senha" element={<EsqueceuSenha />} />
            <Route path="/tutoriais"      element={<Tutoriais />} />

            {/* ── Rotas autenticadas ─────────────────────────────────────────── */}
            <Route path="/selecao-projeto" element={<PrivateRoute><SelecaoProjeto /></PrivateRoute>} />
            <Route path="/projeto/:id"     element={<PrivateRoute><PainelProjeto /></PrivateRoute>} />
            <Route path="/painel-projeto"  element={<PrivateRoute><PainelProjeto /></PrivateRoute>} />

            <Route path="/favoritos"              element={<PrivateRoute><MeusFavoritos /></PrivateRoute>} />
            <Route path="/meu-painel"             element={<PrivateRoute><MeuPainel /></PrivateRoute>} />
            <Route path="/perfil"                 element={<PrivateRoute><Perfil /></PrivateRoute>} />
            <Route path="/dashboard"              element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/gerenciamento-arquivos" element={<PrivateRoute><GerenciamentoArquivos /></PrivateRoute>} />
            <Route path="/visualizador-arquivo"   element={<PrivateRoute><VisualizadorArquivo /></PrivateRoute>} />
            <Route path="/visualizador-dashboard" element={<PrivateRoute><VisualizadorDashboard /></PrivateRoute>} />
            <Route path="/construtor-formulario"  element={<PrivateRoute><ConstrutorFormulario /></PrivateRoute>} />
            <Route path="/solicitacao-compras"    element={<PrivateRoute><SolicitacaoCompras /></PrivateRoute>} />
            <Route path="/aprovacao-compras"      element={<PrivateRoute><AprovacaoCompras /></PrivateRoute>} />
            <Route path="/minhas-carteiras"       element={<PrivateRoute><MinhasCarteiras /></PrivateRoute>} />

            {/* ── Rotas gerência ─────────────────────────────────────────────── */}
            <Route path="/gerencia"           element={<PrivateRoute><Gerencia /></PrivateRoute>} />
            <Route path="/gerencia-usuarios"  element={<PrivateRoute><GerenciaUsuarios /></PrivateRoute>} />
            <Route path="/gerencia-projetos"  element={<PrivateRoute><GerenciaProjetos /></PrivateRoute>} />
            <Route path="/gerencia-cargos"    element={<PrivateRoute><GerenciaCargos /></PrivateRoute>} />
            <Route path="/logs-auditoria"     element={<PrivateRoute requiredRole="gerente"><LogsAuditoria /></PrivateRoute>} />
            <Route path="/admin-analytics"    element={<PrivateRoute requiredRole="gerente"><AdminAnalytics /></PrivateRoute>} />
            <Route path="/admin-carteiras"    element={<PrivateRoute requiredRole="gerente"><AdminCarteiras /></PrivateRoute>} />
            <Route path="/projeto/:id/carteiras" element={<PrivateRoute requiredRole="gerente"><GerenciaCarteiras /></PrivateRoute>} />

            {/* ── Rotas admin ────────────────────────────────────────────────── */}
            <Route path="/admin"        element={<PrivateRoute requiredRole="admin"><AdminDashboard /></PrivateRoute>} />
            <Route path="/admin-cargos" element={<PrivateRoute requiredRole="admin"><AdminCargos /></PrivateRoute>} />
            <Route path="/lixeira"      element={<PrivateRoute requiredRole="admin"><Lixeira /></PrivateRoute>} />

            {/* ── Redirect legado ────────────────────────────────────────────── */}
            <Route path="/admin-selection" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </PageTransition>
    </BrowserRouter>
  );
}

export default App;
