import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, CheckCircle, XCircle, AlertTriangle,
  ArrowLeft, Trash2, X, Briefcase, Shield, Zap, Megaphone, Save,
  ChevronLeft, ChevronRight, UserCheck, UserX, Clock, Layers,
} from 'lucide-react';
import UserProfileDrawer from '../components/UserProfileDrawer';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { SETORES_PADRAO } from '../services/carteirasDeProjeto';
import { migrarCarteiraParaCargo, verificarMigracaoNecessaria } from '../services/migration';

const PAGE_SIZE = 15;

function formatLastSeen(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 2) return 'agora';
  if (diffMin < 60) return `há ${diffMin}min`;
  if (diffH < 24) return `há ${diffH}h`;
  if (diffD < 30) return `há ${diffD}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function avatarColor(name = '') {
  const colors = [
    'from-blue-500 to-blue-700',
    'from-purple-500 to-purple-700',
    'from-pink-500 to-pink-700',
    'from-orange-500 to-orange-700',
    'from-teal-500 to-teal-700',
    'from-[#57B952] to-[#3d8c38]',
  ];
  return colors[name.charCodeAt(0) % colors.length] ?? colors[0];
}

function StatusBadge({ status }) {
  if (status === 'ativo') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
      Ativo
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      Pendente
    </span>
  );
}

function Toast({ toast }) {
  if (!toast.show) return null;
  return (
    <div className={`fixed top-5 right-5 z-[300] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-xl animate-fade-in ${
      toast.type === 'success'
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-green-500/30 text-green-400'
        : 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-red-500/30 text-red-400'
    }`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toast.type === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
        {toast.type === 'success' ? <CheckCircle size={14} /> : <X size={14} />}
      </div>
      <span className="font-medium text-sm text-white">{toast.message}</span>
    </div>
  );
}

function AdminDashboard() {
  const { userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.funcao === 'admin';

  const [users, setUsers] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, userId: null, userName: '' });
  const [modalProjetos, setModalProjetos] = useState({ open: false, userId: null, userName: '', projetosAtuais: [] });
  const [searchProjetos, setSearchProjetos] = useState('');
  const [modalSetores, setModalSetores] = useState({ open: false, userId: null, userName: '', setores: [] });
  const [searchSetores, setSearchSetores] = useState('');
  const [pendingRoles, setPendingRoles] = useState({});
  const [autoApproval, setAutoApproval] = useState(false);
  const [togglingApproval, setTogglingApproval] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState('');
  const [noticeType, setNoticeType] = useState('info');
  const [noticeActive, setNoticeActive] = useState(false);
  const [savingNotice, setSavingNotice] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [migracaoPendente, setMigracaoPendente] = useState(0);
  const [migrando, setMigrando] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (authLoading) return;
      if (!userProfile) { navigate('/selecao-projeto', { replace: true }); return; }
      const canAccess = isAdmin || userProfile?.funcao?.toLowerCase().includes('gerente');
      if (!canAccess) { navigate('/selecao-projeto', { replace: true }); return; }
      try {
        const [userSnap, projetoSnap, cargosSnap, settingSnap, noticeSnap] = await Promise.all([
          getDocs(collection(db, 'usuarios')),
          getDocs(collection(db, 'projetos')),
          getDocs(collection(db, 'cargos')),
          getDoc(doc(db, 'settings', 'autoApproval')),
          getDoc(doc(db, 'settings', 'globalNotice')),
        ]);
        setAutoApproval(settingSnap.exists() ? settingSnap.data().enabled === true : false);
        if (noticeSnap.exists()) {
          const nd = noticeSnap.data();
          setNoticeMsg(nd.message || '');
          setNoticeType(nd.type || 'info');
          setNoticeActive(nd.active || false);
        }
        let userList = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!isAdmin) userList = userList.filter(u => u.funcao !== 'admin');
        userList.sort((a, b) => (a.statusAcesso === 'pendente' ? -1 : 1));
        setUsers(userList);
        setProjetos(projetoSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        let cargosList = cargosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (cargosList.length === 0) cargosList = [{ id: 'default', nome: 'Colaborador' }];
        setCargos(cargosList);

        // Verifica silenciosamente se há dados legados para migrar
        if (isAdmin) {
          verificarMigracaoNecessaria().then(({ pendentes }) => setMigracaoPendente(pendentes));
        }
      } catch {
        showToast('Erro ao carregar dados.', 'error');
      } finally {
        setLoading(false);
      }
    };
    if (!authLoading) fetchData();
  // Primitivos estáveis: evita refetch completo a cada snapshot do perfil
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userProfile?.uid, userProfile?.funcao, navigate]);

  useEffect(() => { setPage(0); }, [searchTerm, statusFilter]);

  const handleApprove = async (user, newRole) => {
    try {
      if (!isAdmin && newRole === 'admin') { showToast('Sem permissão para este cargo.', 'error'); return; }
      await updateDoc(doc(db, 'usuarios', user.id), { statusAcesso: 'ativo', funcao: newRole || user.funcao });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, statusAcesso: 'ativo', funcao: newRole || u.funcao } : u));
      showToast(`${user.nome} aprovado!`);
    } catch { showToast('Erro ao aprovar.', 'error'); }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!isAdmin && newRole === 'admin') { showToast('Sem permissão.', 'error'); return; }
      if (!isAdmin && user?.funcao === 'admin') { showToast('Não pode modificar administradores.', 'error'); return; }
      await updateDoc(doc(db, 'usuarios', userId), { funcao: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, funcao: newRole } : u));
      showToast('Cargo atualizado.');
    } catch { showToast('Erro ao atualizar cargo.', 'error'); }
  };

  const deleteUser = async () => {
    const { userId, userName } = confirmDelete;
    try {
      const user = users.find(u => u.id === userId);
      if (!isAdmin && user?.funcao === 'admin') { showToast('Não pode excluir administradores.', 'error'); return; }
      await deleteDoc(doc(db, 'usuarios', userId));
      setUsers(prev => prev.filter(u => u.id !== userId));
      showToast(`${userName} removido.`);
    } catch { showToast('Erro ao remover.', 'error'); }
    finally { setConfirmDelete({ open: false, userId: null, userName: '' }); }
  };

  const openSetoresModal = (user) => {
    setSearchSetores('');
    setModalSetores({
      open: true,
      userId: user.id,
      userName: user.nome,
      setores: user.setores ? [...user.setores] : [],
    });
  };

  const toggleSetor = (setorId) => {
    setModalSetores(prev => {
      const atual = prev.setores;
      const novo = atual.includes(setorId)
        ? atual.filter(id => id !== setorId)
        : [...atual, setorId];
      return { ...prev, setores: novo };
    });
  };

  const salvarSetores = async () => {
    try {
      await updateDoc(doc(db, 'usuarios', modalSetores.userId), {
        setores: modalSetores.setores,
      });
      setUsers(prev => prev.map(u =>
        u.id === modalSetores.userId ? { ...u, setores: modalSetores.setores } : u
      ));
      showToast('Setores salvos!');
      setModalSetores({ open: false, userId: null, userName: '', setores: [] });
    } catch { showToast('Erro ao salvar setores.', 'error'); }
  };

  const salvarProjetos = async () => {
    try {
      await updateDoc(doc(db, 'usuarios', modalProjetos.userId), { projetos: modalProjetos.projetosAtuais });
      setUsers(prev => prev.map(u => u.id === modalProjetos.userId ? { ...u, projetos: modalProjetos.projetosAtuais } : u));
      showToast('Projetos salvos!');
      setModalProjetos({ open: false, userId: null, userName: '', projetosAtuais: [] });
    } catch { showToast('Erro ao salvar projetos.', 'error'); }
  };

  const saveNotice = async () => {
    setSavingNotice(true);
    try {
      await setDoc(doc(db, 'settings', 'globalNotice'), {
        message: noticeMsg.trim(),
        type: noticeType,
        active: noticeActive,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      showToast('Aviso salvo!');
    } catch {
      showToast('Erro ao salvar aviso.', 'error');
    } finally {
      setSavingNotice(false);
    }
  };

  const handleMigracao = async () => {
    setMigrando(true);
    try {
      const result = await migrarCarteiraParaCargo();
      setMigracaoPendente(0);
      showToast(`Migração concluída: ${result.migrated} usuário(s) atualizados.`);
    } catch {
      showToast('Erro na migração. Tente novamente.', 'error');
    } finally {
      setMigrando(false);
    }
  };

  const toggleAutoApproval = async () => {
    if (!isAdmin) return;
    setTogglingApproval(true);
    try {
      const novo = !autoApproval;
      await setDoc(doc(db, 'settings', 'autoApproval'), { enabled: novo }, { merge: true });
      setAutoApproval(novo);
      showToast(novo ? 'Aprovação automática ativada.' : 'Aprovação manual reativada.');
    } catch { showToast('Erro ao alterar configuração.', 'error'); }
    finally { setTogglingApproval(false); }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch =
      (u.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || u.statusAcesso === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const stats = [
    { label: 'Total de Usuários', value: users.length, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Usuários Ativos', value: users.filter(u => u.statusAcesso === 'ativo').length, icon: UserCheck, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    { label: 'Aguardando Aprovação', value: users.filter(u => u.statusAcesso === 'pendente').length, icon: UserX, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#57B952] border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white font-[Outfit,sans-serif] relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl pointer-events-none" />
      <Toast toast={toast} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/20 bg-gray-900/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Usa navigate(-1) para voltar corretamente para Gerência ou de onde veio */}
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-white/[0.05] group-hover:bg-white/[0.1] flex items-center justify-center transition-colors">
                <ArrowLeft size={15} />
              </div>
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="h-4 w-px bg-white/[0.08]" />
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/20 flex items-center justify-center">
                <Users size={14} className="text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">Gestão de Usuários</p>
                <p className="text-[10px] text-gray-500 leading-tight">Gerência</p>
              </div>
            </div>
          </div>

          <div />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {stats.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`relative overflow-hidden bg-white/10 border rounded-2xl p-4 sm:p-5 ${s.bg}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-2 leading-tight">{s.label}</p>
                    <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.bg}`}>
                    <Icon size={16} className={s.color} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Auto-Approval — admin only */}
        {isAdmin && (
          <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-white/10 border border-white/20">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${
                autoApproval ? 'bg-[#57B952]/15 border-[#57B952]/25' : 'bg-white/[0.05] border-white/20'
              }`}>
                <Zap size={15} className={autoApproval ? 'text-[#57B952]' : 'text-gray-600'} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Aprovação automática</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {autoApproval ? 'Novos cadastros ativados automaticamente' : 'Novos cadastros aguardam aprovação manual'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleAutoApproval}
              disabled={togglingApproval}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${
                autoApproval ? 'bg-[#57B952]' : 'bg-white/15'
              } ${togglingApproval ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${autoApproval ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        )}

        {/* Migração carteira→cargo — admin only, visível apenas se houver dados legados */}
        {isAdmin && migracaoPendente > 0 && (
          <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                <Shield size={15} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Migração pendente</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {migracaoPendente} usuário(s) com campo legado "carteira" precisam ser migrados para "cargo"
                </p>
              </div>
            </div>
            <button
              onClick={handleMigracao}
              disabled={migrando}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {migrando
                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Shield size={13} />}
              Migrar Agora
            </button>
          </div>
        )}

        {/* Global Notice Management — admin only */}
        {isAdmin && (
          <div className="bg-white/10 border border-white/20 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${noticeActive ? 'bg-indigo-500/15 border-indigo-500/25' : 'bg-white/[0.05] border-white/20'}`}>
                <Megaphone size={15} className={noticeActive ? 'text-indigo-400' : 'text-gray-600'} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Aviso global</p>
                <p className="text-xs text-gray-600 mt-0.5">Aparece para todos os usuários logados</p>
              </div>
              <button
                onClick={() => setNoticeActive(p => !p)}
                className={`relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${noticeActive ? 'bg-indigo-500' : 'bg-white/15'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${noticeActive ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="space-y-3">
              <textarea
                rows={2}
                value={noticeMsg}
                onChange={e => setNoticeMsg(e.target.value)}
                placeholder="Digite a mensagem que aparecerá para todos os usuários..."
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-gray-700 focus:outline-none focus:border-indigo-500/40 transition-all resize-none leading-relaxed"
              />
              <div className="flex gap-3">
                <select
                  value={noticeType}
                  onChange={e => setNoticeType(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-all"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                >
                  <option value="info"    style={{ backgroundColor: '#111', color: '#fff' }}>Informação (azul)</option>
                  <option value="warning" style={{ backgroundColor: '#111', color: '#fff' }}>Atenção (amarelo)</option>
                  <option value="alert"   style={{ backgroundColor: '#111', color: '#fff' }}>Alerta (vermelho)</option>
                </select>
                <button
                  onClick={saveNotice}
                  disabled={savingNotice}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {savingNotice
                    ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <Save size={13} />
                  }
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table card */}
        <div className="bg-white/10 border border-white/20 rounded-2xl overflow-hidden">

          {/* Filters inside the card */}
          <div className="px-5 py-4 border-b border-white/10 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-gray-700 focus:outline-none focus:border-[#57B952]/40 transition-all"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-sm focus:outline-none focus:border-[#57B952]/40 transition-all text-white"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
            >
              <option value="all" style={{ backgroundColor: '#111', color: '#fff' }}>Todos</option>
              <option value="ativo" style={{ backgroundColor: '#111', color: '#fff' }}>Ativos</option>
              <option value="pendente" style={{ backgroundColor: '#111', color: '#fff' }}>Pendentes</option>
            </select>
            <span className="self-center text-xs text-gray-600 whitespace-nowrap">
              {filteredUsers.length} usuário(s)
            </span>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {['Usuário', 'Status', 'Último acesso', 'Cargo / Ação', 'Projetos', 'Setores', ''].map(h => (
                    <th key={h} className={`px-5 py-3 text-[11px] font-semibold text-gray-600 uppercase tracking-wider ${h === '' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-5 py-16 text-center text-gray-700 text-sm">
                      {users.length === 0 ? 'Nenhum usuário cadastrado ainda.' : 'Nenhum resultado encontrado.'}
                    </td>
                  </tr>
                ) : paginatedUsers.map((user, idx) => (
                  <tr
                    key={user.id}
                    className={`border-b border-white/[0.04] transition-colors ${
                      user.statusAcesso === 'pendente'
                        ? 'bg-amber-500/[0.03]'
                        : 'hover:bg-white/10'
                    }`}
                  >
                    {/* Usuário */}
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity group"
                      >
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(user.nome)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm group-hover:ring-2 group-hover:ring-white/20 transition-all`}>
                          {user.nome?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white leading-tight group-hover:text-[#57B952] transition-colors">{user.nome || '—'}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{user.email}</p>
                        </div>
                      </button>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={user.statusAcesso} />
                    </td>

                    {/* Último acesso */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Clock size={11} />
                        {formatLastSeen(user.lastSeen)}
                      </div>
                    </td>

                    {/* Cargo / Ação */}
                    <td className="px-5 py-3.5">
                      {user.statusAcesso === 'pendente' ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={pendingRoles[user.id] ?? user.funcao ?? 'colaborador'}
                            onChange={e => setPendingRoles(prev => ({ ...prev, [user.id]: e.target.value }))}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-white/[0.10] bg-white/[0.05] text-white focus:outline-none focus:border-[#57B952]/50"
                            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                          >
                            {cargos.map(c => <option key={c.id} value={c.nome} style={{ backgroundColor: '#111', color: '#fff' }}>{c.nome}</option>)}
                            {isAdmin && <option value="admin" style={{ backgroundColor: '#111', color: '#fff' }}>Administrador</option>}
                          </select>
                          <button
                            onClick={() => handleApprove(user, pendingRoles[user.id] ?? user.funcao ?? 'colaborador')}
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
                          className={`text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none transition-colors text-white ${
                            user.funcao === 'admin' && !isAdmin
                              ? 'border-white/5 opacity-40 cursor-not-allowed bg-white/10'
                              : 'border-white/[0.10] bg-white/[0.05] cursor-pointer hover:border-white/20 focus:border-[#57B952]/50'
                          }`}
                          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                        >
                          {cargos.map(c => <option key={c.id} value={c.nome} style={{ backgroundColor: '#111', color: '#fff' }}>{c.nome}</option>)}
                          {isAdmin && <option value="admin" style={{ backgroundColor: '#111', color: '#fff' }}>Administrador</option>}
                        </select>
                      )}
                    </td>

                    {/* Projetos */}
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setModalProjetos({ open: true, userId: user.id, userName: user.nome, projetosAtuais: user.projetos || [] })}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[#57B952]/10 text-[#57B952] border border-[#57B952]/20 hover:bg-[#57B952]/20 transition-colors font-medium"
                      >
                        {(user.projetos || []).length > 0 ? `${user.projetos.length} proj.` : '+ Atribuir'}
                      </button>
                    </td>

                    {/* Setores */}
                    <td className="px-5 py-3.5">
                      {(() => {
                        const total = (user.setores || []).length;
                        return (
                          <button
                            onClick={() => openSetoresModal(user)}
                            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                              total > 0
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20'
                                : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10 hover:text-gray-300'
                            }`}
                          >
                            {total > 0 ? `${total} setor${total !== 1 ? 'es' : ''}` : '+ Atribuir'}
                          </button>
                        );
                      })()}
                    </td>

                    {/* Ações */}
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setConfirmDelete({ open: true, userId: user.id, userName: user.nome || user.email })}
                        disabled={user.funcao === 'admin' && !isAdmin}
                        className={`p-1.5 rounded-lg transition-colors ${
                          user.funcao === 'admin' && !isAdmin
                            ? 'opacity-20 cursor-not-allowed text-gray-600'
                            : 'text-gray-600 hover:text-red-400 hover:bg-red-500/15'
                        }`}
                        title="Remover usuário"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-white/10">
            {paginatedUsers.length === 0 ? (
              <p className="py-14 text-center text-gray-700 text-sm">Nenhum usuário encontrado.</p>
            ) : paginatedUsers.map(user => (
              <div key={user.id} className={`p-4 space-y-3 ${user.statusAcesso === 'pendente' ? 'bg-amber-500/[0.03]' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(user.nome)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                      {user.nome?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-white">{user.nome || '—'}</p>
                      <p className="text-xs text-gray-600">{user.email}</p>
                      <p className="text-xs text-gray-700 mt-0.5 flex items-center gap-1"><Clock size={9} /> {formatLastSeen(user.lastSeen)}</p>
                    </div>
                  </div>
                  <StatusBadge status={user.statusAcesso} />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={user.funcao || 'colaborador'}
                    onChange={e => user.statusAcesso !== 'pendente' && handleRoleChange(user.id, e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-xl border border-white/[0.10] bg-white/[0.05] text-white focus:outline-none"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  >
                    {cargos.map(c => <option key={c.id} value={c.nome} style={{ backgroundColor: '#111', color: '#fff' }}>{c.nome}</option>)}
                    {isAdmin && <option value="admin" style={{ backgroundColor: '#111', color: '#fff' }}>Administrador</option>}
                  </select>
                  {user.statusAcesso === 'pendente' && (
                    <button onClick={() => handleApprove(user, user.funcao || 'colaborador')} className="p-2 rounded-xl bg-green-500/15 text-green-400 border border-green-500/25"><CheckCircle size={16} /></button>
                  )}
                  <button onClick={() => setModalProjetos({ open: true, userId: user.id, userName: user.nome, projetosAtuais: user.projetos || [] })} className="p-2 rounded-xl bg-[#57B952]/10 text-[#57B952] border border-[#57B952]/20"><Briefcase size={16} /></button>
                  <button onClick={() => openSetoresModal(user)} className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"><Layers size={16} /></button>
                  <button onClick={() => setConfirmDelete({ open: true, userId: user.id, userName: user.nome || user.email })} className="p-2 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-500/15 transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination — dentro do card */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/10 bg-white/[0.05]">
              <span className="text-xs text-gray-600">
                Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredUsers.length)} de {filteredUsers.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/20 text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                      i === page
                        ? 'bg-[#57B952] text-white'
                        : 'text-gray-500 hover:text-white hover:bg-white/[0.06] border border-white/20'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page + 1 >= totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/20 text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Confirm delete modal ── */}
      {confirmDelete.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 border border-white/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={17} className="text-red-400" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Remover usuário</p>
                <p className="text-xs text-gray-600">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-5">
              Remover <span className="text-white font-semibold">{confirmDelete.userName}</span> do sistema?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete({ open: false, userId: null, userName: '' })} className="flex-1 py-2.5 rounded-xl bg-white/10 border border-white/20 text-gray-300 text-sm font-medium hover:bg-white/[0.08] transition-colors">Cancelar</button>
              <button onClick={deleteUser} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors">Remover</button>
            </div>
          </div>
        </div>
      )}

      {/* ── User profile drawer ── */}
      {selectedUser && (
        <UserProfileDrawer
          user={selectedUser}
          projetos={projetos}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {/* ── Setores modal ── */}
      {modalSetores.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 border border-white/20 rounded-2xl shadow-2xl w-full max-w-lg max-h-[82vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
                  <Layers size={14} className="text-cyan-400" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Atribuir Setores</p>
                  <p className="text-xs text-gray-500 mt-0.5">{modalSetores.userName}</p>
                </div>
              </div>
              <button onClick={() => setModalSetores({ open: false, userId: null, userName: '', setores: [] })} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-gray-500 hover:text-white transition-colors">
                <X size={15} />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pt-4 pb-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar setor..."
                  value={searchSetores}
                  onChange={e => setSearchSetores(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-gray-700 focus:outline-none focus:border-cyan-500/40"
                />
              </div>
            </div>

            {/* Body — 10 setores fixos globais */}
            <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-1">
              {SETORES_PADRAO.filter(s =>
                !searchSetores || s.nome.toLowerCase().includes(searchSetores.toLowerCase())
              ).map(setor => {
                const checked = modalSetores.setores.includes(setor.id);
                return (
                  <label
                    key={setor.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border ${
                      checked ? 'border-cyan-500/25 bg-cyan-500/10' : 'border-transparent hover:bg-white/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSetor(setor.id)}
                      className="w-4 h-4 flex-shrink-0 accent-cyan-400"
                    />
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: setor.cor }} />
                    <span className="text-sm text-white font-medium flex-1">{setor.nome}</span>
                  </label>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-white/20 flex items-center justify-between gap-3">
              <span className="text-xs text-gray-600">
                {modalSetores.setores.length} setor(es) selecionado(s)
              </span>
              <div className="flex gap-3">
                <button onClick={() => setModalSetores({ open: false, userId: null, userName: '', setores: [] })} className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm text-gray-300 font-medium hover:bg-white/[0.08] transition-colors">Cancelar</button>
                <button onClick={salvarSetores} className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-bold transition-colors">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Projects modal ── */}
      {modalProjetos.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 border border-white/20 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/20">
              <div>
                <p className="font-bold text-white text-sm">Atribuir Projetos</p>
                <p className="text-xs text-gray-500 mt-0.5">{modalProjetos.userName}</p>
              </div>
              <button onClick={() => setModalProjetos({ open: false, userId: null, userName: '', projetosAtuais: [] })} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-gray-500 hover:text-white transition-colors">
                <X size={15} />
              </button>
            </div>
            <div className="px-4 pt-4 pb-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar projetos..."
                  value={searchProjetos}
                  onChange={e => setSearchProjetos(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-gray-700 focus:outline-none focus:border-[#57B952]/40"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1">
              {projetos
                .filter(p => !p.deletedAt && p.nome?.toLowerCase().includes(searchProjetos.toLowerCase()))
                .map(projeto => {
                  const checked = modalProjetos.projetosAtuais.includes(projeto.id);
                  return (
                    <label
                      key={projeto.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border ${
                        checked ? 'bg-[#57B952]/10 border-[#57B952]/20' : 'border-transparent hover:bg-white/10'
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
                        className="accent-[#57B952] w-4 h-4 flex-shrink-0"
                      />
                      <span className="text-sm text-white">{projeto.nome}</span>
                    </label>
                  );
                })}
              {projetos.length === 0 && <p className="text-center text-gray-700 text-sm py-8">Nenhum projeto cadastrado.</p>}
            </div>
            <div className="px-4 py-4 border-t border-white/20 flex gap-3">
              <button onClick={() => setModalProjetos({ open: false, userId: null, userName: '', projetosAtuais: [] })} className="flex-1 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm text-gray-300 font-medium hover:bg-white/[0.08] transition-colors">Cancelar</button>
              <button onClick={salvarProjetos} className="flex-1 py-2.5 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white text-sm font-bold transition-colors">
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
