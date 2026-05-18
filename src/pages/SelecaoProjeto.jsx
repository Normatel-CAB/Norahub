import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, Plus, Briefcase, Settings, X, Save, Trash2, User, Shield } from 'lucide-react';
// ThemeToggle removed: app forced to light mode
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import NotificationCenter from '../components/NotificationCenter';

const NO_URL_TYPES = ['documents', 'files', 'spreadsheets'];

import ActivityLogger from '../services/activityLogger';
import FavoriteButton from '../components/FavoriteButton';
import { getFavorites } from '../services/favorites';

function SelecaoProjeto() {
  const { theme } = useTheme();
  const { currentUser, userProfile } = useAuth();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Variáveis de perfil
  const primeiroNome = userProfile?.nome?.split(' ')[0] || currentUser?.displayName?.split(' ')[0] || 'Usuário';
  const fotoURL = currentUser?.photoURL || userProfile?.fotoURL;
  const isAdmin = userProfile?.funcao === 'admin'; // Verifica se é admin
  const [projetosPermitidos, setProjetosPermitidos] = useState([]);
  const [canManageProjects, setCanManageProjects] = useState(false);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);

  // Estados para o Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [urlForms, setUrlForms] = useState(''); 
  const [urlSharePoint, setUrlSharePoint] = useState(''); 
  const [saving, setSaving] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [extraFields, setExtraFields] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, projetoId: null });
  
  // Filtros e Ordenação
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'date', 'recent', 'favorites'
  const [favIds, setFavIds] = useState(new Set());

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };
  
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = [...projetos];

    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      filtered = filtered.filter(p =>
        p.nome?.toLowerCase().includes(term) ||
        p.descricao?.toLowerCase().includes(term)
      );
    }

    if (statusFilter === 'active') {
      filtered = filtered.filter(p => p.ativa !== false);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(p => p.ativa === false);
    }

    if (sortBy === 'name') {
      filtered.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    } else if (sortBy === 'date') {
      filtered.sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)));
    } else if (sortBy === 'recent') {
      filtered.sort((a, b) => {
        const da = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
        const db_ = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
        return db_ - da;
      });
    } else if (sortBy === 'favorites') {
      filtered.sort((a, b) => {
        const diff = (favIds.has(b.id) ? 1 : 0) - (favIds.has(a.id) ? 1 : 0);
        return diff !== 0 ? diff : (a.nome || '').localeCompare(b.nome || '');
      });
    }

    return filtered;
  }, [projetos, searchFilter, statusFilter, sortBy, favIds]);

  useEffect(() => {
    fetchProjetos();
    checkPermissions();
    loadFavorites();
  }, [userProfile]);

  const loadFavorites = async () => {
    if (!currentUser) { setFavIds(new Set()); return; }
    const res = await getFavorites(currentUser.uid, 'project');
    if (res.success) {
      const ids = new Set(res.favorites.map(f => f.id));
      setFavIds(ids);
    }
  };

  const checkPermissions = async () => {
    if (!userProfile) return;
    
    // Admin pode acessar tudo
    if (isAdmin) {
      setCanManageProjects(true);
      setCanAccessAdmin(true);
      return;
    }
    
    // Todos os gerentes (qualquer cargo que começa com "gerente") têm acesso ao admin
    if (typeof userProfile.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente')) {
      setCanManageProjects(true);
      setCanAccessAdmin(true);
      return;
    }
    
    // Verificar se o cargo do usuário tem permissões para algum projeto
    try {
      const cargosQuery = query(
        collection(db, 'cargos'),
        where('nome', '==', userProfile.funcao)
      );
      const cargosSnapshot = await getDocs(cargosQuery);
      
      if (!cargosSnapshot.empty) {
        const cargoData = cargosSnapshot.docs[0].data();
        const projetos = cargoData.projetos || [];
        setProjetosPermitidos(projetos);
        
        // Pode criar projetos se tiver permissão canCreateProjetos ou tiver projetos atribuídos
        const canCreate = cargoData.canCreateProjetos || projetos.length > 0;
        setCanManageProjects(canCreate);
        
        // Permitir acesso ao admin se tiver qualquer permissão de gerenciamento
        const temPermissaoAdmin = cargoData.canManageUsers || cargoData.canManagePermissions;
        setCanAccessAdmin(temPermissaoAdmin);
      } else {
        setCanManageProjects(false);
        setCanAccessAdmin(false);
      }
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      setCanManageProjects(false);
      setCanAccessAdmin(false);
    }
  };

  const fetchProjetos = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'projetos'));
      let listaDoBanco = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Admin e todos os gerentes veem todos os projetos
      if (userProfile && (userProfile.funcao === 'admin' || (typeof userProfile.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente')))) {
        // Mostrar todos os projetos
      } else if (userProfile && userProfile.funcao !== 'admin') {
        const projetosDoUsuario = userProfile.projetos || [];
        if (projetosDoUsuario.length > 0) {
          // Filtra apenas os projetos atribuídos ao usuário
          listaDoBanco = listaDoBanco.filter(proj => projetosDoUsuario.includes(proj.id));
        } else {
          // Se não tem projetos atribuídos, mostra lista vazia
          listaDoBanco = [];
        }
      }
      
      setProjetos(listaDoBanco);
    } catch (error) {
      console.error("Erro ao buscar projetos:", error);
    } finally {
      setLoading(false);
    }
  };

    const handleSaveProject = async (e) => {
    e.preventDefault();
        if (!newProjectName.trim()) return;
    setSaving(true);
    try {
                const extras = extraFields
                    .filter(f => f.name?.trim())
                    .map(f => ({ name: f.name.trim(), description: (f.description || '').trim(), url: (f.url || '').trim(), type: f.type || 'link', files: [], formFields: [], formResponses: [] }));

                if (editingProject) {
                    await updateDoc(doc(db, 'projetos', editingProject.id), {
                        nome: newProjectName,
                        urlForms,
                        urlSharePoint,
                        descricao: editingProject.descricao || 'Base ativa',
                        updatedAt: new Date()
                    });
                    await ActivityLogger.projectEdited(newProjectName, currentUser.uid, primeiroNome);
                } else {
                    await addDoc(collection(db, 'projetos'), {
                        nome: newProjectName,
                        extras,
                        createdAt: new Date()
                    });
                    await ActivityLogger.projectCreated(newProjectName, currentUser.uid, primeiroNome);
                }

                setNewProjectName('');
                setUrlForms('');
                setUrlSharePoint('');
                setExtraFields([]);
                setEditingProject(null);
                setIsModalOpen(false);
                fetchProjetos();
    } catch (e) { showToast('Erro ao salvar projeto.', 'error'); } finally { setSaving(false); }
  };

    const addExtraField = () => setExtraFields(prev => [...prev, { name: '', description: '', url: '', type: 'link' }]);
    const updateExtraField = (index, key, val) => setExtraFields(prev => prev.map((item, i) => i === index ? { ...item, [key]: val } : item));
    const removeExtraField = (index) => setExtraFields(prev => prev.filter((_, i) => i !== index));

  const canEditProject = (projetoId) => {
    if (isAdmin) return true;
    // Todos os gerentes podem editar projetos
    if (typeof userProfile?.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente')) return true;
    return projetosPermitidos.includes(projetoId);
  };

  const handleDeleteProject = async (e, projetoId) => {
    e.stopPropagation();
    setConfirmDelete({ open: true, projetoId });
  };

  const confirmDeleteProject = async () => {
    try {
      const projeto = projetos.find(p => p.id === confirmDelete.projetoId);
      const projectName = projeto?.nome || 'Projeto';
      
      await deleteDoc(doc(db, 'projetos', confirmDelete.projetoId));
      setProjetos(prev => prev.filter(p => p.id !== confirmDelete.projetoId));
      setConfirmDelete({ open: false, projetoId: null });
      showToast('Projeto excluído com sucesso!', 'success');
      
      // Registrar atividade
      await ActivityLogger.projectDeleted(projectName, currentUser.uid, primeiroNome);
    } catch (error) {
      console.error("Erro ao excluir:", error);
      showToast('Erro ao excluir projeto.', 'error');
      setConfirmDelete({ open: false, projetoId: null });
    }
  };

  const handleSelectProject = (projeto) => {
    navigate('/painel-projeto', { state: { projeto } });
  };

    const openCreateModal = () => {
        setEditingProject(null);
        setNewProjectName('');
        setUrlForms('');
        setUrlSharePoint('');
        setExtraFields([]);
        setIsModalOpen(true);
    };

    const openEditModal = (projeto) => {
        setEditingProject(projeto);
        setNewProjectName(projeto.nome || '');
        setUrlForms(projeto.urlForms || '');
        setUrlSharePoint(projeto.urlSharePoint || '');
        setIsModalOpen(true);
    };

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 transition-colors duration-200 text-white">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl"></div>
      </div>
    {/* ThemeToggle removed */}

      <header className="relative w-full flex items-center justify-between py-3 md:py-6 px-3 md:px-8 border-b border-gray-700 min-h-[56px] md:h-20 bg-gray-900/50 backdrop-blur-md z-20">
        <div className="flex items-center min-w-[44px]">
          <button onClick={() => navigate('/')} className="flex items-center gap-1 md:gap-2 text-gray-300 hover:text-[#57B952] hover:bg-white/5 px-3 sm:px-4 py-2 rounded-lg transition-all font-semibold text-xs md:text-sm shrink-0 backdrop-blur-sm">
            <ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" /> <span className="hidden sm:inline">Voltar</span>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 md:gap-4 px-2">
          <img src="/img/Designer (6).png" alt="Logo Nora" className="h-9 sm:h-10 md:h-14 w-auto object-contain drop-shadow-lg" />
          <span className="text-gray-500 text-lg md:text-2xl font-light">|</span>
          <img 
            src={isDark ? "/img/Normatel Engenharia_BRANCO.png" : "/img/Normatel Engenharia_PRETO.png"} 
            alt="Logo Normatel" 
            className="h-5 sm:h-6 md:h-10 w-auto object-contain drop-shadow-lg" 
          />
        </div>
        
        {currentUser && (
          <div className="flex items-center gap-2 md:gap-3 min-w-[80px] justify-end shrink-0">
            <NotificationCenter />
            <button 
              onClick={() => navigate('/perfil')} 
              className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-[#57B952] bg-gray-700 flex items-center justify-center hover:border-green-600 transition-colors cursor-pointer shrink-0"
            >
              {fotoURL ? <img src={fotoURL} className="w-full h-full object-cover" alt="Avatar" /> : <User size={16} className="md:w-5 md:h-5 text-gray-500" />}
            </button>
            <span className="hidden sm:inline text-xs md:text-base lg:text-lg font-semibold text-white truncate max-w-[60px] sm:max-w-[100px] md:max-w-none"><span className="hidden md:inline">Olá, </span>{primeiroNome}</span>
          </div>
        )}
      </header>

      <main className="flex-grow flex flex-col items-center p-2 sm:p-3 md:p-8 relative z-10">
        <div className="w-full max-w-6xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-3 md:mb-8 gap-3 md:gap-4">
                <div className="flex-1 w-full">
                    <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-white">Seleção de projetos</h1>
                    <p className="text-xs sm:text-sm md:text-base text-gray-300 mt-1 md:mt-2">Escolha o projeto para acessar o ambiente de trabalho.</p>
                </div>
                
                <div className="flex gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end">
                    {/* BOTÃO ADMIN - Apenas para Administrador */}
                    {isAdmin && (
                        <Link
                            to="/admin"
                            className="bg-purple-500/20 text-purple-300 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold flex items-center gap-1.5 sm:gap-2 shadow transition-all hover:scale-105 hover:bg-purple-500/30 text-xs sm:text-sm border border-purple-500/30"
                        >
                          <Shield size={16} className="sm:w-[18px] sm:h-[18px]" />
                          <span className="hidden sm:inline">Administrador</span>
                          <span className="sm:hidden">Adm</span>
                        </Link>
                    )}

                    {/* BOTÃO GERÊNCIA */}
                    {(isAdmin || canAccessAdmin) && (
                        <Link
                            to="/gerencia"
                            className="bg-orange-500/20 text-orange-300 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold flex items-center gap-1.5 sm:gap-2 shadow transition-all hover:scale-105 hover:bg-orange-500/30 text-xs sm:text-sm border border-orange-500/30"
                        >
                          <Shield size={16} className="sm:w-[18px] sm:h-[18px]" />
                          <span className="hidden sm:inline">Gerência</span>
                          <span className="sm:hidden">Ger</span>
                        </Link>
                    )}

                    {/* Botão Novo Projeto */}
                    {canManageProjects && (
                        <button onClick={openCreateModal} className="bg-[#57B952] hover:bg-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold flex items-center gap-1.5 sm:gap-2 shadow transition-transform hover:scale-105 text-xs sm:text-sm">
                            <Plus size={16} className="sm:w-[18px] sm:h-[18px]" /> <span className="hidden xs:inline">Novo Projeto</span><span className="xs:hidden">Novo</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Filtros e Busca */}
            <div className="mb-4 md:mb-6 bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-3 md:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="sm:col-span-2 md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-200 mb-1.5 md:mb-2">Buscar</label>
                  <input
                    type="text"
                    placeholder="Buscar por nome..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-[#57B952] outline-none bg-white/10 text-white placeholder-gray-400 backdrop-blur-sm transition-all hover:bg-white/15"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-200 mb-1.5 md:mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-[#57B952] outline-none transition-all"
                    style={{ backgroundColor: '#ffffff', color: '#111827' }}
                  >
                    <option value="all" style={{ backgroundColor: '#ffffff', color: '#111827' }}>Todos</option>
                    <option value="active" style={{ backgroundColor: '#ffffff', color: '#111827' }}>Ativos</option>
                    <option value="inactive" style={{ backgroundColor: '#ffffff', color: '#111827' }}>Inativos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-200 mb-1.5 md:mb-2">Ordenar por</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-[#57B952] outline-none transition-all"
                    style={{ backgroundColor: '#ffffff', color: '#111827' }}
                  >
                    <option value="name" style={{ backgroundColor: '#ffffff', color: '#111827' }}>Nome (A-Z)</option>
                    <option value="date" style={{ backgroundColor: '#ffffff', color: '#111827' }}>Data de Criação</option>
                    <option value="recent" style={{ backgroundColor: '#ffffff', color: '#111827' }}>Modificados Recentemente</option>
                    <option value="favorites" style={{ backgroundColor: '#ffffff', color: '#111827' }}>Favoritos</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-300">Carregando bases...</div>
            ) : filteredAndSortedProjects.length === 0 ? (
                <div className="text-center py-20 bg-white/10 backdrop-blur-md rounded-xl shadow border border-white/20">
                    <p className="text-gray-200 mb-4">
                      {projetos.length === 0 ? 'Nenhuma base cadastrada ainda.' : 'Nenhum projeto encontrado com os filtros aplicados.'}
                    </p>
                    {canManageProjects && projetos.length === 0 && (
                        <button onClick={() => setIsModalOpen(true)} className="text-[#57B952] font-bold hover:underline">
                            + Adicionar primeira base
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                    {filteredAndSortedProjects.map((projeto) => (
                        <div 
                            key={projeto.id} 
                            onClick={() => handleSelectProject(projeto)} 
                            className="group bg-white/10 backdrop-blur-md p-4 sm:p-5 md:p-8 rounded-xl shadow-lg hover:shadow-xl border border-white/20 hover:border-white/40 text-left transition-all hover:-translate-y-1 flex flex-col h-full relative cursor-pointer"
                        >
                            <div className="flex items-start justify-between mb-2 sm:mb-3 md:mb-4">
                                <div className="bg-[#57B952]/20 p-2 rounded-lg text-[#57B952] border border-[#57B952]/50"><Briefcase size={18} className="sm:w-5 sm:h-5 md:w-6 md:h-6" /></div>
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <span className="text-[9px] sm:text-[10px] md:text-xs font-bold text-gray-300 uppercase tracking-wider">Base Ativa</span>
                                    <FavoriteButton 
                                        itemId={projeto.id}
                                        itemType="project"
                                        itemData={{ name: projeto.nome }}
                                        size={16}
                                        onChange={(next) => {
                                            setFavIds(prev => {
                                                const s = new Set(prev);
                                                if (next) s.add(projeto.id); else s.delete(projeto.id);
                                                return s;
                                            });
                                        }}
                                    />
                                    {canEditProject(projeto.id) && (
                                        <button 
                                            onClick={(e) => handleDeleteProject(e, projeto.id)}
                                            className="p-1 sm:p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            title="Excluir Base"
                                        >
                                            <Trash2 size={13} className="sm:w-[14px] sm:h-[14px] md:w-4 md:h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <h3 className="text-base sm:text-lg md:text-xl font-bold text-white mb-1.5 sm:mb-2 group-hover:text-[#57B952] transition-colors line-clamp-2">{projeto.nome}</h3>
                            <p className="text-xs sm:text-sm text-gray-200 mb-4 sm:mb-5 md:mb-6 flex-grow line-clamp-2">{projeto.descricao || 'Acesso ao portal.'}</p>
                            <div className="mt-auto w-full py-2 rounded-lg bg-white/10 text-center text-xs sm:text-sm font-medium text-white group-hover:bg-[#57B952] group-hover:text-white transition-colors backdrop-blur-sm border border-white/20 group-hover:border-[#57B952]/50">Acessar Projeto</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </main>

      {/* MODAL (criar/editar base) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111114] rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl border border-white/[0.10] flex flex-col max-h-[95vh] sm:max-h-[88vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#57B952]/15 border border-[#57B952]/20 flex items-center justify-center flex-shrink-0">
                  {editingProject
                    ? <Settings size={18} className="text-[#57B952]" />
                    : <Briefcase size={18} className="text-[#57B952]" />}
                </div>
                <div>
                  <p className="font-bold text-white text-base leading-tight">
                    {editingProject ? 'Editar Base' : 'Adicionar Nova Base'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {editingProject ? editingProject.nome : 'Configure o projeto e adicione seus cards'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-gray-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="flex flex-col flex-1 overflow-hidden">
              <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">

                {/* Nome */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    Nome da Base <span className="text-[#57B952]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Projeto 743 — Facilities"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.10] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#57B952]/60 focus:bg-white/[0.07] transition-all"
                  />
                </div>

              </div>

                {/* Cards — só no modo criar */}
                {!editingProject && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Cards</label>
                        {extraFields.filter(f => f.name?.trim()).length > 0 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#57B952]/20 text-[#57B952] text-[10px] font-bold">
                            {extraFields.filter(f => f.name?.trim()).length}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={addExtraField}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#57B952]/10 text-[#57B952] border border-[#57B952]/20 hover:bg-[#57B952]/20 font-semibold transition-colors"
                      >
                        <Plus size={13} /> Novo card
                      </button>
                    </div>

                    {extraFields.length === 0 && (
                      <button
                        type="button"
                        onClick={addExtraField}
                        className="w-full flex flex-col items-center justify-center gap-2 py-8 border border-dashed border-white/[0.10] rounded-2xl hover:border-[#57B952]/30 hover:bg-[#57B952]/[0.03] transition-all group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white/[0.04] group-hover:bg-[#57B952]/10 flex items-center justify-center transition-colors">
                          <Plus size={18} className="text-gray-600 group-hover:text-[#57B952] transition-colors" />
                        </div>
                        <p className="text-xs font-medium text-gray-500 group-hover:text-gray-400 transition-colors">
                          Clique para adicionar um card
                        </p>
                      </button>
                    )}

                    {extraFields.length > 0 && (
                      <div className="space-y-3">
                        {extraFields.map((field, idx) => (
                          <div key={idx} className="group bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.14] rounded-2xl p-4 space-y-3 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-[#57B952]/15 border border-[#57B952]/20 flex items-center justify-center text-[11px] font-bold text-[#57B952] flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-xs text-gray-500 font-medium">Card {idx + 1}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeExtraField(idx)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/15 text-gray-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <X size={14} />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                              <input
                                type="text"
                                placeholder="Nome do card *"
                                value={field.name || ''}
                                onChange={(e) => updateExtraField(idx, 'name', e.target.value)}
                                className="sm:col-span-3 w-full px-3 py-2.5 bg-white/[0.05] border border-white/[0.10] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#57B952]/60 transition-all"
                              />
                              <select
                                value={field.type || 'link'}
                                onChange={(e) => updateExtraField(idx, 'type', e.target.value)}
                                className="sm:col-span-2 w-full px-3 py-2.5 border border-white/[0.10] rounded-xl text-sm focus:outline-none focus:border-[#57B952]/60 transition-all cursor-pointer"
                                style={{ backgroundColor: '#ffffff', color: '#111827' }}
                              >
                                {[
                                  { v: 'link',         l: '🔗 Link Externo' },
                                  { v: 'documents',    l: '📁 Documentos' },
                                  { v: 'reports',      l: '📊 Relatórios' },
                                  { v: 'files',        l: '📄 Arquivos PDF' },
                                  { v: 'spreadsheets', l: '📈 Planilhas' },
                                  { v: 'inventory',    l: '📦 Estoque' },
                                  { v: 'financial',    l: '💰 Financeiro' },
                                  { v: 'hr',           l: '👥 RH' },
                                ].map(t => (
                                  <option key={t.v} value={t.v} style={{ backgroundColor: '#ffffff', color: '#111827' }}>{t.l}</option>
                                ))}
                              </select>
                            </div>

                            <input
                              type="text"
                              placeholder="Descrição (opcional)"
                              value={field.description || ''}
                              onChange={(e) => updateExtraField(idx, 'description', e.target.value)}
                              className="w-full px-3 py-2.5 bg-white/[0.05] border border-white/[0.10] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#57B952]/60 transition-all"
                            />

                            {!NO_URL_TYPES.includes(field.type || 'link') && (
                              <input
                                type="text"
                                placeholder="URL (https://...)"
                                value={field.url || ''}
                                onChange={(e) => updateExtraField(idx, 'url', e.target.value)}
                                className="w-full px-3 py-2.5 bg-white/[0.05] border border-white/[0.10] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#57B952]/60 transition-all"
                              />
                            )}

                            {NO_URL_TYPES.includes(field.type || 'link') && (
                              <p className="flex items-center gap-2 text-xs text-blue-300 bg-blue-500/10 border border-blue-400/20 rounded-xl px-3 py-2">
                                <span>📁</span> Permite upload de arquivos após criado
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/[0.07] flex gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-gray-300 text-sm font-medium hover:bg-white/[0.08] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {saving ? (
                    <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvando...</>
                  ) : (
                    <><Save size={15} /> {editingProject ? 'Salvar Alterações' : 'Criar Base'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast.show && (
        <div className="fixed top-8 right-8 z-[200] animate-fade-in">
          <div className={`border-l-4 ${toast.type === 'error' ? 'bg-red-500/20 border-red-500' : 'bg-green-500/20 border-[#57B952]'} rounded-lg shadow-2xl p-4 flex items-center gap-3 min-w-[300px] text-white`}>
            <div className={`${toast.type === 'error' ? 'bg-red-500/20' : 'bg-green-500/20'} p-2 rounded-full`}>
              {toast.type === 'error' ? (
                <X size={24} className="text-red-500" />
              ) : (
                <Building2 size={24} className="text-[#57B952]" />
              )}
            </div>
            <div>
              <p className="font-bold text-white">{toast.type === 'error' ? 'Erro!' : 'Sucesso!'}</p>
              <p className="text-sm text-gray-100">{toast.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {confirmDelete.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300]">
          <div className="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4 border border-gray-700 text-white">
            <h3 className="text-lg font-bold text-white mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-gray-200 mb-6">Tem certeza que deseja remover esta base? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete({ open: false, projetoId: null })}
                className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors border border-white/20"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteProject}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="w-full py-6 text-center text-gray-300 text-xs shrink-0 border-t border-gray-700 bg-gray-900/50 backdrop-blur-md z-20">&copy; 2025 Parceria Petrobras & Normatel Engenharia</footer>
    </div>
  );
}
export default SelecaoProjeto;
