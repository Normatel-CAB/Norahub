import { useState, useEffect } from 'react';
import { X, Clock, Briefcase, Activity, Mail, Shield } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

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

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 2) return 'agora';
  if (diff < 60) return `há ${diff}min`;
  if (diff < 1440) return `há ${Math.floor(diff / 60)}h`;
  if (diff < 43200) return `há ${Math.floor(diff / 1440)}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ACTION_COLORS = {
  project_created: 'bg-green-500/20 text-green-400',
  project_edited: 'bg-blue-500/20 text-blue-400',
  project_deleted: 'bg-red-500/20 text-red-400',
  card_created: 'bg-green-500/20 text-green-400',
  file_upload: 'bg-purple-500/20 text-purple-400',
  user_approved: 'bg-green-500/20 text-green-400',
  user_login: 'bg-white/10 text-gray-400',
  role_changed: 'bg-yellow-500/20 text-yellow-400',
};

function UserProfileDrawer({ user, projetos, onClose }) {
  const [activities, setActivities] = useState([]);
  const [loadingActs, setLoadingActs] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoadingActs(true);
    setActivities([]);
    const fetchActs = async () => {
      try {
        const q = query(
          collection(db, 'activities'),
          where('userId', '==', user.id),
          orderBy('timestamp', 'desc'),
          limit(8)
        );
        const snap = await getDocs(q);
        setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {
        setActivities([]);
      } finally {
        setLoadingActs(false);
      }
    };
    fetchActs();
  }, [user?.id]);

  if (!user) return null;

  const userProjetos = projetos.filter(p => (user.projetos || []).includes(p.id) && !p.deletedAt);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-gray-900 border-l border-white/20 flex flex-col shadow-2xl font-[Outfit,sans-serif]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/20 flex-shrink-0">
          <p className="font-semibold text-white text-sm">Perfil do Usuário</p>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-gray-500 hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Identity */}
          <div className="px-5 py-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarColor(user.nome)} flex items-center justify-center text-white text-xl font-bold flex-shrink-0 shadow-lg`}>
                {user.nome?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-bold text-white text-base leading-tight">{user.nome || '—'}</p>
                <div className="mt-1.5">
                  {user.statusAcesso === 'ativo' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Ativo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Pendente
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <Mail size={13} className="text-gray-600 flex-shrink-0" />
                <span className="text-sm text-gray-400 truncate">{user.email || '—'}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Shield size={13} className="text-gray-600 flex-shrink-0" />
                <span className="text-sm text-gray-400">{user.funcao || '—'}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock size={13} className="text-gray-600 flex-shrink-0" />
                <span className="text-sm text-gray-400">Último acesso: {formatDate(user.lastSeen)}</span>
              </div>
            </div>
          </div>

          {/* Projects */}
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Briefcase size={11} />
              Projetos atribuídos ({userProjetos.length})
            </p>
            {userProjetos.length === 0 ? (
              <p className="text-xs text-gray-700">Nenhum projeto atribuído.</p>
            ) : (
              <div className="space-y-1.5">
                {userProjetos.map(p => (
                  <div key={p.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#57B952] flex-shrink-0" />
                    <span className="text-sm text-white truncate">{p.nome}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity size={11} />
              Atividade recente
            </p>
            {loadingActs ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-9 rounded-xl bg-white/[0.03] animate-pulse" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <p className="text-xs text-gray-700">Nenhuma atividade registrada.</p>
            ) : (
              <div className="space-y-2">
                {activities.map(act => (
                  <div key={act.id} className="flex items-start gap-2.5 py-1">
                    <span className={`flex-shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${(ACTION_COLORS[act.action] || '').includes('green') ? 'bg-green-400' : (ACTION_COLORS[act.action] || '').includes('blue') ? 'bg-blue-400' : (ACTION_COLORS[act.action] || '').includes('red') ? 'bg-red-400' : 'bg-white/20'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 leading-snug">{act.description || act.message || act.title || '—'}</p>
                      <p className="text-[10px] text-gray-700 mt-0.5">{formatDate(act.timestamp || act.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default UserProfileDrawer;
