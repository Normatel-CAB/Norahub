import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ArrowLeft, CheckCircle, Users2, UserMinus, Lock,
  UsersRound, Layers, FolderPlus, LayoutTemplate, Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const PERMISSOES = [
  { id: 'canManageUsers',          label: 'Gerenciar Usuários',    icon: Users2        },
  { id: 'canDeleteUsers',          label: 'Excluir Usuários',      icon: UserMinus     },
  { id: 'canManagePermissions',    label: 'Atribuir Projetos',     icon: Lock          },
  { id: 'canManageProjectMembers', label: 'Gerenciar Membros',     icon: UsersRound    },
  { id: 'canChangeCarteiras',      label: 'Alterar Setores',       icon: Layers        },
  { id: 'canCreateCargos',         label: 'Criar Cargos',          icon: Shield        },
  { id: 'canCreateProjetos',       label: 'Criar Projetos',        icon: FolderPlus    },
  { id: 'canEditCardsProjetos',    label: 'Editar Cards',          icon: LayoutTemplate },
];

export default function MinhasCarteiras() {
  const { userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [cargoData, setCargoData] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = userProfile?.funcao === 'admin';
  const nomeCargo = userProfile?.funcao || 'Colaborador';

  useEffect(() => {
    if (authLoading) return;
    if (!userProfile) { navigate('/selecao-projeto', { replace: true }); return; }

    if (isAdmin) {
      setCargoData({
        nome: 'Administrador',
        descricao: 'Acesso total ao sistema',
        status: 'ativo',
        canManageUsers: true,
        canDeleteUsers: true,
        canManagePermissions: true,
        canManageProjectMembers: true,
        canChangeCarteiras: true,
        canCreateCargos: true,
        canCreateProjetos: true,
        canEditCardsProjetos: true,
      });
      setLoading(false);
      return;
    }

    const fetchCargo = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'cargos'), where('nome', '==', nomeCargo))
        );
        if (!snap.empty) {
          setCargoData(snap.docs[0].data());
        }
      } catch {
        // falha silenciosa
      } finally {
        setLoading(false);
      }
    };

    fetchCargo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userProfile?.uid, userProfile?.funcao]);

  const permsAtivas = PERMISSOES.filter(p => cargoData?.[p.id]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#57B952] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white font-[Outfit,sans-serif] relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#57B952]/8 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-gray-900/70 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
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
              <p className="text-sm font-semibold text-white leading-tight">Meu Cargo</p>
              <p className="text-[10px] text-gray-500 leading-tight">Função e permissões no sistema</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* Card do cargo */}
        <div className="bg-white/[0.05] border border-white/[0.10] rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
              <Shield size={24} className="text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white">{cargoData?.nome || nomeCargo}</h1>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  cargoData?.status === 'inativo'
                    ? 'bg-red-500/15 text-red-400 border-red-500/20'
                    : 'bg-[#57B952]/15 text-[#57B952] border-[#57B952]/20'
                }`}>
                  {cargoData?.status === 'inativo' ? 'Inativo' : 'Ativo'}
                </span>
              </div>
              {cargoData?.descricao ? (
                <p className="text-sm text-gray-400 mt-1">{cargoData.descricao}</p>
              ) : (
                <p className="text-sm text-gray-600 mt-1 italic">Sem descrição cadastrada.</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
              <Shield size={16} className="text-purple-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{permsAtivas.length}</p>
              <p className="text-xs text-gray-500">Permissões ativas</p>
            </div>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#57B952]/15 border border-[#57B952]/20 flex items-center justify-center">
              <CheckCircle size={16} className="text-[#57B952]" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{PERMISSOES.length}</p>
              <p className="text-xs text-gray-500">Total possível</p>
            </div>
          </div>
        </div>

        {/* Permissões */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06]">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Permissões do Cargo</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {PERMISSOES.map(perm => {
              const active = !!cargoData?.[perm.id];
              const Icon = perm.icon;
              return (
                <div
                  key={perm.id}
                  className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${active ? '' : 'opacity-40'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    active ? 'bg-[#57B952]/20' : 'bg-white/[0.05]'
                  }`}>
                    <Icon size={14} className={active ? 'text-[#57B952]' : 'text-gray-600'} />
                  </div>
                  <p className={`text-sm font-medium flex-1 ${active ? 'text-white' : 'text-gray-600'}`}>
                    {perm.label}
                  </p>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    active ? 'bg-[#57B952]' : 'bg-white/[0.06] border border-white/[0.10]'
                  }`}>
                    {active && <CheckCircle size={11} className="text-white" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info */}
        {!cargoData && !isAdmin && (
          <div className="flex items-start gap-3 px-4 py-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
            <Info size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 leading-relaxed">
              Seu cargo <strong>"{nomeCargo}"</strong> ainda não está cadastrado no sistema. Contate um administrador para regularizar.
            </p>
          </div>
        )}

      </main>
    </div>
  );
}
