import { supabase } from './supabase';

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
    nome: 'Colaborador',
    descricao: 'Colaborador geral com acesso básico ao sistema',
    status: 'ativo',
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
    nome: 'Técnico',
    descricao: 'Técnico responsável por execução de atividades operacionais',
    status: 'ativo',
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
    nome: 'Analista',
    descricao: 'Analista responsável por análise e elaboração de relatórios',
    status: 'ativo',
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
    descricao: 'Supervisor com permissão para editar cards de projetos',
    status: 'ativo',
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
    nome: 'Coordenador',
    descricao: 'Coordenador de equipes e projetos',
    status: 'ativo',
    tipo: 'colaborador',
    canManageUsers: false,
    canDeleteUsers: false,
    canManagePermissions: false,
    canChangeCarteiras: false,
    canManageProjectMembers: true,
    canCreateCargos: false,
    canCreateProjetos: false,
    canEditCardsProjetos: true,
  },
  {
    nome: 'Gerente de Projeto',
    descricao: 'Gerente com acesso completo a usuários e projetos',
    status: 'ativo',
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

// `nome` é coluna real na tabela `carteiras`; o resto vive em `data` (jsonb).
function mapCarteiraRow(row) {
  return { id: row.id, nome: row.nome, ...(row.data || {}) };
}

// ─── CRUD de Carteiras ────────────────────────────────────────────────────────

export const getCarteiras = async () => {
  try {
    const { data, error } = await supabase.from('carteiras').select('*');
    if (error) throw error;
    const carteiras = (data || [])
      .map(mapCarteiraRow)
      .sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));
    return { success: true, carteiras };
  } catch (err) {
    return { success: false, carteiras: [], error: err.message };
  }
};

export const getCarteira = async (id) => {
  try {
    const { data, error } = await supabase.from('carteiras').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return { success: false, carteira: null };
    return { success: true, carteira: mapCarteiraRow(data) };
  } catch (err) {
    return { success: false, carteira: null, error: err.message };
  }
};

export const createCarteira = async (payload, userId) => {
  try {
    const { data, error } = await supabase
      .from('carteiras')
      .insert({
        nome: payload.nome.trim(),
        data: {
          descricao: (payload.descricao || '').trim(),
          cor: payload.cor || '#57B952',
          ordem: payload.ordem ?? 99,
          links: [],
          createdBy: userId,
        },
      })
      .select('id')
      .single();
    if (error) throw error;
    return { success: true, id: data.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const updateCarteira = async (id, payload) => {
  try {
    const { data: existing, error: fetchError } = await supabase.from('carteiras').select('data').eq('id', id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return { success: false, error: 'Carteira não encontrada' };
    const { nome, ...rest } = payload;
    const { error } = await supabase
      .from('carteiras')
      .update({
        ...(nome !== undefined ? { nome } : {}),
        data: { ...(existing.data || {}), ...rest },
      })
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const deleteCarteira = async (id) => {
  try {
    const { error } = await supabase.from('carteiras').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ─── CRUD de Links dentro de Carteiras ───────────────────────────────────────

const genLinkId = () => `lk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

export const addLink = async (carteiraId, linkData, userId) => {
  try {
    const { data: existing, error: fetchError } = await supabase.from('carteiras').select('data').eq('id', carteiraId).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return { success: false, error: 'Carteira não encontrada' };
    const link = {
      id: genLinkId(),
      nome: linkData.nome.trim(),
      url: (linkData.url || '').trim(),
      tipo: linkData.tipo || 'link',
      descricao: (linkData.descricao || '').trim(),
      criadoEm: new Date().toISOString(),
      criadoPor: userId,
    };
    const links = [...((existing.data || {}).links || []), link];
    const { error } = await supabase.from('carteiras').update({ data: { ...(existing.data || {}), links } }).eq('id', carteiraId);
    if (error) throw error;
    return { success: true, link };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const updateLink = async (carteiraId, linkId, linkData) => {
  try {
    const { data: existing, error: fetchError } = await supabase.from('carteiras').select('data').eq('id', carteiraId).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return { success: false };
    const links = ((existing.data || {}).links || []).map(l => (l.id === linkId ? { ...l, ...linkData } : l));
    const { error } = await supabase.from('carteiras').update({ data: { ...(existing.data || {}), links } }).eq('id', carteiraId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const removeLink = async (carteiraId, linkId) => {
  try {
    const { data: existing, error: fetchError } = await supabase.from('carteiras').select('data').eq('id', carteiraId).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return { success: false };
    const links = ((existing.data || {}).links || []).filter(l => l.id !== linkId);
    const { error } = await supabase.from('carteiras').update({ data: { ...(existing.data || {}), links } }).eq('id', carteiraId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ─── Seeders ──────────────────────────────────────────────────────────────────

export const seedCarteiras = async (userId) => {
  try {
    const { data: existing, error: fetchError } = await supabase.from('carteiras').select('id').limit(1);
    if (fetchError) throw fetchError;
    if (existing && existing.length > 0) return { success: false, reason: 'already_seeded' };
    const rows = CARTEIRAS_PADRAO.map(c => ({
      nome: c.nome,
      data: { descricao: c.descricao, cor: c.cor, ordem: c.ordem, links: [], createdBy: userId },
    }));
    const { error } = await supabase.from('carteiras').insert(rows);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const seedCargos = async () => {
  try {
    const { data: existing, error: fetchError } = await supabase.from('cargos').select('nome');
    if (fetchError) throw fetchError;
    const existingNames = new Set((existing || []).map(c => c.nome));
    const toCreate = CARGOS_PADRAO.filter(c => !existingNames.has(c.nome));
    if (toCreate.length === 0) return { success: true, created: 0 };
    const rows = toCreate.map(c => ({
      nome: c.nome,
      can_manage_users: c.canManageUsers,
      can_manage_permissions: c.canManagePermissions,
      can_manage_project_members: c.canManageProjectMembers,
      can_change_carteiras: c.canChangeCarteiras,
      can_create_cargos: c.canCreateCargos,
      can_create_projetos: c.canCreateProjetos,
      data: {
        descricao: c.descricao,
        status: c.status,
        tipo: c.tipo,
        canDeleteUsers: c.canDeleteUsers,
        canEditCardsProjetos: c.canEditCardsProjetos,
      },
    }));
    const { error } = await supabase.from('cargos').insert(rows);
    if (error) throw error;
    return { success: true, created: toCreate.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
