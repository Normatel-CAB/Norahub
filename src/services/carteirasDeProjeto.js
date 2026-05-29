import { db } from './firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const genId = () => `c_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
const genLinkId = () => `l_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getCarteiras(projetoId) {
  try {
    const snap = await getDoc(doc(db, 'projetos', projetoId));
    if (!snap.exists()) return { success: false, carteiras: [] };
    const list = (snap.data().carteiras || []).sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));
    return { success: true, carteiras: list };
  } catch (err) {
    return { success: false, carteiras: [], error: err.message };
  }
}

// ─── Carteira CRUD ────────────────────────────────────────────────────────────

export async function createCarteira(projetoId, data, userId) {
  try {
    const snap = await getDoc(doc(db, 'projetos', projetoId));
    if (!snap.exists()) return { success: false };
    const nova = {
      id: genId(),
      nome: data.nome.trim(),
      descricao: (data.descricao || '').trim(),
      cor: data.cor || '#57B952',
      ordem: data.ordem ?? 99,
      links: [],
      criadoEm: new Date().toISOString(),
      criadoPor: userId,
    };
    const existing = snap.data().carteiras || [];
    const carteiras = [...existing, nova].sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));
    await updateDoc(doc(db, 'projetos', projetoId), { carteiras, updatedAt: serverTimestamp() });
    return { success: true, carteira: nova };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function updateCarteira(projetoId, carteiraId, data) {
  try {
    const snap = await getDoc(doc(db, 'projetos', projetoId));
    if (!snap.exists()) return { success: false };
    const carteiras = (snap.data().carteiras || []).map(c =>
      c.id === carteiraId ? { ...c, ...data } : c
    );
    await updateDoc(doc(db, 'projetos', projetoId), { carteiras, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function deleteCarteira(projetoId, carteiraId) {
  try {
    const snap = await getDoc(doc(db, 'projetos', projetoId));
    if (!snap.exists()) return { success: false };
    const carteiras = (snap.data().carteiras || []).filter(c => c.id !== carteiraId);
    await updateDoc(doc(db, 'projetos', projetoId), { carteiras, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Link CRUD ────────────────────────────────────────────────────────────────

export async function addLink(projetoId, carteiraId, linkData, userId) {
  try {
    const snap = await getDoc(doc(db, 'projetos', projetoId));
    if (!snap.exists()) return { success: false };
    const link = {
      id: genLinkId(),
      nome: linkData.nome.trim(),
      url: (linkData.url || '').trim(),
      tipo: linkData.tipo || 'link',
      descricao: (linkData.descricao || '').trim(),
      criadoEm: new Date().toISOString(),
      criadoPor: userId,
    };
    const carteiras = (snap.data().carteiras || []).map(c =>
      c.id === carteiraId ? { ...c, links: [...(c.links || []), link] } : c
    );
    await updateDoc(doc(db, 'projetos', projetoId), { carteiras, updatedAt: serverTimestamp() });
    return { success: true, link };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function updateLink(projetoId, carteiraId, linkId, data) {
  try {
    const snap = await getDoc(doc(db, 'projetos', projetoId));
    if (!snap.exists()) return { success: false };
    const carteiras = (snap.data().carteiras || []).map(c =>
      c.id === carteiraId
        ? { ...c, links: (c.links || []).map(l => l.id === linkId ? { ...l, ...data } : l) }
        : c
    );
    await updateDoc(doc(db, 'projetos', projetoId), { carteiras, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function removeLink(projetoId, carteiraId, linkId) {
  try {
    const snap = await getDoc(doc(db, 'projetos', projetoId));
    if (!snap.exists()) return { success: false };
    const carteiras = (snap.data().carteiras || []).map(c =>
      c.id === carteiraId
        ? { ...c, links: (c.links || []).filter(l => l.id !== linkId) }
        : c
    );
    await updateDoc(doc(db, 'projetos', projetoId), { carteiras, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Setores fixos globais ────────────────────────────────────────────────────
// Usados no seletor de cards e na atribuição de usuários

export const SETORES_PADRAO = [
  { id: 'civil',          nome: 'Civil',          cor: '#3B82F6' },
  { id: 'eletrica',       nome: 'Elétrica',        cor: '#EAB308' },
  { id: 'limpeza',        nome: 'Limpeza',         cor: '#06B6D4' },
  { id: 'rh',             nome: 'RH',              cor: '#EC4899' },
  { id: 'compras',        nome: 'Compras',         cor: '#57B952' },
  { id: 'logistica',      nome: 'Logística',       cor: '#F97316' },
  { id: 'planejamento',   nome: 'Planejamento',    cor: '#8B5CF6' },
  { id: 'administrativo', nome: 'Administrativo',  cor: '#64748B' },
  { id: 'areas-verdes',   nome: 'Áreas Verdes',    cor: '#22C55E' },
  { id: 'sms',            nome: 'SMS',             cor: '#EF4444' },
];

// ─── Seeder ───────────────────────────────────────────────────────────────────

export const CARTEIRAS_PADRAO_PROJETO = [
  { nome: 'Civil',          cor: '#3B82F6', descricao: 'Setor de Engenharia Civil',         ordem: 1  },
  { nome: 'Logística',      cor: '#F97316', descricao: 'Setor de Logística e Suprimentos',  ordem: 2  },
  { nome: 'Planejamento',   cor: '#8B5CF6', descricao: 'Setor de Planejamento',              ordem: 3  },
  { nome: 'RH',             cor: '#EC4899', descricao: 'Recursos Humanos',                   ordem: 4  },
  { nome: 'Elétrica',       cor: '#EAB308', descricao: 'Setor de Engenharia Elétrica',       ordem: 5  },
  { nome: 'Áreas Verdes',   cor: '#22C55E', descricao: 'Manutenção de Áreas Verdes',         ordem: 6  },
  { nome: 'Administrativo', cor: '#64748B', descricao: 'Setor Administrativo',               ordem: 7  },
  { nome: 'Limpeza',        cor: '#06B6D4', descricao: 'Setor de Limpeza e Conservação',     ordem: 8  },
  { nome: 'SMS',            cor: '#EF4444', descricao: 'Saúde, Meio Ambiente e Segurança',   ordem: 9  },
  { nome: 'Compras',        cor: '#57B952', descricao: 'Setor de Compras e Aquisições',      ordem: 10 },
];

export const CORES_CARTEIRA = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
  '#F97316', '#EAB308', '#22C55E', '#57B952',
  '#06B6D4', '#64748B',
];

export const LINK_TIPOS = [
  { value: 'link',         label: 'Link Externo' },
  { value: 'documento',    label: 'Documento'    },
  { value: 'planilha',     label: 'Planilha'     },
  { value: 'relatorio',    label: 'Relatório'    },
  { value: 'pasta',        label: 'Pasta/Arquivos' },
  { value: 'contato',      label: 'Contato'      },
  { value: 'email',        label: 'E-mail'       },
];

export async function seedCarteiras(projetoId, userId) {
  try {
    const snap = await getDoc(doc(db, 'projetos', projetoId));
    if (!snap.exists()) return { success: false };
    const existing = snap.data().carteiras || [];
    if (existing.length > 0) return { success: false, reason: 'already_seeded' };
    const carteiras = CARTEIRAS_PADRAO_PROJETO.map(c => ({
      id: genId(),
      ...c,
      links: [],
      criadoEm: new Date().toISOString(),
      criadoPor: userId,
    }));
    await updateDoc(doc(db, 'projetos', projetoId), { carteiras, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
