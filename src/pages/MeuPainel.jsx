import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Star, Clock, TrendingUp, ExternalLink, Briefcase, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserPageHeader } from '../components/UserPageHeader';
import { Breadcrumb } from '../components/Breadcrumb';
import { getFavorites, getRecentLinks } from '../services/favorites';

function MeuPainel() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const primeiroNome = userProfile?.nome?.split(' ')[0] || currentUser?.displayName?.split(' ')[0] || 'Usuário';

  const [favProjects, setFavProjects] = useState([]);
  const [recentLinks, setRecentLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    Promise.all([
      getFavorites(currentUser.uid, 'project'),
      getRecentLinks(currentUser.uid),
    ]).then(([favRes, recentRes]) => {
      if (favRes.success) setFavProjects(favRes.favorites);
      if (recentRes.success) setRecentLinks(recentRes.recentLinks);
      setLoading(false);
    });
  }, [currentUser]);

  const topLinks = [...recentLinks]
    .sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0))
    .slice(0, 6);

  const recentLinksSorted = recentLinks.slice(0, 8);

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden nt-page-bg text-txt">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand-deep/10 rounded-full blur-3xl" />
      </div>

      <UserPageHeader backTo="/selecao-projeto" backLabel="Projetos" />

      <main className="flex-grow flex flex-col relative z-10 p-4 md:p-8">
        <div className="w-full max-w-5xl mx-auto">
          <div className="px-0 pt-2 pb-4">
            <Breadcrumb items={[{ label: 'Meu Painel' }]} />
          </div>

          {/* Cabeçalho */}
          <div className="mb-8 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand/20 border border-brand/30 flex items-center justify-center">
              <LayoutDashboard size={22} className="text-brand-lite" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-txt">Meu Painel</h1>
              <p className="text-sm text-txt-dim">Olá, {primeiroNome}. Seus projetos e links favoritos.</p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-surface-2 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-8">

              {/* Projetos favoritos */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Star size={16} className="text-yellow-400 fill-yellow-400" />
                    <h2 className="text-base font-bold text-txt">Projetos Favoritos</h2>
                    <span className="text-xs text-txt-faint bg-surface-2 px-2 py-0.5 rounded-full">{favProjects.length}</span>
                  </div>
                  <button onClick={() => navigate('/selecao-projeto')} className="text-xs text-txt-dim hover:text-brand-lite flex items-center gap-1 transition-colors">
                    Ver todos <ArrowRight size={12} />
                  </button>
                </div>

                {favProjects.length === 0 ? (
                  <div className="nt-glass p-6 text-center">
                    <Star size={28} className="text-txt-faint mx-auto mb-3" />
                    <p className="text-sm text-txt-dim">Nenhum projeto favoritado ainda.</p>
                    <button onClick={() => navigate('/selecao-projeto')} className="mt-3 text-xs text-brand-lite hover:underline">
                      Ir para projetos
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {favProjects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => navigate(`/projeto/${p.id}`)}
                        className="group nt-glass p-4 hover:border-hairline-hi text-left transition-all hover:-translate-y-0.5"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="bg-brand/20 p-1.5 rounded-lg text-brand-lite border border-brand/30">
                            <Briefcase size={14} />
                          </div>
                          <Star size={12} className="text-yellow-400 fill-yellow-400 mt-0.5" />
                        </div>
                        <p className="text-sm font-semibold text-txt group-hover:text-brand-lite transition-colors line-clamp-2">
                          {p.name || p.nome}
                        </p>
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-txt-faint">
                          <span>Abrir projeto</span>
                          <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Links mais usados */}
              {topLinks.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={16} className="text-blue-400" />
                    <h2 className="text-base font-bold text-txt">Links Mais Usados</h2>
                    <span className="text-xs text-txt-faint bg-surface-2 px-2 py-0.5 rounded-full">{topLinks.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {topLinks.map(link => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group nt-glass flex items-center gap-3 px-4 py-3 hover:border-blue-400/40 transition-all hover:-translate-y-0.5"
                      >
                        <div className="bg-blue-400/15 p-2 rounded-lg border border-blue-400/20 flex-shrink-0">
                          <ExternalLink size={14} className="text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-txt group-hover:text-blue-300 transition-colors truncate">{link.cardName}</p>
                          <p className="text-[11px] text-txt-faint truncate">{link.projetoNome}</p>
                        </div>
                        <span className="flex-shrink-0 text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full border border-blue-400/20">
                          {link.accessCount}x
                        </span>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Histórico recente */}
              {recentLinksSorted.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={16} className="text-purple-400" />
                    <h2 className="text-base font-bold text-txt">Acessados Recentemente</h2>
                  </div>
                  <div className="space-y-2">
                    {recentLinksSorted.map(link => {
                      const dateStr = new Date(link.lastAccessedAt).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      });
                      return (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-3 nt-glass hover:bg-surface-2 px-4 py-3 hover:border-hairline-hi transition-all"
                        >
                          <div className="bg-purple-400/15 p-1.5 rounded-lg border border-purple-400/20 flex-shrink-0">
                            <ExternalLink size={12} className="text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-txt truncate">{link.cardName}</p>
                            <p className="text-[11px] text-txt-faint truncate">{link.projetoNome}</p>
                          </div>
                          <span className="flex-shrink-0 text-[10px] text-txt-faint whitespace-nowrap">{dateStr}</span>
                        </a>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Estado vazio */}
              {favProjects.length === 0 && recentLinks.length === 0 && (
                <div className="text-center py-16">
                  <LayoutDashboard size={40} className="text-txt-faint mx-auto mb-4" />
                  <p className="text-txt-dim mb-2">Seu painel está vazio por enquanto.</p>
                  <p className="text-sm text-txt-faint">Favorite projetos e acesse links para popular seu painel.</p>
                  <button
                    onClick={() => navigate('/selecao-projeto')}
                    className="mt-6 inline-flex items-center gap-2 bg-brand/20 hover:bg-brand/30 text-brand-lite px-5 py-2.5 rounded-xl font-semibold text-sm border border-brand/30 transition-colors"
                  >
                    Ir para projetos <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="w-full py-6 text-center text-txt-dim text-xs border-t border-hairline bg-surface-2 relative z-10">
        &copy; {new Date().getFullYear()} Normatel Engenharia
      </footer>
    </div>
  );
}

export default MeuPainel;
