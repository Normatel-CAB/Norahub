import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ArrowLeft, CheckCircle, Users2, UserMinus, Lock,
  UsersRound, Layers, FolderPlus, LayoutTemplate, Info,
} from 'lucide-react';
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
        const { data: row } = await supabase.from('cargos').select('*').eq('nome', nomeCargo).maybeSingle();
        if (row) setCargoData(mapCargoRow(row));
      } catch {
        // falha silenciosa
      } finally {
        setLoading(false);
      }
    };

    fetchCargo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userProfile?.id, userProfile?.funcao]);

  const permsAtivas = PERMISSOES.filter(p => cargoData?.[p.id]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center nt-page-bg">
        <div className="relative z-10 animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen nt-page-bg text-txt font-[Outfit,sans-serif] relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand/8 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-hairline bg-surface-card/80 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-txt-dim hover:text-txt transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-surface-2 group-hover:bg-hairline-hi/20 flex items-center justify-center transition-colors">
              <ArrowLeft size={15} />
            </div>
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <div className="h-4 w-px bg-hairline" />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/25 flex items-center justify-center">
              <Shield size={15} className="text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-txt leading-tight">Meu Cargo</p>
              <p className="text-[10px] text-txt-faint leading-tight">Função e permissões no sistema</p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* Card do cargo */}
        <div className="nt-glass p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
              <Shield size={24} className="text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-txt">{cargoData?.nome || nomeCargo}</h1>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  cargoData?.status === 'inativo'
                    ? 'bg-red-500/15 text-red-400 border-red-500/20'
                    : 'bg-brand/15 text-brand-lite border-brand/20'
                }`}>
                  {cargoData?.status === 'inativo' ? 'Inativo' : 'Ativo'}
                </span>
              </div>
              {cargoData?.descricao ? (
                <p className="text-sm text-txt-dim mt-1">{cargoData.descricao}</p>
              ) : (
                <p className="text-sm text-txt-faint mt-1 italic">Sem descrição cadastrada.</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="nt-glass p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
              <Shield size={16} className="text-purple-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-txt">{permsAtivas.length}</p>
              <p className="text-xs text-txt-faint">Permissões ativas</p>
            </div>
          </div>
          <div className="nt-glass p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/15 border border-brand/20 flex items-center justify-center">
              <CheckCircle size={16} className="text-brand-lite" />
            </div>
            <div>
              <p className="text-xl font-bold text-txt">{PERMISSOES.length}</p>
              <p className="text-xs text-txt-faint">Total possível</p>
            </div>
          </div>
        </div>

        {/* Permissões */}
        <div className="nt-glass overflow-hidden">
          <div className="px-5 py-3.5 border-b border-hairline">
            <p className="text-xs font-semibold text-txt-faint uppercase tracking-wider">Permissões do Cargo</p>
          </div>
          <div className="divide-y divide-hairline">
            {PERMISSOES.map(perm => {
              const active = !!cargoData?.[perm.id];
              const Icon = perm.icon;
              return (
                <div
                  key={perm.id}
                  className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${active ? '' : 'opacity-40'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    active ? 'bg-brand/20' : 'bg-surface-2'
                  }`}>
                    <Icon size={14} className={active ? 'text-brand-lite' : 'text-txt-faint'} />
                  </div>
                  <p className={`text-sm font-medium flex-1 ${active ? 'text-txt' : 'text-txt-faint'}`}>
                    {perm.label}
                  </p>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    active ? 'bg-brand' : 'bg-surface-2 border border-hairline'
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
