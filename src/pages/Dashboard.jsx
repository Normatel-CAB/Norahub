import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Users, FolderOpen, FileText, TrendingUp,
  Activity, Clock, CheckCircle, XCircle, BarChart3
} from 'lucide-react';
import { SkeletonStatCards, SkeletonActivityRow } from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import NotificationCenter from '../components/NotificationCenter';

function mapActivityRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    createdAt: row.created_at,
    ...(row.data || {}),
  };
}

function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProjects: 0,
    totalForms: 0,
    totalFiles: 0,
    activeProjects: 0,
    pendingApprovals: 0
  });
  
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const primeiroNome = userProfile?.nome?.split(' ')[0] || currentUser?.user_metadata?.full_name?.split(' ')[0] || 'Usuário';
  const fotoURL = currentUser?.user_metadata?.avatar_url || userProfile?.foto_url;

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Buscar usuários
      const { data: usersRows, error: usersErr } = await supabase.from('usuarios').select('id');
      if (usersErr) throw usersErr;
      const totalUsers = (usersRows || []).length;

      // Buscar projetos
      const { data: projectRows, error: projErr } = await supabase.from('projetos').select('id, ativa, data');
      if (projErr) throw projErr;
      const totalProjects = (projectRows || []).length;
      const activeProjects = (projectRows || []).filter(p => p.ativa !== false).length;

      let totalForms = 0;
      let totalFiles = 0;
      for (const projeto of (projectRows || [])) {
        const extras = projeto.data?.extras;
        if (!Array.isArray(extras)) continue;
        for (const extra of extras) {
          if (Array.isArray(extra.formResponses)) totalForms += extra.formResponses.length;
          if (Array.isArray(extra.files))         totalFiles += extra.files.length;
        }
      }

      // Buscar atividades recentes
      const { data: activityRows, error: actErr } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (actErr) throw actErr;
      const activities = (activityRows || []).map(mapActivityRow);

      setStats({
        totalUsers,
        totalProjects,
        totalForms,
        totalFiles,
        activeProjects,
        pendingApprovals: 0
      });
      
      setRecentActivity(activities);
      setLoading(false);
    } catch (error) {
      setError('Erro ao carregar os dados do dashboard. Tente novamente.');
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Data desconhecida';
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Data inválida';
    }
  };

  const StatCard = ({ icon: Icon, label, value, accent }) => (
    <div className="nt-glass rounded-xl p-4 md:p-6 hover:border-hairline-hi transition-all">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs md:text-sm text-txt-dim mb-1 uppercase tracking-wider font-medium">{label}</p>
          <p className={`text-2xl md:text-3xl font-bold text-txt`}>{value}</p>
        </div>
        <div className={`${accent} bg-opacity-20 p-3 md:p-4 rounded-xl border border-hairline`}>
          <Icon size={24} className={`md:w-8 md:h-8 ${accent}`} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="nt-page-bg min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden relative">
      {/* Header */}
      <header className="relative w-full flex items-center justify-center py-3 md:py-6 px-3 md:px-8 border-b border-hairline min-h-[56px] md:h-20 backdrop-blur-md z-20" style={{ background: 'rgba(9, 22, 11, 0.6)' }}>
        <button
          onClick={() => navigate('/selecao-projeto')}
          className="absolute left-3 md:left-8 flex items-center gap-1 md:gap-2 text-txt-dim hover:text-brand-lite transition-colors font-medium text-xs md:text-sm shrink-0 z-10"
        >
          <ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />
          <span className="hidden sm:inline">Voltar</span>
        </button>

        <div className="flex items-center gap-2 md:gap-4">
          <img src="/img/Designer (6).png" alt="Logo Nora" className="h-10 sm:h-12 md:h-14 w-auto object-contain drop-shadow-lg" />
          <span className="text-txt-dim text-lg md:text-2xl font-light">|</span>
          <img
            src={isDark ? "/img/Normatel Engenharia_BRANCO.png" : "/img/Normatel Engenharia_PRETO.png"}
            alt="Logo Normatel"
            className="h-6 sm:h-8 md:h-10 w-auto object-contain drop-shadow-lg"
          />
        </div>

        {currentUser && (
          <div className="absolute right-3 md:right-8 flex items-center gap-2 md:gap-3 shrink-0">
            <NotificationCenter />
            <button
              onClick={() => navigate('/perfil')}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-brand bg-surface-2 flex items-center justify-center hover:border-brand-lite transition-colors cursor-pointer shrink-0"
            >
              {fotoURL ? (
                <img src={fotoURL} className="w-full h-full object-cover" alt="Avatar" />
              ) : (
                <User size={16} className="md:w-5 md:h-5 text-txt-dim" />
              )}
            </button>
            <span className="text-xs md:text-base lg:text-lg font-semibold text-txt truncate max-w-[60px] sm:max-w-[100px] md:max-w-none">
              <span className="hidden md:inline">Olá, </span>{primeiroNome}
            </span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow p-3 md:p-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Título */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-4xl font-bold text-txt flex items-center gap-3">
              <BarChart3 size={32} className="md:w-10 md:h-10 text-brand-lite" />
              Dashboard
            </h1>
            <p className="text-sm md:text-base text-txt-dim mt-2">
              Visão geral das estatísticas do sistema
            </p>
          </div>

          {loading ? (
            <>
              <SkeletonStatCards count={6} />
              <div className="nt-glass mt-6 rounded-xl p-4 md:p-6 space-y-2">
                <div className="h-5 w-40 bg-white/[0.07] rounded animate-pulse mb-4" />
                {[1, 2, 3, 4, 5].map(i => <SkeletonActivityRow key={i} />)}
              </div>
            </>
          ) : error ? (
            <div className="text-center py-20 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 font-medium">{error}</p>
              <button
                onClick={fetchDashboardData}
                className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-medium transition-colors border border-red-500/30"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              {/* Cards de Estatísticas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                <StatCard
                  icon={Users}
                  label="Total de Usuários"
                  value={stats.totalUsers}
                  accent="text-blue-400"
                />
                <StatCard
                  icon={FolderOpen}
                  label="Total de Projetos"
                  value={stats.totalProjects}
                  accent="text-brand-lite"
                />
                <StatCard
                  icon={Activity}
                  label="Projetos Ativos"
                  value={stats.activeProjects}
                  accent="text-purple-400"
                />
                <StatCard
                  icon={FileText}
                  label="Total de Formulários"
                  value={stats.totalForms}
                  accent="text-orange-400"
                />
                <StatCard
                  icon={FolderOpen}
                  label="Total de Arquivos"
                  value={stats.totalFiles}
                  accent="text-indigo-400"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Taxa de Atividade"
                  value={`${stats.totalProjects > 0 ? Math.round((stats.activeProjects / stats.totalProjects) * 100) : 0}%`}
                  accent="text-brand-lite"
                />
              </div>

              {/* Atividade Recente */}
              <div className="nt-glass rounded-xl p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-txt mb-4 flex items-center gap-2">
                  <Clock size={20} className="md:w-6 md:h-6" />
                  Atividade Recente
                </h2>

                {recentActivity.length === 0 ? (
                  <p className="text-txt-faint text-center py-8">Nenhuma atividade recente</p>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-txt"
                      >
                        <div className={`p-2 rounded-lg ${
                          activity.type === 'form_response' ? 'bg-blue-500/15' :
                          activity.type === 'file_upload' ? 'bg-brand/15' :
                          activity.type === 'approval' ? 'bg-purple-500/15' :
                          'bg-white/10'
                        }`}>
                          {activity.type === 'form_response' ? <FileText size={18} className="text-blue-400" /> :
                           activity.type === 'file_upload' ? <FolderOpen size={18} className="text-brand-lite" /> :
                           activity.type === 'approval' ? <CheckCircle size={18} className="text-purple-400" /> :
                           <Activity size={18} className="text-txt-dim" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-txt">{activity.title || activity.action || 'Atividade'}</p>
                          <p className="text-xs text-txt-faint mt-1">{activity.message || activity.description || 'Sem descrição'}</p>
                          <p className="text-xs text-txt-dim mt-1">{formatTimestamp(activity.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
