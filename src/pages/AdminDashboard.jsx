import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, CheckCircle, XCircle, AlertTriangle,
  ArrowLeft, Trash2, X, Briefcase, Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

function StatusBadge({ status }) {
  if (status === 'ativo') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/25">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
      Ativo
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
      Pendente
    </span>
  );
}

function Toast({ toast }) {
  if (!toast.show) return null;
  return (
    <div className={`fixed top-5 right-5 z-[300] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-xl transition-all ${
      toast.type === 'success'
        ? 'bg-green-500/20 border-green-500/40 text-green-300'
        : 'bg-red-500/20 border-red-500/40 text-red-300'
    }`}>
      {toast.type === 'success' ? <CheckCircle size={16} /> : <X size={16} />}
      <span className="font-medium text-sm">{toast.message}</span>
    </div>
  );
}

function AdminDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.funcao === 'admin';

  const [users, setUsers] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, userId: null, userName: '' });
  const [modalProjetos, setModalProjetos] = useState({ open: false, userId: null, userName: '', projetosAtuais: [] });
  const [searchProjetos, setSearchProjetos] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  useEffect(() => {
    const fetchData = async () => {
      const canAccess = isAdmin || userProfile?.funcao?.toLowerCase().includes('gerente');
      if (!canAccess) { navigate('/selecao-projeto'); return; }

      try {
        const [userSnap, projetoSnap, cargosSnap] = await Promise.all([
          getDocs(collection(db, 'usuarios')),
          getDocs(collection(db, 'projetos')),
          getDocs(collection(db, 'cargos')),
        ]);

        let userList = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!isAdmin) userList = userList.filter(u => u.funcao !== 'admin');
        userList.sort((a, b) => (a.statusAcesso === 'pendente' ? -1 : 1));
        setUsers(userList);
        setProjetos(projetoSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        let cargosList = cargosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (cargosList.length === 0) cargosList = [{ id: 'default', nome: 'Colaborador' }];
        setCargos(cargosList);
      } catch {
        showToast('Erro ao carregar dados.', 'error');
      } finally {
        setLoading(false);
      }
    };
    if (userProfile) fetchData();
  }, [isAdmin, userProfile, navigate]);

  const handleApprove = async (user, newRole) => {
    try {
      if (!isAdmin && newRole === 'admin') { showToast('Sem permissão para este cargo.', 'error'); return; }
      await updateDoc(doc(db, 'usuarios', user.id), { statusAcesso: 'ativo', funcao: newRole || user.funcao });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, statusAcesso: 'ativo', funcao: newRole || u.funcao } : u));
      showToast(`${user.nome} aprovado com sucesso!`);
    } catch {
      showToast('Erro ao aprovar usuário.', 'error');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!isAdmin && newRole === 'admin') { showToast('Sem permissão.', 'error'); return; }
      if (!isAdmin && user?.funcao === 'admin') { showToast('Não pode modificar administradores.', 'error'); return; }
      await updateDoc(doc(db, 'usuarios', userId), { funcao: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, funcao: newRole } : u));
      showToast('Cargo atualizado.');
    } catch {
      showToast('Erro ao atualizar cargo.', 'error');
    }
  };

  const deleteUser = async () => {
    const { userId, userName } = confirmDelete;
    try {
      const user = users.find(u => u.id === userId);
      if (!isAdmin && user?.funcao === 'admin') { showToast('Não pode excluir administradores.', 'error'); return; }
      await deleteDoc(doc(db, 'usuarios', userId));
      setUsers(prev => prev.filter(u => u.id !== userId));
      showToast(`${userName} removido.`);
    } catch {
      showToast('Erro ao remover usuário.', 'error');
    } finally {
      setConfirmDelete({ open: false, userId: null, userName: '' });
    }
  };

  const salvarProjetos = async () => {
    try {
      await updateDoc(doc(db, 'usuarios', modalProjetos.userId), { projetos: modalProjetos.projetosAtuais });
      setUsers(prev => prev.map(u => u.id === modalProjetos.userId ? { ...u, projetos: modalProjetos.projetosAtuais } : u));
      showToast('Projetos salvos!');
      setModalProjetos({ open: false, userId: null, userName: '', projetosAtuais: [] });
    } catch {
      showToast('Erro ao salvar projetos.', 'error');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch =
      (u.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || u.statusAcesso === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: users.length,
    ativos: users.filter(u => u.statusAcesso === 'ativo').length,
    pendentes: users.filter(u => u.statusAcesso === 'pendente').length,
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/selecao-projeto')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#57B952]/20 flex items-center justify-center">
                <Users size={14} className="text-[#57B952]" />
              </div>
              <span className="font-semibold text-sm">Gestão de Usuários</span>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => navigate('/admin-cargos')}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
            >
              <Shield size={13} />
              Cargos
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Ativos', value: stats.ativos, color: 'text-green-400' },
            { label: 'Pendentes', value: stats.pendentes, color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 sm:p-5">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-2xl sm:text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#57B952]/50 focus:ring-1 focus:ring-[#57B952]/20 transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-gray-300 focus:outline-none focus:border-[#57B952]/50 transition-all"
          >
            <option value="all">Todos os status</option>
            <option value="ativo">Somente ativos</option>
            <option value="pendente">Somente pendentes</option>
          </select>
        </div>

        {/* Table — desktop */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Status', 'Usuário', 'Cargo / Ação', 'Projetos', ''].map(h => (
                    <th key={h} className={`p-4 text-xs font-medium text-gray-600 uppercase tracking-wider ${h === '' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-14 text-center text-gray-600 text-sm">
                      {users.length === 0 ? 'Nenhum usuário cadastrado ainda.' : 'Nenhum resultado para a busca.'}
                    </td>
                  </tr>
                ) : filteredUsers.map(user => (
                  <tr key={user.id} className={`transition-colors ${user.statusAcesso === 'pendente' ? 'bg-yellow-500/[0.04]' : 'hover:bg-white/[0.02]'}`}>

                    <td className="p-4 w-32"><StatusBadge status={user.statusAcesso} /></td>

                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#57B952] to-[#3d8c38] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {user.nome?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white leading-tight">{user.nome || '—'}</p>
                          <p className="text-xs text-gray-600">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      {user.statusAcesso === 'pendente' ? (
                        <div className="flex items-center gap-2">
                          <select
                            id={`role-${user.id}`}
                            defaultValue={user.funcao || 'colaborador'}
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white focus:outline-none focus:border-[#57B952]/50"
                          >
                            {cargos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                            {isAdmin && <option value="admin">Administrador</option>}
                          </select>
                          <button
                            onClick={() => handleApprove(user, document.getElementById(`role-${user.id}`)?.value)}
                            className="p-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25 transition-colors"
                            title="Aprovar"
                          >
                            <CheckCircle size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ open: true, userId: user.id, userName: user.nome || user.email })}
                            className="p-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors"
                            title="Rejeitar"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      ) : (
                        <select
                          value={user.funcao || 'colaborador'}
                          onChange={e => handleRoleChange(user.id, e.target.value)}
                          disabled={user.funcao === 'admin' && !isAdmin}
                          className={`text-xs px-3 py-1.5 rounded-lg border focus:outline-none transition-colors ${
                            user.funcao === 'admin' && !isAdmin
                              ? 'bg-white/[0.02] border-white/5 text-gray-700 cursor-not-allowed'
                              : 'bg-white/[0.06] border-white/[0.12] text-white hover:bg-white/[0.10] cursor-pointer focus:border-[#57B952]/50'
                          }`}
                        >
                          {cargos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                          {isAdmin && <option value="admin">Administrador</option>}
                        </select>
                      )}
                    </td>

                    <td className="p-4">
                      <button
                        onClick={() => setModalProjetos({ open: true, userId: user.id, userName: user.nome, projetosAtuais: user.projetos || [] })}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[#57B952]/10 text-[#57B952] border border-[#57B952]/20 hover:bg-[#57B952]/20 transition-colors font-medium"
                      >
                        {(user.projetos || []).length > 0 ? `${user.projetos.length} projeto(s)` : '+ Atribuir'}
                      </button>
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => setConfirmDelete({ open: true, userId: user.id, userName: user.nome || user.email })}
                        disabled={user.funcao === 'admin' && !isAdmin}
                        className={`p-1.5 rounded-lg transition-colors ${
                          user.funcao === 'admin' && !isAdmin
                            ? 'opacity-20 cursor-not-allowed text-gray-500'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                        }`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards — mobile */}
          <div className="md:hidden divide-y divide-white/[0.06]">
            {filteredUsers.length === 0 ? (
              <p className="p-10 text-center text-gray-600 text-sm">Nenhum usuário encontrado.</p>
            ) : filteredUsers.map(user => (
              <div key={user.id} className={`p-4 space-y-3 ${user.statusAcesso === 'pendente' ? 'bg-yellow-500/[0.04]' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#57B952] to-[#3d8c38] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {user.nome?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-white">{user.nome || '—'}</p>
                      <p className="text-xs text-gray-600">{user.email}</p>
                    </div>
                  </div>
                  <StatusBadge status={user.statusAcesso} />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={user.funcao || 'colaborador'}
                    onChange={e => user.statusAcesso !== 'pendente' && handleRoleChange(user.id, e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white focus:outline-none"
                  >
                    {cargos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                    {isAdmin && <option value="admin">Administrador</option>}
                  </select>
                  {user.statusAcesso === 'pendente' && (
                    <button onClick={() => handleApprove(user, user.funcao || 'colaborador')} className="p-2 rounded-lg bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25 transition-colors"><CheckCircle size={16} /></button>
                  )}
                  <button onClick={() => setModalProjetos({ open: true, userId: user.id, userName: user.nome, projetosAtuais: user.projetos || [] })} className="p-2 rounded-lg bg-[#57B952]/10 text-[#57B952] border border-[#57B952]/20 hover:bg-[#57B952]/20 transition-colors">
                    <Briefcase size={16} />
                  </button>
                  <button onClick={() => setConfirmDelete({ open: true, userId: user.id, userName: user.nome || user.email })} className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Delete confirm modal */}
      {confirmDelete.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161618] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">Confirmar exclusão</p>
                <p className="text-xs text-gray-600">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-5 pl-1">
              Remover <span className="text-white font-medium">{confirmDelete.userName}</span> do sistema?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete({ open: false, userId: null, userName: '' })} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={deleteUser} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Projects modal */}
      {modalProjetos.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161618] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
              <div>
                <p className="font-semibold text-white text-sm">Atribuir Projetos</p>
                <p className="text-xs text-gray-500 mt-0.5">{modalProjetos.userName}</p>
              </div>
              <button onClick={() => setModalProjetos({ open: false, userId: null, userName: '', projetosAtuais: [] })} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 border-b border-white/[0.06]">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar projetos..."
                  value={searchProjetos}
                  onChange={e => setSearchProjetos(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#57B952]/50"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {projetos
                .filter(p => p.nome?.toLowerCase().includes(searchProjetos.toLowerCase()))
                .map(projeto => {
                  const checked = modalProjetos.projetosAtuais.includes(projeto.id);
                  return (
                    <label
                      key={projeto.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${
                        checked ? 'bg-[#57B952]/10 border-[#57B952]/25' : 'border-transparent hover:bg-white/[0.04]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const updated = checked
                            ? modalProjetos.projetosAtuais.filter(id => id !== projeto.id)
                            : [...modalProjetos.projetosAtuais, projeto.id];
                          setModalProjetos(prev => ({ ...prev, projetosAtuais: updated }));
                        }}
                        className="accent-[#57B952] w-4 h-4"
                      />
                      <span className="text-sm font-medium text-white">{projeto.nome}</span>
                    </label>
                  );
                })}
              {projetos.length === 0 && <p className="text-center text-gray-600 text-sm py-6">Nenhum projeto cadastrado.</p>}
            </div>
            <div className="p-4 border-t border-white/[0.08] flex gap-3">
              <button onClick={() => setModalProjetos({ open: false, userId: null, userName: '', projetosAtuais: [] })} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 font-medium hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={salvarProjetos} className="flex-1 py-2.5 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white text-sm font-semibold transition-colors">
                Salvar ({modalProjetos.projetosAtuais.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
