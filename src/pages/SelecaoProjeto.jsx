import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, Plus, Briefcase, Settings, X, Save, Trash2, Shield, Calendar,
  Tag, RotateCcw, LayoutDashboard, Search, Star, Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import NotificationCenter from '../components/NotificationCenter';
import { UserPageHeader } from '../components/UserPageHeader';
import { SkeletonProjectCard } from '../components/Skeleton';
import { CardFieldsForm } from '../components/CardFieldsForm';
import ActivityLogger from '../services/activityLogger';
import FavoriteButton from '../components/FavoriteButton';
import { getFavorites } from '../services/favorites';
const NO_URL_TYPES = new Set(['documents', 'files', 'spreadsheets']);

const inputCls =
  'w-full px-4 py-3 bg-white/[0.05] border border-white/[0.10] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#57B952]/60 focus:bg-white/[0.07] transition-all';

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
        : 'bg-white/10 text-gray-500 border-white/15'
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
      <div className={`border-l-4 ${toast.type === 'error' ? 'bg-red-500/20 border-red-500' : 'bg-green-500/20 border-[#57B952]'} rounded-lg shadow-2xl p-4 flex items-center gap-3 min-w-[300px] text-white`}>
        <div className={`${toast.type === 'error' ? 'bg-red-500/20' : 'bg-green-500/20'} p-2 rounded-full`}>
          {toast.type === 'error' ? <X size={20} className="text-red-400" /> : <Building2 size={20} className="text-[#57B952]" />}
        </div>
        <div>
          <p className="font-bold text-white">{toast.type === 'error' ? 'Erro!' : 'Sucesso!'}</p>
          <p className="text-sm text-gray-100">{toast.message}</p>
        </div>
      </div>
    </div>
  );
}

function SelecaoProjeto() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.funcao === 'admin';
  const primeiroNome = userProfile?.nome?.split(' ')[0] || currentUser?.displayName?.split(' ')[0] || 'Usuário';

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
    else if (sortBy === 'date') list.sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)));
    else if (sortBy === 'recent') {
      list.sort((a, b) => {
        const da = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
        const db_ = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
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
  // Apenas primitivos como dependências — arrays como projetos causam re-run a cada snapshot
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid, userProfile?.funcao, (userProfile?.projetos || []).join(',')]);

  const loadFavorites = async () => {
    if (!currentUser) { setFavIds(new Set()); return; }
    const res = await getFavorites(currentUser.uid, 'project');
    if (res.success) setFavIds(new Set(res.favorites.map(f => f.id)));
  };

  const checkPermissions = async () => {
    if (!userProfile) return;
    if (isAdmin) { setCanManageProjects(true); setCanAccessAdmin(true); return; }
    if (typeof userProfile.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente')) {
      setCanManageProjects(true); setCanAccessAdmin(true); return;
    }
    try {
      const snap = await getDocs(query(collection(db, 'cargos'), where('nome', '==', userProfile.funcao)));
      if (!snap.empty) {
        const cargo = snap.docs[0].data();
        setProjetosPermitidos(cargo.projetos || []);
        setCanManageProjects(cargo.canCreateProjetos || (cargo.projetos || []).length > 0);
        setCanAccessAdmin(cargo.canManageUsers || cargo.canManagePermissions);
      }
    } catch {
      setCanManageProjects(false);
      setCanAccessAdmin(false);
    }
  };

  const fetchProjetos = async () => {
    try {
      const snap = await getDocs(collection(db, 'projetos'));
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const isManager = typeof userProfile?.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente');
      if (!isAdmin && !isManager) {
        const userProjetos = userProfile?.projetos || [];
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
        await updateDoc(doc(db, 'projetos', editingProject.id), {
          nome: newProjectName,
          tags,
          deadline,
          extras,
          updatedAt: new Date(),
        });
        ActivityLogger.projectEdited(newProjectName, currentUser.uid, primeiroNome);
        showToast('Projeto atualizado!');
      } else {
        await addDoc(collection(db, 'projetos'), {
          nome: newProjectName,
          tags,
          deadline,
          extras: [],
          ativa: true,
          createdAt: new Date(),
        });
        ActivityLogger.projectCreated(newProjectName, currentUser.uid, primeiroNome);
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
      await updateDoc(doc(db, 'projetos', confirmDelete.projetoId), {
        deletedAt: new Date(),
        deletedBy: currentUser.uid,
      });
      setProjetos(prev =>
        prev.map(p => p.id === confirmDelete.projetoId ? { ...p, deletedAt: new Date() } : p)
      );
      ActivityLogger.projectDeleted(confirmDelete.nome, currentUser.uid, primeiroNome);
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
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl" />
      </div>

      <Toast toast={toast} />
      <UserPageHeader backTo="/" />

      <main className="flex-grow flex flex-col items-center p-2 sm:p-3 md:p-8 relative z-10">
        <div className="w-full max-w-6xl">

          {/* Título + Botões */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-3 md:mb-6 gap-3">
            <div className="flex-1 w-full">
              <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-white">Seleção de projetos</h1>
              <p className="text-xs sm:text-sm md:text-base text-gray-300 mt-1">Escolha o projeto para acessar o ambiente de trabalho.</p>
            </div>
            <div className="flex gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end">
              <Link to="/meu-painel" className="bg-[#57B952]/20 text-[#57B952] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold flex items-center gap-1.5 sm:gap-2 shadow transition-all hover:scale-105 hover:bg-[#57B952]/30 text-xs sm:text-sm border border-[#57B952]/30">
                <LayoutDashboard size={15} /><span className="hidden sm:inline">Meu Painel</span><span className="sm:hidden">Painel</span>
              </Link>
              {(isAdmin || (userProfile?.carteiras?.length > 0) || typeof userProfile?.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente')) && (
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
                <button onClick={openCreateModal} className="bg-[#57B952] hover:bg-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold flex items-center gap-1.5 sm:gap-2 shadow transition-transform hover:scale-105 text-xs sm:text-sm">
                  <Plus size={15} /> Novo Projeto
                </button>
              )}
            </div>
          </div>

          {/* Barra de busca destacada */}
          <div className="mb-4 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar projeto por nome..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 text-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-[#57B952] outline-none bg-white/10 backdrop-blur-md text-white placeholder-gray-400 transition-all shadow-lg"
            />
          </div>

          {/* Strip de favoritos */}
          {favIds.size > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Star size={13} className="text-yellow-400 fill-yellow-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Favoritos</span>
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
          <div className="mb-4 md:mb-6 bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-3 md:p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-200 mb-1.5">Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-[#57B952] outline-none transition-all"
                  style={{ backgroundColor: 'rgba(255,255,255,0.10)', color: '#f9fafb' }}
                >
                  <option value="all" style={{ backgroundColor: '#fff', color: '#111' }}>Todos</option>
                  <option value="active" style={{ backgroundColor: '#fff', color: '#111' }}>Ativos</option>
                  <option value="inactive" style={{ backgroundColor: '#fff', color: '#111' }}>Inativos</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-200 mb-1.5">Ordenar por</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-[#57B952] outline-none transition-all"
                  style={{ backgroundColor: 'rgba(255,255,255,0.10)', color: '#f9fafb' }}
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
                <Tag size={12} className="text-gray-500 flex-shrink-0" />
                <button
                  onClick={() => setActiveTagFilter('')}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    !activeTagFilter
                      ? 'bg-[#57B952]/20 text-[#57B952] border-[#57B952]/30'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
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
                        ? 'bg-[#57B952]/20 text-[#57B952] border-[#57B952]/30'
                        : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
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
            <div className="text-center py-20 bg-white/10 backdrop-blur-md rounded-xl shadow border border-white/20">
              <p className="text-gray-200 mb-4">
                {visibleProjetos.length === 0
                  ? 'Nenhuma base cadastrada ainda.'
                  : 'Nenhum projeto encontrado com os filtros aplicados.'}
              </p>
              {canManageProjects && visibleProjetos.length === 0 && (
                <button onClick={openCreateModal} className="text-[#57B952] font-bold hover:underline">
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
                  className="group bg-white/10 backdrop-blur-md p-4 sm:p-5 md:p-8 rounded-xl shadow-lg hover:shadow-xl border border-white/20 hover:border-white/40 text-left transition-all hover:-translate-y-1 flex flex-col h-full relative cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2 sm:mb-3 md:mb-4">
                    <div className="bg-[#57B952]/20 p-2 rounded-lg text-[#57B952] border border-[#57B952]/50">
                      <Briefcase size={18} className="sm:w-5 sm:h-5" />
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <DeadlineBadge deadline={projeto.deadline} />
                      <span className="text-[9px] sm:text-[10px] font-bold text-gray-300 uppercase tracking-wider hidden sm:inline">
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
                            className="p-1 sm:p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Editar projeto"
                          >
                            <Settings size={12} className="sm:w-3.5 sm:h-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDelete({ open: true, projetoId: projeto.id, nome: projeto.nome }); }}
                            className="p-1 sm:p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Mover para lixeira"
                          >
                            <Trash2 size={12} className="sm:w-3.5 sm:h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base sm:text-lg md:text-xl font-bold text-white mb-1.5 sm:mb-2 group-hover:text-[#57B952] transition-colors line-clamp-2">
                    {projeto.nome}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-200 mb-3 flex-grow line-clamp-2">
                    {projeto.descricao || 'Acesso ao portal.'}
                  </p>

                  {/* Tags */}
                  {projeto.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {projeto.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 border border-white/10">
                          {tag}
                        </span>
                      ))}
                      {projeto.tags.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-500">
                          +{projeto.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto w-full py-2 rounded-lg bg-white/10 text-center text-xs sm:text-sm font-medium text-white group-hover:bg-[#57B952] group-hover:text-white transition-colors border border-white/20 group-hover:border-[#57B952]/50">
                    Acessar Projeto
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="w-full py-6 text-center text-gray-300 text-xs border-t border-gray-700 bg-gray-900/50 backdrop-blur-md z-20 relative">
        &copy; 2025 Parceria Petrobras &amp; Normatel Engenharia
      </footer>

      {/* ─── Modal criar/editar ──────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111114] rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl border border-white/[0.10] flex flex-col max-h-[95vh] sm:max-h-[88vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#57B952]/15 border border-[#57B952]/20 flex items-center justify-center flex-shrink-0">
                  {editingProject ? <Settings size={18} className="text-[#57B952]" /> : <Briefcase size={18} className="text-[#57B952]" />}
                </div>
                <div>
                  <p className="font-bold text-white text-base leading-tight">
                    {editingProject ? 'Editar Base' : 'Adicionar Nova Base'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {editingProject ? editingProject.nome : 'Configure o projeto'}
                  </p>
                </div>
              </div>
              <button onClick={resetModal} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-gray-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="flex flex-col flex-1 overflow-hidden">
              <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

                {/* Nome */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    Nome da Base <span className="text-[#57B952]">*</span>
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
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    Tags <span className="text-gray-600 font-normal normal-case">(separadas por vírgula)</span>
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
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
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
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
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

              <div className="px-6 py-4 border-t border-white/[0.07] flex gap-3 flex-shrink-0">
                <button type="button" onClick={resetModal} className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-gray-300 text-sm font-medium hover:bg-white/[0.08] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
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
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">Mover para lixeira?</p>
                <p className="text-xs text-gray-500">O projeto pode ser restaurado pelo admin.</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-5">
              <span className="text-white font-medium">{confirmDelete.nome}</span> será movido para a lixeira.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete({ open: false, projetoId: null, nome: '' })} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors border border-white/20">
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
