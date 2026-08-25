import { db } from './firebase';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

/**
 * Serviço de gerenciamento de favoritos
 * Suporta favoritar: projetos, cards, arquivos
 */

// Adicionar item aos favoritos
export const addFavorite = async (userId, itemId, itemType, itemData) => {
  try {
    const favoriteRef = doc(db, 'favorites', userId);
    const favoriteDoc = await getDoc(favoriteRef);

    const favoriteItem = {
      id: itemId,
      type: itemType, // 'project', 'card', 'file'
      name: itemData.name || itemData.nome,
      addedAt: new Date().toISOString(),
      ...itemData
    };

    if (favoriteDoc.exists()) {
      await updateDoc(favoriteRef, {
        items: arrayUnion(favoriteItem)
      });
    } else {
      await setDoc(favoriteRef, {
        userId,
        items: [favoriteItem],
        createdAt: new Date().toISOString()
      });
    }

    return { success: true, message: 'Adicionado aos favoritos' };
  } catch (error) {
    console.error('Erro ao adicionar favorito:', error);
    return { success: false, error: error.message };
  }
};

// Remover item dos favoritos
export const removeFavorite = async (userId, itemId) => {
  try {
    const favoriteRef = doc(db, 'favorites', userId);
    const favoriteDoc = await getDoc(favoriteRef);

    if (!favoriteDoc.exists()) {
      return { success: false, error: 'Nenhum favorito encontrado' };
    }

    const items = favoriteDoc.data().items || [];
    const updatedItems = items.filter(item => item.id !== itemId);

    await updateDoc(favoriteRef, {
      items: updatedItems
    });

    return { success: true, message: 'Removido dos favoritos' };
  } catch (error) {
    console.error('Erro ao remover favorito:', error);
    return { success: false, error: error.message };
  }
};

// Verificar se item está nos favoritos
export const isFavorite = async (userId, itemId) => {
  try {
    const favoriteRef = doc(db, 'favorites', userId);
    const favoriteDoc = await getDoc(favoriteRef);

    if (!favoriteDoc.exists()) return false;

    const items = favoriteDoc.data().items || [];
    return items.some(item => item.id === itemId);
  } catch (error) {
    console.error('Erro ao verificar favorito:', error);
    return false;
  }
};

// Buscar todos os favoritos do usuário
export const getFavorites = async (userId, filterByType = null) => {
  try {
    const favoriteRef = doc(db, 'favorites', userId);
    const favoriteDoc = await getDoc(favoriteRef);

    if (!favoriteDoc.exists()) {
      return { success: true, favorites: [] };
    }

    let items = favoriteDoc.data().items || [];

    if (filterByType) {
      items = items.filter(item => item.type === filterByType);
    }

    // Ordenar por data de adição (mais recente primeiro)
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
    const favoriteRef = doc(db, 'favorites', userId);
    const favoriteDoc = await getDoc(favoriteRef);

    const id = `${linkData.projetoId}_${linkData.cardName}`.replace(/\s+/g, '_');
    const now = new Date().toISOString();

    if (!favoriteDoc.exists()) {
      await setDoc(favoriteRef, {
        userId,
        items: [],
        recentLinks: [{ ...linkData, id, accessCount: 1, lastAccessedAt: now }],
        createdAt: now,
      });
      return;
    }

    const recentLinks = favoriteDoc.data().recentLinks || [];
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

    await updateDoc(favoriteRef, { recentLinks: updatedLinks });
  } catch {
    // Tracking is non-critical — fail silently
  }
};

// Buscar links recentemente acessados
export const getRecentLinks = async (userId) => {
  try {
    const favoriteRef = doc(db, 'favorites', userId);
    const favoriteDoc = await getDoc(favoriteRef);
    if (!favoriteDoc.exists()) return { success: true, recentLinks: [] };
    const recentLinks = (favoriteDoc.data().recentLinks || []).sort(
      (a, b) => new Date(b.lastAccessedAt) - new Date(a.lastAccessedAt)
    );
    return { success: true, recentLinks };
  } catch {
    return { success: false, recentLinks: [] };
  }
};
