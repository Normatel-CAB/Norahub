import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Shield, Briefcase, ChevronRight, Lock, Activity, Trash2, TrendingUp, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

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
    cor: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
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
    titulo: 'Carteiras & Setores',
    descricao: 'Gerenciar setores, adicionar links e atribuir carteiras aos colaboradores',
    icon: Layers,
    path: '/admin-carteiras',
    cor: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
    permissao: 'canChangeCarteiras',
  },
];

function Gerencia() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [cargoData, setCargoData] = useState(null);
  const [loading, setLoading] = useState(true);

  const primeiroNome = userProfile?.nome?.split(' ')[0] || 'Usuário';
  const isAdmin = userProfile?.funcao === 'admin';

  useEffect(() => {
    const fetchCargo = async () => {
      if (!userProfile) return;
      try {
        if (!isAdmin) {
          const snap = await getDocs(
            query(collection(db, 'cargos'), where('nome', '==', userProfile.funcao))
          );
          if (!snap.empty) setCargoData(snap.docs[0].data());
        }
      } catch {
        // falha silenciosa — usuário verá opções sem permissão
      } finally {
        setLoading(false);
      }
    };
    fetchCargo();
  }, [userProfile, isAdmin]);

  const hasPermission = (opcao) => {
    if (isAdmin) return true;
    if (opcao.permissao === null) return true;
    return !!cargoData?.[opcao.permissao];
  };

  const opcoesVisiveis = OPCOES.filter(o => isAdmin || hasPermission(o));

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#57B952] border-t-transparent" />
    </div>
  );

  if (!isAdmin && opcoesVisiveis.length === 0) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="text-center max-w-xs">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
          <Lock size={26} className="text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Acesso Restrito</h1>
        <p className="text-gray-500 text-sm mb-7">Você não tem permissão para acessar esta área.</p>
        <button
          onClick={() => navigate('/selecao-projeto')}
          className="flex items-center gap-2 mx-auto text-sm text-[#57B952] hover:text-white transition-colors"
        >
          <ArrowLeft size={15} /> Voltar para projetos
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white font-[Outfit,sans-serif] relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl pointer-events-none" />
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/20 bg-gray-900/50 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/[0.05] group-hover:bg-white/[0.1] flex items-center justify-center transition-colors">
              <ArrowLeft size={15} />
            </div>
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <span className="text-sm font-medium text-gray-400">Área de Gerência</span>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Olá, {primeiroNome}</h1>
          <p className="text-gray-500 mt-2 text-sm">Selecione uma área para gerenciar.</p>
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
                    : 'bg-white/[0.02] border-white/[0.06] opacity-40 cursor-not-allowed'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 border ${
                  enabled ? `${opcao.bg}` : 'bg-white/5 border-white/10'
                }`}>
                  {enabled
                    ? <Icon size={20} className={opcao.cor} />
                    : <Lock size={18} className="text-gray-600" />
                  }
                </div>
                <h3 className="font-semibold text-white mb-1.5">{opcao.titulo}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{opcao.descricao}</p>
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
