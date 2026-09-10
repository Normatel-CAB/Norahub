import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { Grid3x3, Settings, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { UserPageHeader } from '../components/UserPageHeader';

// Resolve qualquer nome de ícone lucide-react salvo no banco; cai num
// ícone padrão se o nome não existir (ex: admin digitou errado).
function AppIcon({ name, size = 26, className = '' }) {
  const Icon = (name && LucideIcons[name]) || Grid3x3;
  return <Icon size={size} className={className} />;
}

function mapAppRow(row) {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    url: row.url,
    categoria: row.categoria,
    icone: row.icone,
    cargosPermitidos: row.cargos_permitidos,
    ativo: row.ativo,
    ordem: row.ordem,
  };
}

function Aplicativos() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.funcao === 'admin';
  const funcao = userProfile?.funcao;

  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const { data, error: fetchErr } = await supabase.from('apps_normatel').select('*');
        if (!active) return;
        if (fetchErr) throw fetchErr;
        setApps((data || []).map(mapAppRow));
        setError(null);
      } catch (err) {
        if (active) setError('Não foi possível carregar a lista de sistemas.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Admin sempre vê tudo (inclusive pra conferir o cadastro); os demais só
  // veem apps sem restrição de cargo ou cujo cargosPermitidos inclui o seu.
  const visiveis = useMemo(() => {
    return apps
      .filter(a => a.ativo !== false)
      .filter(a => {
        if (isAdmin) return true;
        const cargos = Array.isArray(a.cargosPermitidos) ? a.cargosPermitidos : [];
        return cargos.length === 0 || cargos.includes(funcao);
      })
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }, [apps, isAdmin, funcao]);

  const porCategoria = useMemo(() => {
    const grupos = new Map();
    for (const app of visiveis) {
      const cat = (app.categoria || '').trim() || 'Outros';
      if (!grupos.has(cat)) grupos.set(cat, []);
      grupos.get(cat).push(app);
    }
    return Array.from(grupos.entries());
  }, [visiveis]);

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl" />
      </div>

      <UserPageHeader backTo="/selecao-projeto" />

      <main className="flex-grow p-3 md:p-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-8 gap-3">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-white flex items-center gap-3">
                <Grid3x3 size={32} className="md:w-10 md:h-10 text-[#57B952]" />
                Aplicativos
              </h1>
              <p className="text-sm md:text-base text-gray-400 mt-2">
                Sistemas da Normatel liberados para o seu cargo.
              </p>
            </div>
            {isAdmin && (
              <Link
                to="/admin-aplicativos"
                className="bg-purple-500/20 text-purple-300 px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow transition-all hover:scale-105 hover:bg-purple-500/30 text-sm border border-purple-500/30"
              >
                <Settings size={16} /> Gerenciar
              </Link>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-40 rounded-2xl bg-white/[0.05] animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 font-medium">{error}</p>
            </div>
          ) : visiveis.length === 0 ? (
            <div className="text-center py-20 bg-white/5 border border-white/10 rounded-2xl">
              <Grid3x3 size={40} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-300 font-medium">Nenhum sistema liberado para o seu cargo ainda.</p>
              <p className="text-gray-500 text-sm mt-1">Fale com o administrador se você esperava ver algo aqui.</p>
            </div>
          ) : (
            <div className="space-y-8 md:space-y-10">
              {porCategoria.map(([categoria, appsDaCategoria]) => (
                <div key={categoria}>
                  <h2 className="text-sm md:text-base font-bold text-gray-400 uppercase tracking-wider mb-3 md:mb-4">
                    {categoria}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {appsDaCategoria.map(app => (
                      <a
                        key={app.id}
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col text-left transition-all transform hover:-translate-y-1 hover:border-[#57B952]/40"
                      >
                        <div className="bg-green-900/30 p-3 rounded-xl mb-4 w-fit group-hover:scale-110 transition-transform text-[#57B952]">
                          <AppIcon name={app.icone} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">{app.nome}</h3>
                        {app.descricao && (
                          <p className="text-gray-500 text-sm mb-4 flex-grow">{app.descricao}</p>
                        )}
                        <span className="text-[#57B952] font-semibold text-sm flex items-center gap-1 mt-auto">
                          Abrir <ExternalLink size={14} />
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Aplicativos;
