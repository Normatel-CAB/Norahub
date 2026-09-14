import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';

// Avalia permissão de admin/gerente de forma síncrona, sem ir ao banco
function quickAdminCheck(userProfile, pathname) {
  if (!userProfile || !pathname.startsWith('/admin')) return null; // inconclusivo
  if (userProfile.funcao === 'admin') return true;
  if (typeof userProfile.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente')) return true;
  return null; // precisa checar cargos no banco
}

function PrivateRoute({ children, requiredRole, requiredPermission }) {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();

  // Tenta resolver permissão admin de forma síncrona a partir do perfil em memória
  const quickResult = useMemo(
    () => quickAdminCheck(userProfile, location.pathname),
    // funcao é o único campo usado por quickAdminCheck — evita recalcular à toa
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userProfile?.funcao, location.pathname]
  );

  // Apenas chega aqui se quickResult === null (cargo custom que precisa do banco)
  const [cargoPermission, setCargoPermission] = useState(null);
  const [cargoLoading, setCargoLoading] = useState(false);

  useEffect(() => {
    if (quickResult !== null) {
      setCargoPermission(null);
      setCargoLoading(false);
      return;
    }
    if (!userProfile || !location.pathname.startsWith('/admin')) {
      setCargoPermission(false);
      setCargoLoading(false);
      return;
    }

    let cancelled = false;
    setCargoLoading(true);
    supabase
      .from('cargos')
      .select('*')
      .eq('nome', userProfile.funcao)
      .maybeSingle()
      .then(({ data: c }) => {
        if (cancelled) return;
        if (c) {
          // Se a rota exige uma permissão específica, verifica só ela.
          // Caso contrário, verifica permissões genéricas de área admin.
          const granted = requiredPermission
            ? !!c[requiredPermission]
            : (c.can_manage_users || c.can_manage_permissions || false);
          setCargoPermission(granted);
        } else {
          setCargoPermission(false);
        }
      })
      .catch(() => { if (!cancelled) setCargoPermission(false); })
      .finally(() => { if (!cancelled) setCargoLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.funcao, location.pathname, quickResult, requiredPermission]);

  // Spinner enquanto a sessão ou o perfil carregam
  const spinner = (
    <div className="min-h-screen w-full flex items-center justify-center nt-page-bg">
      <div className="relative z-10 animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand" />
    </div>
  );

  if (loading) return spinner;
  if (!currentUser) return <Navigate to="/login" replace />;

  // Aguarda cargos do banco apenas quando necessário
  if (cargoLoading) return spinner;

  // Rota /admin
  if (location.pathname.startsWith('/admin')) {
    const hasAccess = quickResult ?? cargoPermission ?? false;
    if (!hasAccess) return <Navigate to="/" replace />;
  } else if (requiredRole && userProfile) {
    // Rotas com requiredRole fora de /admin (ex: gerente, admin)
    const funcao = userProfile.funcao ?? '';
    const isAdminUser    = funcao === 'admin';
    const isExactMatch   = funcao === requiredRole;
    const isGerenteMatch = requiredRole === 'gerente' && funcao.toLowerCase().includes('gerente');
    if (!isAdminUser && !isExactMatch && !isGerenteMatch) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

export default PrivateRoute;
