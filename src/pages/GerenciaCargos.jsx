import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Unified into AdminCargos — redirect transparently
function GerenciaCargos() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/admin-cargos', { replace: true }); }, [navigate]);
  return null;
}

export default GerenciaCargos;
