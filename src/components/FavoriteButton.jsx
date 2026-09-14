import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { toggleFavorite, isFavorite } from '../services/favorites';
import { useAuth } from '../context/AuthContext';

function FavoriteButton({ itemId, itemType, itemData, size = 20, className = '', onChange }) {
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();

  useEffect(() => {
    checkFavorite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, itemType, currentUser?.uid]);

  const checkFavorite = async () => {
    try {
      setError('');
      if (!currentUser || !itemId) return;
      const isFav = await isFavorite(currentUser.uid, itemId);
      setFavorited(isFav);
    } catch (e) {
      console.error('Erro ao verificar favorito:', e);
    }
  };

  const handleToggle = async (e) => {
    e.stopPropagation(); // Evitar propagação do clique
    if (!currentUser || loading) return;

    setLoading(true);
    setError('');
    try {
      const result = await toggleFavorite(currentUser.uid, itemId, itemType, itemData);
      if (result.success) {
        setFavorited((prev) => {
          const next = !prev;
          if (typeof onChange === 'function') {
            try { onChange(next, { itemId, itemType, itemData }); } catch {}
          }
          return next;
        });
      } else {
        setError(result.error || 'Não foi possível atualizar favorito.');
        alert(result.error || 'Não foi possível atualizar favorito.');
      }
    } catch (err) {
      console.error('Erro ao alternar favorito:', err);
      setError(err.message || 'Erro inesperado.');
      alert(err.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      aria-pressed={favorited}
      className={`p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95 ${favorited ? 'bg-yellow-500/20 backdrop-blur-sm' : 'bg-surface-2 backdrop-blur-sm hover:bg-yellow-500/20'} ${loading ? 'opacity-70 cursor-not-allowed' : ''} ${className}`}
      title={favorited ? '⭐ Favoritado! Clique para remover' : '☆ Adicionar aos favoritos'}
    >
      <Star
        size={size}
        className={`transition-colors ${
          favorited
            ? 'fill-yellow-400 text-yellow-500 drop-shadow-md'
            : 'text-txt-dim hover:text-yellow-500'
        }`}
      />
    </button>
  );
}

export default FavoriteButton;
