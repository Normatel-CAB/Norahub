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
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl" />
      </div>

      <UserPageHeader backTo="/selecao-projeto" backLabel="Projetos" />

      <main className="flex-grow flex flex-col relative z-10 p-4 md:p-8">
        <div className="w-full max-w-5xl mx-auto">
          <div className="px-0 pt-2 pb-4">
            <Breadcrumb items={[{ label: 'Meu Painel' }]} />
          </div>

          {/* Cabeçalho */}
          <div className="mb-8 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#57B952]/20 border border-[#57B952]/30 flex items-center justify-center">
              <LayoutDashboard size={22} className="text-[#57B952]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Meu Painel</h1>
              <p className="text-sm text-gray-400">Olá, {primeiroNome}. Seus projetos e links favoritos.</p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-8">

              {/* Projetos favoritos */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Star size={16} className="text-yellow-400 fill-yellow-400" />
                    <h2 className="text-base font-bold text-white">Projetos Favoritos</h2>
                    <span className="text-xs text-gray-500 bg-white/10 px-2 py-0.5 rounded-full">{favProjects.length}</span>
                  </div>
                  <button onClick={() => navigate('/selecao-projeto')} className="text-xs text-gray-400 hover:text-[#57B952] flex items-center gap-1 transition-colors">
                    Ver todos <ArrowRight size={12} />
                  </button>
                </div>

                {favProjects.length === 0 ? (
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-6 text-center">
                    <Star size={28} className="text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Nenhum projeto favoritado ainda.</p>
                    <button onClick={() => navigate('/selecao-projeto')} className="mt-3 text-xs text-[#57B952] hover:underline">
                      Ir para projetos
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {favProjects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => navigate(`/projeto/${p.id}`)}
                        className="group bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 hover:border-[#57B952]/40 text-left transition-all hover:-translate-y-0.5"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="bg-[#57B952]/20 p-1.5 rounded-lg text-[#57B952] border border-[#57B952]/30">
                            <Briefcase size={14} />
                          </div>
                          <Star size={12} className="text-yellow-400 fill-yellow-400 mt-0.5" />
                        </div>
                        <p className="text-sm font-semibold text-white group-hover:text-[#57B952] transition-colors line-clamp-2">
                          {p.name || p.nome}
                        </p>
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500">
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
                    <h2 className="text-base font-bold text-white">Links Mais Usados</h2>
                    <span className="text-xs text-gray-500 bg-white/10 px-2 py-0.5 rounded-full">{topLinks.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {topLinks.map(link => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/20 hover:border-blue-400/40 transition-all hover:-translate-y-0.5"
                      >
                        <div className="bg-blue-400/15 p-2 rounded-lg border border-blue-400/20 flex-shrink-0">
                          <ExternalLink size={14} className="text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors truncate">{link.cardName}</p>
                          <p className="text-[11px] text-gray-500 truncate">{link.projetoNome}</p>
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
                    <h2 className="text-base font-bold text-white">Acessados Recentemente</h2>
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
                          className="group flex items-center gap-3 bg-white/5 hover:bg-white/10 px-4 py-3 rounded-xl border border-white/10 hover:border-white/20 transition-all"
                        >
                          <div className="bg-purple-400/15 p-1.5 rounded-lg border border-purple-400/20 flex-shrink-0">
                            <ExternalLink size={12} className="text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{link.cardName}</p>
                            <p className="text-[11px] text-gray-500 truncate">{link.projetoNome}</p>
                          </div>
                          <span className="flex-shrink-0 text-[10px] text-gray-500 whitespace-nowrap">{dateStr}</span>
                        </a>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Estado vazio */}
              {favProjects.length === 0 && recentLinks.length === 0 && (
                <div className="text-center py-16">
                  <LayoutDashboard size={40} className="text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-2">Seu painel está vazio por enquanto.</p>
                  <p className="text-sm text-gray-500">Favorite projetos e acesse links para popular seu painel.</p>
                  <button
                    onClick={() => navigate('/selecao-projeto')}
                    className="mt-6 inline-flex items-center gap-2 bg-[#57B952]/20 hover:bg-[#57B952]/30 text-[#57B952] px-5 py-2.5 rounded-xl font-semibold text-sm border border-[#57B952]/30 transition-colors"
                  >
                    Ir para projetos <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="w-full py-6 text-center text-gray-400 text-xs border-t border-white/20 bg-white/5 relative z-10">
        &copy; 2025 Parceria Petrobras &amp; Normatel Engenharia
      </footer>
    </div>
  );
}

export default MeuPainel;
