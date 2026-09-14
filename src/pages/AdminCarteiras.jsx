import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Edit2, Save, X, CheckCircle, Layers,
  ChevronDown, ChevronUp, Search, ExternalLink, FolderOpen,
  FileSpreadsheet, BarChart3, FileText, Link2, Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getCarteiras, createCarteira, updateCarteira, deleteCarteira,
  addLink, updateLink, removeLink, seedCarteiras, CORES_CARTEIRA,
} from '../services/carteiras';

// ─── Tipos de link ────────────────────────────────────────────────────────────
const LINK_TIPOS = [
  { value: 'link',         label: 'Link Externo',  Icon: ExternalLink  },
  { value: 'documents',    label: 'Documentos',     Icon: FolderOpen    },
  { value: 'spreadsheets', label: 'Planilhas',       Icon: FileSpreadsheet },
  { value: 'reports',      label: 'Relatório',       Icon: BarChart3     },
  { value: 'files',        label: 'Arquivos/PDFs',   Icon: FileText      },
];

function getLinkIcon(tipo) {
  return (LINK_TIPOS.find(t => t.value === tipo) ?? LINK_TIPOS[0]).Icon;
}

function getLinkLabel(tipo) {
  return (LINK_TIPOS.find(t => t.value === tipo) ?? LINK_TIPOS[0]).label;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast.show) return null;
  return (
    <div className={`fixed top-5 right-5 z-[300] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-xl ${
      toast.type === 'success' ? 'bg-surface-solid border-brand/30' : 'bg-surface-solid border-red-500/30'
    }`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toast.type === 'success' ? 'bg-brand/20' : 'bg-red-500/20'}`}>
        {toast.type === 'success' ? <CheckCircle size={14} className="text-brand-lite" /> : <X size={14} className="text-red-400" />}
      </div>
      <span className="font-medium text-sm text-txt">{toast.message}</span>
    </div>
  );
}

const EMPTY_CARTEIRA = { nome: '', descricao: '', cor: '#57B952' };
const EMPTY_LINK = { nome: '', url: '', tipo: 'link', descricao: '' };

function AdminCarteiras() {
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.funcao === 'admin';
  const isManager = typeof userProfile?.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente');

  const [carteiras, setCarteiras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Modals
  const [carteiraModal, setCarteiraModal] = useState({ open: false, carteira: null });
  const [linkModal, setLinkModal] = useState({ open: false, carteiraId: null, link: null });
  const [confirmDel, setConfirmDel] = useState({ open: false, type: '', carteiraId: null, linkId: null, nome: '' });

  // Forms
  const [formCarteira, setFormCarteira] = useState(EMPTY_CARTEIRA);
  const [formLink, setFormLink] = useState(EMPTY_LINK);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!userProfile) { navigate('/selecao-projeto', { replace: true }); return; }
    if (!isAdmin && !isManager) { navigate('/selecao-projeto', { replace: true }); return; }
    fetchCarteiras();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userProfile?.uid, userProfile?.funcao]);

  const fetchCarteiras = async () => {
    setLoading(true);
    const res = await getCarteiras();
    if (res.success) setCarteiras(res.carteiras);
    else showToast('Erro ao carregar carteiras.', 'error');
    setLoading(false);
  };

  const filteredCarteiras = useMemo(() => {
    if (!search.trim()) return carteiras;
    const t = search.toLowerCase();
    return carteiras.filter(c => c.nome?.toLowerCase().includes(t) || c.descricao?.toLowerCase().includes(t));
  }, [carteiras, search]);

  const toggleExpand = (id) =>
    setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // ─── Seed ────────────────────────────────────────────────────────────────────
  const handleSeed = async () => {
    setSeeding(true);
    const res = await seedCarteiras(currentUser?.uid);
    if (res.success) {
      showToast('10 carteiras padrão criadas!');
      fetchCarteiras();
    } else if (res.reason === 'already_seeded') {
      showToast('Carteiras já existem no sistema.', 'error');
    } else {
      showToast('Erro ao criar carteiras.', 'error');
    }
    setSeeding(false);
  };

  // ─── Carteira CRUD ────────────────────────────────────────────────────────────
  const openCreateCarteira = () => {
    setFormCarteira(EMPTY_CARTEIRA);
    setCarteiraModal({ open: true, carteira: null });
  };

  const openEditCarteira = (carteira) => {
    setFormCarteira({ nome: carteira.nome, descricao: carteira.descricao || '', cor: carteira.cor || '#57B952' });
    setCarteiraModal({ open: true, carteira });
  };

  const handleSaveCarteira = async (e) => {
    e.preventDefault();
    if (!formCarteira.nome.trim()) return;
    setSaving(true);
    try {
      if (carteiraModal.carteira) {
        await updateCarteira(carteiraModal.carteira.id, formCarteira);
        setCarteiras(prev => prev.map(c => c.id === carteiraModal.carteira.id ? { ...c, ...formCarteira } : c));
        showToast('Carteira atualizada!');
      } else {
        const res = await createCarteira(formCarteira, currentUser?.uid);
        if (res.success) {
          showToast('Carteira criada!');
          fetchCarteiras();
        } else throw new Error(res.error);
      }
      setCarteiraModal({ open: false, carteira: null });
    } catch { showToast('Erro ao salvar carteira.', 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteCarteira = async () => {
    const { carteiraId, nome } = confirmDel;
    const res = await deleteCarteira(carteiraId);
    if (res.success) {
      setCarteiras(prev => prev.filter(c => c.id !== carteiraId));
      showToast(`"${nome}" removida.`);
    } else {
      showToast('Erro ao excluir carteira.', 'error');
    }
    setConfirmDel({ open: false, type: '', carteiraId: null, linkId: null, nome: '' });
  };

  // ─── Link CRUD ────────────────────────────────────────────────────────────────
  const openCreateLink = (carteiraId) => {
    setFormLink(EMPTY_LINK);
    setLinkModal({ open: true, carteiraId, link: null });
  };

  const openEditLink = (carteiraId, link) => {
    setFormLink({ nome: link.nome, url: link.url || '', tipo: link.tipo || 'link', descricao: link.descricao || '' });
    setLinkModal({ open: true, carteiraId, link });
  };

  const handleSaveLink = async (e) => {
    e.preventDefault();
    if (!formLink.nome.trim()) return;
    setSaving(true);
    try {
      if (linkModal.link) {
        await updateLink(linkModal.carteiraId, linkModal.link.id, formLink);
        setCarteiras(prev => prev.map(c =>
          c.id === linkModal.carteiraId
            ? { ...c, links: (c.links || []).map(l => l.id === linkModal.link.id ? { ...l, ...formLink } : l) }
            : c
        ));
        showToast('Link atualizado!');
      } else {
        const res = await addLink(linkModal.carteiraId, formLink, currentUser?.uid);
        if (res.success) {
          setCarteiras(prev => prev.map(c =>
            c.id === linkModal.carteiraId ? { ...c, links: [...(c.links || []), res.link] } : c
          ));
          showToast('Link adicionado!');
        } else throw new Error(res.error);
      }
      setLinkModal({ open: false, carteiraId: null, link: null });
    } catch { showToast('Erro ao salvar link.', 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteLink = async () => {
    const { carteiraId, linkId, nome } = confirmDel;
    const res = await removeLink(carteiraId, linkId);
    if (res.success) {
      setCarteiras(prev => prev.map(c =>
        c.id === carteiraId ? { ...c, links: (c.links || []).filter(l => l.id !== linkId) } : c
      ));
      showToast(`Link "${nome}" removido.`);
    } else {
      showToast('Erro ao remover link.', 'error');
    }
    setConfirmDel({ open: false, type: '', carteiraId: null, linkId: null, nome: '' });
  };

  const totalLinks = carteiras.reduce((acc, c) => acc + (c.links?.length || 0), 0);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center nt-page-bg">
      <div className="relative z-10 animate-spin rounded-full h-8 w-8 border-2 border-brand-lite border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen nt-page-bg text-txt font-[Outfit,sans-serif] relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand/8 rounded-full blur-3xl pointer-events-none" />
      <Toast toast={toast} />

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-hairline bg-[#050b06]/70 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-txt-dim hover:text-txt transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-surface group-hover:bg-surface-2 flex items-center justify-center transition-colors">
                <ArrowLeft size={15} />
              </div>
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="h-4 w-px bg-surface-2" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/25 flex items-center justify-center">
                <Layers size={15} className="text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-txt leading-tight">Carteiras & Setores</p>
                <p className="text-[10px] text-txt-faint leading-tight">
                  {carteiras.length} carteira{carteiras.length !== 1 ? 's' : ''} · {totalLinks} link{totalLinks !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {carteiras.length === 0 && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/25 font-semibold transition-all"
              >
                {seeding ? <span className="w-3.5 h-3.5 border-2 border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" /> : <Sparkles size={13} />}
                Criar Padrão
              </button>
            )}
            <button
              onClick={openCreateCarteira}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-gradient-to-r from-brand-lite via-brand to-brand-deep hover:brightness-110 transition-all text-white font-semibold hover:scale-[1.02] shadow-md shadow-brand/20"
            >
              <Plus size={15} /> <span className="hidden sm:inline">Nova</span> Carteira
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Carteiras',   value: carteiras.length,                                     color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20'   },
            { label: 'Links',       value: totalLinks,                                            color: 'text-brand-lite',  bg: 'bg-brand/10 border-brand/20' },
            { label: 'Sem links',   value: carteiras.filter(c => !(c.links?.length)).length,     color: 'text-txt-dim',   bg: 'bg-surface border-hairline'          },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border rounded-2xl px-4 py-3 text-center`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-txt-faint mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Search ── */}
        {carteiras.length > 3 && (
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-txt-faint pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar carteira..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-surface border border-hairline rounded-xl text-txt placeholder-txt-faint focus:outline-none focus:border-blue-500/40 transition-all"
            />
          </div>
        )}

        {/* ── Lista ── */}
        {filteredCarteiras.length === 0 ? (
          <div className="text-center py-20 bg-surface border border-hairline rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <Layers size={22} className="text-blue-400" />
            </div>
            <p className="text-txt-faint text-sm mb-4">{search ? 'Nenhuma carteira encontrada.' : 'Nenhuma carteira criada.'}</p>
            {!search && (
              <button onClick={openCreateCarteira} className="text-brand-lite text-sm font-semibold hover:underline">
                + Criar primeira carteira
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCarteiras.map(carteira => {
              const expanded = expandedIds.has(carteira.id);
              const linkCount = carteira.links?.length || 0;
              return (
                <div key={carteira.id} className="bg-surface border border-hairline rounded-2xl overflow-hidden transition-all hover:border-hairline-hi">

                  {/* Carteira row */}
                  <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none" onClick={() => toggleExpand(carteira.id)}>
                    <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: carteira.cor || '#57B952' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-txt text-sm">{carteira.nome}</p>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                          style={{ color: carteira.cor, backgroundColor: `${carteira.cor}20`, borderColor: `${carteira.cor}40` }}
                        >
                          {linkCount} link{linkCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {carteira.descricao && (
                        <p className="text-[11px] text-txt-faint mt-0.5 truncate">{carteira.descricao}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); openCreateLink(carteira.id); }}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-brand/10 text-brand-lite border border-brand/20 hover:bg-brand/20 transition-colors font-semibold"
                        title="Adicionar link"
                      >
                        <Plus size={11} /> Link
                      </button>
                      <button onClick={e => { e.stopPropagation(); openEditCarteira(carteira); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-txt-faint hover:text-blue-400 hover:bg-blue-500/15 transition-colors" title="Editar">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setConfirmDel({ open: true, type: 'carteira', carteiraId: carteira.id, linkId: null, nome: carteira.nome }); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-txt-faint hover:text-red-400 hover:bg-red-500/15 transition-colors" title="Excluir">
                        <Trash2 size={14} />
                      </button>
                      <div className="w-7 h-7 flex items-center justify-center text-txt-faint">
                        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>
                    </div>
                  </div>

                  {/* Links expandidos */}
                  {expanded && (
                    <div className="px-4 pb-4 border-t border-hairline">
                      <p className="text-[10px] font-semibold text-txt-faint uppercase tracking-wider pt-3 pb-2">Links</p>
                      {linkCount === 0 ? (
                        <div className="text-center py-6 bg-surface rounded-xl border border-hairline">
                          <Link2 size={18} className="text-txt-faint mx-auto mb-2" />
                          <p className="text-xs text-txt-faint">Nenhum link cadastrado.</p>
                          <button onClick={() => openCreateLink(carteira.id)} className="mt-2 text-xs text-brand-lite hover:underline">+ Adicionar primeiro link</button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {carteira.links.map(link => {
                            const LinkIcon = getLinkIcon(link.tipo);
                            return (
                              <div key={link.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface border border-hairline hover:bg-surface-2 transition-colors group">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-surface" style={{ backgroundColor: `${carteira.cor}15` }}>
                                  <LinkIcon size={14} style={{ color: carteira.cor }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-txt truncate">{link.nome}</p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-[10px] text-txt-faint">{getLinkLabel(link.tipo)}</span>
                                    {link.url && (
                                      <a href={link.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-blue-400 hover:underline truncate max-w-[200px]">
                                        {link.url.replace(/^https?:\/\//, '').split('/')[0]}
                                      </a>
                                    )}
                                  </div>
                                  {link.descricao && <p className="text-[10px] text-txt-faint truncate mt-0.5">{link.descricao}</p>}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openEditLink(carteira.id, link)} className="w-7 h-7 flex items-center justify-center rounded-lg text-txt-faint hover:text-blue-400 hover:bg-blue-500/15 transition-colors">
                                    <Edit2 size={12} />
                                  </button>
                                  <button onClick={() => setConfirmDel({ open: true, type: 'link', carteiraId: carteira.id, linkId: link.id, nome: link.nome })} className="w-7 h-7 flex items-center justify-center rounded-lg text-txt-faint hover:text-red-400 hover:bg-red-500/15 transition-colors">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Modal Carteira ── */}
      {carteiraModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-solid border border-hairline rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-hairline flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                  <Layers size={15} className="text-blue-400" />
                </div>
                <div>
                  <p className="font-bold text-txt text-sm leading-tight">{carteiraModal.carteira ? 'Editar Carteira' : 'Nova Carteira'}</p>
                  <p className="text-[10px] text-txt-faint mt-0.5">{carteiraModal.carteira ? carteiraModal.carteira.nome : 'Defina nome e cor'}</p>
                </div>
              </div>
              <button onClick={() => setCarteiraModal({ open: false, carteira: null })} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-2 text-txt-faint hover:text-txt transition-colors">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleSaveCarteira} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-txt-faint uppercase tracking-wider mb-2">Nome <span className="text-brand-lite">*</span></label>
                  <input
                    type="text"
                    value={formCarteira.nome}
                    onChange={e => setFormCarteira(p => ({ ...p, nome: e.target.value }))}
                    placeholder="Ex: Civil, RH, Logística..."
                    required autoFocus
                    className="w-full px-4 py-3 bg-surface-2 border border-hairline rounded-xl text-sm text-txt placeholder-txt-faint focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-faint uppercase tracking-wider mb-2">Descrição</label>
                  <input
                    type="text"
                    value={formCarteira.descricao}
                    onChange={e => setFormCarteira(p => ({ ...p, descricao: e.target.value }))}
                    placeholder="Descrição opcional do setor..."
                    className="w-full px-4 py-3 bg-surface-2 border border-hairline rounded-xl text-sm text-txt placeholder-txt-faint focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-faint uppercase tracking-wider mb-3">Cor de identificação</label>
                  <div className="flex flex-wrap gap-2.5">
                    {CORES_CARTEIRA.map(cor => (
                      <button
                        key={cor}
                        type="button"
                        onClick={() => setFormCarteira(p => ({ ...p, cor }))}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${formCarteira.cor === cor ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                        style={{ backgroundColor: cor }}
                        title={cor}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-hairline flex gap-3 flex-shrink-0">
                <button type="button" onClick={() => setCarteiraModal({ open: false, carteira: null })} className="flex-1 py-3 rounded-xl bg-surface border border-hairline text-txt-dim text-sm font-medium hover:bg-surface-2 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-brand-lite via-brand to-brand-deep hover:brightness-110 transition-all text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvando...</> : <><Save size={14} /> {carteiraModal.carteira ? 'Salvar' : 'Criar Carteira'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Link ── */}
      {linkModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-solid border border-hairline rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-hairline flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand/15 border border-brand/20 flex items-center justify-center">
                  <Link2 size={15} className="text-brand-lite" />
                </div>
                <p className="font-bold text-txt text-sm">{linkModal.link ? 'Editar Link' : 'Adicionar Link'}</p>
              </div>
              <button onClick={() => setLinkModal({ open: false, carteiraId: null, link: null })} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-2 text-txt-faint hover:text-txt transition-colors">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleSaveLink} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-txt-faint uppercase tracking-wider mb-2">Nome <span className="text-brand-lite">*</span></label>
                  <input type="text" value={formLink.nome} onChange={e => setFormLink(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Documentos de Projetos, Planilha RH..." required autoFocus
                    className="w-full px-4 py-3 bg-surface-2 border border-hairline rounded-xl text-sm text-txt placeholder-txt-faint focus:outline-none focus:border-brand/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-faint uppercase tracking-wider mb-2">URL</label>
                  <input type="url" value={formLink.url} onChange={e => setFormLink(p => ({ ...p, url: e.target.value }))} placeholder="https://..."
                    className="w-full px-4 py-3 bg-surface-2 border border-hairline rounded-xl text-sm text-txt placeholder-txt-faint focus:outline-none focus:border-brand/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-faint uppercase tracking-wider mb-2">Tipo</label>
                  <div className="grid grid-cols-2 gap-2">
                    {LINK_TIPOS.map(({ value, label, Icon }) => (
                      <button key={value} type="button" onClick={() => setFormLink(p => ({ ...p, tipo: value }))}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm transition-all ${
                          formLink.tipo === value ? 'bg-brand/10 border-brand/30 text-txt' : 'bg-surface border-hairline text-txt-faint hover:bg-surface-2'
                        }`}
                      >
                        <Icon size={14} className={formLink.tipo === value ? 'text-brand-lite' : ''} />
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-faint uppercase tracking-wider mb-2">Descrição</label>
                  <input type="text" value={formLink.descricao} onChange={e => setFormLink(p => ({ ...p, descricao: e.target.value }))} placeholder="Descrição opcional..."
                    className="w-full px-4 py-3 bg-surface-2 border border-hairline rounded-xl text-sm text-txt placeholder-txt-faint focus:outline-none focus:border-brand/50 transition-all" />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-hairline flex gap-3 flex-shrink-0">
                <button type="button" onClick={() => setLinkModal({ open: false, carteiraId: null, link: null })} className="flex-1 py-3 rounded-xl bg-surface border border-hairline text-txt-dim text-sm font-medium hover:bg-surface-2 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-brand-lite via-brand to-brand-deep hover:brightness-110 transition-all text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvando...</> : <><Save size={14} /> {linkModal.link ? 'Salvar' : 'Adicionar'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ── */}
      {confirmDel.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-solid border border-hairline rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 size={16} className="text-red-400" />
              </div>
              <div>
                <p className="font-bold text-txt text-sm">Confirmar exclusão</p>
                <p className="text-xs text-txt-faint mt-0.5">{confirmDel.type === 'carteira' ? 'Todos os links serão removidos.' : 'Esta ação não pode ser desfeita.'}</p>
              </div>
            </div>
            <p className="text-sm text-txt-dim mb-5">
              Excluir <span className="text-txt font-semibold">"{confirmDel.nome}"</span>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel({ open: false, type: '', carteiraId: null, linkId: null, nome: '' })} className="flex-1 py-2.5 rounded-xl bg-surface border border-hairline text-txt-dim text-sm font-medium hover:bg-surface-2 transition-colors">Cancelar</button>
              <button onClick={confirmDel.type === 'carteira' ? handleDeleteCarteira : handleDeleteLink} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-txt text-sm font-bold transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCarteiras;
