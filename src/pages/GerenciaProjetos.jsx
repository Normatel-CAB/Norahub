import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Edit2, Trash2, Save, X,
  ChevronDown, LayoutGrid, CheckCircle, ExternalLink, Briefcase,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';

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

const EMPTY_PROJECT = { nome: '' };
const EMPTY_CARD    = { nome: '', descricao: '', url: '', tipo: 'link' };

const CARD_TYPES = [
  { value: 'link',         label: '🔗 Link Externo' },
  { value: 'documents',    label: '📁 Pasta de Documentos' },
  { value: 'reports',      label: '📊 Relatórios e Dashboards' },
  { value: 'files',        label: '📄 Arquivos PDF' },
  { value: 'spreadsheets', label: '📈 Planilhas Excel' },
  { value: 'forms',        label: '📝 Formulários' },
  { value: 'approvals',    label: '✅ Centro de Aprovações' },
  { value: 'inventory',    label: '📦 Controle de Estoque' },
  { value: 'financial',    label: '💰 Financeiro' },
  { value: 'hr',           label: '👥 Recursos Humanos' },
];
const NO_URL_TYPES = ['documents', 'files', 'spreadsheets', 'forms'];

function GerenciaProjetos() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const isAuthorized =
    userProfile?.funcao === 'admin' ||
    (typeof userProfile?.funcao === 'string' && userProfile.funcao.toLowerCase().includes('gerente'));

  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Create project modal
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ ...EMPTY_PROJECT });
  const [createExtras, setCreateExtras] = useState([]);
  const [creating, setCreating] = useState(false);

  // Edit project modal
  const [editModal, setEditModal] = useState({ open: false, projeto: null });
  const [editForm, setEditForm] = useState({ ...EMPTY_PROJECT });
  const [saving, setSaving] = useState(false);

  // Add card modal
  const [cardModal, setCardModal] = useState({ open: false, projetoId: null });
  const [cardForm, setCardForm] = useState({ ...EMPTY_CARD });
  const [savingCard, setSavingCard] = useState(false);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState({ open: false, projetoId: null, nome: '' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  const fetchProjetos = async () => {
    try {
      const snap = await getDocs(collection(db, 'projetos'));
      setProjetos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      showToast('Erro ao carregar projetos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile && !isAuthorized) {
      navigate('/selecao-projeto', { replace: true });
      return;
    }
    if (userProfile) fetchProjetos();
  }, [userProfile, isAuthorized]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.nome.trim()) return;
    setCreating(true);
    try {
      const extras = createExtras
        .filter(c => c.nome.trim())
        .map(c => ({
          name: c.nome.trim(),
          description: c.descricao.trim(),
          url: c.url.trim(),
          type: c.tipo || 'link',
          files: [],
          formFields: [],
          formResponses: [],
        }));
      await addDoc(collection(db, 'projetos'), {
        nome: createForm.nome.trim(),
        extras,
        criadoEm: new Date(),
      });
      setCreateModal(false);
      setCreateForm({ ...EMPTY_PROJECT });
      setCreateExtras([]);
      showToast('Projeto criado!');
      fetchProjetos();
    } catch {
      showToast('Erro ao criar projeto.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (projeto) => {
    setEditForm({ nome: projeto.nome, urlForms: projeto.urlForms || '', urlSharePoint: projeto.urlSharePoint || '' });
    setEditModal({ open: true, projeto });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projetos', editModal.projeto.id), {
        nome: editForm.nome.trim(),
        urlForms: editForm.urlForms.trim(),
        urlSharePoint: editForm.urlSharePoint.trim(),
      });
      setEditModal({ open: false, projeto: null });
      showToast('Projeto atualizado!');
      fetchProjetos();
    } catch {
      showToast('Erro ao salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'projetos', confirmDelete.projetoId));
      setConfirmDelete({ open: false, projetoId: null, nome: '' });
      showToast('Projeto excluído.');
      fetchProjetos();
    } catch {
      showToast('Erro ao excluir.', 'error');
    }
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    setSavingCard(true);
    try {
      const projeto = projetos.find(p => p.id === cardModal.projetoId);
      const extras = projeto?.extras || [];
      await updateDoc(doc(db, 'projetos', cardModal.projetoId), {
        extras: [...extras, {
          name: cardForm.nome.trim(),
          description: cardForm.descricao.trim(),
          url: cardForm.url.trim(),
          type: cardForm.tipo || 'link',
          files: [],
          formFields: [],
          formResponses: [],
        }],
      });
      setCardModal({ open: false, projetoId: null });
      setCardForm({ ...EMPTY_CARD });
      showToast('Card adicionado!');
      fetchProjetos();
    } catch {
      showToast('Erro ao adicionar card.', 'error');
    } finally {
      setSavingCard(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#57B952] border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-[Outfit,sans-serif]">
      <Toast toast={toast} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#0a0a0f]/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/gerencia')} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#57B952]/20 flex items-center justify-center">
                <Briefcase size={14} className="text-[#57B952]" />
              </div>
              <span className="font-semibold text-sm">Gestão de Projetos</span>
            </div>
          </div>
          <button
            onClick={() => setCreateModal(true)}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white font-semibold transition-colors"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Novo</span> Projeto
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-xs text-gray-600 mb-5">{projetos.length} projeto(s)</p>

        {projetos.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-[#57B952]/10 border border-[#57B952]/20 flex items-center justify-center mx-auto mb-4">
              <Briefcase size={24} className="text-[#57B952]" />
            </div>
            <p className="text-gray-500 text-sm mb-4">Nenhum projeto criado ainda.</p>
            <button onClick={() => setCreateModal(true)} className="text-[#57B952] text-sm font-semibold hover:underline">
              + Criar primeiro projeto
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {projetos.map(projeto => (
              <div key={projeto.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                {/* Accordion header */}
                <div
                  className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
                  onClick={() => setExpanded(expanded === projeto.id ? null : projeto.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#57B952]/15 border border-[#57B952]/25 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#57B952] font-bold text-sm">{projeto.nome?.charAt(0)?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">{projeto.nome}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{(projeto.extras || []).length} card(s) extra(s)</p>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-gray-500 transition-transform flex-shrink-0 ${expanded === projeto.id ? 'rotate-180' : ''}`}
                  />
                </div>

                {/* Accordion body */}
                {expanded === projeto.id && (
                  <div className="border-t border-white/[0.06] p-5 space-y-4">
                    {/* URLs */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      {[{ label: 'URL Forms', val: projeto.urlForms }, { label: 'URL SharePoint', val: projeto.urlSharePoint }].map(({ label, val }) => (
                        <div key={label} className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                          <p className="text-xs text-gray-600 mb-1">{label}</p>
                          {val ? (
                            <a href={val} target="_blank" rel="noopener noreferrer" className="text-[#57B952] text-xs hover:underline flex items-center gap-1 truncate">
                              {val.length > 50 ? val.slice(0, 50) + '…' : val}
                              <ExternalLink size={11} className="flex-shrink-0" />
                            </a>
                          ) : <p className="text-xs text-gray-600 italic">Não definida</p>}
                        </div>
                      ))}
                    </div>

                    {/* Cards extras */}
                    {(projeto.extras || []).length > 0 && (
                      <div>
                        <p className="text-xs text-gray-600 mb-2">Cards extras</p>
                        <div className="space-y-1.5">
                          {projeto.extras.map((card, i) => (
                            <div key={i} className="flex items-center gap-3 p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                              <div className="w-6 h-6 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                                <LayoutGrid size={12} className="text-gray-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{card.name}</p>
                                <p className="text-xs text-gray-600 truncate">{card.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => setCardModal({ open: true, projetoId: projeto.id })}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-[#57B952]/10 text-[#57B952] border border-[#57B952]/20 hover:bg-[#57B952]/20 font-medium transition-colors"
                      >
                        <LayoutGrid size={13} /> Adicionar Card
                      </button>
                      <button
                        onClick={() => openEdit(projeto)}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 font-medium transition-colors"
                      >
                        <Edit2 size={13} /> Editar
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ open: true, projetoId: projeto.id, nome: projeto.nome })}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-medium transition-colors"
                      >
                        <Trash2 size={13} /> Excluir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161618] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
              <p className="font-semibold text-white">Novo Projeto</p>
              <button onClick={() => { setCreateModal(false); setCreateExtras([]); }} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 space-y-5 overflow-y-auto flex-1">
                {/* Nome */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">Nome do Projeto *</label>
                  <input
                    type="text"
                    value={createForm.nome}
                    onChange={e => setCreateForm(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Projeto 741"
                    required
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#57B952]/50"
                  />
                </div>

                {/* Cards */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Cards do Projeto</label>
                    <button
                      type="button"
                      onClick={() => setCreateExtras(prev => [...prev, { nome: '', descricao: '', url: '', tipo: 'link' }])}
                      className="flex items-center gap-1 text-xs text-[#57B952] hover:text-green-400 font-semibold"
                    >
                      <Plus size={13} /> Adicionar card
                    </button>
                  </div>
                  {createExtras.length === 0 ? (
                    <div className="border border-dashed border-white/[0.10] rounded-xl p-6 text-center">
                      <p className="text-xs text-gray-600">Nenhum card ainda. Clique em "Adicionar card" para começar.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {createExtras.map((card, idx) => (
                        <div key={idx} className="border border-white/[0.08] rounded-xl p-4 bg-white/[0.02] space-y-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-600 font-medium">Card {idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => setCreateExtras(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            >
                              <X size={13} />
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Nome do card *"
                            value={card.nome}
                            onChange={e => setCreateExtras(prev => prev.map((c, i) => i === idx ? { ...c, nome: e.target.value } : c))}
                            className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#57B952]/50"
                          />
                          <select
                            value={card.tipo}
                            onChange={e => setCreateExtras(prev => prev.map((c, i) => i === idx ? { ...c, tipo: e.target.value } : c))}
                            className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-[#57B952]/50"
                          >
                            {CARD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <input
                            type="text"
                            placeholder="Descrição (opcional)"
                            value={card.descricao}
                            onChange={e => setCreateExtras(prev => prev.map((c, i) => i === idx ? { ...c, descricao: e.target.value } : c))}
                            className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#57B952]/50"
                          />
                          {!NO_URL_TYPES.includes(card.tipo) && (
                            <input
                              type="text"
                              placeholder="URL (https://...)"
                              value={card.url}
                              onChange={e => setCreateExtras(prev => prev.map((c, i) => i === idx ? { ...c, url: e.target.value } : c))}
                              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#57B952]/50"
                            />
                          )}
                          {['documents','files','spreadsheets'].includes(card.tipo) && (
                            <p className="text-xs text-blue-300 bg-blue-500/10 border border-blue-400/20 rounded-lg px-3 py-2">Permite upload de arquivos após criado</p>
                          )}
                          {card.tipo === 'forms' && (
                            <p className="text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-400/20 rounded-lg px-3 py-2">Abrirá construtor de formulário personalizado</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 p-5 border-t border-white/[0.08] flex-shrink-0">
                <button type="button" onClick={() => { setCreateModal(false); setCreateExtras([]); }} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors">Cancelar</button>
                <button type="submit" disabled={creating} className="flex-1 py-2.5 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white text-sm font-semibold transition-colors disabled:opacity-60">
                  {creating ? 'Criando...' : 'Criar Projeto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161618] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
              <p className="font-semibold text-white">Editar Projeto</p>
              <button onClick={() => setEditModal({ open: false, projeto: null })} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors"><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              {[
                { label: 'Nome *', key: 'nome', placeholder: 'Nome do projeto', required: true },
                { label: 'URL Forms', key: 'urlForms', placeholder: 'https://forms.microsoft.com/...', required: false },
                { label: 'URL SharePoint', key: 'urlSharePoint', placeholder: 'https://...sharepoint.com/...', required: false },
              ].map(({ label, key, placeholder, required }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">{label}</label>
                  <input
                    type="text"
                    value={editForm[key]}
                    onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    required={required}
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#57B952]/50"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditModal({ open: false, projeto: null })} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? 'Salvando...' : <><Save size={14} /> Salvar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Card Modal */}
      {cardModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161618] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
              <p className="font-semibold text-white">Adicionar Card</p>
              <button onClick={() => { setCardModal({ open: false, projetoId: null }); setCardForm({ ...EMPTY_CARD }); }} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors"><X size={16} /></button>
            </div>
            <form onSubmit={handleAddCard} className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">Nome do Card *</label>
                <input
                  type="text"
                  value={cardForm.nome}
                  onChange={e => setCardForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Relatório Mensal"
                  required
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#57B952]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">Tipo</label>
                <select
                  value={cardForm.tipo}
                  onChange={e => setCardForm(prev => ({ ...prev, tipo: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-[#57B952]/50"
                >
                  {CARD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">Descrição</label>
                <input
                  type="text"
                  value={cardForm.descricao}
                  onChange={e => setCardForm(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Breve descrição"
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#57B952]/50"
                />
              </div>
              {!NO_URL_TYPES.includes(cardForm.tipo) && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">URL</label>
                  <input
                    type="text"
                    value={cardForm.url}
                    onChange={e => setCardForm(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#57B952]/50"
                  />
                </div>
              )}
              {['documents','files','spreadsheets'].includes(cardForm.tipo) && (
                <p className="text-xs text-blue-300 bg-blue-500/10 border border-blue-400/20 rounded-lg px-3 py-2">Permite upload de arquivos após criado</p>
              )}
              {cardForm.tipo === 'forms' && (
                <p className="text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-400/20 rounded-lg px-3 py-2">Abrirá construtor de formulário personalizado</p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setCardModal({ open: false, projetoId: null }); setCardForm({ ...EMPTY_CARD }); }} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors">Cancelar</button>
                <button type="submit" disabled={savingCard} className="flex-1 py-2.5 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white text-sm font-semibold transition-colors disabled:opacity-60">
                  {savingCard ? 'Adicionando...' : 'Adicionar Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161618] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <p className="font-semibold text-white mb-2">Excluir projeto?</p>
            <p className="text-sm text-gray-500 mb-5">
              <span className="text-white font-medium">{confirmDelete.nome}</span> será removido permanentemente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete({ open: false, projetoId: null, nome: '' })} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GerenciaProjetos;
