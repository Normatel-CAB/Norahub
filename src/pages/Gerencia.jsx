import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Shield, Briefcase, ChevronRight, Lock, Activity, Trash2, TrendingUp, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

function mapCargoRow(row) {
  return {
    id: row.id,
    nome: row.nome,
    canManageUsers: row.can_manage_users,
    canManagePermissions: row.can_manage_permissions,
    canManageProjectMembers: row.can_manage_project_members,
    canChangeCarteiras: row.can_change_carteiras,
    canCreateCargos: row.can_create_cargos,
    canCreateProjetos: row.can_create_projetos,
    ...(row.data || {}),
  };
}

const OPCOES = [
  {
    id: 'usuarios',
    titulo: 'Usuários',
    descricao: 'Aprovar cadastros, atribuir cargos e gerenciar acesso ao sistema',
    icon: Users,
    path: '/admin',
    cor: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    permissao: 'canManageUsers',
  },
  {
    id: 'cargos',
    titulo: 'Cargos',
    descricao: 'Criar cargos e configurar permissões para cada função',
    icon: Shield,
    path: '/admin-cargos',
    cor: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    permissao: 'canCreateCargos',
  },
  {
    id: 'projetos',
    titulo: 'Projetos',
    descricao: 'Criar e gerenciar projetos disponíveis no sistema',
    icon: Briefcase,
    path: '/gerencia-projetos',
    cor: 'text-brand-lite',
    bg: 'bg-brand/10 border-brand/20',
    permissao: 'canCreateProjetos',
  },
  {
    id: 'logs',
    titulo: 'Logs de Auditoria',
    descricao: 'Histórico completo de ações realizadas no sistema',
    icon: Activity,
    path: '/logs-auditoria',
    cor: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
    permissao: null, // admin e gerente sempre têm acesso
  },
  {
    id: 'lixeira',
    titulo: 'Lixeira',
    descricao: 'Restaurar ou excluir permanentemente projetos removidos',
    icon: Trash2,
    path: '/lixeira',
    cor: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    permissao: null,
  },
  {
    id: 'analytics',
    titulo: 'Dashboard de Uso',
    descricao: 'Gráficos de atividade, ações frequentes e usuários mais ativos',
    icon: TrendingUp,
    path: '/admin-analytics',
    cor: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    permissao: null,
  },
  {
    id: 'carteiras',
    titulo: 'Setores & Links',
    descricao: 'Gerenciar setores, adicionar links e atribuir setores aos colaboradores',
    icon: Layers,
    path: '/admin-carteiras',
    cor: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
    permissao: 'canChangeCarteiras',
  },
];

function Gerencia() {
  const { userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [cargoData, setCargoData] = useState(null);
  const [loading, setLoading] = useState(true);

  const primeiroNome = userProfile?.nome?.split(' ')[0] || 'Usuário';
  const isAdmin = userProfile?.funcao === 'admin';

  useEffect(() => {
    const fetchCargo = async () => {
      if (authLoading) return;
      if (!userProfile) { navigate('/selecao-projeto', { replace: true }); return; }
      try {
        if (!isAdmin) {
          const { data: row } = await supabase.from('cargos').select('*').eq('nome', userProfile.funcao).maybeSingle();
          if (row) setCargoData(mapCargoRow(row));
        }
      } catch {
        // falha silenciosa — usuário verá opções sem permissão
      } finally {
        setLoading(false);
      }
    };
    fetchCargo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userProfile?.id, userProfile?.funcao]);

  const hasPermission = (opcao) => {
    if (isAdmin) return true;
    if (opcao.permissao === null) return true;
    return !!cargoData?.[opcao.permissao];
  };

  const opcoesVisiveis = OPCOES.filter(o => isAdmin || hasPermission(o));

  if (authLoading || loading) return (
    <div className="nt-page-bg min-h-screen flex items-center justify-center relative">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent relative z-10" />
    </div>
  );

  if (!isAdmin && opcoesVisiveis.length === 0) return (
    <div className="nt-page-bg min-h-screen flex items-center justify-center p-6 relative">
      <div className="text-center max-w-xs relative z-10">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
          <Lock size={26} className="text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-txt mb-2">Acesso Restrito</h1>
        <p className="text-txt-faint text-sm mb-7">Você não tem permissão para acessar esta área.</p>
        <button
          onClick={() => navigate('/selecao-projeto')}
          className="flex items-center gap-2 mx-auto text-sm text-brand-lite hover:text-txt transition-colors"
        >
          <ArrowLeft size={15} /> Voltar para projetos
        </button>
      </div>
    </div>
  );

  return (
    <div className="nt-page-bg min-h-screen text-txt font-[Outfit,sans-serif] relative overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-hairline backdrop-blur-md" style={{ background: 'rgba(9, 22, 11, 0.6)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-txt-dim hover:text-txt transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/[0.05] group-hover:bg-white/[0.1] flex items-center justify-center transition-colors">
              <ArrowLeft size={15} />
            </div>
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <span className="text-sm font-medium text-txt-dim">Área de Gerência</span>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 relative z-10">
        <div className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-txt">Olá, {primeiroNome}</h1>
          <p className="text-txt-faint mt-2 text-sm">Selecione uma área para gerenciar.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {opcoesVisiveis.map(opcao => {
            const Icon = opcao.icon;
            const enabled = hasPermission(opcao);
            return (
              <button
                key={opcao.id}
                onClick={() => enabled && navigate(opcao.path)}
                disabled={!enabled}
                className={`group relative text-left p-6 rounded-2xl border transition-all duration-200 ${
                  enabled
                    ? `${opcao.bg} hover:scale-[1.02] hover:shadow-xl cursor-pointer`
                    : 'bg-white/[0.02] border-hairline opacity-40 cursor-not-allowed'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 border ${
                  enabled ? `${opcao.bg}` : 'bg-white/5 border-hairline'
                }`}>
                  {enabled
                    ? <Icon size={20} className={opcao.cor} />
                    : <Lock size={18} className="text-txt-faint" />
                  }
                </div>
                <h3 className="font-semibold text-txt mb-1.5">{opcao.titulo}</h3>
                <p className="text-xs text-txt-faint leading-relaxed">{opcao.descricao}</p>
                {enabled && (
                  <ChevronRight
                    size={15}
                    className={`absolute top-6 right-6 ${opcao.cor} opacity-0 group-hover:opacity-100 transition-opacity`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default Gerencia;
