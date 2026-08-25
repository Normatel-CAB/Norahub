import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFavorites, toggleFavorite } from '../services/favorites';
import FavoriteButton from '../components/FavoriteButton';
import { ExternalLink, Download, ArrowLeft, Star } from 'lucide-react';

function MeusFavoritos() {
  const { currentUser } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('tutorial'); // 'all' | 'tutorial' | 'project' | 'file'

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      setLoading(true);
      const res = await getFavorites(currentUser.uid);
      if (res.success) setFavorites(res.favorites);
      setLoading(false);
    })();
  }, [currentUser]);

  const filtered = useMemo(() => {
    if (filter === 'all') return favorites;
    return favorites.filter(f => f.type === filter);
  }, [favorites, filter]);

  const handleRemove = async (fav) => {
    if (!currentUser) return;
    const res = await toggleFavorite(currentUser.uid, fav.id, fav.type, fav);
    if (res.success) {
      setFavorites(prev => prev.filter(x => x.id !== fav.id));
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Faça login para ver seus favoritos.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-6 md:p-8 max-w-7xl flex-grow">
        <div className="relative flex justify-center items-center pb-6 mb-8">
          <Link to="/" className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-white/10 backdrop-blur-xl text-white hover:bg-[#57B952] px-4 py-2 rounded-lg shadow border border-white/20 hover:border-[#57B952] transition-all">
            <ArrowLeft size={18} /> Voltar
          </Link>
          <div className="flex items-center gap-2">
            <Star size={22} className="text-yellow-500" />
            <h1 className="text-2xl md:text-3xl font-bold text-white">Meus Favoritos</h1>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-xl shadow border border-white/20 p-4 md:p-5 mb-6 flex items-center gap-2 flex-wrap">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'tutorial', label: 'Tutoriais' },
            { key: 'project', label: 'Projetos' },
            { key: 'file', label: 'Arquivos' },
          ].map(btn => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${filter === btn.key ? 'bg-[#57B952] text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-20">Carregando favoritos...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-20 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20">Nenhum favorito encontrado.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(fav => (
              <div key={fav.id} className="bg-white/10 backdrop-blur-xl rounded-xl shadow border border-white/20 p-5 relative">
                <div className="absolute top-3 right-3">
                  <FavoriteButton itemId={fav.id} itemType={fav.type} itemData={fav} size={18} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{fav.type}</p>
                <h3 className="text-lg font-bold text-white mb-1" title={fav.name || fav.titulo}>{fav.name || fav.titulo}</h3>
                {fav.descricao && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{fav.descricao}</p>
                )}
                <div className="flex gap-2">
                  {fav.url && (
                    <a href={fav.url} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-semibold text-white bg-[#57B952] hover:bg-green-600">
                      <ExternalLink size={16} className="mr-2" /> Abrir
                    </a>
                  )}
                  {fav.url && fav.type === 'tutorial' && (
                    <a href={fav.url} download className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20">
                      <Download size={16} className="mr-2" /> Baixar
                    </a>
                  )}
                  <button onClick={() => handleRemove(fav)} className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20">Remover</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <footer className="w-full bg-[#57B952] py-4 mt-auto shadow-inner">
        <div className="container mx-auto text-center">
          <p className="text-white text-lg font-medium tracking-wide">Nós fazemos acontecer.</p>
        </div>
      </footer>
    </div>
  );
}

export default MeusFavoritos;
