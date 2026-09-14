import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, Plus, Briefcase, Settings, X, Save, Trash2, Shield, Calendar,
  Tag, RotateCcw, LayoutDashboard, LayoutGrid, Search, Star, Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import NotificationCenter from '../components/NotificationCenter';
import { UserPageHeader } from '../components/UserPageHeader';
import { SkeletonProjectCard } from '../components/Skeleton';
import { CardFieldsForm } from '../components/CardFieldsForm';
import ActivityLogger from '../services/activityLogger';
import FavoriteButton from '../components/FavoriteButton';
import { getFavorites } from '../services/favorites';
const NO_URL_TYPES = new Set(['documents', 'files', 'spreadsheets']);

const inputCls =
  'w-full px-4 py-3 bg-surface-2 border border-hairline rounded-xl text-sm text-txt placeholder-txt-faint focus:outline-none focus:border-brand/60 focus:bg-hairline-hi/10 transition-all';

// Uma linha de `projetos` vira um objeto "achatado": nome/ativa são colunas reais,
// o resto (tags, deadline, extras, carteiras, deletedAt...) vive em `data` (jsonb).
function mapProjetoRow(row) {
  return {
    id: row.id,
    nome: row.nome,
    ativa: row.ativa,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.data || {}),
  };
}

// ─── DeadlineBadge ────────────────────────────────────────────────────────────
function DeadlineBadge({ deadline }) {
  if (!deadline) return null;
  const date = new Date(deadline);
  const now = new Date();
  const isOverdue = date < now;
  const diff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
      isOverdue
        ? 'bg-red-500/15 text-red-400 border-red-500/25'
        : diff <= 3
        ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'
        : 'bg-surface-2 text-txt-faint border-hairline'
    }`}>
      <Calendar size={9} />
      {isOverdue ? `Atrasado` : diff === 0 ? 'Hoje' : `${diff}d`}
    </span>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast.show) return null;
  return (
    <div className="fixed top-8 right-8 z-[200] animate-fade-in">
      <div className={`border-l-4 ${toast.type === 'error' ? 'bg-red-500/20 border-red-500' : 'bg-brand/20 border-brand'} rounded-lg shadow-2xl p-4 flex items-center gap-3 min-w-[300px] text-txt`}>
        <div className={`${toast.type === 'error' ? 'bg-red-500/20' : 'bg-brand/20'} p-2 rounded-full`}>
          {toast.type === 'error' ? <X size={20} className="text-red-400" /> : <Building2 size={20} className="text-brand-lite" />}
        </div>
        <div>
          <p className="font-bold text-txt">{toast.type === 'error' ? 'Erro!' : 'Sucesso!'}</p>
          <p className="text-sm text-txt-dim">{toast.message}</p>
        </div>
      </div>
    </div>
  );
}

function SelecaoProjeto() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.funcao === 'admin';
  const primeiroNome = userProfile?.nome?.split(' ')[0] || currentUser?.user_metadata?.full_name?.split(' ')[0] || 'Usuário';

  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projetosPermitidos, setProjetosPermitidos] = useState([]);
  const [canManageProjects, setCanManageProjects] = useState(false);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editingCarteiras, setEditingCarteiras] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newTagsInput, setNewTagsInput] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [extraFields, setExtraFields] = useState([]);
  const [saving, setSaving] = useState(false);


  // Filtros
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [activeTagFilter, setActiveTagFilter] = useState('');
  const [favIds, setFavIds] = useState(new Set());

  // Confirmação de exclusão (soft delete)
  const [confirmDelete, setConfirmDelete] = useState({ open: false, projetoId: null, nome: '' });

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // ─── Tags disponíveis nos projetos ──────────────────────────────────────────
  const allTags = useMemo(() => {
    const set = new Set();
    projetos.forEach(p => (p.tags || []).forEach(t => set.add(t)));
    return [...set].sort();
  }, [projetos]);

  // ─── Filtragem e ordenação ───────────────────────────────────────────────────
  const filteredAndSortedProjects = useMemo(() => {
    let list = projetos.filter(p => !p.deletedAt);

    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      list = list.filter(
        p => p.nome?.toLowerCase().includes(term) || p.descricao?.toLowerCase().includes(term)
      );
    }

    if (statusFilter === 'active') list = list.filter(p => p.ativa !== false);
    else if (statusFilter === 'inactive') list = list.filter(p => p.ativa === false);

    if (activeTagFilter) list = list.filter(p => (p.tags || []).includes(activeTagFilter));

    if (sortBy === 'name') list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    else if (sortBy === 'date') list.sort((a, b) => (b.createdAt ? new Date(b.createdAt) : new Date(0)) - (a.createdAt ? new Date(a.createdAt) : new Date(0)));
    else if (sortBy === 'recent') {
      list.sort((a, b) => {
        const da = a.updatedAt ? new Date(a.updatedAt) : a.createdAt ? new Date(a.createdAt) : new Date(0);
        const db_ = b.updatedAt ? new Date(b.updatedAt) : b.createdAt ? new Date(b.createdAt) : new Date(0);
        return db_ - da;
      });
    } else if (sortBy === 'deadline') {
      list.sort((a, b) => {
        const da = a.deadline ? new Date(a.deadline) : new Date('9999');
        const db_ = b.deadline ? new Date(b.deadline) : new Date('9999');
        return da - db_;
      });
    } else if (sortBy === 'favorites') {
      list.sort((a, b) => {
        const diff = (favIds.has(b.id) ? 1 : 0) - (favIds.has(a.id) ? 1 : 0);
        return diff !== 0 ? diff : (a.nome || '').localeCompare(b.nome || '');
      });
    }

    return list;
  }, [projetos, searchFilter, statusFilter, sortBy, activeTagFilter, favIds]);

  useEffect(() => {
    if (userProfile) {
      fetchProjetos();
      checkPermissions();
      loadFavorites();
    }
  // Apenas primitivos como dependências — arrays como projetos causam re-run à toa
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id, userProfile?.funcao, (userProfile?.data?.projetos || []).join(',')]);

  const loadFavorites = async () => {
    if (!currentUser) { setFavIds(new Set()); return; }
    const res = await getFavorites(currentUser.id, 'project');
    if (res.success) setFavIds(new Set(res.favorites.map(f => f.id)));
  };

  const checkPermissions = async () => {
    if (!userProfile) return;
    if (isAdmin) { setCanManageProjects(true); setCanAccessAdmin(true); return; }
    if (typeof userProfile.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente')) {
      setCanManageProjects(true); setCanAccessAdmin(true); return;
    }
    try {
      const { data: cargo } = await supabase.from('cargos').select('*').eq('nome', userProfile.funcao).maybeSingle();
      if (cargo) {
        const cargoExtra = cargo.data || {};
        setProjetosPermitidos(cargoExtra.projetos || []);
        setCanManageProjects(cargo.can_create_projetos || (cargoExtra.projetos || []).length > 0);
        setCanAccessAdmin(cargo.can_manage_users || cargo.can_manage_permissions);
      }
    } catch {
      setCanManageProjects(false);
      setCanAccessAdmin(false);
    }
  };

  const fetchProjetos = async () => {
    try {
      const { data, error } = await supabase.from('projetos').select('*');
      if (error) throw error;
      let list = (data || []).map(mapProjetoRow);

      const isManager = typeof userProfile?.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente');
      if (!isAdmin && !isManager) {
        const userProjetos = userProfile?.data?.projetos || [];
        list = userProjetos.length > 0 ? list.filter(p => userProjetos.includes(p.id)) : [];
      }

      setProjetos(list);
    } catch {
      showToast('Erro ao carregar projetos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const canEditProject = (projetoId) => {
    if (isAdmin) return true;
    if (typeof userProfile?.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente')) return true;
    return projetosPermitidos.includes(projetoId);
  };

  // ─── CRUD ────────────────────────────────────────────────────────────────────
  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setSaving(true);
    try {
      const tags = newTagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const deadline = newDeadline || null;

      if (editingProject) {
        const extras = extraFields
          .filter(f => f.name?.trim())
          .map(f => {
            const orig = (editingProject.extras || []).find(o => o.name === f.name);
            return {
              name: f.name.trim(),
              description: (f.description || '').trim(),
              url: (f.url || '').trim(),
              type: f.type || 'link',
              carteiraId: f.carteiraId || null,
              files: orig?.files || [],
              formFields: orig?.formFields || [],
              formResponses: orig?.formResponses || [],
            };
          });

        const { data: existingRow, error: fetchErr } = await supabase.from('projetos').select('data').eq('id', editingProject.id).maybeSingle();
        if (fetchErr) throw fetchErr;
        const mergedData = { ...(existingRow?.data || {}), tags, deadline, extras };

        const { error } = await supabase.from('projetos').update({ nome: newProjectName, data: mergedData }).eq('id', editingProject.id);
        if (error) throw error;
        ActivityLogger.projectEdited(newProjectName, currentUser.id, primeiroNome);
        showToast('Projeto atualizado!');
      } else {
        const { error } = await supabase.from('projetos').insert({
          nome: newProjectName,
          ativa: true,
          data: { tags, deadline, extras: [] },
        });
        if (error) throw error;
        ActivityLogger.projectCreated(newProjectName, currentUser.id, primeiroNome);
        showToast('Projeto criado!');
      }

      resetModal();
      fetchProjetos();
    } catch {
      showToast('Erro ao salvar projeto.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Soft delete — move para lixeira em vez de apagar
  const confirmSoftDelete = async () => {
    try {
      const { data: existingRow, error: fetchErr } = await supabase.from('projetos').select('data').eq('id', confirmDelete.projetoId).maybeSingle();
      if (fetchErr) throw fetchErr;
      const deletedAt = new Date().toISOString();
      const mergedData = { ...(existingRow?.data || {}), deletedAt, deletedBy: currentUser.id };

      const { error } = await supabase.from('projetos').update({ data: mergedData }).eq('id', confirmDelete.projetoId);
      if (error) throw error;

      setProjetos(prev =>
        prev.map(p => p.id === confirmDelete.projetoId ? { ...p, deletedAt } : p)
      );
      ActivityLogger.projectDeleted(confirmDelete.nome, currentUser.id, primeiroNome);
      showToast('Projeto movido para a lixeira.');
    } catch {
      showToast('Erro ao excluir projeto.', 'error');
    } finally {
      setConfirmDelete({ open: false, projetoId: null, nome: '' });
    }
  };

  const resetModal = () => {
    setEditingProject(null);
    setEditingCarteiras([]);
    setNewProjectName('');
    setNewTagsInput('');
    setNewDeadline('');
    setExtraFields([]);
    setIsModalOpen(false);
  };

  const openCreateModal = () => {
    setEditingProject(null);
    setEditingCarteiras([]);
    setNewProjectName('');
    setNewTagsInput('');
    setNewDeadline('');
    setExtraFields([]);
    setIsModalOpen(true);
  };

  const openEditModal = (e, projeto) => {
    e.stopPropagation();
    setEditingProject(projeto);
    setEditingCarteiras(
      (projeto.carteiras || []).sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99))
    );
    setNewProjectName(projeto.nome || '');
    setNewTagsInput((projeto.tags || []).join(', '));
    setNewDeadline(projeto.deadline || '');
    setExtraFields(
      (projeto.extras || []).map(e => ({
        name: e.name || '',
        description: e.description || '',
        url: e.url || '',
        type: e.type || 'link',
        carteiraId: e.carteiraId || null,
      }))
    );
    setIsModalOpen(true);
  };

  const visibleProjetos = projetos.filter(p => !p.deletedAt);

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden relative nt-page-bg text-txt">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand-deep/10 rounded-full blur-3xl" />
      </div>

      <Toast toast={toast} />
      <UserPageHeader backTo="/" />

      <main className="flex-grow flex flex-col items-center p-2 sm:p-3 md:p-8 relative z-10">
        <div className="w-full max-w-6xl">

          {/* Título + Botões */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-3 md:mb-6 gap-3">
            <div className="flex-1 w-full">
              <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-txt">Seleção de projetos</h1>
              <p className="text-xs sm:text-sm md:text-base text-txt-dim mt-1">Escolha o projeto para acessar o ambiente de trabalho.</p>
            </div>
            <div className="flex gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end">
              <Link to="/meu-painel" className="bg-brand/20 text-brand-lite px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold flex items-center gap-1.5 sm:gap-2 shadow transition-all hover:scale-105 hover:bg-brand/30 text-xs sm:text-sm border border-brand/30">
                <LayoutDashboard size={15} /><span className="hidden sm:inline">Meu Painel</span><span className="sm:hidden">Painel</span>
              </Link>
              <Link to="/aplicativos" className="bg-surface-2 text-txt-dim px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold flex items-center gap-1.5 sm:gap-2 shadow transition-all hover:scale-105 hover:bg-hairline-hi/20 text-xs sm:text-sm border border-hairline">
                <LayoutGrid size={15} /><span className="hidden sm:inline">Aplicativos</span><span className="sm:hidden">Apps</span>
              </Link>
              {(isAdmin || (userProfile?.data?.carteiras?.length > 0) || typeof userProfile?.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente')) && (
                <Link to="/minhas-carteiras" className="bg-cyan-500/20 text-cyan-300 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold flex items-center gap-1.5 sm:gap-2 shadow transition-all hover:scale-105 hover:bg-cyan-500/30 text-xs sm:text-sm border border-cyan-500/30">
                  <Layers size={15} /><span className="hidden sm:inline">Carteiras</span><span className="sm:hidden">Cart.</span>
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin" className="bg-purple-500/20 text-purple-300 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold flex items-center gap-1.5 sm:gap-2 shadow transition-all hover:scale-105 hover:bg-purple-500/30 text-xs sm:text-sm border border-purple-500/30">
                  <Shield size={15} /><span className="hidden sm:inline">Administrador</span><span className="sm:hidden">Adm</span>
                </Link>
              )}
              {(isAdmin || canAccessAdmin) && (
                <Link to="/gerencia" className="bg-orange-500/20 text-orange-300 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold flex items-center gap-1.5 sm:gap-2 shadow transition-all hover:scale-105 hover:bg-orange-500/30 text-xs sm:text-sm border border-orange-500/30">
                  <Shield size={15} /><span className="hidden sm:inline">Gerência</span><span className="sm:hidden">Ger</span>
                </Link>
              )}
              {canManageProjects && (
                <button onClick={openCreateModal} className="nt-glow-btn bg-gradient-to-r from-brand-lite via-brand to-brand-deep hover:brightness-110 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold flex items-center gap-1.5 sm:gap-2 shadow transition-all hover:scale-105 text-xs sm:text-sm">
                  <Plus size={15} /> Novo Projeto
                </button>
              )}
            </div>
          </div>

          {/* Barra de busca destacada */}
          <div className="mb-4 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-faint pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar projeto por nome..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 text-sm border border-hairline rounded-xl focus:ring-2 focus:ring-brand outline-none bg-surface-2 backdrop-blur-md text-txt placeholder-txt-faint transition-all shadow-lg"
            />
          </div>

          {/* Strip de favoritos */}
          {favIds.size > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Star size={13} className="text-yellow-400 fill-yellow-400" />
                <span className="text-xs font-semibold text-txt-dim uppercase tracking-wider">Favoritos</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {projetos
                  .filter(p => !p.deletedAt && favIds.has(p.id))
                  .map(p => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/projeto/${p.id}`)}
                      className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-400/10 border border-yellow-400/25 text-yellow-300 text-xs font-semibold hover:bg-yellow-400/20 transition-colors whitespace-nowrap"
                    >
                      <Star size={11} className="fill-yellow-400 text-yellow-400" />
                      {p.nome}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="mb-4 md:mb-6 nt-glass p-3 md:p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-txt-dim mb-1.5">Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:ring-2 focus:ring-brand outline-none transition-all"
                  style={{ backgroundColor: 'var(--surface-2)', color: 'var(--txt)' }}
                >
                  <option value="all" style={{ backgroundColor: '#fff', color: '#111' }}>Todos</option>
                  <option value="active" style={{ backgroundColor: '#fff', color: '#111' }}>Ativos</option>
                  <option value="inactive" style={{ backgroundColor: '#fff', color: '#111' }}>Inativos</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-dim mb-1.5">Ordenar por</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:ring-2 focus:ring-brand outline-none transition-all"
                  style={{ backgroundColor: 'var(--surface-2)', color: 'var(--txt)' }}
                >
                  <option value="name"      style={{ backgroundColor: '#fff', color: '#111' }}>Nome (A-Z)</option>
                  <option value="date"      style={{ backgroundColor: '#fff', color: '#111' }}>Data de Criação</option>
                  <option value="recent"    style={{ backgroundColor: '#fff', color: '#111' }}>Modificados Recentemente</option>
                  <option value="deadline"  style={{ backgroundColor: '#fff', color: '#111' }}>Por Prazo</option>
                  <option value="favorites" style={{ backgroundColor: '#fff', color: '#111' }}>Favoritos</option>
                </select>
              </div>
            </div>

            {/* Filtro por tag */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <Tag size={12} className="text-txt-faint flex-shrink-0" />
                <button
                  onClick={() => setActiveTagFilter('')}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    !activeTagFilter
                      ? 'bg-brand/20 text-brand-lite border-brand/30'
                      : 'bg-surface-2 text-txt-dim border-hairline hover:border-hairline-hi'
                  }`}
                >
                  Todos
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setActiveTagFilter(t => t === tag ? '' : tag)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      activeTagFilter === tag
                        ? 'bg-brand/20 text-brand-lite border-brand/30'
                        : 'bg-surface-2 text-txt-dim border-hairline hover:border-hairline-hi'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Grid de projetos */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => <SkeletonProjectCard key={i} />)}
            </div>
          ) : filteredAndSortedProjects.length === 0 ? (
            <div className="text-center py-20 nt-glass">
              <p className="text-txt-dim mb-4">
                {visibleProjetos.length === 0
                  ? 'Nenhuma base cadastrada ainda.'
                  : 'Nenhum projeto encontrado com os filtros aplicados.'}
              </p>
              {canManageProjects && visibleProjetos.length === 0 && (
                <button onClick={openCreateModal} className="text-brand-lite font-bold hover:underline">
                  + Adicionar primeira base
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
              {filteredAndSortedProjects.map(projeto => (
                <div
                  key={projeto.id}
                  onClick={() => navigate(`/projeto/${projeto.id}`)}
                  className="group nt-beam-host nt-glass p-4 sm:p-5 md:p-8 hover:shadow-xl hover:border-hairline-hi text-left transition-all hover:-translate-y-1 flex flex-col h-full relative cursor-pointer"
                >
                  <span className="nt-beam" aria-hidden="true" />
                  <div className="nt-beam-content flex flex-col h-full">
                  <div className="flex items-start justify-between mb-2 sm:mb-3 md:mb-4">
                    <div className="bg-brand/20 p-2 rounded-lg text-brand-lite border border-brand/50">
                      <Briefcase size={18} className="sm:w-5 sm:h-5" />
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <DeadlineBadge deadline={projeto.deadline} />
                      <span className="text-[9px] sm:text-[10px] font-bold text-txt-dim uppercase tracking-wider hidden sm:inline">
                        Base Ativa
                      </span>
                      <FavoriteButton
                        itemId={projeto.id}
                        itemType="project"
                        itemData={{ name: projeto.nome }}
                        size={14}
                        onChange={next => setFavIds(prev => {
                          const s = new Set(prev);
                          if (next) s.add(projeto.id); else s.delete(projeto.id);
                          return s;
                        })}
                      />
                      {canEditProject(projeto.id) && (
                        <>
                          <button
                            onClick={e => openEditModal(e, projeto)}
                            className="p-1 sm:p-1.5 text-txt-dim hover:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Editar projeto"
                          >
                            <Settings size={12} className="sm:w-3.5 sm:h-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDelete({ open: true, projetoId: projeto.id, nome: projeto.nome }); }}
                            className="p-1 sm:p-1.5 text-txt-dim hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Mover para lixeira"
                          >
                            <Trash2 size={12} className="sm:w-3.5 sm:h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base sm:text-lg md:text-xl font-bold text-txt mb-1.5 sm:mb-2 group-hover:text-brand-lite transition-colors line-clamp-2">
                    {projeto.nome}
                  </h3>
                  <p className="text-xs sm:text-sm text-txt-dim mb-3 flex-grow line-clamp-2">
                    {projeto.descricao || 'Acesso ao portal.'}
                  </p>

                  {/* Tags */}
                  {projeto.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {projeto.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2 text-txt-dim border border-hairline">
                          {tag}
                        </span>
                      ))}
                      {projeto.tags.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2 text-txt-faint">
                          +{projeto.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto w-full py-2 rounded-lg bg-surface-2 text-center text-xs sm:text-sm font-medium text-txt group-hover:bg-brand group-hover:text-white transition-colors border border-hairline group-hover:border-brand/50">
                    Acessar Projeto
                  </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="w-full py-6 text-center text-txt-dim text-xs border-t border-hairline bg-surface-card/80 backdrop-blur-md z-20 relative">
        &copy; {new Date().getFullYear()} Normatel Engenharia
      </footer>

      {/* ─── Modal criar/editar ──────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-surface-solid rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl border border-hairline flex flex-col max-h-[95vh] sm:max-h-[88vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-hairline flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/15 border border-brand/20 flex items-center justify-center flex-shrink-0">
                  {editingProject ? <Settings size={18} className="text-brand-lite" /> : <Briefcase size={18} className="text-brand-lite" />}
                </div>
                <div>
                  <p className="font-bold text-txt text-base leading-tight">
                    {editingProject ? 'Editar Base' : 'Adicionar Nova Base'}
                  </p>
                  <p className="text-xs text-txt-faint mt-0.5">
                    {editingProject ? editingProject.nome : 'Configure o projeto'}
                  </p>
                </div>
              </div>
              <button onClick={resetModal} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-2 text-txt-faint hover:text-txt transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="flex flex-col flex-1 overflow-hidden">
              <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

                {/* Nome */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-txt-dim uppercase tracking-widest">
                    Nome da Base <span className="text-brand-lite">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Projeto 743 — Facilities"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>

                {/* Tags */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-txt-dim uppercase tracking-widest">
                    Tags <span className="text-txt-faint font-normal normal-case">(separadas por vírgula)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: obras, manutenção, 2025"
                    value={newTagsInput}
                    onChange={e => setNewTagsInput(e.target.value)}
                    className={inputCls}
                  />
                </div>

                {/* Prazo */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-txt-dim uppercase tracking-widest">
                    Prazo / Deadline
                  </label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={e => setNewDeadline(e.target.value)}
                    className={`${inputCls} cursor-pointer`}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>

                {/* Setores + Cards — só no modo editar */}
                {editingProject && (
                  <>
                    {editingCarteiras.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-txt-dim uppercase tracking-widest flex items-center gap-1.5">
                          <Layers size={12} className="text-cyan-400" />
                          Setores desta base
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {editingCarteiras.map(s => (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                              style={{ backgroundColor: `${s.cor}20`, borderColor: `${s.cor}40`, color: s.cor }}
                            >
                              {s.nome}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <CardFieldsForm
                      cards={extraFields}
                      onAdd={() => setExtraFields(prev => [...prev, { name: '', description: '', url: '', type: 'link', carteiraId: null }])}
                      onUpdate={(idx, key, val) =>
                        setExtraFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f))
                      }
                      onRemove={idx => setExtraFields(prev => prev.filter((_, i) => i !== idx))}
                      carteiras={editingCarteiras}
                    />
                  </>
                )}
              </div>

              <div className="px-6 py-4 border-t border-hairline flex gap-3 flex-shrink-0">
                <button type="button" onClick={resetModal} className="flex-1 py-3 rounded-xl bg-surface-2 border border-hairline text-txt-dim text-sm font-medium hover:bg-hairline-hi/20 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="nt-glow-btn flex-1 py-3 rounded-xl bg-gradient-to-r from-brand-lite via-brand to-brand-deep hover:brightness-110 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                  {saving
                    ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvando...</>
                    : <><Save size={15} /> {editingProject ? 'Salvar Alterações' : 'Criar Base'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Confirm soft delete ─────────────────────────────────────────────── */}
      {confirmDelete.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4">
          <div className="bg-surface-solid rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-hairline">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-txt text-sm">Mover para lixeira?</p>
                <p className="text-xs text-txt-faint">O projeto pode ser restaurado pelo admin.</p>
              </div>
            </div>
            <p className="text-sm text-txt-dim mb-5">
              <span className="text-txt font-medium">{confirmDelete.nome}</span> será movido para a lixeira.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete({ open: false, projetoId: null, nome: '' })} className="flex-1 py-2.5 rounded-xl bg-surface-2 hover:bg-hairline-hi/20 text-txt font-semibold transition-colors border border-hairline">
                Cancelar
              </button>
              <button onClick={confirmSoftDelete} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors">
                Mover para Lixeira
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SelecaoProjeto;
