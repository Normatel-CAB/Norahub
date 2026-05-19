import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

function PrivateRoute({ children, requiredRole }) {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();
  const [hasAdminPermission, setHasAdminPermission] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(true);

  // Verificar se o cargo tem permissão de admin quando tentar acessar /admin
  useEffect(() => {
    const checkAdminPermission = async () => {
      if (!userProfile) {
        setHasAdminPermission(false);
        setPermissionLoading(false);
        return;
      }

      // Se não está tentando acessar /admin, não precisa verificar
      if (!location.pathname.startsWith('/admin')) {
        setHasAdminPermission(false);
        setPermissionLoading(false);
        return;
      }

      // Para rotas /admin: admin tem acesso automático
      if (userProfile.funcao === 'admin') {
        setHasAdminPermission(true);
        setPermissionLoading(false);
        return;
      }

      // Todos os gerentes (qualquer cargo que começa com "gerente") têm acesso automático a /admin
      if (typeof userProfile.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente')) {
        setHasAdminPermission(true);
        setPermissionLoading(false);
        return;
      }

      // Para outros cargos em /admin: verificar se tem canManageUsers ou canManagePermissions
      try {
        const cargosQuery = query(
          collection(db, 'cargos'),
          where('nome', '==', userProfile.funcao)
        );
        const cargosSnapshot = await getDocs(cargosQuery);
        
        if (!cargosSnapshot.empty) {
          const cargoData = cargosSnapshot.docs[0].data();
          // Permite acesso se tiver permissão de gerenciar usuários ou permissões
          const temPermissao = cargoData.canManageUsers || cargoData.canManagePermissions;
          setHasAdminPermission(temPermissao);
        } else {
          setHasAdminPermission(false);
        }
      } catch {
        setHasAdminPermission(false);
      }
      
      setPermissionLoading(false);
    };

    checkAdminPermission();
  }, [userProfile, location.pathname]);

  if (loading || permissionLoading) return <div className="min-h-screen w-full flex items-center justify-center bg-gray-900"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#57B952]"></div></div>;

  if (!currentUser) return <Navigate to="/login" replace />;

  // Se for rota de admin
  if (location.pathname.startsWith('/admin')) {
    if (userProfile?.funcao !== 'admin' && !hasAdminPermission) {
      return <Navigate to="/" replace />;
    }
  } else if (requiredRole && userProfile) {
    const funcao = userProfile.funcao ?? '';
    const isAdminUser = funcao === 'admin';
    const isExactMatch = funcao === requiredRole;
    // "gerente" como requiredRole aceita qualquer cargo que contenha "gerente"
    const isGerenteMatch = requiredRole === 'gerente' && funcao.toLowerCase().includes('gerente');
    if (!isAdminUser && !isExactMatch && !isGerenteMatch) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
export default PrivateRoute;