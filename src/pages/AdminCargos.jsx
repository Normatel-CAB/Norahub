import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Edit2, Save, X, CheckCircle, Shield,
  Users2, Lock, FolderPlus, LayoutTemplate, ChevronDown, ChevronUp, Search,
  UserMinus, Layers, UsersRound, Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { seedCargos } from '../services/carteiras';

const PERMISSOES = [
  { id: 'canManageUsers',           label: 'Gerenciar Usuários',        desc: 'Aprovar cadastros e atribuir cargos',            icon: Users2 },
  { id: 'canDeleteUsers',           label: 'Excluir Usuários',          desc: 'Remover colaboradores do sistema',               icon: UserMinus },
  { id: 'canManagePermissions',     label: 'Atribuir Projetos',         desc: 'Vincular e revogar projetos de usuários',        icon: Lock },
  { id: 'canManageProjectMembers',  label: 'Gerenciar Membros',         desc: 'Adicionar e remover membros de projetos',        icon: UsersRound },
  { id: 'canChangeCarteiras',       label: 'Alterar Carteiras',         desc: 'Atribuir e revogar carteiras de usuários',       icon: Layers },
  { id: 'canCreateCargos',          label: 'Criar Cargos',              desc: 'Criar e editar cargos no sistema',               icon: Shield },
  { id: 'canCreateProjetos',        label: 'Criar Projetos',            desc: 'Criar e gerenciar bases de trabalho',            icon: FolderPlus },
  { id: 'canEditCardsProjetos',     label: 'Editar Cards',              desc: 'Adicionar e remover cards dos projetos',         icon: LayoutTemplate },
];

const EMPTY_PERMS = {
  canManageUsers: false,
  canDeleteUsers: false,
  canManagePermissions: false,
  canManageProjectMembers: false,
  canChangeCarteiras: false,
  canCreateCargos: false,
  canCreateProjetos: false,
  canEditCardsProjetos: false,
};

function permCount(cargo) {
  return PERMISSOES.filter(p => cargo[p.id]).length;
}

function PermLevelBadge({ count }) {
  if (count === 0) return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-500 border border-white/10">
      Sem permissões
    </span>
  );
  if (count <= 2) return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
      {count}/{PERMISSOES.length} permissões
    </span>
  );
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#57B952]/15 text-[#57B952] border border-[#57B952]/20">
      {count}/{PERMISSOES.length} permissões
    </span>
  );
}

function Toast({ toast }) {
  if (!toast.show) return null;
  return (
    <div className={`fixed top-5 right-5 z-[300] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-xl ${
      toast.type === 'success'
        ? 'bg-gray-900/95 border-green-500/30 text-green-400'
        : 'bg-gray-900/95 border-red-500/30 text-red-400'
    }`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toast.type === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
        {toast.type === 'success' ? <CheckCircle size={14} /> : <X size={14} />}
      </div>
      <span className="font-medium text-sm text-white">{toast.message}</span>
    </div>
  );
}

function AdminCargos() {
  const { userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.funcao === 'admin';

  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [modal, setModal] = useState({ open: false, cargo: null });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, cargo: null });
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [search, setSearch] = useState('');

  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formStatus, setFormStatus] = useState('ativo');
  const [formPerms, setFormPerms] = useState({ ...EMPTY_PERMS });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  useEffect(() => {
    const checkAccess = async () => {
      if (authLoading) return;
      if (!userProfile) { navigate('/selecao-projeto', { replace: true }); return; }
      if (isAdmin) { fetchData(); return; }
      try {
        const snap = await getDocs(query(collection(db, 'cargos'), where('nome', '==', userProfile.funcao)));
        if (!snap.empty && snap.docs[0].data().canCreateCargos) {
          fetchData();
        } else {
          navigate('/selecao-projeto', { replace: true });
        }
      } catch { navigate('/selecao-projeto', { replace: true }); }
    };
    checkAccess();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userProfile?.uid, userProfile?.funcao, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'cargos'));
      setCargos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      showToast('Erro ao carregar cargos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredCargos = useMemo(() => {
    if (!search.trim()) return cargos;
    const t = search.toLowerCase();
    return cargos.filter(c => c.nome?.toLowerCase().includes(t));
  }, [cargos, search]);

  const toggleExpand = (id) =>
    setExpandedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const openCreate = () => {
    setFormNome('');
    setFormDescricao('');
    setFormStatus('ativo');
    setFormPerms({ ...EMPTY_PERMS });
    setModal({ open: true, cargo: null });
  };

  const openEdit = (cargo) => {
    setFormNome(cargo.nome);
    setFormDescricao(cargo.descricao || '');
    setFormStatus(cargo.status || 'ativo');
    setFormPerms({
      canManageUsers:          !!cargo.canManageUsers,
      canDeleteUsers:          !!cargo.canDeleteUsers,
      canManagePermissions:    !!cargo.canManagePermissions,
      canManageProjectMembers: !!cargo.canManageProjectMembers,
      canChangeCarteiras:      !!cargo.canChangeCarteiras,
      canCreateCargos:         !!cargo.canCreateCargos,
      canCreateProjetos:       !!cargo.canCreateProjetos,
      canEditCardsProjetos:    !!cargo.canEditCardsProjetos,
    });
    setModal({ open: true, cargo });
  };

  const handleSeedCargos = async () => {
    setSaving(true);
    try {
      const result = await seedCargos();
      if (result.success) {
        showToast(`${result.created} cargo(s) padrão criados!`);
        await fetchData();
      } else {
        showToast('Cargos já existem ou erro ao criar.', 'error');
      }
    } catch {
      showToast('Erro ao criar cargos padrão.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const togglePerm = (id) =>
    setFormPerms(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formNome.trim()) return;
    setSaving(true);
    try {
      const data = {
        nome: formNome.trim(),
        descricao: formDescricao.trim(),
        status: formStatus,
        tipo: 'colaborador',
        ...formPerms,
        updatedAt: new Date(),
      };
      if (modal.cargo) {
        await updateDoc(doc(db, 'cargos', modal.cargo.id), data);
        setCargos(prev => prev.map(c => c.id === modal.cargo.id ? { ...c, ...data } : c));
        showToast('Cargo atualizado!');
      } else {
        const ref = await addDoc(collection(db, 'cargos'), { ...data, createdAt: new Date() });
        setCargos(prev => [...prev, { id: ref.id, ...data, createdAt: new Date() }]);
        showToast('Cargo criado!');
      }
      setModal({ open: false, cargo: null });
    } catch {
      showToast('Erro ao salvar cargo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const { cargo } = confirmDelete;
    try {
      const usersSnap = await getDocs(query(collection(db, 'usuarios'), where('funcao', '==', cargo.nome)));
      if (!usersSnap.empty) {
        showToast(`${usersSnap.size} usuário(s) com este cargo. Reatribua antes de excluir.`, 'error');
        setConfirmDelete({ open: false, cargo: null });
        return;
      }
      await deleteDoc(doc(db, 'cargos', cargo.id));
      setCargos(prev => prev.filter(c => c.id !== cargo.id));
      showToast('Cargo excluído.');
    } catch {
      showToast('Erro ao excluir.', 'error');
    } finally {
      setConfirmDelete({ open: false, cargo: null });
    }
  };

  const totalPermissoes = cargos.reduce((acc, c) => acc + permCount(c), 0);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#57B952] border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white font-[Outfit,sans-serif] relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#57B952]/8 rounded-full blur-3xl pointer-events-none" />
      <Toast toast={toast} />

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-gray-900/70 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-white/[0.05] group-hover:bg-white/[0.10] flex items-center justify-center transition-colors">
                <ArrowLeft size={15} />
              </div>
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="h-4 w-px bg-white/[0.08]" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/25 flex items-center justify-center">
                <Shield size={15} className="text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">Gestão de Cargos</p>
                <p className="text-[10px] text-gray-500 leading-tight">
                  {cargos.length} cargo{cargos.length !== 1 ? 's' : ''} · {totalPermissoes} permissão(ões) ativas
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cargos.length === 0 && (
              <button
                onClick={handleSeedCargos}
                disabled={saving}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-semibold transition-all disabled:opacity-60"
              >
                <Sparkles size={14} />
                <span className="hidden sm:inline">Criar Padrão</span>
              </button>
            )}
            <button
              onClick={openCreate}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white font-semibold transition-all hover:scale-[1.02] shadow-md shadow-[#57B952]/20"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Novo</span> Cargo
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Cargos', value: cargos.length, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
            { label: 'Permissões ativas', value: totalPermissoes, color: 'text-[#57B952]', bg: 'bg-[#57B952]/10 border-[#57B952]/20' },
            { label: 'Sem permissão', value: cargos.filter(c => permCount(c) === 0).length, color: 'text-gray-400', bg: 'bg-white/5 border-white/10' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border rounded-2xl px-4 py-3 text-center`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Search ── */}
        {cargos.length > 3 && (
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar cargo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.10] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/40 transition-all"
            />
          </div>
        )}

        {/* ── Lista ── */}
        {filteredCargos.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.04] border border-white/[0.07] rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
              <Shield size={22} className="text-purple-400" />
            </div>
            <p className="text-gray-500 text-sm mb-4">
              {search ? 'Nenhum cargo encontrado.' : 'Nenhum cargo criado ainda.'}
            </p>
            {!search && (
              <button onClick={openCreate} className="text-[#57B952] text-sm font-semibold hover:underline">
                + Criar primeiro cargo
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCargos.map(cargo => {
              const count = permCount(cargo);
              const expanded = expandedIds.has(cargo.id);
              return (
                <div
                  key={cargo.id}
                  className="bg-white/[0.05] border border-white/[0.09] rounded-2xl overflow-hidden transition-all hover:border-white/[0.15]"
                >
                  {/* Row header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none"
                    onClick={() => toggleExpand(cargo.id)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
                      <Shield size={16} className="text-purple-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-white text-sm truncate">{cargo.nome}</p>
                        {cargo.status === 'inativo' && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                            Inativo
                          </span>
                        )}
                      </div>
                      {cargo.descricao && (
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">{cargo.descricao}</p>
                      )}
                      <div className="mt-1">
                        <PermLevelBadge count={count} />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(cargo); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/15 transition-colors"
                        title="Editar cargo"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete({ open: true, cargo }); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/15 transition-colors"
                        title="Excluir cargo"
                      >
                        <Trash2 size={14} />
                      </button>
                      <div className="w-7 h-7 flex items-center justify-center text-gray-600">
                        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded permissions detail */}
                  {expanded && (
                    <div className="px-4 pb-4 border-t border-white/[0.06]">
                      <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider pt-3 pb-2">
                        Permissões
                      </p>
                      <div className="space-y-1.5">
                        {PERMISSOES.map(perm => {
                          const active = !!cargo[perm.id];
                          const Icon = perm.icon;
                          return (
                            <div
                              key={perm.id}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                                active
                                  ? 'bg-[#57B952]/[0.08] border-[#57B952]/25'
                                  : 'bg-white/[0.02] border-white/[0.05]'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-[#57B952]/20' : 'bg-white/[0.05]'}`}>
                                <Icon size={14} className={active ? 'text-[#57B952]' : 'text-gray-600'} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold leading-tight ${active ? 'text-white' : 'text-gray-600'}`}>
                                  {perm.label}
                                </p>
                                <p className="text-[11px] text-gray-600 mt-0.5">{perm.desc}</p>
                              </div>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${active ? 'bg-[#57B952]' : 'bg-white/[0.08] border border-white/[0.10]'}`}>
                                {active && <CheckCircle size={11} className="text-white" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Modal Criar / Editar ── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111115] border border-white/[0.10] rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[92vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                  <Shield size={15} className="text-purple-400" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm leading-tight">
                    {modal.cargo ? 'Editar Cargo' : 'Novo Cargo'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {modal.cargo ? modal.cargo.nome : 'Defina nome e permissões'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModal({ open: false, cargo: null })}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-gray-500 hover:text-white transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                {/* Nome */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Nome do Cargo <span className="text-[#57B952]">*</span>
                  </label>
                  <input
                    type="text"
                    value={formNome}
                    onChange={e => setFormNome(e.target.value)}
                    placeholder="Ex: Coordenador, Analista, Fiscal..."
                    required
                    autoFocus
                    className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.10] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.08] transition-all"
                  />
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Descrição
                  </label>
                  <input
                    type="text"
                    value={formDescricao}
                    onChange={e => setFormDescricao(e.target.value)}
                    placeholder="Ex: Responsável por coordenar equipes..."
                    className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.10] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.08] transition-all"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Status
                  </label>
                  <div className="flex gap-2">
                    {[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormStatus(opt.value)}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                          formStatus === opt.value
                            ? opt.value === 'ativo'
                              ? 'bg-[#57B952]/15 border-[#57B952]/40 text-[#57B952]'
                              : 'bg-red-500/15 border-red-500/40 text-red-400'
                            : 'bg-white/[0.03] border-white/[0.08] text-gray-500 hover:bg-white/[0.06]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Permissões */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Permissões
                    </label>
                    <span className="text-[10px] text-gray-600">
                      {Object.values(formPerms).filter(Boolean).length}/{PERMISSOES.length} ativas
                    </span>
                  </div>
                  <div className="space-y-2">
                    {PERMISSOES.map(perm => {
                      const active = formPerms[perm.id];
                      const Icon = perm.icon;
                      return (
                        <button
                          key={perm.id}
                          type="button"
                          onClick={() => togglePerm(perm.id)}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all ${
                            active
                              ? 'bg-[#57B952]/[0.10] border-[#57B952]/30'
                              : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.12]'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${active ? 'bg-[#57B952]/20' : 'bg-white/[0.06]'}`}>
                            <Icon size={15} className={active ? 'text-[#57B952]' : 'text-gray-500'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold leading-tight transition-colors ${active ? 'text-white' : 'text-gray-400'}`}>
                              {perm.label}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{perm.desc}</p>
                          </div>
                          {/* Toggle switch */}
                          <div className={`w-10 h-5 rounded-full relative flex-shrink-0 transition-colors duration-200 ${active ? 'bg-[#57B952]' : 'bg-white/20'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${active ? 'left-5' : 'left-0.5'}`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/[0.07] flex gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setModal({ open: false, cargo: null })}
                  className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-gray-300 text-sm font-medium hover:bg-white/[0.08] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving
                    ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvando...</>
                    : <><Save size={14} /> {modal.cargo ? 'Salvar Alterações' : 'Criar Cargo'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm delete ── */}
      {confirmDelete.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111115] border border-white/[0.10] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 size={16} className="text-red-400" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Excluir cargo?</p>
                <p className="text-xs text-gray-500 mt-0.5">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-5">
              O cargo <span className="text-white font-semibold">"{confirmDelete.cargo?.nome}"</span> será removido permanentemente. Certifique-se de que nenhum usuário está vinculado a ele.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete({ open: false, cargo: null })}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.10] text-gray-300 text-sm font-medium hover:bg-white/[0.09] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
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

export default AdminCargos;
