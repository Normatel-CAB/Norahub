import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { FileText, CheckCircle, ArrowLeft, ExternalLink, User, Sparkles, Settings, X, Save, Plus, Trash2, FolderOpen, BarChart3, FileSpreadsheet, File, ClipboardList, PackageCheck, DollarSign, Users } from 'lucide-react';
// ThemeToggle removed: app forced to light mode
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext'; // Importar Auth
import { db } from '../services/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import NotificationCenter from '../components/NotificationCenter';

const CARD_CONFIGS = {
  link:        { icon: ExternalLink,  bgColor: 'bg-green-500/20', textColor: 'text-green-400', btnColor: 'bg-[#57B952] hover:bg-[#3d8c38]', label: 'Acessar',             needsUpload: false },
  documents:   { icon: FolderOpen,    bgColor: 'bg-green-500/20', textColor: 'text-green-400', btnColor: 'bg-[#57B952] hover:bg-[#3d8c38]', label: 'Ver Arquivos',        needsUpload: true  },
  reports:     { icon: BarChart3,     bgColor: 'bg-green-500/20', textColor: 'text-green-400', btnColor: 'bg-[#57B952] hover:bg-[#3d8c38]', label: 'Ver Relatório',       needsUpload: false },
  files:       { icon: File,          bgColor: 'bg-green-500/20', textColor: 'text-green-400', btnColor: 'bg-[#57B952] hover:bg-[#3d8c38]', label: 'Ver PDFs',            needsUpload: true  },
  spreadsheets:{ icon: FileSpreadsheet,bgColor: 'bg-green-500/20',textColor: 'text-green-400', btnColor: 'bg-[#57B952] hover:bg-[#3d8c38]', label: 'Ver Planilhas',       needsUpload: true  },
  forms:       { icon: ClipboardList, bgColor: 'bg-green-500/20', textColor: 'text-green-400', btnColor: 'bg-[#57B952] hover:bg-[#3d8c38]', label: 'Acessar Formulário',  needsUpload: false, isCustomForm: true },
  approvals:   { icon: CheckCircle,   bgColor: 'bg-green-500/20', textColor: 'text-green-400', btnColor: 'bg-[#57B952] hover:bg-[#3d8c38]', label: 'Ver Aprovações',      needsUpload: false },
  inventory:   { icon: PackageCheck,  bgColor: 'bg-green-500/20', textColor: 'text-green-400', btnColor: 'bg-[#57B952] hover:bg-[#3d8c38]', label: 'Acessar Estoque',     needsUpload: false },
  financial:   { icon: DollarSign,    bgColor: 'bg-green-500/20', textColor: 'text-green-400', btnColor: 'bg-[#57B952] hover:bg-[#3d8c38]', label: 'Ver Financeiro',      needsUpload: false },
  hr:          { icon: Users,         bgColor: 'bg-green-500/20', textColor: 'text-green-400', btnColor: 'bg-[#57B952] hover:bg-[#3d8c38]', label: 'Acessar RH',          needsUpload: false },
};

const getCardConfig = (type) => CARD_CONFIGS[type] ?? CARD_CONFIGS.link;

function PainelProjeto() {
  const { theme } = useTheme();
  const { currentUser, userProfile } = useAuth(); // Pegar usuário
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const location = useLocation();
  
  // Usar useState para o projeto para permitir atualizações sem reload
  const [projeto, setProjeto] = useState(() => {
    let initialProjeto = location.state?.projeto;
    if (!initialProjeto) {
      try {
        const savedProjeto = localStorage.getItem('currentProjeto');
        if (savedProjeto) initialProjeto = JSON.parse(savedProjeto);
      } catch {
        localStorage.removeItem('currentProjeto');
      }
    } else {
      try {
        localStorage.setItem('currentProjeto', JSON.stringify(initialProjeto));
      } catch {
        // storage pode estar cheio ou bloqueado — ignora silenciosamente
      }
    }
    return initialProjeto;
  });

  // Dados Perfil
  const primeiroNome = userProfile?.nome?.split(' ')[0] || currentUser?.displayName?.split(' ')[0] || 'Usuário';
  const fotoURL = currentUser?.photoURL || userProfile?.fotoURL;
  const isAdmin = userProfile?.funcao === 'admin';
  
  // Estado para permissões
  const [canEdit, setCanEdit] = useState(false);
  const [canEditCards, setCanEditCards] = useState(false);

  // Estado do modal de edição
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedUrlForms, setEditedUrlForms] = useState('');
  const [editedUrlSharePoint, setEditedUrlSharePoint] = useState('');
  const [editedExtras, setEditedExtras] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, cardIndex: null, isBuiltIn: false, builtInKey: null });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Verificar permissões do usuário
  useEffect(() => {
    const checkPermissions = async () => {
      if (!userProfile || !projeto) return;
      
      // Admin sempre pode editar
      if (isAdmin) {
        setCanEdit(true);
        setCanEditCards(true);
        return;
      }
      
      // Gerente de projeto sempre pode editar
      if (userProfile.funcao === 'gerente-projeto') {
        setCanEdit(true);
        setCanEditCards(true);
        return;
      }
      
      // Verificar se o cargo do usuário tem permissão para este projeto
      try {
        const cargosQuery = query(
          collection(db, 'cargos'),
          where('nome', '==', userProfile.funcao)
        );
        const cargosSnapshot = await getDocs(cargosQuery);
        
        if (!cargosSnapshot.empty) {
          const cargoData = cargosSnapshot.docs[0].data();
          const projetosPermitidos = cargoData.projetos || [];
          
          // Verificar se o projeto atual está na lista de projetos permitidos
          if (projetosPermitidos.includes(projeto.id)) {
            setCanEdit(true);
            // Pode editar cards se tiver permissão específica
            setCanEditCards(cargoData.canEditCardsProjetos || false);
          } else {
            setCanEdit(false);
            setCanEditCards(false);
          }
        } else {
          setCanEdit(false);
          setCanEditCards(false);
        }
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        setCanEdit(false);
        setCanEditCards(false);
      }
    };
    
    checkPermissions();
  }, [userProfile, projeto, isAdmin]);

  if (!projeto) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            <button onClick={() => navigate('/selecao-projeto')} className="text-[#57B952]">Voltar para Seleção</button>
        </div>
      );
  }

  // Fallback seguro
  const linkSolicitacao = projeto.urlForms || projeto.url || '#';
  const linkAprovacao = projeto.urlSharePoint || 'https://normatelce.sharepoint.com/';
  const hiddenBuiltIns = Array.isArray(projeto.hiddenBuiltIns) ? projeto.hiddenBuiltIns : [];
  const extras = Array.isArray(projeto.extras)
    ? projeto.extras
        .map((e, originalIndex) => ({ ...e, originalIndex }))
        .filter((e) => e?.name?.trim())
    : [];

  // Cards fixos derivados das URLs do projeto — filtrados se o admin os ocultou
  const builtInCards = [
    {
      name: 'Nova Solicitação',
      description: `Preencher formulário de requisição para ${projeto.nome}.`,
      url: linkSolicitacao,
      type: 'link',
      builtInIcon: FileText,
      isBuiltIn: true,
      builtInKey: 'forms',
    },
    {
      name: 'Aprovação / Painel',
      description: 'Acessar lista de pedidos e aprovações desta base.',
      url: linkAprovacao,
      type: 'link',
      builtInIcon: CheckCircle,
      isBuiltIn: true,
      builtInKey: 'sharepoint',
    },
  ].filter(c => !hiddenBuiltIns.includes(c.builtInKey));

  // Todos os cards: fixos visíveis primeiro, depois os extras dinâmicos
  const allCards = [...builtInCards, ...extras];

  const openEditModal = () => {
    setEditedName(projeto.nome || '');
    setEditedUrlForms(projeto.urlForms || '');
    setEditedUrlSharePoint(projeto.urlSharePoint || '');
    setEditedExtras(
      projeto.extras && projeto.extras.length > 0
        ? projeto.extras.map((e) => ({ name: e.name || '', description: e.description || '', url: e.url || '', type: e.type || 'link' }))
        : [{ name: '', description: '', url: '', type: 'link' }]
    );
    setIsEditModalOpen(true);
  };

  const addExtraField = () => {
    setEditedExtras((prev) => [...prev, { name: '', description: '', url: '', type: 'link' }]);
  };

  const updateExtraField = (index, key, newValue) => {
    setEditedExtras((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: newValue } : item))
    );
  };

  const removeExtraField = (index) => {
    setEditedExtras((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteExtraCard = (e, card) => {
    e.preventDefault();
    e.stopPropagation();
    if (card.isBuiltIn) {
      setConfirmDelete({ open: true, cardIndex: null, isBuiltIn: true, builtInKey: card.builtInKey });
    } else {
      setConfirmDelete({ open: true, cardIndex: card.originalIndex, isBuiltIn: false, builtInKey: null });
    }
  };

  const confirmDeleteCard = async () => {
    try {
      let updatedProjeto;
      if (confirmDelete.isBuiltIn) {
        const current = Array.isArray(projeto.hiddenBuiltIns) ? projeto.hiddenBuiltIns : [];
        const updated = [...current, confirmDelete.builtInKey];
        await updateDoc(doc(db, 'projetos', projeto.id), { hiddenBuiltIns: updated });
        updatedProjeto = { ...projeto, hiddenBuiltIns: updated };
      } else {
        const allExtras = Array.isArray(projeto.extras) ? projeto.extras : [];
        const updatedExtras = allExtras.filter((_, idx) => idx !== confirmDelete.cardIndex);
        await updateDoc(doc(db, 'projetos', projeto.id), { extras: updatedExtras, updatedAt: new Date() });
        updatedProjeto = { ...projeto, extras: updatedExtras };
      }
      setProjeto(updatedProjeto);
      localStorage.setItem('currentProjeto', JSON.stringify(updatedProjeto));
      showToast('Card removido com sucesso!', 'success');
      setConfirmDelete({ open: false, cardIndex: null, isBuiltIn: false, builtInKey: null });
    } catch (error) {
      showToast('Erro ao excluir card: ' + error.message, 'error');
      setConfirmDelete({ open: false, cardIndex: null, isBuiltIn: false, builtInKey: null });
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editedName) return;
    setSaving(true);
    try {
      // Buscar os extras originais do banco para preservar dados existentes
      const projetoDoc = await getDoc(doc(db, 'projetos', projeto.id));
      const projetoData = projetoDoc.data();
      const extrasOriginais = Array.isArray(projetoData.extras) ? projetoData.extras : [];

      const filteredExtras = editedExtras
        .filter((f) => f.name && f.name.trim() !== '')
        .map((f) => {
          const cardOriginal = extrasOriginais.find(e => e.name === f.name);
          return {
            name: f.name.trim(),
            description: (f.description || '').trim(),
            url: (f.url || '').trim(),
            type: f.type || 'link',
            files: cardOriginal?.files || f.files || [],
            formFields: cardOriginal?.formFields || f.formFields || [],
            formResponses: cardOriginal?.formResponses || [],
            emailNotifications: cardOriginal?.emailNotifications || false,
            notificationEmails: cardOriginal?.notificationEmails || ''
          };
        });

      await updateDoc(doc(db, 'projetos', projeto.id), {
        nome: editedName,
        urlForms: editedUrlForms,
        urlSharePoint: editedUrlSharePoint,
        extras: filteredExtras,
        updatedAt: new Date(),
      });

      const updatedProjeto = {
        ...projeto,
        nome: editedName,
        urlForms: editedUrlForms,
        urlSharePoint: editedUrlSharePoint,
        extras: filteredExtras
      };
      
      setProjeto(updatedProjeto);
      localStorage.setItem('currentProjeto', JSON.stringify(updatedProjeto));
      
      setIsEditModalOpen(false);
      showToast(`✅ Projeto salvo com ${filteredExtras.length} card(s)!`, 'success');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showToast('Erro ao salvar alterações.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 transition-colors duration-200 text-white">
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl"></div>
    </div>
    {/* ThemeToggle removed */}

      <header className="relative w-full flex items-center justify-between py-4 px-4 md:px-8 border-b border-gray-700 min-h-[64px] bg-gray-900/50 backdrop-blur-md z-20">
        <button onClick={() => navigate('/selecao-projeto')} className="flex items-center gap-1 md:gap-2 text-gray-300 hover:text-[#57B952] transition-colors font-medium text-xs md:text-sm shrink-0 z-10">
             <ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" /> <span className="hidden sm:inline">Trocar</span><span className="hidden md:inline"> Projeto</span>
        </button>
        
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2 md:gap-4">
                <img src="/img/Designer (6).png" alt="Logo Nora" className="h-10 sm:h-12 md:h-14 w-auto object-contain drop-shadow-lg" />
            <span className="text-gray-400 text-xl md:text-2xl font-light">|</span>
            <img 
              src={isDark ? "/img/Normatel Engenharia_BRANCO.png" : "/img/Normatel Engenharia_PRETO.png"} 
              alt="Logo Normatel" 
              className="h-6 sm:h-8 md:h-10 w-auto object-contain drop-shadow-lg" 
            />
        </div>

        {/* PERFIL NO CANTO DIREITO */}
        {currentUser && (
            <div className="flex items-center gap-2 md:gap-3 shrink-0 z-10">
                <NotificationCenter />
                <button 
                    onClick={() => navigate('/perfil')} 
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-[#57B952] bg-white/10 flex items-center justify-center hover:border-green-600 transition-colors cursor-pointer shrink-0"
                >
                    {fotoURL ? <img src={fotoURL} className="w-full h-full object-cover" alt="Avatar" /> : <User size={16} className="md:w-5 md:h-5 text-gray-400" />}
                </button>
                <span className="text-xs md:text-base font-semibold text-white hidden xs:block truncate max-w-[80px] md:max-w-none"><span className="hidden md:inline">Olá, </span>{primeiroNome}</span>
            </div>
        )}
      </header>

      <main className="flex-grow flex flex-col items-center justify-center p-3 md:p-8">
        <div className="w-full max-w-5xl">
            
            <div className="text-center mb-6 md:mb-12">
                <h2 className="text-xs md:text-sm font-bold text-[#57B952] uppercase tracking-widest mb-1 md:mb-2">
                    Ambiente de Trabalho
                </h2>
                <h1 className="text-xl md:text-3xl lg:text-4xl font-bold text-white">
                    {projeto.nome}
                </h1>
                <p className="text-xs md:text-base text-gray-400 mt-1 md:mt-2">Selecione a operação desejada para esta base.</p>
                {canEdit && (
                  <button
                    onClick={openEditModal}
                    className="mt-4 inline-flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2 rounded-lg font-semibold text-sm border border-blue-400/30 transition-colors shadow-sm"
                  >
                    <Settings size={16} /> Editar Base
                  </button>
                )}
            </div>

            {/* Grid dinâmico unificado — todos os cards via map() */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {allCards.map((card, idx) => {
                const config = getCardConfig(card.type || 'link');
                const CardIcon = card.builtInIcon || config.icon;

                const baseClass =
                  'group bg-white/10 backdrop-blur-md p-4 md:p-10 rounded-2xl shadow-xl hover:shadow-2xl border border-white/20 flex flex-col items-center text-center transition-all transform hover:-translate-y-2 min-h-[280px] md:h-[320px] w-full';

                const cardInner = (
                  <>
                    <div className={`${config.bgColor} p-4 md:p-6 rounded-full mb-4 md:mb-6 group-hover:scale-110 transition-transform ${config.textColor}`}>
                      <CardIcon size={36} className="md:w-12 md:h-12" />
                    </div>
                    <h2 className="text-lg md:text-2xl font-bold text-white mb-2 md:mb-3">{card.name}</h2>
                    <p className="text-sm md:text-base text-gray-400 mb-4 md:mb-6">
                      {card.description || 'Acesse este recurso.'}
                    </p>
                    <div className={`mt-auto flex items-center gap-2 ${config.btnColor} text-white px-4 md:px-6 py-2 rounded-full font-bold transition-colors shadow-md text-sm md:text-base`}>
                      {config.label}
                      {!config.needsUpload && !config.isCustomForm && card.type !== 'reports' && (
                        <ExternalLink size={14} className="md:w-4 md:h-4" />
                      )}
                    </div>
                  </>
                );

                return (
                  <div key={idx} className="relative">
                    {/* Botão excluir — disponível em todos os cards para quem pode editar */}
                    {(canEdit || canEditCards) && (
                      <button
                        onClick={(e) => handleDeleteExtraCard(e, card)}
                        className="absolute top-4 right-4 z-20 p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-full transition-colors bg-white/10 backdrop-blur-md"
                        title="Excluir Card"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}

                    {config.isCustomForm ? (
                      <div
                        onClick={() => navigate('/construtor-formulario', { state: { card, projeto } })}
                        className={`${baseClass} cursor-pointer`}
                      >
                        {cardInner}
                      </div>
                    ) : config.needsUpload ? (
                      <div
                        onClick={() => navigate('/gerenciamento-arquivos', { state: { card, projeto } })}
                        className={`${baseClass} cursor-pointer`}
                      >
                        {cardInner}
                      </div>
                    ) : card.type === 'reports' ? (
                      <div
                        onClick={() => navigate('/visualizador-dashboard', { state: { dashboardUrl: card.url, dashboardName: card.name, projeto } })}
                        className={`${baseClass} cursor-pointer`}
                      >
                        {cardInner}
                      </div>
                    ) : (
                      <a
                        href={card.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${baseClass} block`}
                      >
                        {cardInner}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
        </div>
      </main>
      
      <footer className="w-full py-6 text-center text-gray-400 text-xs shrink-0 border-t border-white/20 bg-white/5">
        &copy; 2025 Parceria Petrobras & Normatel Engenharia
      </footer>

      {/* MODAL DE EDIÇÃO */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111114] rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl border border-white/[0.10] flex flex-col max-h-[95vh] sm:max-h-[88vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#57B952]/15 border border-[#57B952]/20 flex items-center justify-center flex-shrink-0">
                  <Settings size={18} className="text-[#57B952]" />
                </div>
                <div>
                  <p className="font-bold text-white text-base leading-tight">Editar Base</p>
                  <p className="text-xs text-gray-500 mt-0.5">{projeto.nome}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-gray-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 overflow-hidden">
              <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">

                {/* Nome */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    Nome da Base <span className="text-[#57B952]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Projeto 743 — Facilities"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.10] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#57B952]/60 focus:bg-white/[0.07] transition-all"
                  />
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Cards</label>
                      {editedExtras.length > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#57B952]/20 text-[#57B952] text-[10px] font-bold">
                          {editedExtras.length}
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

                  {editedExtras.length === 0 && (
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

                  {editedExtras.length > 0 && (
                    <div className="space-y-3">
                      {editedExtras.map((field, idx) => (
                        <div key={idx} className="group bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.14] rounded-2xl p-4 space-y-3 transition-colors">
                          {/* Card header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-[#57B952]/15 border border-[#57B952]/20 flex items-center justify-center text-[11px] font-bold text-[#57B952] flex-shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-xs text-gray-500 font-medium">Card {idx + 1}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeExtraField(idx); }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/15 text-gray-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          {/* Nome + Tipo em grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                            <input
                              type="text"
                              placeholder="Nome do card *"
                              value={field.name}
                              onChange={(e) => updateExtraField(idx, 'name', e.target.value)}
                              className="sm:col-span-3 w-full px-3 py-2.5 bg-white/[0.05] border border-white/[0.10] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#57B952]/60 transition-all"
                            />
                            <select
                              value={field.type || 'link'}
                              onChange={(e) => updateExtraField(idx, 'type', e.target.value)}
                              className="sm:col-span-2 w-full px-3 py-2.5 border border-white/[0.10] rounded-xl text-sm focus:outline-none focus:border-[#57B952]/60 transition-all cursor-pointer"
                              style={{ backgroundColor: '#1a1a20', color: '#f9fafb' }}
                            >
                              {[
                                { v: 'link',         l: '🔗 Link Externo' },
                                { v: 'documents',    l: '📁 Documentos' },
                                { v: 'reports',      l: '📊 Relatórios' },
                                { v: 'files',        l: '📄 Arquivos PDF' },
                                { v: 'spreadsheets', l: '📈 Planilhas' },
                                { v: 'forms',        l: '📝 Formulários' },
                                { v: 'approvals',    l: '✅ Aprovações' },
                                { v: 'inventory',    l: '📦 Estoque' },
                                { v: 'financial',    l: '💰 Financeiro' },
                                { v: 'hr',           l: '👥 RH' },
                              ].map(t => (
                                <option key={t.v} value={t.v} style={{ backgroundColor: '#ffffff', color: '#111827' }}>{t.l}</option>
                              ))}
                            </select>
                          </div>

                          {/* Descrição */}
                          <input
                            type="text"
                            placeholder="Descrição (opcional)"
                            value={field.description}
                            onChange={(e) => updateExtraField(idx, 'description', e.target.value)}
                            className="w-full px-3 py-2.5 bg-white/[0.05] border border-white/[0.10] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#57B952]/60 transition-all"
                          />

                          {/* URL — só quando não usa upload nem form personalizado */}
                          {!getCardConfig(field.type || 'link').needsUpload && !getCardConfig(field.type || 'link').isCustomForm && (
                            <input
                              type="url"
                              placeholder="URL (https://...)"
                              value={field.url}
                              onChange={(e) => updateExtraField(idx, 'url', e.target.value)}
                              className="w-full px-3 py-2.5 bg-white/[0.05] border border-white/[0.10] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#57B952]/60 transition-all"
                            />
                          )}

                          {getCardConfig(field.type || 'link').needsUpload && (
                            <p className="flex items-center gap-2 text-xs text-blue-300 bg-blue-500/10 border border-blue-400/20 rounded-xl px-3 py-2">
                              <span>📁</span> Permite upload de arquivos após criado
                            </p>
                          )}
                          {getCardConfig(field.type || 'link').isCustomForm && (
                            <p className="flex items-center gap-2 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-400/20 rounded-xl px-3 py-2">
                              <span>📝</span> Abrirá construtor de formulário personalizado
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/[0.07] flex gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
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
                    <><Save size={15} /> Salvar Alterações</>
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
                <CheckCircle size={24} className="text-[#57B952]" />
              )}
            </div>
            <div>
              <p className="font-bold text-white">{toast.type === 'error' ? 'Erro!' : 'Sucesso!'}</p>
              <p className="text-sm text-gray-200">{toast.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {confirmDelete.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300]">
          <div className="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4 border border-gray-700 text-white">
            <h3 className="text-lg font-bold text-white mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-gray-300 mb-6">Tem certeza que deseja remover este card adicional? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete({ open: false, cardIndex: null, isBuiltIn: false, builtInKey: null })}
                className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteCard}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PainelProjeto;
