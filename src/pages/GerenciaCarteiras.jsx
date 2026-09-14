import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Edit2, Save, X, CheckCircle,
  ChevronDown, ChevronUp, Search, ExternalLink, FileText,
  FileSpreadsheet, BarChart3, FolderOpen, Phone, Mail,
  Sparkles, Layers, Users, Link2, Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import {
  createCarteira, updateCarteira, deleteCarteira,
  addLink, updateLink, removeLink, seedCarteiras,
  CORES_CARTEIRA, LINK_TIPOS,
} from '../services/carteirasDeProjeto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function mapUsuarioRow(row) {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    funcao: row.funcao,
    fotoUrl: row.foto_url,
    ...(row.data || {}),
  };
}

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
  'w-full px-3 py-2.5 bg-white/5 border border-hairline rounded-xl text-sm text-txt placeholder-txt-faint focus:outline-none focus:border-brand/60 focus:bg-white/10 transition-all';

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast.show) return null;
  return (
    <div className={`fixed top-5 right-5 z-[300] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-xl bg-surface-card ${
      toast.type === 'success' ? 'border-brand/30' : 'border-red-500/30'
    }`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toast.type === 'success' ? 'bg-brand/20' : 'bg-red-500/20'}`}>
        {toast.type === 'success'
          ? <CheckCircle size={14} className="text-brand-lite" />
          : <X size={14} className="text-red-400" />}
      </div>
      <span className="font-medium text-sm text-txt">{toast.message}</span>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ open, title, body, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="nt-glass rounded-2xl p-6 w-full max-w-sm">
        <p className="font-bold text-txt text-sm mb-2">{title}</p>
        <p className="text-xs text-txt-dim mb-5">{body}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] border border-hairline text-txt-dim text-sm font-medium hover:bg-white/10 transition-colors">Cancelar</button>
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

    let active = true;

    const fetchProjeto = async () => {
      const { data: row, error } = await supabase.from('projetos').select('*').eq('id', projetoId).maybeSingle();
      if (!active) return;
      if (error || !row) { navigate('/selecao-projeto'); return; }
      setProjeto(mapProjetoRow(row));
      setLoading(false);
    };
    fetchProjeto();

    const channel = supabase
      .channel(`projeto-carteiras-${projetoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projetos', filter: `id=eq.${projetoId}` }, (payload) => {
        if (payload.eventType === 'DELETE') { navigate('/selecao-projeto'); return; }
        setProjeto(mapProjetoRow(payload.new));
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [projetoId, isAdmin, isManager, navigate]);

  // ─── Load users ───────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('usuarios').select('*').then(({ data, error }) => {
      if (error) return;
      setAllUsers((data || []).map(mapUsuarioRow).filter(u => u.funcao !== 'admin'));
    });
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
        await createCarteira(projetoId, { ...formCarteira, ordem: carteiras.length + 1 }, currentUser.id);
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
    const res = await seedCarteiras(projetoId, currentUser.id);
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
        await addLink(projetoId, linkModal.carteiraId, formLink, currentUser.id);
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
      const { data: row, error: fetchErr } = await supabase.from('usuarios').select('data').eq('id', user.id).maybeSingle();
      if (fetchErr) throw fetchErr;
      const mergedData = {
        ...(row?.data || {}),
        carteirasPorProjeto: { ...((row?.data || {}).carteirasPorProjeto || {}), [projetoId]: updated },
      };
      const { error } = await supabase.from('usuarios').update({ data: mergedData }).eq('id', user.id);
      if (error) throw error;
      setAllUsers(prev => prev.map(u =>
        u.id === user.id
          ? { ...u, carteirasPorProjeto: { ...(u.carteirasPorProjeto || {}), [projetoId]: updated } }
          : u
      ));
    } catch { showToast('Erro ao atualizar acesso.', 'error'); }
  };

  if (loading) return (
    <div className="nt-page-bg min-h-screen flex items-center justify-center relative">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent relative z-10" />
    </div>
  );

  const totalLinks = carteiras.reduce((s, c) => s + (c.links?.length ?? 0), 0);

  return (
    <div className="nt-page-bg min-h-screen text-txt font-[Outfit,sans-serif] relative">
      <Toast toast={toast} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-hairline backdrop-blur-md" style={{ background: 'rgba(9, 22, 11, 0.6)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/projeto/${projetoId}`)}
              className="flex items-center gap-2 text-sm text-txt-dim hover:text-txt transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-white/[0.05] group-hover:bg-white/[0.10] flex items-center justify-center">
                <ArrowLeft size={15} />
              </div>
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="h-4 w-px bg-hairline" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
                <Layers size={15} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-txt leading-tight">Gerenciar Setores</p>
                <p className="text-[10px] text-txt-faint leading-tight truncate max-w-[200px]">{projeto?.nome}</p>
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
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-gradient-to-r from-brand-lite via-brand to-brand-deep hover:brightness-110 text-white font-semibold transition-all shadow-md shadow-brand/20"
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
            { label: 'Links total', value: totalLinks, color: 'text-brand-lite', bg: 'bg-brand/10 border-brand/20' },
            { label: 'Membros', value: projectMembers.length, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border rounded-2xl px-4 py-3 text-center`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-txt-faint mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        {carteiras.length > 3 && (
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-txt-faint pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar setor..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/5 border border-hairline rounded-xl text-txt placeholder-txt-faint focus:outline-none focus:border-cyan-500/40 transition-all"
            />
          </div>
        )}

        {/* Empty state */}
        {carteiras.length === 0 && (
          <div className="rounded-2xl border border-dashed border-hairline p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
              <Layers size={22} className="text-cyan-400" />
            </div>
            <p className="text-sm font-semibold text-txt-dim mb-1">Nenhum setor configurado</p>
            <p className="text-xs text-txt-faint mb-4">Crie setores padrão ou adicione manualmente.</p>
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
                className="nt-glass rounded-2xl overflow-hidden"
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
                      <p className="text-sm font-semibold text-txt truncate">{carteira.nome}</p>
                      {carteira.descricao && (
                        <p className="text-[11px] text-txt-faint truncate">{carteira.descricao}</p>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0"
                      style={{ color: carteira.cor, backgroundColor: `${carteira.cor}20`, borderColor: `${carteira.cor}40` }}
                    >
                      {links.length} link{links.length !== 1 ? 's' : ''}
                    </span>
                    {expanded ? <ChevronUp size={14} className="text-txt-faint flex-shrink-0" /> : <ChevronDown size={14} className="text-txt-faint flex-shrink-0" />}
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setMembrosModal({ open: true, carteira })}
                      title="Membros com acesso"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-txt-faint hover:text-purple-400 hover:bg-purple-500/15 transition-colors"
                    >
                      <Users size={14} />
                    </button>
                    <button
                      onClick={() => openLinkModal(carteira.id)}
                      title="Adicionar link"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-txt-faint hover:text-brand-lite hover:bg-brand/15 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => openCarteiraModal(carteira)}
                      title="Editar setor"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-txt-faint hover:text-blue-400 hover:bg-blue-500/15 transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setConfirm({ open: true, type: 'carteira', carteiraId: carteira.id, linkId: null, nome: carteira.nome })}
                      title="Excluir setor"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-txt-faint hover:text-red-400 hover:bg-red-500/15 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Links list */}
                {expanded && (
                  <div className="px-4 pb-4 space-y-1.5 border-t border-hairline pt-3">
                    {links.length === 0 ? (
                      <p className="text-xs text-txt-faint italic text-center py-3">
                        Nenhum link. Clique em <span className="text-brand-lite">+</span> para adicionar.
                      </p>
                    ) : links.map(link => {
                      const Icon = getLinkIcon(link.tipo);
                      const isClickable = link.url && !['contato'].includes(link.tipo);
                      return (
                        <div
                          key={link.id}
                          className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-hairline hover:bg-white/[0.06] hover:border-hairline-hi transition-all"
                        >
                          <span className="text-txt-faint flex-shrink-0"><Icon size={13} /></span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-txt truncate">{link.nome}</p>
                            {link.descricao && <p className="text-[10px] text-txt-faint truncate">{link.descricao}</p>}
                            {link.url && <p className="text-[10px] text-txt-faint truncate">{link.url}</p>}
                          </div>
                          {isClickable && (
                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-txt-faint hover:text-txt transition-all">
                              <ExternalLink size={12} />
                            </a>
                          )}
                          <button
                            onClick={() => openLinkModal(carteira.id, link)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-blue-500/15 text-txt-faint hover:text-blue-400 transition-all"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => setConfirm({ open: true, type: 'link', carteiraId: carteira.id, linkId: link.id, nome: link.nome })}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/15 text-txt-faint hover:text-red-400 transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => openLinkModal(carteira.id)}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-hairline text-xs text-txt-faint hover:text-brand-lite hover:border-brand/30 hover:bg-brand/[0.03] transition-all"
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
          <div className="nt-glass rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
                  <Layers size={14} className="text-cyan-400" />
                </div>
                <p className="font-bold text-txt text-sm">
                  {carteiraModal.carteira ? 'Editar Setor' : 'Novo Setor'}
                </p>
              </div>
              <button onClick={() => setCarteiraModal({ open: false, carteira: null })} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-txt-faint hover:text-txt transition-colors">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleSaveCarteira} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-txt-faint uppercase tracking-wider mb-1.5">Nome *</label>
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
                <label className="block text-xs font-semibold text-txt-faint uppercase tracking-wider mb-1.5">Descrição</label>
                <input
                  value={formCarteira.descricao}
                  onChange={e => setFormCarteira(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Breve descrição do setor"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-txt-faint uppercase tracking-wider mb-2">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {CORES_CARTEIRA.map(cor => (
                    <button
                      key={cor} type="button"
                      onClick={() => setFormCarteira(p => ({ ...p, cor }))}
                      className={`w-7 h-7 rounded-full transition-transform ${formCarteira.cor === cor ? 'scale-125 ring-2 ring-white/60 ring-offset-1 ring-offset-surface-card' : 'hover:scale-110'}`}
                      style={{ backgroundColor: cor }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setCarteiraModal({ open: false, carteira: null })} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-hairline text-txt-dim text-sm font-medium hover:bg-white/[0.08] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-lite via-brand to-brand-deep hover:brightness-110 text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
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
          <div className="nt-glass rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand/15 border border-brand/20 flex items-center justify-center">
                  <Link2 size={14} className="text-brand-lite" />
                </div>
                <p className="font-bold text-txt text-sm">
                  {linkModal.link ? 'Editar Link' : 'Novo Link'}
                </p>
              </div>
              <button onClick={() => setLinkModal({ open: false, carteiraId: null, link: null })} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-txt-faint hover:text-txt transition-colors">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleSaveLink} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-txt-faint uppercase tracking-wider mb-1.5">Nome *</label>
                  <input
                    autoFocus required
                    value={formLink.nome}
                    onChange={e => setFormLink(p => ({ ...p, nome: e.target.value }))}
                    placeholder="Nome do link"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-faint uppercase tracking-wider mb-1.5">Tipo</label>
                  <select
                    value={formLink.tipo}
                    onChange={e => setFormLink(p => ({ ...p, tipo: e.target.value }))}
                    className={`${inputCls} cursor-pointer`}
                    style={{ backgroundColor: 'var(--surface-2)', color: 'var(--txt)' }}
                  >
                    {LINK_TIPOS.map(t => (
                      <option key={t.value} value={t.value} style={{ backgroundColor: 'var(--surface-card)', color: 'var(--txt)' }}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-txt-faint uppercase tracking-wider mb-1.5">URL</label>
                <input
                  value={formLink.url}
                  onChange={e => setFormLink(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-txt-faint uppercase tracking-wider mb-1.5">Descrição</label>
                <input
                  value={formLink.descricao}
                  onChange={e => setFormLink(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Breve descrição (opcional)"
                  className={inputCls}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setLinkModal({ open: false, carteiraId: null, link: null })} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-hairline text-txt-dim text-sm font-medium hover:bg-white/[0.08] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-lite via-brand to-brand-deep hover:brightness-110 text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
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
          <div className="nt-glass rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-hairline flex-shrink-0">
              <div className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: membrosModal.carteira.cor }}
                />
                <div>
                  <p className="font-bold text-txt text-sm">{membrosModal.carteira.nome}</p>
                  <p className="text-xs text-txt-faint">Controle de acesso</p>
                </div>
              </div>
              <button onClick={() => { setMembrosModal({ open: false, carteira: null }); setMembrosSearch(''); }} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-txt-faint hover:text-txt transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-faint pointer-events-none" />
                <input
                  value={membrosSearch}
                  onChange={e => setMembrosSearch(e.target.value)}
                  placeholder="Buscar colaborador..."
                  className="w-full pl-8 pr-4 py-2 bg-white/5 border border-hairline rounded-xl text-xs text-txt placeholder-txt-faint focus:outline-none focus:border-hairline-hi"
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
                        hasAccess ? 'bg-brand/10 border-brand/20' : 'border-hairline hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${hasAccess ? 'bg-brand/25 text-brand-lite' : 'bg-white/10 text-txt-dim'}`}>
                        {user.nome?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-txt truncate">{user.nome}</p>
                        <p className="text-[10px] text-txt-faint truncate">{user.funcao || 'Colaborador'}</p>
                      </div>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${hasAccess ? 'bg-brand border-brand' : 'border-hairline'}`}>
                        {hasAccess && <CheckCircle size={10} className="text-white" />}
                      </div>
                    </button>
                  );
                })}
              {projectMembers.length === 0 && (
                <p className="text-xs text-txt-faint text-center py-6">Nenhum membro neste projeto.</p>
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
