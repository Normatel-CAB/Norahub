import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Edit2, Save, X, CheckCircle,
  ChevronDown, ChevronUp, Search, ExternalLink, FileText,
  FileSpreadsheet, BarChart3, FolderOpen, Phone, Mail,
  Sparkles, Layers, Users, Link2, Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import {
  doc, onSnapshot, collection, getDocs, updateDoc,
} from 'firebase/firestore';
import {
  createCarteira, updateCarteira, deleteCarteira,
  addLink, updateLink, removeLink, seedCarteiras,
  CORES_CARTEIRA, LINK_TIPOS,
} from '../services/carteirasDeProjeto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const inputCls =
  'w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.10] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#57B952]/60 focus:bg-white/[0.08] transition-all';

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast.show) return null;
  return (
    <div className={`fixed top-5 right-5 z-[300] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-xl ${
      toast.type === 'success' ? 'bg-gray-900/95 border-green-500/30' : 'bg-gray-900/95 border-red-500/30'
    }`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toast.type === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
        {toast.type === 'success'
          ? <CheckCircle size={14} className="text-green-400" />
          : <X size={14} className="text-red-400" />}
      </div>
      <span className="font-medium text-sm text-white">{toast.message}</span>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ open, title, body, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111115] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <p className="font-bold text-white text-sm mb-2">{title}</p>
        <p className="text-xs text-gray-400 mb-5">{body}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.09] text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors">Excluir</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function GerenciaCarteiras() {
  const { id: projetoId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const isAdmin = userProfile?.funcao === 'admin';
  const isManager = typeof userProfile?.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente');

  const [projeto, setProjeto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Modals
  const [carteiraModal, setCarteiraModal] = useState({ open: false, carteira: null });
  const [linkModal, setLinkModal] = useState({ open: false, carteiraId: null, link: null });
  const [membrosModal, setMembrosModal] = useState({ open: false, carteira: null });
  const [confirm, setConfirm] = useState({ open: false, type: '', carteiraId: null, linkId: null, nome: '' });

  // Forms
  const [formCarteira, setFormCarteira] = useState({ nome: '', descricao: '', cor: '#57B952' });
  const [formLink, setFormLink] = useState({ nome: '', url: '', tipo: 'link', descricao: '' });
  const [membrosSearch, setMembrosSearch] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  // ─── Load project (real-time) ──────────────────────────────────────────────
  useEffect(() => {
    if (!projetoId) { navigate('/selecao-projeto'); return; }
    if (!isAdmin && !isManager) { navigate('/selecao-projeto'); return; }

    const unsub = onSnapshot(doc(db, 'projetos', projetoId), (snap) => {
      if (!snap.exists()) { navigate('/selecao-projeto'); return; }
      setProjeto({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
    return () => unsub();
  }, [projetoId, isAdmin, isManager, navigate]);

  // ─── Load users ───────────────────────────────────────────────────────────
  useEffect(() => {
    getDocs(collection(db, 'usuarios')).then(snap => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.funcao !== 'admin'));
    }).catch(() => {});
  }, []);

  const carteiras = useMemo(
    () => (projeto?.carteiras || []).sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99)),
    [projeto]
  );

  const filteredCarteiras = useMemo(() => {
    if (!search.trim()) return carteiras;
    const t = search.toLowerCase();
    return carteiras.filter(c => c.nome.toLowerCase().includes(t) || (c.descricao || '').toLowerCase().includes(t));
  }, [carteiras, search]);

  const projectMembers = useMemo(
    () => allUsers.filter(u => (u.projetos || []).includes(projetoId) || u.funcao?.toLowerCase().includes('gerente')),
    [allUsers, projetoId]
  );

  const toggleExpand = (id) =>
    setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // ─── Carteira CRUD ────────────────────────────────────────────────────────
  const openCarteiraModal = (carteira = null) => {
    setFormCarteira(carteira
      ? { nome: carteira.nome, descricao: carteira.descricao || '', cor: carteira.cor }
      : { nome: '', descricao: '', cor: '#57B952' }
    );
    setCarteiraModal({ open: true, carteira });
  };

  const handleSaveCarteira = async (e) => {
    e.preventDefault();
    if (!formCarteira.nome.trim()) return;
    setSaving(true);
    try {
      if (carteiraModal.carteira) {
        await updateCarteira(projetoId, carteiraModal.carteira.id, formCarteira);
        showToast('Setor atualizado!');
      } else {
        await createCarteira(projetoId, { ...formCarteira, ordem: carteiras.length + 1 }, currentUser.uid);
        showToast('Setor criado!');
      }
      setCarteiraModal({ open: false, carteira: null });
    } catch { showToast('Erro ao salvar setor.', 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteCarteira = async () => {
    await deleteCarteira(projetoId, confirm.carteiraId);
    showToast('Setor removido.');
    setConfirm({ open: false, type: '', carteiraId: null, linkId: null, nome: '' });
  };

  const handleSeed = async () => {
    setSeeding(true);
    const res = await seedCarteiras(projetoId, currentUser.uid);
    if (res.success) {
      showToast('10 setores criados com sucesso!');
      setExpandedIds(new Set());
    } else if (res.reason === 'already_seeded') {
      showToast('Este projeto já possui setores.', 'error');
    } else {
      showToast('Erro ao criar setores.', 'error');
    }
    setSeeding(false);
  };

  // ─── Link CRUD ────────────────────────────────────────────────────────────
  const openLinkModal = (carteiraId, link = null) => {
    setFormLink(link
      ? { nome: link.nome, url: link.url || '', tipo: link.tipo || 'link', descricao: link.descricao || '' }
      : { nome: '', url: '', tipo: 'link', descricao: '' }
    );
    setLinkModal({ open: true, carteiraId, link });
  };

  const handleSaveLink = async (e) => {
    e.preventDefault();
    if (!formLink.nome.trim()) return;
    setSaving(true);
    try {
      if (linkModal.link) {
        await updateLink(projetoId, linkModal.carteiraId, linkModal.link.id, formLink);
        showToast('Link atualizado!');
      } else {
        await addLink(projetoId, linkModal.carteiraId, formLink, currentUser.uid);
        showToast('Link adicionado!');
      }
      setLinkModal({ open: false, carteiraId: null, link: null });
    } catch { showToast('Erro ao salvar link.', 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteLink = async () => {
    await removeLink(projetoId, confirm.carteiraId, confirm.linkId);
    showToast('Link removido.');
    setConfirm({ open: false, type: '', carteiraId: null, linkId: null, nome: '' });
  };

  // ─── Members management ───────────────────────────────────────────────────
  const getUserCarteiraIds = (user) =>
    (user?.carteirasPorProjeto?.[projetoId] || []);

  const toggleMembro = async (user, carteiraId) => {
    const current = getUserCarteiraIds(user);
    const alreadyHas = current.includes(carteiraId);
    const updated = alreadyHas ? current.filter(id => id !== carteiraId) : [...current, carteiraId];
    try {
      await updateDoc(doc(db, 'usuarios', user.id), {
        [`carteirasPorProjeto.${projetoId}`]: updated,
      });
      setAllUsers(prev => prev.map(u =>
        u.id === user.id
          ? { ...u, carteirasPorProjeto: { ...(u.carteirasPorProjeto || {}), [projetoId]: updated } }
          : u
      ));
    } catch { showToast('Erro ao atualizar acesso.', 'error'); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f1117] via-[#151821] to-[#0f1117]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#57B952] border-t-transparent" />
    </div>
  );

  const totalLinks = carteiras.reduce((s, c) => s + (c.links?.length ?? 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1117] via-[#151821] to-[#0f1117] text-white font-[Outfit,sans-serif]">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#57B952]/8 rounded-full blur-3xl pointer-events-none" />

      <Toast toast={toast} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0f1117]/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/projeto/${projetoId}`)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-white/[0.05] group-hover:bg-white/[0.10] flex items-center justify-center">
                <ArrowLeft size={15} />
              </div>
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="h-4 w-px bg-white/[0.08]" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
                <Layers size={15} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">Gerenciar Setores</p>
                <p className="text-[10px] text-gray-500 leading-tight truncate max-w-[200px]">{projeto?.nome}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {carteiras.length === 0 && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 font-semibold hover:bg-cyan-500/25 transition-colors disabled:opacity-50"
              >
                <Sparkles size={13} />
                {seeding ? 'Criando...' : 'Criar Padrão'}
              </button>
            )}
            <button
              onClick={() => openCarteiraModal()}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white font-semibold transition-all shadow-md shadow-[#57B952]/20"
            >
              <Plus size={14} />
              Novo Setor
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5 relative z-10">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Setores', value: carteiras.length, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
            { label: 'Links total', value: totalLinks, color: 'text-[#57B952]', bg: 'bg-[#57B952]/10 border-[#57B952]/20' },
            { label: 'Membros', value: projectMembers.length, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border rounded-2xl px-4 py-3 text-center`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        {carteiras.length > 3 && (
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar setor..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.10] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all"
            />
          </div>
        )}

        {/* Empty state */}
        {carteiras.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
              <Layers size={22} className="text-cyan-400" />
            </div>
            <p className="text-sm font-semibold text-white/60 mb-1">Nenhum setor configurado</p>
            <p className="text-xs text-white/30 mb-4">Crie setores padrão ou adicione manualmente.</p>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-semibold hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
            >
              <Sparkles size={14} />
              {seeding ? 'Criando...' : 'Criar 10 Setores Padrão'}
            </button>
          </div>
        )}

        {/* Carteiras list */}
        <div className="space-y-3">
          {filteredCarteiras.map(carteira => {
            const expanded = expandedIds.has(carteira.id);
            const links = carteira.links || [];
            return (
              <div
                key={carteira.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden"
                style={{ borderLeftColor: carteira.cor, borderLeftWidth: 3 }}
              >
                {/* Carteira header */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <button
                    onClick={() => toggleExpand(carteira.id)}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${carteira.cor}25` }}
                    >
                      <Layers size={14} style={{ color: carteira.cor }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{carteira.nome}</p>
                      {carteira.descricao && (
                        <p className="text-[11px] text-gray-500 truncate">{carteira.descricao}</p>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0"
                      style={{ color: carteira.cor, backgroundColor: `${carteira.cor}20`, borderColor: `${carteira.cor}40` }}
                    >
                      {links.length} link{links.length !== 1 ? 's' : ''}
                    </span>
                    {expanded ? <ChevronUp size={14} className="text-white/30 flex-shrink-0" /> : <ChevronDown size={14} className="text-white/30 flex-shrink-0" />}
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setMembrosModal({ open: true, carteira })}
                      title="Membros com acesso"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-purple-400 hover:bg-purple-500/15 transition-colors"
                    >
                      <Users size={14} />
                    </button>
                    <button
                      onClick={() => openLinkModal(carteira.id)}
                      title="Adicionar link"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-[#57B952] hover:bg-[#57B952]/15 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => openCarteiraModal(carteira)}
                      title="Editar setor"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/15 transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setConfirm({ open: true, type: 'carteira', carteiraId: carteira.id, linkId: null, nome: carteira.nome })}
                      title="Excluir setor"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/15 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Links list */}
                {expanded && (
                  <div className="px-4 pb-4 space-y-1.5 border-t border-white/[0.06] pt-3">
                    {links.length === 0 ? (
                      <p className="text-xs text-white/25 italic text-center py-3">
                        Nenhum link. Clique em <span className="text-[#57B952]">+</span> para adicionar.
                      </p>
                    ) : links.map(link => {
                      const Icon = getLinkIcon(link.tipo);
                      const isClickable = link.url && !['contato'].includes(link.tipo);
                      return (
                        <div
                          key={link.id}
                          className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.10] transition-all"
                        >
                          <span className="text-gray-500 flex-shrink-0"><Icon size={13} /></span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white/80 truncate">{link.nome}</p>
                            {link.descricao && <p className="text-[10px] text-gray-600 truncate">{link.descricao}</p>}
                            {link.url && <p className="text-[10px] text-gray-600 truncate">{link.url}</p>}
                          </div>
                          {isClickable && (
                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-all">
                              <ExternalLink size={12} />
                            </a>
                          )}
                          <button
                            onClick={() => openLinkModal(carteira.id, link)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-blue-500/15 text-gray-500 hover:text-blue-400 transition-all"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => setConfirm({ open: true, type: 'link', carteiraId: carteira.id, linkId: link.id, nome: link.nome })}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/15 text-gray-500 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => openLinkModal(carteira.id)}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-white/[0.08] text-xs text-gray-600 hover:text-[#57B952] hover:border-[#57B952]/30 hover:bg-[#57B952]/[0.03] transition-all"
                    >
                      <Plus size={12} /> Adicionar link
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* ── Carteira Modal ─────────────────────────────────────────────────────── */}
      {carteiraModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111115] border border-white/[0.10] rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
                  <Layers size={14} className="text-cyan-400" />
                </div>
                <p className="font-bold text-white text-sm">
                  {carteiraModal.carteira ? 'Editar Setor' : 'Novo Setor'}
                </p>
              </div>
              <button onClick={() => setCarteiraModal({ open: false, carteira: null })} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-gray-500 hover:text-white transition-colors">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleSaveCarteira} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nome *</label>
                <input
                  autoFocus
                  required
                  value={formCarteira.nome}
                  onChange={e => setFormCarteira(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Civil, RH, Logística..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Descrição</label>
                <input
                  value={formCarteira.descricao}
                  onChange={e => setFormCarteira(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Breve descrição do setor"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {CORES_CARTEIRA.map(cor => (
                    <button
                      key={cor} type="button"
                      onClick={() => setFormCarteira(p => ({ ...p, cor }))}
                      className={`w-7 h-7 rounded-full transition-transform ${formCarteira.cor === cor ? 'scale-125 ring-2 ring-white/60 ring-offset-1 ring-offset-[#111115]' : 'hover:scale-110'}`}
                      style={{ backgroundColor: cor }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setCarteiraModal({ open: false, carteira: null })} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-gray-300 text-sm font-medium hover:bg-white/[0.08] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /></> : <><Save size={14} /> Salvar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Link Modal ─────────────────────────────────────────────────────────── */}
      {linkModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111115] border border-white/[0.10] rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#57B952]/15 border border-[#57B952]/20 flex items-center justify-center">
                  <Link2 size={14} className="text-[#57B952]" />
                </div>
                <p className="font-bold text-white text-sm">
                  {linkModal.link ? 'Editar Link' : 'Novo Link'}
                </p>
              </div>
              <button onClick={() => setLinkModal({ open: false, carteiraId: null, link: null })} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-gray-500 hover:text-white transition-colors">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleSaveLink} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nome *</label>
                  <input
                    autoFocus required
                    value={formLink.nome}
                    onChange={e => setFormLink(p => ({ ...p, nome: e.target.value }))}
                    placeholder="Nome do link"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tipo</label>
                  <select
                    value={formLink.tipo}
                    onChange={e => setFormLink(p => ({ ...p, tipo: e.target.value }))}
                    className={`${inputCls} cursor-pointer`}
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#f9fafb' }}
                  >
                    {LINK_TIPOS.map(t => (
                      <option key={t.value} value={t.value} style={{ backgroundColor: '#111827', color: '#fff' }}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">URL</label>
                <input
                  value={formLink.url}
                  onChange={e => setFormLink(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Descrição</label>
                <input
                  value={formLink.descricao}
                  onChange={e => setFormLink(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Breve descrição (opcional)"
                  className={inputCls}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setLinkModal({ open: false, carteiraId: null, link: null })} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-gray-300 text-sm font-medium hover:bg-white/[0.08] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><Save size={14} /> Salvar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Members Modal ──────────────────────────────────────────────────────── */}
      {membrosModal.open && membrosModal.carteira && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111115] border border-white/[0.10] rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
              <div className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: membrosModal.carteira.cor }}
                />
                <div>
                  <p className="font-bold text-white text-sm">{membrosModal.carteira.nome}</p>
                  <p className="text-xs text-gray-500">Controle de acesso</p>
                </div>
              </div>
              <button onClick={() => { setMembrosModal({ open: false, carteira: null }); setMembrosSearch(''); }} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-gray-500 hover:text-white transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                <input
                  value={membrosSearch}
                  onChange={e => setMembrosSearch(e.target.value)}
                  placeholder="Buscar colaborador..."
                  className="w-full pl-8 pr-4 py-2 bg-white/[0.05] border border-white/[0.09] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-white/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
              {projectMembers
                .filter(u => u.nome?.toLowerCase().includes(membrosSearch.toLowerCase()) || u.email?.toLowerCase().includes(membrosSearch.toLowerCase()))
                .map(user => {
                  const hasAccess = getUserCarteiraIds(user).includes(membrosModal.carteira.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleMembro(user, membrosModal.carteira.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                        hasAccess ? 'bg-[#57B952]/10 border-[#57B952]/20' : 'border-white/[0.06] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${hasAccess ? 'bg-[#57B952]/25 text-[#57B952]' : 'bg-white/10 text-gray-400'}`}>
                        {user.nome?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{user.nome}</p>
                        <p className="text-[10px] text-gray-600 truncate">{user.funcao || 'Colaborador'}</p>
                      </div>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${hasAccess ? 'bg-[#57B952] border-[#57B952]' : 'border-white/20'}`}>
                        {hasAccess && <CheckCircle size={10} className="text-white" />}
                      </div>
                    </button>
                  );
                })}
              {projectMembers.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-6">Nenhum membro neste projeto.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Dialog ─────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirm.open}
        title={confirm.type === 'carteira' ? 'Excluir setor?' : 'Excluir link?'}
        body={`"${confirm.nome}" será removido permanentemente.`}
        onConfirm={confirm.type === 'carteira' ? handleDeleteCarteira : handleDeleteLink}
        onCancel={() => setConfirm({ open: false, type: '', carteiraId: null, linkId: null, nome: '' })}
      />
    </div>
  );
}

export default GerenciaCarteiras;
