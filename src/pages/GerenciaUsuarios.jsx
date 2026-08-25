import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Unified into AdminDashboard — redirect transparently
function GerenciaUsuarios() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/admin', { replace: true }); }, [navigate]);
  return null;
}

export default GerenciaUsuarios;
