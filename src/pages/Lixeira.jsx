import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, RotateCcw, AlertTriangle, FolderX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import ActivityLogger from '../services/activityLogger';

function mapProjetoRow(row) {
  return {
    id: row.id,
    nome: row.nome,
    ativa: row.ativa,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.data || {}),
  };
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Lixeira() {
  const { userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.funcao === 'admin';

  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmPerm, setConfirmPerm] = useState(null);
  const [working, setWorking] = useState(null);
  const [toast, setToast] = useState('');

  const showError = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!userProfile) { navigate('/selecao-projeto', { replace: true }); return; }
    const canAccess = isAdmin || userProfile.funcao?.toLowerCase().includes('gerente');
    if (!canAccess) { navigate('/selecao-projeto', { replace: true }); return; }
    fetchDeleted();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userProfile?.id, userProfile?.funcao]);

  const fetchDeleted = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('projetos').select('*');
      if (error) throw error;
      const deleted = (data || []).map(mapProjetoRow).filter(p => p.deletedAt);
      deleted.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
      setProjetos(deleted);
    } catch {
      setProjetos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (projeto) => {
    setWorking(projeto.id);
    try {
      const { data: existingRow, error: fetchErr } = await supabase.from('projetos').select('data').eq('id', projeto.id).maybeSingle();
      if (fetchErr) throw fetchErr;
      const { deletedAt, deletedBy, ...rest } = existingRow?.data || {};
      const { error } = await supabase.from('projetos').update({ data: rest }).eq('id', projeto.id);
      if (error) throw error;
      ActivityLogger.projectRestored(projeto.nome, userProfile?.id, userProfile?.nome);
      setProjetos(prev => prev.filter(p => p.id !== projeto.id));
    } catch {
      showError('Erro ao restaurar o projeto. Tente novamente.');
    } finally {
      setWorking(null);
    }
  };

  const handlePermanentDelete = async (projeto) => {
    setWorking(projeto.id);
    setConfirmPerm(null);
    try {
      const { error } = await supabase.from('projetos').delete().eq('id', projeto.id);
      if (error) throw error;
      ActivityLogger.projectDeleted(projeto.nome, userProfile?.id, userProfile?.nome);
      setProjetos(prev => prev.filter(p => p.id !== projeto.id));
    } catch {
      showError('Erro ao excluir o projeto. Tente novamente.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="nt-page-bg min-h-screen text-txt font-[Outfit,sans-serif] relative overflow-hidden">
      {toast && (
        <div className="fixed top-5 right-5 z-[300] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-xl bg-surface-card border-red-500/30">
          <span className="font-medium text-sm text-txt">{toast}</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-hairline backdrop-blur-md" style={{ background: 'rgba(9, 22, 11, 0.6)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-txt-dim hover:text-txt transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/[0.05] group-hover:bg-white/[0.1] flex items-center justify-center transition-colors">
              <ArrowLeft size={15} />
            </div>
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <div className="h-4 w-px bg-hairline" />
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/20 flex items-center justify-center">
              <Trash2 size={14} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-txt leading-tight">Lixeira</p>
              <p className="text-[10px] text-txt-faint leading-tight">Projetos excluídos recentemente</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 relative z-10">

        {loading ? (
          <div className="py-24 flex items-center justify-center">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-red-400 border-t-transparent" />
          </div>
        ) : projetos.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-hairline flex items-center justify-center">
              <FolderX size={28} className="text-txt-faint" />
            </div>
            <div>
              <p className="text-txt-dim font-semibold">Lixeira vazia</p>
              <p className="text-txt-faint text-sm mt-1">Nenhum projeto foi excluído.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-txt-faint mb-4">{projetos.length} projeto{projetos.length !== 1 ? 's' : ''} na lixeira</p>
            {projetos.map(projeto => (
              <div
                key={projeto.id}
                className="nt-glass flex items-center gap-4 px-5 py-4 rounded-2xl hover:border-hairline-hi transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={16} className="text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-txt truncate">{projeto.nome}</p>
                  <p className="text-xs text-txt-faint mt-0.5">
                    Excluído em {formatDate(projeto.deletedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRestore(projeto)}
                    disabled={working === projeto.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand/10 border border-brand/20 text-brand-lite hover:bg-brand/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RotateCcw size={12} />
                    Restaurar
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setConfirmPerm(projeto)}
                      disabled={working === projeto.id}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={12} />
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal de confirmação de exclusão permanente */}
      {confirmPerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="nt-glass rounded-2xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} className="text-red-400" />
            </div>
            <h3 className="text-base font-bold text-txt text-center mb-2">Excluir permanentemente?</h3>
            <p className="text-sm text-txt-faint text-center mb-6">
              O projeto <span className="text-txt font-semibold">"{confirmPerm.nome}"</span> será removido para sempre. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmPerm(null)}
                className="flex-1 py-2.5 rounded-xl border border-hairline text-sm text-txt-dim hover:text-txt hover:bg-white/[0.05] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handlePermanentDelete(confirmPerm)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-semibold text-white transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Lixeira;
