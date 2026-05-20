import { db } from './firebase';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

// ─── Paleta de cores disponíveis ─────────────────────────────────────────────
export const CORES_CARTEIRA = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
  '#F97316', '#EAB308', '#22C55E', '#57B952',
  '#06B6D4', '#64748B',
];

// ─── Carteiras padrão do sistema ─────────────────────────────────────────────
export const CARTEIRAS_PADRAO = [
  { nome: 'Civil',          descricao: 'Setor de Engenharia Civil',          cor: '#3B82F6', ordem: 1  },
  { nome: 'Logística',      descricao: 'Setor de Logística e Suprimentos',   cor: '#F97316', ordem: 2  },
  { nome: 'Planejamento',   descricao: 'Setor de Planejamento',               cor: '#8B5CF6', ordem: 3  },
  { nome: 'RH',             descricao: 'Recursos Humanos',                    cor: '#EC4899', ordem: 4  },
  { nome: 'Elétrica',       descricao: 'Setor de Engenharia Elétrica',        cor: '#EAB308', ordem: 5  },
  { nome: 'Áreas Verdes',   descricao: 'Manutenção de Áreas Verdes',          cor: '#22C55E', ordem: 6  },
  { nome: 'Administrativo', descricao: 'Setor Administrativo',                cor: '#64748B', ordem: 7  },
  { nome: 'Limpeza',        descricao: 'Setor de Limpeza e Conservação',      cor: '#06B6D4', ordem: 8  },
  { nome: 'SMS',            descricao: 'Saúde, Meio Ambiente e Segurança',    cor: '#EF4444', ordem: 9  },
  { nome: 'Compras',        descricao: 'Setor de Compras e Aquisições',       cor: '#57B952', ordem: 10 },
];

// ─── Cargos padrão do sistema ─────────────────────────────────────────────────
export const CARGOS_PADRAO = [
  {
    nome: 'Engenheiro',
    tipo: 'colaborador',
    canManageUsers: false,
    canDeleteUsers: false,
    canManagePermissions: false,
    canChangeCarteiras: false,
    canManageProjectMembers: false,
    canCreateCargos: false,
    canCreateProjetos: false,
    canEditCardsProjetos: false,
  },
  {
    nome: 'Supervisor',
    tipo: 'colaborador',
    canManageUsers: false,
    canDeleteUsers: false,
    canManagePermissions: false,
    canChangeCarteiras: false,
    canManageProjectMembers: false,
    canCreateCargos: false,
    canCreateProjetos: false,
    canEditCardsProjetos: true,
  },
  {
    nome: 'Gerente de Projeto',
    tipo: 'gerente',
    canManageUsers: true,
    canDeleteUsers: true,
    canManagePermissions: true,
    canChangeCarteiras: true,
    canManageProjectMembers: true,
    canCreateCargos: false,
    canCreateProjetos: true,
    canEditCardsProjetos: true,
  },
];

// ─── CRUD de Carteiras ────────────────────────────────────────────────────────

export const getCarteiras = async () => {
  try {
    const snap = await getDocs(collection(db, 'carteiras'));
    const carteiras = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));
    return { success: true, carteiras };
  } catch (err) {
    return { success: false, carteiras: [], error: err.message };
  }
};

export const getCarteira = async (id) => {
  try {
    const snap = await getDoc(doc(db, 'carteiras', id));
    if (!snap.exists()) return { success: false, carteira: null };
    return { success: true, carteira: { id: snap.id, ...snap.data() } };
  } catch (err) {
    return { success: false, carteira: null, error: err.message };
  }
};

export const createCarteira = async (data, userId) => {
  try {
    const ref = await addDoc(collection(db, 'carteiras'), {
      nome: data.nome.trim(),
      descricao: (data.descricao || '').trim(),
      cor: data.cor || '#57B952',
      ordem: data.ordem ?? 99,
      links: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    });
    return { success: true, id: ref.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const updateCarteira = async (id, data) => {
  try {
    await updateDoc(doc(db, 'carteiras', id), { ...data, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const deleteCarteira = async (id) => {
  try {
    await deleteDoc(doc(db, 'carteiras', id));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ─── CRUD de Links dentro de Carteiras ───────────────────────────────────────

const genLinkId = () => `lk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

export const addLink = async (carteiraId, linkData, userId) => {
  try {
    const snap = await getDoc(doc(db, 'carteiras', carteiraId));
    if (!snap.exists()) return { success: false, error: 'Carteira não encontrada' };
    const link = {
      id: genLinkId(),
      nome: linkData.nome.trim(),
      url: (linkData.url || '').trim(),
      tipo: linkData.tipo || 'link',
      descricao: (linkData.descricao || '').trim(),
      criadoEm: new Date().toISOString(),
      criadoPor: userId,
    };
    const links = [...(snap.data().links || []), link];
    await updateDoc(doc(db, 'carteiras', carteiraId), { links, updatedAt: serverTimestamp() });
    return { success: true, link };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const updateLink = async (carteiraId, linkId, linkData) => {
  try {
    const snap = await getDoc(doc(db, 'carteiras', carteiraId));
    if (!snap.exists()) return { success: false };
    const links = (snap.data().links || []).map(l =>
      l.id === linkId ? { ...l, ...linkData } : l
    );
    await updateDoc(doc(db, 'carteiras', carteiraId), { links, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const removeLink = async (carteiraId, linkId) => {
  try {
    const snap = await getDoc(doc(db, 'carteiras', carteiraId));
    if (!snap.exists()) return { success: false };
    const links = (snap.data().links || []).filter(l => l.id !== linkId);
    await updateDoc(doc(db, 'carteiras', carteiraId), { links, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ─── Seeders ──────────────────────────────────────────────────────────────────

export const seedCarteiras = async (userId) => {
  try {
    const existing = await getDocs(collection(db, 'carteiras'));
    if (!existing.empty) return { success: false, reason: 'already_seeded' };
    await Promise.all(
      CARTEIRAS_PADRAO.map(c =>
        addDoc(collection(db, 'carteiras'), {
          ...c, links: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userId,
        })
      )
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const seedCargos = async () => {
  try {
    const existing = await getDocs(collection(db, 'cargos'));
    const existingNames = new Set(existing.docs.map(d => d.data().nome));
    const toCreate = CARGOS_PADRAO.filter(c => !existingNames.has(c.nome));
    if (toCreate.length === 0) return { success: true, created: 0 };
    await Promise.all(
      toCreate.map(c =>
        addDoc(collection(db, 'cargos'), {
          ...c,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    );
    return { success: true, created: toCreate.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
