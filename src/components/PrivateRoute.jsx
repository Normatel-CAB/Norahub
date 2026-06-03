import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

// Avalia permissão de admin/gerente de forma síncrona, sem Firestore
function quickAdminCheck(userProfile, pathname) {
  if (!userProfile || !pathname.startsWith('/admin')) return null; // inconclusivo
  if (userProfile.funcao === 'admin') return true;
  if (typeof userProfile.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente')) return true;
  return null; // precisa checar cargos no Firestore
}

function PrivateRoute({ children, requiredRole }) {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();

  // Tenta resolver permissão admin de forma síncrona a partir do perfil em memória
  const quickResult = useMemo(
    () => quickAdminCheck(userProfile, location.pathname),
    [userProfile, location.pathname]
  );

  // Apenas chega aqui se quickResult === null (cargo custom que precisa de Firestore)
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

    setCargoLoading(true);
    const cargosQuery = query(collection(db, 'cargos'), where('nome', '==', userProfile.funcao));
    getDocs(cargosQuery)
      .then(snap => {
        if (!snap.empty) {
          const c = snap.docs[0].data();
          setCargoPermission(c.canManageUsers || c.canManagePermissions || false);
        } else {
          setCargoPermission(false);
        }
      })
      .catch(() => setCargoPermission(false))
      .finally(() => setCargoLoading(false));
  }, [userProfile, location.pathname, quickResult]);

  // Spinner enquanto Firebase Auth ou perfil carrega
  const spinner = (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#57B952]" />
    </div>
  );

  if (loading) return spinner;
  if (!currentUser) return <Navigate to="/login" replace />;

  // Aguarda cargos do Firestore apenas quando necessário
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
