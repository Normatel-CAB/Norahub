import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { Grid3x3, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { UserPageHeader } from '../components/UserPageHeader';

function AppIcon({ name, size = 18, className = '' }) {
  const Icon = (name && LucideIcons[name]) || Grid3x3;
  return <Icon size={size} className={className} />;
}

function VisualizadorApp() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.funcao === 'admin';
  const funcao = userProfile?.funcao;

  const [app, setApp] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    (async () => {
      setStatus('loading');
      const { data, error } = await supabase.from('apps_normatel').select('*').eq('id', id).single();
      if (!active) return;
      if (error || !data || data.ativo === false) {
        setStatus('blocked');
        return;
      }
      const cargos = Array.isArray(data.cargos_permitidos) ? data.cargos_permitidos : [];
      if (!isAdmin && cargos.length > 0 && !cargos.includes(funcao)) {
        setStatus('blocked');
        return;
      }
      setApp(data);
      setStatus('ok');
    })();
    return () => { active = false; };
  }, [id, isAdmin, funcao]);

  useEffect(() => {
    if (status === 'blocked') navigate('/aplicativos', { replace: true });
  }, [status, navigate]);

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] nt-page-bg">
      <UserPageHeader backTo="/aplicativos">
        {app && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="bg-brand/15 p-1.5 rounded-lg text-brand-lite shrink-0">
              <AppIcon name={app.icone} />
            </span>
            <span className="font-semibold text-txt truncate">{app.nome}</span>
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir em nova aba"
              className="text-txt-faint hover:text-brand-lite transition-colors shrink-0"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        )}
      </UserPageHeader>

      <main className="flex-grow relative">
        {status === 'loading' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand" />
          </div>
        ) : status === 'ok' ? (
          <iframe
            src={app.url}
            title={app.nome}
            className="absolute inset-0 w-full h-full border-0"
            referrerPolicy="no-referrer"
          />
        ) : null}
      </main>
    </div>
  );
}

export default VisualizadorApp;
