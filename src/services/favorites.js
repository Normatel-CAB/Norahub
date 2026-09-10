import { supabase } from './supabase';

/**
 * Serviço de gerenciamento de favoritos
 * Suporta favoritar: projetos, cards, arquivos
 * Uma linha por usuário na tabela `favorites` (PK = user_id), tudo dentro de `data` (jsonb).
 */

async function loadFavoritesData(userId) {
  const { data, error } = await supabase.from('favorites').select('data').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? (data.data || {}) : null; // null = ainda não existe linha
}

async function upsertFavoritesData(userId, newData) {
  const { error } = await supabase.from('favorites').upsert({ user_id: userId, data: newData }, { onConflict: 'user_id' });
  if (error) throw error;
}

// Adicionar item aos favoritos
export const addFavorite = async (userId, itemId, itemType, itemData) => {
  try {
    const favoriteItem = {
      id: itemId,
      type: itemType, // 'project', 'card', 'file'
      name: itemData.name || itemData.nome,
      addedAt: new Date().toISOString(),
      ...itemData,
    };

    const existing = await loadFavoritesData(userId);
    const items = [...((existing || {}).items || []), favoriteItem];
    await upsertFavoritesData(userId, { ...(existing || { createdAt: new Date().toISOString() }), items });

    return { success: true, message: 'Adicionado aos favoritos' };
  } catch (error) {
    console.error('Erro ao adicionar favorito:', error);
    return { success: false, error: error.message };
  }
};

// Remover item dos favoritos
export const removeFavorite = async (userId, itemId) => {
  try {
    const existing = await loadFavoritesData(userId);
    if (existing === null) return { success: false, error: 'Nenhum favorito encontrado' };

    const items = (existing.items || []).filter(item => item.id !== itemId);
    await upsertFavoritesData(userId, { ...existing, items });

    return { success: true, message: 'Removido dos favoritos' };
  } catch (error) {
    console.error('Erro ao remover favorito:', error);
    return { success: false, error: error.message };
  }
};

// Verificar se item está nos favoritos
export const isFavorite = async (userId, itemId) => {
  try {
    const existing = await loadFavoritesData(userId);
    if (existing === null) return false;
    return (existing.items || []).some(item => item.id === itemId);
  } catch (error) {
    console.error('Erro ao verificar favorito:', error);
    return false;
  }
};

// Buscar todos os favoritos do usuário
export const getFavorites = async (userId, filterByType = null) => {
  try {
    const existing = await loadFavoritesData(userId);
    if (existing === null) return { success: true, favorites: [] };

    let items = existing.items || [];
    if (filterByType) {
      items = items.filter(item => item.type === filterByType);
    }
    items.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

    return { success: true, favorites: items };
  } catch (error) {
    console.error('Erro ao buscar favoritos:', error);
    return { success: false, error: error.message, favorites: [] };
  }
};

// Toggle favorito (adiciona se não existe, remove se existe)
export const toggleFavorite = async (userId, itemId, itemType, itemData) => {
  const isAlreadyFavorite = await isFavorite(userId, itemId);

  if (isAlreadyFavorite) {
    return await removeFavorite(userId, itemId);
  } else {
    return await addFavorite(userId, itemId, itemType, itemData);
  }
};

// Registrar acesso a um link
export const trackLinkAccess = async (userId, linkData) => {
  try {
    const id = `${linkData.projetoId}_${linkData.cardName}`.replace(/\s+/g, '_');
    const now = new Date().toISOString();

    const existing = await loadFavoritesData(userId);

    if (existing === null) {
      await upsertFavoritesData(userId, {
        items: [],
        recentLinks: [{ ...linkData, id, accessCount: 1, lastAccessedAt: now }],
        createdAt: now,
      });
      return;
    }

    const recentLinks = existing.recentLinks || [];
    const existingIdx = recentLinks.findIndex(l => l.id === id);

    let updatedLinks;
    if (existingIdx >= 0) {
      updatedLinks = recentLinks.map((l, i) =>
        i === existingIdx
          ? { ...l, accessCount: (l.accessCount || 0) + 1, lastAccessedAt: now }
          : l
      );
    } else {
      updatedLinks = [{ ...linkData, id, accessCount: 1, lastAccessedAt: now }, ...recentLinks];
    }

    updatedLinks.sort((a, b) => new Date(b.lastAccessedAt) - new Date(a.lastAccessedAt));
    if (updatedLinks.length > 20) updatedLinks = updatedLinks.slice(0, 20);

    await upsertFavoritesData(userId, { ...existing, recentLinks: updatedLinks });
  } catch {
    // Tracking is non-critical — fail silently
  }
};

// Buscar links recentemente acessados
export const getRecentLinks = async (userId) => {
  try {
    const existing = await loadFavoritesData(userId);
    if (existing === null) return { success: true, recentLinks: [] };
    const recentLinks = (existing.recentLinks || []).sort(
      (a, b) => new Date(b.lastAccessedAt) - new Date(a.lastAccessedAt)
    );
    return { success: true, recentLinks };
  } catch {
    return { success: false, recentLinks: [] };
  }
};
