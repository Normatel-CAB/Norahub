import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit2, Save, X, CheckCircle, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';

const PERMISSOES = [
  { id: 'canManageUsers',       label: 'Gerenciar Usuários',    desc: 'Criar, editar e aprovar usuários', color: 'blue' },
  { id: 'canManagePermissions', label: 'Atribuir Projetos',     desc: 'Atribuir e revogar projetos de usuários', color: 'green' },
  { id: 'canCreateCargos',      label: 'Criar Cargos',          desc: 'Criar e editar novos cargos', color: 'purple' },
  { id: 'canCreateProjetos',    label: 'Criar Projetos',        desc: 'Criar novos projetos no sistema', color: 'indigo' },
  { id: 'canEditCardsProjetos', label: 'Editar Cards',          desc: 'Editar cards adicionais nos projetos', color: 'amber' },
];

const PERM_COLORS = {
  blue:   'bg-blue-500/15 border-blue-500/25 text-blue-400',
  green:  'bg-green-500/15 border-green-500/25 text-green-400',
  purple: 'bg-purple-500/15 border-purple-500/25 text-purple-400',
  indigo: 'bg-indigo-500/15 border-indigo-500/25 text-indigo-400',
  amber:  'bg-amber-500/15 border-amber-500/25 text-amber-400',
};

const EMPTY_PERMS = {
  canManageUsers: false,
  canManagePermissions: false,
  canCreateCargos: false,
  canCreateProjetos: false,
  canEditCardsProjetos: false,
};

const TEMPLATES = {
  'Administrador Geral':  { canManageUsers: true,  canManagePermissions: true,  canCreateCargos: true,  canCreateProjetos: true,  canEditCardsProjetos: true  },
  'Gerente Geral':        { canManageUsers: true,  canManagePermissions: true,  canCreateCargos: true,  canCreateProjetos: true,  canEditCardsProjetos: true  },
  'Gerente de Usuários':  { canManageUsers: true,  canManagePermissions: true,  canCreateCargos: false, canCreateProjetos: false, canEditCardsProjetos: false },
  'Gerente de Projetos':  { canManageUsers: false, canManagePermissions: false, canCreateCargos: false, canCreateProjetos: true,  canEditCardsProjetos: true  },
  'Gerente de Cargos':    { canManageUsers: false, canManagePermissions: false, canCreateCargos: true,  canCreateProjetos: false, canEditCardsProjetos: false },
  'Colaborador':          { ...EMPTY_PERMS },
};

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

function PermBadge({ label, color }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${PERM_COLORS[color]}`}>
      {label}
    </span>
  );
}

function AdminCargos() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.funcao === 'admin';

  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [modal, setModal] = useState({ open: false, cargo: null });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, cargo: null });

  // Form state
  const [formNome, setFormNome] = useState('');
  const [formPerms, setFormPerms] = useState({ ...EMPTY_PERMS });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  useEffect(() => {
    const checkAccess = async () => {
      if (!userProfile) { navigate('/'); return; }
      if (isAdmin) { fetchData(); return; }
      try {
        const snap = await getDocs(query(collection(db, 'cargos'), where('nome', '==', userProfile.funcao)));
        if (!snap.empty && snap.docs[0].data().canCreateCargos) {
          fetchData();
        } else {
          navigate('/');
        }
      } catch {
        navigate('/');
      }
    };
    checkAccess();
  }, [isAdmin, userProfile, navigate]);

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

  const openCreate = () => {
    setFormNome('');
    setFormPerms({ ...EMPTY_PERMS });
    setModal({ open: true, cargo: null });
  };

  const openEdit = (cargo) => {
    setFormNome(cargo.nome);
    setFormPerms({
      canManageUsers: !!cargo.canManageUsers,
      canManagePermissions: !!cargo.canManagePermissions,
      canCreateCargos: !!cargo.canCreateCargos,
      canCreateProjetos: !!cargo.canCreateProjetos,
      canEditCardsProjetos: !!cargo.canEditCardsProjetos,
    });
    setModal({ open: true, cargo });
  };

  const handleTemplate = (templateNome) => {
    if (!templateNome || !TEMPLATES[templateNome]) return;
    setFormNome(templateNome);
    setFormPerms({ ...TEMPLATES[templateNome] });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formNome.trim()) return;
    setSaving(true);
    try {
      const data = { nome: formNome.trim(), tipo: 'colaborador', ...formPerms, updatedAt: new Date() };
      if (modal.cargo) {
        await updateDoc(doc(db, 'cargos', modal.cargo.id), data);
        showToast('Cargo atualizado!');
      } else {
        await addDoc(collection(db, 'cargos'), { ...data, createdAt: new Date() });
        showToast('Cargo criado!');
      }
      setModal({ open: false, cargo: null });
      fetchData();
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
        showToast(`${usersSnap.size} usuário(s) possuem este cargo. Reatribua-os primeiro.`, 'error');
        setConfirmDelete({ open: false, cargo: null });
        return;
      }
      await deleteDoc(doc(db, 'cargos', cargo.id));
      showToast('Cargo excluído.');
      setConfirmDelete({ open: false, cargo: null });
      fetchData();
    } catch {
      showToast('Erro ao excluir cargo.', 'error');
      setConfirmDelete({ open: false, cargo: null });
    }
  };

  const permCount = (cargo) => PERMISSOES.filter(p => cargo[p.id]).length;

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
            <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Shield size={14} className="text-purple-400" />
              </div>
              <span className="font-semibold text-sm">Gestão de Cargos</span>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white font-semibold transition-colors"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Novo</span> Cargo
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="mb-6">
          <p className="text-xs text-gray-600">{cargos.length} cargo(s) cadastrado(s)</p>
        </div>

        {cargos.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
              <Shield size={24} className="text-purple-400" />
            </div>
            <p className="text-gray-500 text-sm mb-4">Nenhum cargo criado ainda.</p>
            <button onClick={openCreate} className="text-[#57B952] text-sm font-semibold hover:underline">
              + Criar primeiro cargo
            </button>
          </div>
        ) : (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left p-4 text-xs font-medium text-gray-600 uppercase tracking-wider">Cargo</th>
                  <th className="text-left p-4 text-xs font-medium text-gray-600 uppercase tracking-wider hidden sm:table-cell">Permissões</th>
                  <th className="text-right p-4 text-xs font-medium text-gray-600 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {cargos.map(cargo => (
                  <tr key={cargo.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-white text-sm">{cargo.nome}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{permCount(cargo)} permissão(ões)</p>
                        {/* Mobile perms */}
                        <div className="flex flex-wrap gap-1 mt-2 sm:hidden">
                          {PERMISSOES.filter(p => cargo[p.id]).map(p => (
                            <PermBadge key={p.id} label={p.label} color={p.color} />
                          ))}
                          {permCount(cargo) === 0 && <span className="text-xs text-gray-600">Nenhuma permissão</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        {PERMISSOES.filter(p => cargo[p.id]).map(p => (
                          <PermBadge key={p.id} label={p.label} color={p.color} />
                        ))}
                        {permCount(cargo) === 0 && <span className="text-xs text-gray-600">Nenhuma permissão</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(cargo)}
                          className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ open: true, cargo })}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create / Edit Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161618] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
              <p className="font-semibold text-white">{modal.cargo ? 'Editar Cargo' : 'Novo Cargo'}</p>
              <button onClick={() => setModal({ open: false, cargo: null })} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Template */}
                <div>
                  <label className="block text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Template (opcional)</label>
                  <select
                    onChange={e => handleTemplate(e.target.value)}
                    defaultValue=""
                    className="w-full px-3 py-2.5 border border-white/[0.08] rounded-xl text-sm focus:outline-none focus:border-[#57B952]/50"
                    style={{ backgroundColor: '#ffffff', color: '#111827' }}
                  >
                    <option value="" style={{ backgroundColor: '#ffffff', color: '#111827' }}>Selecionar template...</option>
                    {Object.keys(TEMPLATES).map(t => <option key={t} value={t} style={{ backgroundColor: '#ffffff', color: '#111827' }}>{t}</option>)}
                  </select>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Nome do Cargo *</label>
                  <input
                    type="text"
                    value={formNome}
                    onChange={e => setFormNome(e.target.value)}
                    placeholder="Ex: Coordenador, Analista..."
                    required
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#57B952]/50 focus:ring-1 focus:ring-[#57B952]/20"
                  />
                </div>

                {/* Permissions */}
                <div>
                  <label className="block text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Permissões</label>
                  <div className="space-y-2">
                    {PERMISSOES.map(perm => {
                      const active = formPerms[perm.id];
                      return (
                        <label
                          key={perm.id}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                            active
                              ? `${PERM_COLORS[perm.color]} bg-opacity-15`
                              : 'border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={e => setFormPerms(prev => ({ ...prev, [perm.id]: e.target.checked }))}
                            className="accent-[#57B952] w-4 h-4 flex-shrink-0"
                          />
                          <div>
                            <p className="font-medium text-white text-sm">{perm.label}</p>
                            <p className="text-xs text-gray-500">{perm.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-white/[0.08] flex gap-3">
                <button type="button" onClick={() => setModal({ open: false, cargo: null })} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? 'Salvando...' : <><Save size={14} /> {modal.cargo ? 'Salvar' : 'Criar Cargo'}</>}
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
            <p className="font-semibold text-white mb-2">Excluir cargo?</p>
            <p className="text-sm text-gray-500 mb-5">
              O cargo <span className="text-white font-medium">{confirmDelete.cargo?.nome}</span> será removido permanentemente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete({ open: false, cargo: null })} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCargos;
