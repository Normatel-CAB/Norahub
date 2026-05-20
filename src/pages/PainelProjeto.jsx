import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import {
  FileText, CheckCircle, ExternalLink, Settings, X, Save, Trash2,
  FolderOpen, BarChart3, FileSpreadsheet, File, ClipboardList, PackageCheck,
  DollarSign, Users, Calendar, Copy, Check, Eye, Layers, ChevronDown,
  ChevronUp, Phone, Mail, Link2, Plus, Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, updateDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import NotificationCenter from '../components/NotificationCenter';
import { UserPageHeader } from '../components/UserPageHeader';
import { Breadcrumb } from '../components/Breadcrumb';
import { SkeletonPainelCard } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { CardFieldsForm } from '../components/CardFieldsForm';
import ActivityLogger from '../services/activityLogger';
import { trackLinkAccess, getRecentLinks } from '../services/favorites';

// ─── Configs dos cards legados ─────────────────────────────────────────────────
const GREEN = { bgColor: 'bg-[#57B952]/20', textColor: 'text-[#57B952]', btnColor: 'bg-[#57B952] hover:bg-[#3d8c38]' };
const CARD_CONFIGS = {
  link:         { icon: ExternalLink,    ...GREEN, label: 'Acessar',             needsUpload: false },
  documents:    { icon: FolderOpen,      ...GREEN, label: 'Ver Arquivos',         needsUpload: true  },
  reports:      { icon: BarChart3,       ...GREEN, label: 'Ver Relatório',        needsUpload: false },
  files:        { icon: File,            ...GREEN, label: 'Ver PDFs',             needsUpload: true  },
  spreadsheets: { icon: FileSpreadsheet, ...GREEN, label: 'Ver Planilhas',        needsUpload: true  },
  forms:        { icon: ClipboardList,   ...GREEN, label: 'Acessar Formulário',   needsUpload: false, isCustomForm: true },
  approvals:    { icon: CheckCircle,     ...GREEN, label: 'Ver Aprovações',       needsUpload: false },
  inventory:    { icon: PackageCheck,    ...GREEN, label: 'Acessar Estoque',      needsUpload: false },
  financial:    { icon: DollarSign,      ...GREEN, label: 'Ver Financeiro',       needsUpload: false },
  hr:           { icon: Users,           ...GREEN, label: 'Acessar RH',           needsUpload: false },
};
const getCardConfig = (type) => CARD_CONFIGS[type] ?? CARD_CONFIGS.link;

// ─── Ícones de link nas carteiras ──────────────────────────────────────────────
const LINK_ICON_MAP = {
  link:      ExternalLink,
  documento: FileText,
  planilha:  FileSpreadsheet,
  relatorio: BarChart3,
  pasta:     FolderOpen,
  contato:   Phone,
  email:     Mail,
};
const getLinkIcon = (tipo) => LINK_ICON_MAP[tipo] ?? ExternalLink;

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast.show) return null;
  return (
    <div className={`fixed top-5 right-5 z-[300] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-xl ${
      toast.type === 'success' ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-red-500/20 border-red-500/40 text-red-300'
    }`}>
      {toast.type === 'success' ? <CheckCircle size={16} /> : <X size={16} />}
      <span className="font-medium text-sm">{toast.message}</span>
    </div>
  );
}

// ─── DeadlineBadge ─────────────────────────────────────────────────────────────
function DeadlineBadge({ deadline }) {
  if (!deadline) return null;
  const date = new Date(deadline);
  const now = new Date();
  const isOverdue = date < now;
  const diff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
      isOverdue ? 'bg-red-500/15 text-red-400 border-red-500/25' : diff <= 3 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' : 'bg-white/10 text-gray-400 border-white/15'
    }`}>
      <Calendar size={10} />
      {isOverdue ? `Atrasado ${Math.abs(diff)}d` : diff === 0 ? 'Vence hoje' : `${diff}d restantes`}
    </span>
  );
}

// ─── Carteira Section ──────────────────────────────────────────────────────────
function CarteiraSection({ carteira, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const links = carteira.links || [];

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden"
      style={{ borderLeftColor: carteira.cor, borderLeftWidth: 3 }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${carteira.cor}25` }}
        >
          <Layers size={14} style={{ color: carteira.cor }} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{carteira.nome}</p>
          {carteira.descricao && <p className="text-[11px] text-gray-500 truncate">{carteira.descricao}</p>}
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0"
          style={{ color: carteira.cor, backgroundColor: `${carteira.cor}20`, borderColor: `${carteira.cor}40` }}
        >
          {links.length} {links.length === 1 ? 'link' : 'links'}
        </span>
        {open ? <ChevronUp size={14} className="text-white/30 flex-shrink-0" /> : <ChevronDown size={14} className="text-white/30 flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-2 border-t border-white/[0.06] pt-3">
          {links.length === 0 ? (
            <p className="text-xs text-white/25 italic py-2">Nenhum link neste setor.</p>
          ) : links.map(link => {
            const Icon = getLinkIcon(link.tipo);
            const isClickable = link.url && !['contato'].includes(link.tipo);
            const href = link.tipo === 'email' ? `mailto:${link.url}` : link.url;

            return (
              <div
                key={link.id}
                onClick={() => isClickable && window.open(href, '_blank', 'noopener,noreferrer')}
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] transition-all ${
                  isClickable ? 'cursor-pointer hover:bg-white/[0.07] hover:border-white/[0.12]' : ''
                }`}
              >
                <span className="text-gray-500 flex-shrink-0"><Icon size={14} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/90 truncate">{link.nome}</p>
                  {link.descricao && <p className="text-xs text-white/40 truncate mt-0.5">{link.descricao}</p>}
                  {link.url && !link.descricao && <p className="text-xs text-white/25 truncate mt-0.5">{link.url}</p>}
                </div>
                {isClickable && (
                  <ExternalLink size={13} className="text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
function PainelProjeto() {
  const { id: paramId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [projeto, setProjeto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canEditCards, setCanEditCards] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedExtras, setEditedExtras] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, cardIndex: null, isBuiltIn: false, builtInKey: null });
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [linkCounts, setLinkCounts] = useState({});

  const isAdmin = userProfile?.funcao === 'admin';
  const isManager = typeof userProfile?.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente');
  const canManageCarteiras = isAdmin || isManager;
  const primeiroNome = userProfile?.nome?.split(' ')[0] || currentUser?.displayName?.split(' ')[0] || 'Usuário';

  // Hooks MUST be declared before any conditional returns
  const projetoCarteiras = useMemo(
    () => (projeto?.carteiras || []).sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99)),
    [projeto]
  );

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const projetoId = paramId ?? location.state?.projeto?.id;

  // ─── Real-time project listener ──────────────────────────────────────────────
  useEffect(() => {
    if (!projetoId) { navigate('/selecao-projeto', { replace: true }); return; }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'projetos', projetoId),
      (snap) => {
        if (!snap.exists() || snap.data()?.deletedAt) { setErrorType('notfound'); setLoading(false); return; }
        setProjeto({ id: snap.id, ...snap.data() });
        setLoading(false);
      },
      (err) => {
        setErrorType(err.code === 'permission-denied' ? 'permission' : 'generic');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [projetoId, navigate]);

  // ─── Access counters ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser || !projeto) return;
    getRecentLinks(currentUser.uid).then(res => {
      if (!res.success) return;
      const counts = {};
      res.recentLinks.forEach(l => { if (l.projetoId === projeto.id) counts[l.id] = l.accessCount || 0; });
      setLinkCounts(counts);
    });
  }, [currentUser, projeto?.id]);

  // ─── Permissions ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      if (!userProfile || !projeto) return;
      if (isAdmin || isManager) { setCanEdit(true); setCanEditCards(true); return; }
      try {
        const snap = await getDocs(query(collection(db, 'cargos'), where('nome', '==', userProfile.funcao)));
        if (!snap.empty) {
          const cargo = snap.docs[0].data();
          setCanEdit(true);
          setCanEditCards(cargo.canEditCardsProjetos || false);
        }
      } catch { setCanEdit(false); setCanEditCards(false); }
    };
    check();
  }, [userProfile, projeto, isAdmin, isManager]);

  // ─── Legacy edit modal helpers ───────────────────────────────────────────────
  const openEditModal = () => {
    setEditedName(projeto.nome || '');
    setEditedExtras(
      (projeto.extras || []).map(e => ({
        name: e.name || '',
        description: e.description || '',
        url: e.url || '',
        type: e.type || 'link',
        carteiraId: e.carteiraId || null,
      }))
    );
    setIsEditModalOpen(true);
  };

  const addExtraField = () => setEditedExtras(prev => [...prev, { name: '', description: '', url: '', type: 'link', carteiraId: null }]);
  const updateExtraField = (idx, key, val) => setEditedExtras(prev => prev.map((item, i) => i === idx ? { ...item, [key]: val } : item));
  const removeExtraField = (idx) => setEditedExtras(prev => prev.filter((_, i) => i !== idx));

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editedName) return;
    setSaving(true);
    try {
      const extrasOriginais = Array.isArray(projeto.extras) ? projeto.extras : [];
      const filteredExtras = editedExtras.filter(f => f.name?.trim()).map(f => {
        const original = extrasOriginais.find(o => o.name === f.name);
        return {
          name: f.name.trim(),
          description: (f.description || '').trim(),
          url: (f.url || '').trim(),
          type: f.type || 'link',
          carteiraId: f.carteiraId || null,
          files: original?.files || [],
          formFields: original?.formFields || [],
          formResponses: original?.formResponses || [],
          emailNotifications: original?.emailNotifications || false,
          notificationEmails: original?.notificationEmails || '',
        };
      });
      await updateDoc(doc(db, 'projetos', projeto.id), { nome: editedName, extras: filteredExtras, updatedAt: new Date() });
      setIsEditModalOpen(false);
      showToast(`Projeto salvo!`);
      ActivityLogger.projectEdited(editedName, currentUser.uid, primeiroNome);
    } catch { showToast('Erro ao salvar.', 'error'); }
    finally { setSaving(false); }
  };

  const handleCopyLink = async (e, url, idx) => {
    e.preventDefault(); e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch { showToast('Não foi possível copiar.', 'error'); }
  };

  const trackAccess = (card) => {
    if (!currentUser || !card.url || card.url === '#') return;
    trackLinkAccess(currentUser.uid, { projetoId: projeto.id, projetoNome: projeto.nome, cardName: card.name, url: card.url, type: card.type || 'link' });
  };

  const handleDeleteExtraCard = (e, card) => {
    e.preventDefault(); e.stopPropagation();
    if (card.isBuiltIn) setConfirmDelete({ open: true, cardIndex: null, isBuiltIn: true, builtInKey: card.builtInKey });
    else setConfirmDelete({ open: true, cardIndex: card.originalIndex, isBuiltIn: false, builtInKey: null });
  };

  const confirmDeleteCard = async () => {
    try {
      if (confirmDelete.isBuiltIn) {
        const current = Array.isArray(projeto.hiddenBuiltIns) ? projeto.hiddenBuiltIns : [];
        await updateDoc(doc(db, 'projetos', projeto.id), { hiddenBuiltIns: [...current, confirmDelete.builtInKey] });
      } else {
        const updatedExtras = (projeto.extras || []).filter((_, idx) => idx !== confirmDelete.cardIndex);
        await updateDoc(doc(db, 'projetos', projeto.id), { extras: updatedExtras, updatedAt: new Date() });
        ActivityLogger.cardDeleted('card', projeto.nome, currentUser.uid, primeiroNome);
      }
      showToast('Card removido.');
    } catch { showToast('Erro ao excluir card.', 'error'); }
    finally { setConfirmDelete({ open: false, cardIndex: null, isBuiltIn: false, builtInKey: null }); }
  };

  // ─── Loading / error states ───────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <UserPageHeader backTo="/selecao-projeto" backLabel="Trocar Projeto" />
      <main className="flex-grow flex flex-col items-center p-3 md:p-8">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-8">
            <div className="h-4 w-32 bg-white/10 rounded-full mx-auto mb-3 animate-pulse" />
            <div className="h-8 w-64 bg-white/10 rounded-xl mx-auto animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => <SkeletonPainelCard key={i} />)}
          </div>
        </div>
      </main>
    </div>
  );

  if (errorType) return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <UserPageHeader backTo="/selecao-projeto" backLabel="Trocar Projeto" />
      <main className="flex-grow flex items-center justify-center">
        <ErrorState type={errorType} title={errorType === 'notfound' ? 'Projeto não encontrado' : undefined} message={errorType === 'notfound' ? 'Este projeto não existe ou foi removido.' : undefined} onRetry={errorType !== 'notfound' && errorType !== 'permission' ? () => window.location.reload() : undefined} />
      </main>
    </div>
  );

  // ─── Carteiras: filtro por acesso do usuário ──────────────────────────────────
  const userCarteiraIds = new Set(userProfile?.carteirasPorProjeto?.[projetoId] || []);
  const visibleCarteiras = canManageCarteiras
    ? projetoCarteiras
    : projetoCarteiras.filter(c => userCarteiraIds.has(c.id));

  // ─── Legacy extras (backward compat) ─────────────────────────────────────────
  const hiddenBuiltIns = Array.isArray(projeto.hiddenBuiltIns) ? projeto.hiddenBuiltIns : [];
  const extrasRaw = Array.isArray(projeto.extras)
    ? projeto.extras.map((e, originalIndex) => ({ ...e, originalIndex })).filter(e => e?.name?.trim())
    : [];

  // Filter legacy extras by carteira if user has restrictions
  const extras = extrasRaw.filter(card => {
    if (canManageCarteiras) return true;
    if (!card.carteiraId) return true;
    return userCarteiraIds.has(card.carteiraId);
  });

  const builtInCards = [
    { name: 'Nova Solicitação', description: `Formulário de requisição para ${projeto.nome}.`, url: projeto.urlForms || projeto.url || '#', type: 'link', builtInIcon: FileText, isBuiltIn: true, builtInKey: 'forms' },
    { name: 'Aprovação / Painel', description: 'Lista de pedidos e aprovações.', url: projeto.urlSharePoint || 'https://normatelce.sharepoint.com/', type: 'link', builtInIcon: CheckCircle, isBuiltIn: true, builtInKey: 'sharepoint' },
  ].filter(c => !hiddenBuiltIns.includes(c.builtInKey));

  // Decide render mode: NEW carteiras mode OR legacy extras mode
  const hasCarteiras = projetoCarteiras.length > 0;
  const hasLegacyExtras = extras.length > 0 || builtInCards.length > 0;

  const baseClass = 'group bg-white/10 backdrop-blur-md p-4 md:p-10 rounded-2xl shadow-xl hover:shadow-2xl border border-white/20 flex flex-col items-center text-center transition-all transform hover:-translate-y-2 min-h-[280px] md:h-[320px] w-full';

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl" />
      </div>

      <Toast toast={toast} />
      <UserPageHeader backTo="/selecao-projeto" backLabel="Trocar Projeto" />

      <main className="flex-grow flex flex-col relative z-10">
        <div className="px-4 md:px-8 pt-4 pb-0">
          <Breadcrumb items={[{ label: projeto.nome }]} />
        </div>

        <div className="flex-grow px-4 md:px-8 py-6 max-w-5xl w-full mx-auto space-y-6">

          {/* ── Project header ────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-[#57B952] uppercase tracking-widest mb-1">Ambiente de Trabalho</p>
              <h1 className="text-xl md:text-3xl font-bold text-white">{projeto.nome}</h1>
              {projeto.deadline && <div className="mt-2"><DeadlineBadge deadline={projeto.deadline} /></div>}
              {projeto.tags?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {projeto.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 border border-white/15">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Admin actions */}
            {(canEdit || canEditCards) && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={openEditModal}
                  className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 text-blue-300 font-semibold transition-colors"
                >
                  <Settings size={14} />
                  Editar Base
                </button>
              </div>
            )}
          </div>

          {/* ── CARTEIRAS MODE (new) ─────────────────────────────────────────── */}
          {hasCarteiras && (
            <div className="space-y-3">
              {visibleCarteiras.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                    <Lock size={20} className="text-white/20" />
                  </div>
                  <p className="text-sm font-semibold text-white/50 mb-1">Sem setores atribuídos</p>
                  <p className="text-xs text-white/25">Você não possui acesso a nenhum setor neste projeto. Contate seu gerente.</p>
                </div>
              ) : (
                visibleCarteiras.map(carteira => (
                  <CarteiraSection key={carteira.id} carteira={carteira} defaultOpen />
                ))
              )}

            </div>
          )}

          {/* ── LEGACY MODE (extras/cards) ────────────────────────────────────── */}
          {!hasCarteiras && (
            <>
              {builtInCards.length === 0 && extras.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
                  <Layers size={28} className="text-cyan-400/40 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-white/50 mb-1">Projeto sem conteúdo configurado</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[...builtInCards, ...extras].map((card, idx) => {
                    const config = getCardConfig(card.type || 'link');
                    const CardIcon = card.builtInIcon || config.icon;
                    const cardId = `${projeto.id}_${card.name}`.replace(/\s+/g, '_');
                    const accessCount = linkCounts[cardId] || 0;
                    const hasUrl = !config.isCustomForm && !config.needsUpload && card.type !== 'reports' && card.url && card.url !== '#';

                    const cardInner = (
                      <>
                        <div className={`${config.bgColor} p-4 md:p-6 rounded-full mb-4 md:mb-6 group-hover:scale-110 transition-transform ${config.textColor}`}>
                          <CardIcon size={36} className="md:w-12 md:h-12" />
                        </div>
                        <h2 className="text-lg md:text-2xl font-bold text-white mb-2 md:mb-3">{card.name}</h2>
                        <p className="text-sm md:text-base text-gray-400 mb-4 md:mb-6">{card.description || 'Acesse este recurso.'}</p>
                        {accessCount > 0 && <span className="flex items-center gap-1 text-[10px] text-gray-500 mb-2"><Eye size={10} /> {accessCount} {accessCount === 1 ? 'acesso' : 'acessos'}</span>}
                        {!canManageCarteiras && card.carteiraId && (() => {
                          const c = (projeto.carteiras || []).find(c => c.id === card.carteiraId);
                          if (!c) return null;
                          return (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-2" style={{ backgroundColor: `${c.cor}20`, borderColor: `${c.cor}40`, color: c.cor }}>
                              <Layers size={9} /> {c.nome}
                            </span>
                          );
                        })()}
                        <div className={`mt-auto flex items-center gap-2 ${config.btnColor} text-white px-4 md:px-6 py-2 rounded-full font-bold transition-colors shadow-md text-sm md:text-base`}>
                          {config.label}
                          {!config.needsUpload && !config.isCustomForm && card.type !== 'reports' && <ExternalLink size={14} className="md:w-4 md:h-4" />}
                        </div>
                      </>
                    );

                    return (
                      <div key={idx} className="relative">
                        <div className="absolute top-4 right-4 z-20 flex gap-1">
                          {hasUrl && (
                            <button onClick={(e) => handleCopyLink(e, card.url, idx)} className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 rounded-full transition-colors bg-white/10 backdrop-blur-md" title="Copiar link">
                              {copiedIdx === idx ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                            </button>
                          )}
                          {(canEdit || canEditCards) && (
                            <button onClick={(e) => handleDeleteExtraCard(e, card)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-full transition-colors bg-white/10 backdrop-blur-md" title="Excluir Card">
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                        {config.isCustomForm
                          ? <div onClick={() => { trackAccess(card); navigate('/construtor-formulario', { state: { card, projeto } }); }} className={`${baseClass} cursor-pointer`}>{cardInner}</div>
                          : config.needsUpload
                          ? <div onClick={() => { trackAccess(card); navigate('/gerenciamento-arquivos', { state: { card, projeto } }); }} className={`${baseClass} cursor-pointer`}>{cardInner}</div>
                          : card.type === 'reports'
                          ? <div onClick={() => { trackAccess(card); navigate('/visualizador-dashboard', { state: { dashboardUrl: card.url, dashboardName: card.name, projeto } }); }} className={`${baseClass} cursor-pointer`}>{cardInner}</div>
                          : <a href={card.url} target="_blank" rel="noopener noreferrer" onClick={() => trackAccess(card)} className={`${baseClass} block`}>{cardInner}</a>
                        }
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Built-in tools compact strip (in carteiras mode) */}
          {hasCarteiras && builtInCards.length > 0 && (
            <div className="border-t border-white/[0.06] pt-4">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 font-semibold">Ferramentas</p>
              <div className="flex flex-wrap gap-2">
                {builtInCards.map(card => (
                  <a
                    key={card.builtInKey}
                    href={card.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.09] text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <card.builtInIcon size={13} />
                    {card.name}
                    <ExternalLink size={10} className="text-gray-600" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="w-full py-6 text-center text-gray-400 text-xs border-t border-white/20 bg-white/5 relative z-10">
        &copy; 2025 Parceria Petrobras &amp; Normatel Engenharia
      </footer>

      {/* ── Legacy edit modal ─────────────────────────────────────────────────── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111114] rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl border border-white/[0.10] flex flex-col max-h-[95vh] sm:max-h-[88vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#57B952]/15 border border-[#57B952]/20 flex items-center justify-center">
                  <Settings size={18} className="text-[#57B952]" />
                </div>
                <div>
                  <p className="font-bold text-white text-base leading-tight">Editar Base</p>
                  <p className="text-xs text-gray-500 mt-0.5">{projeto.nome}</p>
                </div>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-gray-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 overflow-hidden">
              <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Nome da Base *</label>
                  <input type="text" value={editedName} onChange={e => setEditedName(e.target.value)} required className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.10] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#57B952]/60 transition-all" />
                </div>
                <CardFieldsForm cards={editedExtras} onAdd={addExtraField} onUpdate={updateExtraField} onRemove={removeExtraField} carteiras={projetoCarteiras} />
              </div>
              <div className="px-6 py-4 border-t border-white/[0.07] flex gap-3 flex-shrink-0">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-gray-300 text-sm font-medium hover:bg-white/[0.08] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                  {saving ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvando...</> : <><Save size={15} /> Salvar Alterações</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Card ───────────────────────────────────────────────── */}
      {confirmDelete.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4">
          <div className="bg-[#161618] rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-white/10">
            <h3 className="text-base font-bold text-white mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-gray-400 mb-6">Tem certeza que deseja remover este card?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete({ open: false, cardIndex: null, isBuiltIn: false, builtInKey: null })} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={confirmDeleteCard} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PainelProjeto;
