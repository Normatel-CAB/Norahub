import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Activity, Search, Filter, User, Folder,
  FileText, CheckCircle, Trash2, Plus, Edit2, LogIn, Shield, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';

const PAGE_SIZE = 25;

const ACTION_META = {
  project_created:   { label: 'Projeto Criado',    icon: Plus,         color: 'text-green-400',  bg: 'bg-green-500/10'  },
  project_edited:    { label: 'Projeto Editado',    icon: Edit2,        color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
  project_deleted:   { label: 'Projeto Excluído',   icon: Trash2,       color: 'text-red-400',    bg: 'bg-red-500/10'    },
  project_restored:  { label: 'Projeto Restaurado', icon: CheckCircle,  color: 'text-teal-400',   bg: 'bg-teal-500/10'   },
  card_created:      { label: 'Card Criado',        icon: Plus,         color: 'text-green-400',  bg: 'bg-green-500/10'  },
  card_deleted:      { label: 'Card Excluído',      icon: Trash2,       color: 'text-red-400',    bg: 'bg-red-500/10'    },
  file_upload:       { label: 'Arquivo Enviado',    icon: FileText,     color: 'text-purple-400', bg: 'bg-purple-500/10' },
  file_deleted:      { label: 'Arquivo Excluído',   icon: Trash2,       color: 'text-red-400',    bg: 'bg-red-500/10'    },
  folder_created:    { label: 'Pasta Criada',       icon: Folder,       color: 'text-amber-400',  bg: 'bg-amber-500/10'  },
  form_response:     { label: 'Formulário Resp.',   icon: FileText,     color: 'text-cyan-400',   bg: 'bg-cyan-500/10'   },
  user_created:      { label: 'Usuário Criado',     icon: User,         color: 'text-green-400',  bg: 'bg-green-500/10'  },
  user_approved:     { label: 'Usuário Aprovado',   icon: CheckCircle,  color: 'text-green-400',  bg: 'bg-green-500/10'  },
  user_rejected:     { label: 'Usuário Rejeitado',  icon: X,            color: 'text-red-400',    bg: 'bg-red-500/10'    },
  user_deleted:      { label: 'Usuário Removido',   icon: Trash2,       color: 'text-red-400',    bg: 'bg-red-500/10'    },
  role_changed:      { label: 'Cargo Alterado',     icon: Shield,       color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  projects_changed:  { label: 'Projetos Atualizados', icon: Folder,     color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
  user_login:        { label: 'Login',              icon: LogIn,        color: 'text-gray-400',   bg: 'bg-white/10'      },
  cargo_created:     { label: 'Cargo Criado',       icon: Plus,         color: 'text-green-400',  bg: 'bg-green-500/10'  },
  cargo_edited:      { label: 'Cargo Editado',      icon: Edit2,        color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
  cargo_deleted:     { label: 'Cargo Excluído',     icon: Trash2,       color: 'text-red-400',    bg: 'bg-red-500/10'    },
};

const TYPE_FILTERS = [
  { value: 'all',      label: 'Tudo'       },
  { value: 'project',  label: 'Projetos'   },
  { value: 'user',     label: 'Usuários'   },
  { value: 'file',     label: 'Arquivos'   },
  { value: 'cargo',    label: 'Cargos'     },
  { value: 'login',    label: 'Acessos'    },
];

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getMeta(action) {
  return ACTION_META[action] ?? { label: action, icon: Activity, color: 'text-gray-400', bg: 'bg-white/10' };
}

function actionMatchesFilter(action, filter) {
  if (filter === 'all') return true;
  if (filter === 'project') return action.startsWith('project') || action.startsWith('card');
  if (filter === 'user') return action.startsWith('user') || action === 'role_changed' || action === 'projects_changed';
  if (filter === 'file') return action.startsWith('file') || action === 'folder_created';
  if (filter === 'cargo') return action.startsWith('cargo');
  if (filter === 'login') return action === 'user_login';
  return true;
}

function LogsAuditoria() {
  const { userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.funcao === 'admin';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState([null]); // stack of page cursors

  useEffect(() => {
    if (authLoading) return;
    if (!userProfile) { navigate('/selecao-projeto', { replace: true }); return; }
    const canAccess = isAdmin || userProfile.funcao?.toLowerCase().includes('gerente');
    if (!canAccess) { navigate('/selecao-projeto', { replace: true }); return; }
    fetchLogs(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userProfile?.uid, userProfile?.funcao, typeFilter]);

  const fetchLogs = async (pageIndex, cursorDoc = null) => {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'activities'),
        orderBy('timestamp', 'desc'),
        limit(PAGE_SIZE + 1)
      );
      if (cursorDoc) q = query(q, startAfter(cursorDoc));

      const snap = await getDocs(q);
      const hasMore = snap.docs.length > PAGE_SIZE;
      const docs = snap.docs.slice(0, PAGE_SIZE).map(d => ({ id: d.id, ...d.data(), _ref: d }));

      setLogs(docs);
      setPage(pageIndex);

      if (hasMore) {
        setCursors(prev => {
          const next = [...prev];
          next[pageIndex + 1] = snap.docs[PAGE_SIZE - 1];
          return next;
        });
      }
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const goNext = () => fetchLogs(page + 1, cursors[page + 1] ?? null);
  const goPrev = () => fetchLogs(page - 1, cursors[page - 1] ?? null);

  const filtered = logs.filter(log => {
    const matchType = actionMatchesFilter(log.action, typeFilter);
    const matchSearch = !search.trim() ||
      log.userName?.toLowerCase().includes(search.toLowerCase()) ||
      log.description?.toLowerCase().includes(search.toLowerCase()) ||
      log.title?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white font-[Outfit,sans-serif] relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/20 bg-gray-900/50 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
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
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center">
              <Activity size={14} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Logs de Auditoria</p>
              <p className="text-[10px] text-gray-600 leading-tight">Histórico de ações do sistema</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-4">

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por usuário ou ação..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-gray-700 focus:outline-none focus:border-[#57B952]/40 transition-all"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {TYPE_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => { setTypeFilter(f.value); setCursors([null]); }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  typeFilter === f.value
                    ? 'bg-[#57B952] border-[#57B952] text-white'
                    : 'bg-white/10 border-white/20 text-gray-500 hover:text-white hover:border-white/20'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white/10 border border-white/20 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="py-20 flex items-center justify-center">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-[#57B952] border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-gray-700 text-sm">
              Nenhum log encontrado.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filtered.map(log => {
                const meta = getMeta(log.action);
                const Icon = meta.icon;
                return (
                  <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-white/10 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${meta.bg}`}>
                      <Icon size={15} className={meta.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                        <span className="text-xs text-gray-700">·</span>
                        <span className="text-xs text-gray-500">{log.userName || '—'}</span>
                      </div>
                      <p className="text-sm text-white mt-0.5 leading-snug">
                        {log.description || log.message || log.title || '—'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-700 flex-shrink-0 mt-1">
                      {formatDate(log.timestamp || log.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Paginação dentro do card */}
          {!loading && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/10 bg-white/[0.01]">
              <span className="text-xs text-gray-700">Página {page + 1}</span>
              <div className="flex gap-2">
                <button
                  onClick={goPrev}
                  disabled={page === 0}
                  className="px-4 py-1.5 rounded-lg border border-white/20 text-xs text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ← Anterior
                </button>
                <button
                  onClick={goNext}
                  disabled={logs.length < PAGE_SIZE}
                  className="px-4 py-1.5 rounded-lg border border-white/20 text-xs text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Próximo →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default LogsAuditoria;
