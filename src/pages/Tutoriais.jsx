import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { allTutorials } from '../data';
import FavoriteButton from '../components/FavoriteButton';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getFavorites } from '../services/favorites';
import { Search, Download, ExternalLink, Lock, ArrowLeft } from 'lucide-react';

function Tutoriais() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const { currentUser } = useAuth();
  const [favIds, setFavIds] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    async function loadFavs() {
      if (!currentUser) { if (!cancelled) setFavIds(new Set()); return; }
      const res = await getFavorites(currentUser.uid, 'tutorial');
      if (res.success) {
        const ids = new Set(res.favorites.map(f => f.id));
        if (!cancelled) setFavIds(ids);
      }
    }
    loadFavs();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Lógica de Categorias
  const categorias = ['todos', ...new Set(allTutorials.map(t => t.categoria))].sort();

  // Lógica de Filtro
  const tutoriaisFiltrados = allTutorials.filter(tutorial => {
    const matchCategoria = categoriaAtiva === 'todos' || tutorial.categoria.toLowerCase() === categoriaAtiva.toLowerCase();
    const matchBusca = tutorial.titulo.toLowerCase().includes(busca.toLowerCase()) || 
                       tutorial.descricao.toLowerCase().includes(busca.toLowerCase());
    return matchCategoria && matchBusca;
  });

  // Ordenar
  const tutoriaisOrdenados = [...tutoriaisFiltrados].sort((a, b) => {
    // ordem por título
    return String(a.titulo).localeCompare(String(b.titulo));
  });

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden nt-page-bg">

    {/* ThemeToggle removed */}

      <div className="relative z-10 container mx-auto px-4 py-6 md:p-8 max-w-7xl flex-grow">

        {/* --- CABEÇALHO --- */}
        <div className="relative flex justify-center items-center border-b border-hairline pb-6 mb-8">

            {/* BOTÃO VOLTAR (Agora na Esquerda: left-0) */}
            <Link
                to="/"
                className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-surface-2 text-txt hover:bg-brand hover:text-white px-4 py-2 rounded-lg shadow-lg border border-hairline hover:border-brand transition-all duration-300 group"
            >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                <span className="hidden sm:inline font-semibold text-sm">Voltar</span>
            </Link>

            {/* Logo Dinâmica (Centralizada pelo flex justify-center do pai) */}
        <div className="flex items-center gap-4">
            <img
                src={isDark ? "/img/Normatel Engenharia_BRANCO.png" : "/img/Normatel Engenharia_PRETO.png"}
                alt="Logo Normatel"
                className="h-6 md:h-8 w-auto object-contain"
            />
        </div>
     </div>
        {/* Título e Subtítulo */}
        <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold text-txt">Central de Tutoriais</h1>
            <p className="text-txt-dim mt-2 mb-8 text-lg">Encontre guias e manuais para todos os processos da equipe.</p>
        </div>

        {/* --- ÁREA DE CONTROLES --- */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-8 p-5 nt-glass text-txt">

            {/* Busca */}
            <div className="relative w-full lg:w-1/3">
                <input
                    type="text"
                    placeholder="O que você procura?"
                    className="w-full pl-10 pr-4 py-3 bg-surface-2 border border-hairline rounded-lg text-txt placeholder-txt-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-faint">
                   <Search size={20} />
                </div>
            </div>
            
            {/* Filtros e Ordenação */}
            <div className="flex flex-wrap justify-center lg:justify-end gap-2 w-full lg:w-2/3">
                {categorias.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setCategoriaAtiva(cat.toLowerCase())}
                        className={`py-2 px-5 rounded-full text-sm font-semibold transition-all duration-200 ${
                            categoriaAtiva === cat.toLowerCase()
                            ? 'bg-brand text-white shadow-md transform scale-105'
                            : 'bg-surface-2 text-txt-dim hover:text-txt'
                        }`}
                    >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                ))}
            </div>
        </div>

        {/* --- GRADE DE CARDS --- */}
        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tutoriaisFiltrados.length > 0 ? (
                tutoriaisOrdenados.map((tutorial) => {
                    const isEmBreve = tutorial.categoria.toLowerCase() === 'em breve';
                    const isCadastro = tutorial.categoria.toLowerCase() === 'cadastro';

                    return (
                        <div key={tutorial.id} className="nt-glass rounded-xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl text-txt">

                            <div className="p-6 flex-grow relative group">
                                {/* Favoritar */}
                                <div className="absolute top-4 right-4 z-10">
                                    <FavoriteButton
                                        itemId={`tutorial:${tutorial.id}`}
                                        itemType="tutorial"
                                        itemData={{
                                            name: tutorial.titulo,
                                            titulo: tutorial.titulo,
                                            descricao: tutorial.descricao,
                                            categoria: tutorial.categoria,
                                            url: tutorial.url,
                                            data: tutorial.data
                                        }}
                                        size={20}
                                        onChange={(next) => {
                                            const key = `tutorial:${tutorial.id}`;
                                            setFavIds(prev => {
                                                const s = new Set(prev);
                                                if (next) s.add(key); else s.delete(key);
                                                return s;
                                            });
                                        }}
                                    />
                                </div>
                                <span className={`inline-block text-[10px] font-bold tracking-wider uppercase mb-3 ${isEmBreve ? 'px-2 py-1 rounded bg-surface-2 text-txt-faint' : 'nt-chip'}`}>
                                    {tutorial.categoria}
                                </span>

                                <h3 className="text-xl font-bold text-txt mb-2 line-clamp-1" title={tutorial.titulo}>
                                    {tutorial.titulo}
                                </h3>
                                <p className="text-txt-dim text-sm h-10 overflow-hidden line-clamp-2">
                                    {tutorial.descricao}
                                </p>
                            </div>

                            <div className="p-5 border-t border-hairline">
                                <p className="text-xs text-txt-faint mb-4 flex items-center gap-1">
                                    📅 Atualizado: {tutorial.data}
                                </p>
                                
                                <div className="flex gap-3">
                                    {isEmBreve ? (
                                        <button disabled className="w-full flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-txt-faint bg-surface-2 cursor-not-allowed border border-hairline opacity-70">
                                            <Lock size={16} className="mr-2" /> Em breve
                                        </button>
                                    ) : (
                                        <>
                                            <a href={tutorial.url} target="_blank" rel="noreferrer" className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-brand-lite via-brand to-brand-deep hover:brightness-110 transition-all shadow-sm ${isCadastro ? 'w-full' : ''}`}>
                                                <ExternalLink size={16} className="mr-2" /> Abrir
                                            </a>

                                            {!isCadastro && (
                                                <a href={tutorial.url} download className="flex-1 flex items-center justify-center px-4 py-2 rounded-lg text-sm font-bold text-txt bg-surface-2 hover:bg-surface transition-colors border border-hairline">
                                                    <Download size={16} className="mr-2" /> Baixar
                                                </a>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="col-span-full text-center py-20">
                    <div className="bg-surface-2 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 border border-hairline">
                        <Search size={32} className="text-txt-faint" />
                    </div>
                    <h3 className="text-xl font-semibold text-txt-dim">Nenhum tutorial encontrado</h3>
                    <p className="mt-2 text-sm text-txt-faint">Tente buscar por outro termo ou mude o filtro.</p>
                </div>
            )}
        </main>

      </div>
      
      <footer className="relative z-10 w-full bg-brand py-4 mt-auto shadow-inner">
            <div className="container mx-auto text-center">
                <p className="text-white text-lg font-medium tracking-wide">
                    Nós fazemos acontecer.
                </p>
            </div>  
      </footer>
    </div>
  );
}

export default Tutoriais;
