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
  const [abaAtiva, setAbaAtiva] = useState(null);

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

  // Abas: uma por categoria, na ordem em que cada categoria aparece pela
  // primeira vez entre os apps já ordenados por "ordem" — assim o admin
  // controla a ordem das abas só organizando o campo "ordem" dos apps.
  const abas = useMemo(() => {
    const grupos = new Map();
    for (const app of visiveis) {
      const cat = (app.categoria || '').trim() || 'Outros';
      if (!grupos.has(cat)) grupos.set(cat, []);
      grupos.get(cat).push(app);
    }
    return Array.from(grupos.entries()).map(([categoria, apps]) => ({ categoria, apps }));
  }, [visiveis]);

  // Mantém a aba ativa válida conforme os dados chegam/mudam; se a aba
  // salva sumir (ex: categoria ficou vazia), volta pra primeira disponível.
  useEffect(() => {
    if (abas.length === 0) { setAbaAtiva(null); return; }
    setAbaAtiva(atual => (atual && abas.some(a => a.categoria === atual)) ? atual : abas[0].categoria);
  }, [abas]);

  const grupoAtivo = abas.find(a => a.categoria === abaAtiva);

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden nt-page-bg">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand-deep/10 rounded-full blur-3xl" />
      </div>

      <UserPageHeader backTo="/selecao-projeto" />

      <main className="flex-grow p-3 md:p-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-8 gap-3">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-txt flex items-center gap-3">
                <Grid3x3 size={32} className="md:w-10 md:h-10 text-brand-lite" />
                Aplicativos
              </h1>
              <p className="text-sm md:text-base text-txt-dim mt-2">
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
                <div key={i} className="h-40 rounded-2xl bg-surface animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 font-medium">{error}</p>
            </div>
          ) : visiveis.length === 0 ? (
            <div className="text-center py-20 nt-glass">
              <Grid3x3 size={40} className="mx-auto text-txt-faint mb-4" />
              <p className="text-txt-dim font-medium">Nenhum sistema liberado para o seu cargo ainda.</p>
              <p className="text-txt-faint text-sm mt-1">Fale com o administrador se você esperava ver algo aqui.</p>
            </div>
          ) : (
            <div>
              {/* Barra de abas — uma por categoria. Rola horizontalmente em
                  telas estreitas em vez de quebrar linha. */}
              <div
                role="tablist"
                aria-label="Categorias de aplicativos"
                className="flex gap-2 overflow-x-auto pb-3 mb-6 md:mb-8 -mx-1 px-1 scrollbar-thin"
              >
                {abas.map(({ categoria, apps: appsDaAba }) => {
                  const ativa = categoria === abaAtiva;
                  return (
                    <button
                      key={categoria}
                      role="tab"
                      aria-selected={ativa}
                      onClick={() => setAbaAtiva(categoria)}
                      className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border transition-all whitespace-nowrap ${
                        ativa
                          ? 'text-white border-transparent shadow-lg'
                          : 'text-txt-dim border-hairline bg-surface hover:bg-surface-2 hover:text-txt'
                      }`}
                      style={ativa ? { background: 'linear-gradient(90deg, var(--brand-lite), var(--brand), var(--brand-deep))' } : undefined}
                    >
                      {categoria}
                      <span className={`ml-2 text-xs ${ativa ? 'text-white/80' : 'text-txt-faint'}`}>
                        {appsDaAba.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {grupoAtivo && (
                <div
                  role="tabpanel"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
                >
                  {grupoAtivo.apps.map(app => (
                    <a
                      key={app.id}
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group nt-glass p-6 flex flex-col text-left transition-all transform hover:-translate-y-1 hover:border-hairline-hi"
                    >
                      <div className="bg-brand/15 p-3 rounded-xl mb-4 w-fit group-hover:scale-110 transition-transform text-brand-lite">
                        <AppIcon name={app.icone} />
                      </div>
                      <h3 className="text-lg font-bold text-txt mb-1">{app.nome}</h3>
                      {app.descricao && (
                        <p className="text-txt-faint text-sm mb-4 flex-grow">{app.descricao}</p>
                      )}
                      <span className="text-brand-lite font-semibold text-sm flex items-center gap-1 mt-auto">
                        Abrir <ExternalLink size={14} />
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Aplicativos;
