import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, Plus, Briefcase, X, Save, FileText, Share, Trash2, User, Shield, Upload, FolderOpen, FileSpreadsheet, File } from 'lucide-react';
// ThemeToggle removed: app forced to light mode
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import NotificationCenter from '../components/NotificationCenter';
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
    const [extraFields, setExtraFields] = useState([{ label: '', value: '' }]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
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
        if (!newProjectName || !urlForms || !urlSharePoint) return;
    setSaving(true);
    try {
                // Tipos que não precisam de URL (usam upload ou navegação interna)
                const semUrl = new Set(['documents', 'files', 'spreadsheets', 'forms']);
                const extras = extraFields
                    .filter(f => {
                      if (!f.name?.trim()) return false;
                      if (!semUrl.has(f.type || 'link') && !f.url?.trim()) return false;
                      return true;
                    })
                    .map(f => ({ name: f.name.trim(), description: (f.description || '').trim(), url: (f.url || '').trim(), type: f.type || 'link' }));

                if (editingProject) {
                    await updateDoc(doc(db, 'projetos', editingProject.id), {
                        nome: newProjectName,
                        urlForms,
                        urlSharePoint,
                        descricao: editingProject.descricao || 'Base ativa',
                        extras,
                        updatedAt: new Date()
                    });
                    // Registrar atividade
                    await ActivityLogger.projectEdited(newProjectName, currentUser.uid, primeiroNome);
                } else {
                    await addDoc(collection(db, 'projetos'), {
                            nome: newProjectName,
                            urlForms,
                            urlSharePoint,
                            descricao: 'Base ativa',
                            extras,
                            createdAt: new Date()
                    });
                    // Registrar atividade
                    await ActivityLogger.projectCreated(newProjectName, currentUser.uid, primeiroNome);
                }

                setNewProjectName('');
                setUrlForms('');
                setUrlSharePoint('');
                setExtraFields([{ name: '', description: '', url: '', type: 'link' }]);
                setEditingProject(null);
                setIsModalOpen(false);
                fetchProjetos(); 
    } catch (e) { showToast('Erro ao salvar projeto.', 'error'); } finally { setSaving(false); }
  };

    const addExtraField = () => {
        setExtraFields(prev => [...prev, { name: '', description: '', url: '', type: 'link' }]);
    };

    const updateExtraField = (index, key, newValue) => {
        setExtraFields(prev => prev.map((item, i) => i === index ? { ...item, [key]: newValue } : item));
    };

    const removeExtraField = (index) => {
        setExtraFields(prev => prev.filter((_, i) => i !== index));
    };

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
        setExtraFields([{ name: '', description: '', url: '', type: 'link' }]);
        setIsModalOpen(true);
    };

    const openEditModal = (projeto) => {
        setEditingProject(projeto);
        setNewProjectName(projeto.nome || '');
        setUrlForms(projeto.urlForms || '');
        setUrlSharePoint(projeto.urlSharePoint || '');
        setExtraFields(projeto.extras && projeto.extras.length > 0 ? projeto.extras.map(e => ({ name: e.name || '', description: e.description || '', url: e.url || '', type: e.type || 'link' })) : [{ name: '', description: '', url: '', type: 'link' }]);
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
                    className="w-full px-3 py-2 text-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-[#57B952] outline-none bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/15"
                  >
                    <option value="all" className="bg-gray-900">Todos</option>
                    <option value="active" className="bg-gray-900">Ativos</option>
                    <option value="inactive" className="bg-gray-900">Inativos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-200 mb-1.5 md:mb-2">Ordenar por</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-[#57B952] outline-none bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/15"
                  >
                    <option value="name" className="bg-gray-900">Nome (A-Z)</option>
                    <option value="date" className="bg-gray-900">Data de Criação</option>
                    <option value="recent" className="bg-gray-900">Modificados Recentemente</option>
                    <option value="favorites" className="bg-gray-900">Favoritos</option>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md border border-white/20 animate-fade-in my-8 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-white/10 flex-shrink-0">
                    <h2 className="text-xl font-bold text-white">
                        {editingProject ? 'Editar Base' : 'Adicionar Nova Base'}
                    </h2>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-300 hover:text-red-400 transition-colors"><X size={20} /></button>
                </div>
                <form onSubmit={handleSaveProject} className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1">Nome do Projeto</label>
                        <input type="text" placeholder="Ex: Projeto 743 - Facilities" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-[#57B952] outline-none placeholder-gray-400 backdrop-blur-sm transition-all hover:bg-white/15" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1 flex items-center gap-2"><FileText size={14} /> Link do Forms (Solicitação)</label>
                        <input type="url" placeholder="https://forms..." value={urlForms} onChange={(e) => setUrlForms(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-[#57B952] outline-none placeholder-gray-400 backdrop-blur-sm transition-all hover:bg-white/15" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1 flex items-center gap-2"><Share size={14} /> Link do SharePoint (Aprovação)</label>
                        <input type="url" placeholder="https://sharepoint..." value={urlSharePoint} onChange={(e) => setUrlSharePoint(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-[#57B952] outline-none placeholder-gray-400 backdrop-blur-sm transition-all hover:bg-white/15" required />
                    </div>

                    <div className="pt-2">
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-300">Cards adicionais (opcional)</label>
                            <button type="button" onClick={addExtraField} className="text-sm text-[#57B952] hover:text-green-700 font-semibold flex items-center gap-1">
                                <Plus size={14} /> Adicionar card
                            </button>
                        </div>
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                            {extraFields.map((field, idx) => (
                                <div key={idx} className="border border-white/20 rounded-lg p-3 space-y-2 bg-white/5 backdrop-blur-sm">
                                    <input
                                        type="text"
                                        placeholder="Nome do Card"
                                        value={field.name}
                                        onChange={(e) => updateExtraField(idx, 'name', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-[#57B952] outline-none text-sm placeholder-gray-400"
                                    />
                                    
                                    <div>
                                        <label className="block text-xs font-medium text-gray-300 mb-1">Tipo de Card</label>
                                        <select
                                            value={field.type || 'link'}
                                            onChange={(e) => updateExtraField(idx, 'type', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-[#57B952] outline-none text-sm"
                                        >
                                            <option value="link">🔗 Link Externo</option>
                                            <option value="documents">📁 Pasta de Documentos</option>
                                            <option value="reports">📊 Relatórios e Dashboards</option>
                                            <option value="files">📄 Arquivos PDF</option>
                                            <option value="spreadsheets">📈 Planilhas Excel</option>
                                            <option value="forms">📝 Formulários</option>
                                            <option value="approvals">✅ Centro de Aprovações</option>
                                            <option value="inventory">📦 Controle de Estoque</option>
                                            <option value="financial">💰 Financeiro</option>
                                            <option value="hr">👥 Recursos Humanos</option>
                                        </select>
                                    </div>
                                    
                                    <input
                                        type="text"
                                        placeholder="Descrição (opcional)"
                                        value={field.description}
                                        onChange={(e) => updateExtraField(idx, 'description', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-[#57B952] outline-none text-sm placeholder-gray-400"
                                    />
                                    <input
                                        type="url"
                                        placeholder="URL (https://...)"
                                        value={field.url}
                                        onChange={(e) => updateExtraField(idx, 'url', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-[#57B952] outline-none text-sm placeholder-gray-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeExtraField(idx)}
                                        className="w-full py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors font-semibold"
                                    >
                                        <Trash2 size={14} className="inline mr-1" /> Remover Card
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="bg-white/5 border border-white/20 rounded-lg p-3 mt-3">
                            <p className="text-xs text-gray-300 font-semibold mb-1">💡 Dicas de uso:</p>
                            <ul className="text-xs text-gray-400 space-y-1 ml-4 list-disc">
                                <li><strong className="text-gray-300">📁 Documentos / 📄 PDFs / 📊 Planilhas:</strong> Upload e gerenciamento interno de arquivos</li>
                                <li><strong className="text-gray-300">📈 Relatórios:</strong> Link para Power BI, Tableau ou dashboards</li>
                                <li><strong className="text-gray-300">📝 Formulários:</strong> Construtor interno de formulário</li>
                                <li><strong className="text-gray-300">✅ Aprovações / 📦 Estoque / 💰 Financeiro / 👥 RH:</strong> Link para sistema externo</li>
                            </ul>
                        </div>
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 rounded-lg text-gray-300 hover:bg-white/10 font-medium transition-colors border border-white/10">Cancelar</button>
                        
                        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-[#57B952] hover:bg-green-600 text-white font-bold shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-70">{saving ? 'Salvando...' : <><Save size={18} /> {editingProject ? 'Salvar Alterações' : 'Salvar Base'}</>}</button>
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
