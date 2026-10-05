import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { Grid3x3, Settings, ExternalLink, ChevronRight, ArrowLeft } from 'lucide-react';
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
    abrirEmNovaAba: row.abrir_em_nova_aba === true,
  };
}

function Aplicativos() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.funcao === 'admin';
  const funcao = userProfile?.funcao;

  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // null = tela de seleção (cartões por setor); string = dentro de um setor
  const [setorSelecionado, setSetorSelecionado] = useState(null);

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
      } catch {
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

  // Um setor por categoria, na ordem em que aparece entre os apps já
  // ordenados por "ordem" — o admin controla a ordem dos cartões só
  // organizando o campo "ordem" dos apps de cada setor.
  const setores = useMemo(() => {
    const grupos = new Map();
    for (const app of visiveis) {
      const cat = (app.categoria || '').trim() || 'Outros';
      if (!grupos.has(cat)) grupos.set(cat, []);
      grupos.get(cat).push(app);
    }
    return Array.from(grupos.entries()).map(([categoria, apps]) => ({ categoria, apps }));
  }, [visiveis]);

  // Se o setor aberto sumir dos dados (ex: ficou sem apps), `setorAtivo`
  // vem undefined e a renderização já cai de volta pra tela de seleção —
  // sem precisar sincronizar estado num effect à parte.
  const setorAtivo = setores.find(s => s.categoria === setorSelecionado);

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
              {setorAtivo ? (
                <button
                  onClick={() => setSetorSelecionado(null)}
                  className="flex items-center gap-2 text-txt-dim hover:text-brand-lite transition-colors text-sm font-semibold mb-2"
                >
                  <ArrowLeft size={16} /> Todos os setores
                </button>
              ) : null}
              <h1 className="text-2xl md:text-4xl font-bold text-txt flex items-center gap-3">
                <Grid3x3 size={32} className="md:w-10 md:h-10 text-brand-lite" />
                {setorAtivo ? setorAtivo.categoria : 'Aplicativos'}
              </h1>
              <p className="text-sm md:text-base text-txt-dim mt-2">
                {setorAtivo
                  ? `Sistemas de ${setorAtivo.categoria} liberados para o seu cargo.`
                  : 'Escolha o setor pra ver os sistemas da Normatel liberados para o seu cargo.'}
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
          ) : !setorAtivo ? (
            // Tela de seleção: um cartão por setor, igual ao padrão usado no
            // Menu Normatel — clicar entra só no setor escolhido.
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {setores.map(({ categoria, apps: appsDoSetor }) => (
                <button
                  key={categoria}
                  onClick={() => setSetorSelecionado(categoria)}
                  className="nt-beam-host group nt-glass p-8 flex flex-col items-center text-center transition-all transform hover:-translate-y-2 cursor-pointer"
                >
                  <span className="nt-beam" aria-hidden="true" />
                  <div className="nt-beam-content flex flex-col items-center">
                    <div className="bg-brand/15 p-5 rounded-full mb-5 group-hover:scale-110 transition-transform text-brand-lite">
                      <AppIcon name={appsDoSetor[0]?.icone} size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-txt mb-1">{categoria}</h3>
                    <p className="text-txt-dim text-sm mb-5">
                      {appsDoSetor.length} {appsDoSetor.length === 1 ? 'sistema' : 'sistemas'}
                    </p>
                    <span className="text-brand-lite font-bold text-sm flex items-center gap-1">
                      Ver aplicativos <ChevronRight size={16} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // Dentro de um setor: só os aplicativos daquela categoria.
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {setorAtivo.apps.map(app => {
                const cardClass = "group nt-glass p-6 flex flex-col text-left transition-all transform hover:-translate-y-1 hover:border-hairline-hi";
                const cardContent = (
                  <>
                    <div className="bg-brand/15 p-3 rounded-xl mb-4 w-fit group-hover:scale-110 transition-transform text-brand-lite">
                      <AppIcon name={app.icone} />
                    </div>
                    <h3 className="text-lg font-bold text-txt mb-1">{app.nome}</h3>
                    {app.descricao && (
                      <p className="text-txt-faint text-sm mb-4 flex-grow">{app.descricao}</p>
                    )}
                    <span className="text-brand-lite font-semibold text-sm flex items-center gap-1 mt-auto">
                      Abrir {app.abrirEmNovaAba ? <ExternalLink size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </>
                );
                return app.abrirEmNovaAba ? (
                  <a key={app.id} href={app.url} target="_blank" rel="noopener noreferrer" className={cardClass}>
                    {cardContent}
                  </a>
                ) : (
                  <Link key={app.id} to={`/aplicativos/${app.id}`} className={cardClass}>
                    {cardContent}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Aplicativos;
