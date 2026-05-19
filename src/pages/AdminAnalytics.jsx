import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Users, Folder, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const ACTION_LABELS = {
  project_created:  'Proj. Criado',
  project_edited:   'Proj. Editado',
  project_deleted:  'Proj. Excluído',
  project_restored: 'Proj. Restaurado',
  card_created:     'Card Criado',
  card_deleted:     'Card Excluído',
  file_upload:      'Arquivo Enviado',
  file_deleted:     'Arquivo Excluído',
  folder_created:   'Pasta Criada',
  user_approved:    'Usuário Aprov.',
  user_deleted:     'Usuário Removido',
  user_login:       'Login',
  role_changed:     'Cargo Alterado',
  cargo_created:    'Cargo Criado',
  form_response:    'Formulário',
};

const AVATAR_COLORS = [
  'from-blue-500 to-blue-700',
  'from-purple-500 to-purple-700',
  'from-pink-500 to-pink-700',
  'from-orange-500 to-orange-700',
  'from-teal-500 to-teal-700',
];

function AreaTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-white/[0.08] rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-[#57B952]">{payload[0]?.value} ações</p>
    </div>
  );
}

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-white/[0.08] rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-indigo-400">{payload[0]?.value}</p>
    </div>
  );
}

function AdminAnalytics() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.funcao === 'admin';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState({ users: 0, activeUsers: 0, projects: 0, totalActivities: 0 });
  const [dailyData, setDailyData] = useState([]);
  const [actionData, setActionData] = useState([]);
  const [topUsers, setTopUsers] = useState([]);

  useEffect(() => {
    if (!userProfile) return;
    const canAccess = isAdmin || userProfile.funcao?.toLowerCase().includes('gerente');
    if (!canAccess) { navigate('/selecao-projeto'); return; }
    loadData();
  }, [userProfile]);

  const loadData = async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [usersSnap, projectsSnap, activitiesSnap] = await Promise.all([
        getDocs(collection(db, 'usuarios')),
        getDocs(collection(db, 'projetos')),
        getDocs(query(collection(db, 'activities'), orderBy('timestamp', 'desc'))),
      ]);

      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allActivities = activitiesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setStats({
        users: users.length,
        activeUsers: users.filter(u => u.statusAcesso === 'ativo').length,
        projects: projects.filter(p => !p.deletedAt).length,
        totalActivities: allActivities.length,
      });

      // Filter to last 30 days
      const recent = allActivities.filter(a => {
        const ts = a.timestamp?.toDate?.() ?? (a.createdAt?.toDate?.() ?? null);
        return ts && ts >= thirtyDaysAgo;
      });

      // Build daily activity map
      const dayMap = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        dayMap[key] = 0;
      }
      recent.forEach(a => {
        const ts = a.timestamp?.toDate?.() ?? (a.createdAt?.toDate?.() ?? null);
        if (ts) {
          const key = ts.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          if (dayMap[key] !== undefined) dayMap[key]++;
        }
      });
      setDailyData(Object.entries(dayMap).map(([dia, ações]) => ({ dia, ações })));

      // Top action types
      const actionMap = {};
      recent.forEach(a => {
        const label = ACTION_LABELS[a.action] ?? a.action ?? 'Outro';
        actionMap[label] = (actionMap[label] || 0) + 1;
      });
      setActionData(
        Object.entries(actionMap)
          .map(([action, total]) => ({ action, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 7)
      );

      // Top active users
      const userMap = {};
      recent.forEach(a => {
        if (!a.userId) return;
        if (!userMap[a.userId]) userMap[a.userId] = { name: a.userName || a.userId, count: 0 };
        userMap[a.userId].count++;
      });
      setTopUsers(
        Object.values(userMap)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#57B952] border-t-transparent" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 gap-4 p-6">
      <p className="text-red-400 font-medium">Erro ao carregar os dados. Tente novamente.</p>
      <button
        onClick={() => { setError(false); setLoading(true); loadData(); }}
        className="px-5 py-2 rounded-xl bg-[#57B952] hover:bg-[#4aa847] text-white text-sm font-semibold transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  );

  const statCards = [
    { label: 'Usuários totais',    value: stats.users,           icon: Users,    color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20'       },
    { label: 'Usuários ativos',    value: stats.activeUsers,     icon: Users,    color: 'text-[#57B952]',   bg: 'bg-[#57B952]/10 border-[#57B952]/20'     },
    { label: 'Projetos ativos',    value: stats.projects,        icon: Folder,   color: 'text-indigo-400',  bg: 'bg-indigo-500/10 border-indigo-500/20'   },
    { label: 'Ações registradas',  value: stats.totalActivities, icon: Activity, color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/20'   },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white font-[Outfit,sans-serif] relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/20 bg-gray-900/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
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
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/20 flex items-center justify-center">
              <TrendingUp size={14} className="text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Dashboard de Uso</p>
              <p className="text-[10px] text-gray-600 leading-tight">Últimos 30 dias</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`bg-white/10 border rounded-2xl p-4 sm:p-5 ${s.bg}`}>
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

        {/* Area chart — activity timeline */}
        <div className="bg-white/10 border border-white/20 rounded-2xl p-5">
          <p className="text-sm font-semibold text-white mb-0.5">Atividade por dia</p>
          <p className="text-xs text-gray-600 mb-5">Ações registradas nos últimos 30 dias</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#57B952" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#57B952" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="dia"
                tick={{ fill: '#4B5563', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fill: '#4B5563', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<AreaTooltip />} />
              <Area
                type="monotone"
                dataKey="ações"
                stroke="#57B952"
                strokeWidth={2}
                fill="url(#greenGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#57B952', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">

          {/* Bar chart — action types */}
          <div className="bg-white/10 border border-white/20 rounded-2xl p-5">
            <p className="text-sm font-semibold text-white mb-0.5">Ações mais frequentes</p>
            <p className="text-xs text-gray-600 mb-5">Top ações nos últimos 30 dias</p>
            {actionData.length === 0 ? (
              <p className="text-xs text-gray-700 py-8 text-center">Sem dados suficientes.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={actionData} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="action" type="category" tick={{ fill: '#9CA3AF', fontSize: 10 }} tickLine={false} axisLine={false} width={95} />
                  <Tooltip content={<BarTooltip />} />
                  <Bar dataKey="total" fill="#6366F1" radius={[0, 4, 4, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top users */}
          <div className="bg-white/10 border border-white/20 rounded-2xl p-5">
            <p className="text-sm font-semibold text-white mb-0.5">Usuários mais ativos</p>
            <p className="text-xs text-gray-600 mb-5">Por número de ações nos últimos 30 dias</p>
            {topUsers.length === 0 ? (
              <p className="text-xs text-gray-700 py-8 text-center">Sem dados suficientes.</p>
            ) : (
              <div className="space-y-4">
                {topUsers.map((u, i) => {
                  const max = topUsers[0]?.count || 1;
                  const pct = Math.round((u.count / max) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-700 w-4 text-right flex-shrink-0">{i + 1}</span>
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {u.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-white font-medium truncate">{u.name}</span>
                          <span className="text-xs text-gray-600 ml-2 flex-shrink-0">{u.count} ações</span>
                        </div>
                        <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#57B952] rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminAnalytics;
