import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, RotateCcw, AlertTriangle, FolderX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import ActivityLogger from '../services/activityLogger';

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
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
  }, [authLoading, userProfile?.uid, userProfile?.funcao]);

  const fetchDeleted = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'projetos'));
      const deleted = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.deletedAt);
      // sort by deletedAt desc
      deleted.sort((a, b) => {
        const ta = a.deletedAt?.toDate?.() ?? new Date(a.deletedAt);
        const tb = b.deletedAt?.toDate?.() ?? new Date(b.deletedAt);
        return tb - ta;
      });
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
      await updateDoc(doc(db, 'projetos', projeto.id), {
        deletedAt: null,
        deletedBy: null,
      });
      ActivityLogger.projectRestored(projeto.nome, userProfile?.uid, userProfile?.nome);
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
      await deleteDoc(doc(db, 'projetos', projeto.id));
      ActivityLogger.projectDeleted(projeto.nome, userProfile?.uid, userProfile?.nome);
      setProjetos(prev => prev.filter(p => p.id !== projeto.id));
    } catch {
      showError('Erro ao excluir o projeto. Tente novamente.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white font-[Outfit,sans-serif] relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl pointer-events-none" />

      {toast && (
        <div className="fixed top-5 right-5 z-[300] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-red-500/30">
          <span className="font-medium text-sm text-white">{toast}</span>
        </div>
      )}

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
            <div className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/20 flex items-center justify-center">
              <Trash2 size={14} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Lixeira</p>
              <p className="text-[10px] text-gray-600 leading-tight">Projetos excluídos recentemente</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {loading ? (
          <div className="py-24 flex items-center justify-center">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-red-400 border-t-transparent" />
          </div>
        ) : projetos.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/20 flex items-center justify-center">
              <FolderX size={28} className="text-gray-700" />
            </div>
            <div>
              <p className="text-gray-400 font-semibold">Lixeira vazia</p>
              <p className="text-gray-700 text-sm mt-1">Nenhum projeto foi excluído.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-600 mb-4">{projetos.length} projeto{projetos.length !== 1 ? 's' : ''} na lixeira</p>
            {projetos.map(projeto => (
              <div
                key={projeto.id}
                className="flex items-center gap-4 px-5 py-4 bg-white/10 border border-white/20 rounded-2xl hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={16} className="text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{projeto.nome}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Excluído em {formatDate(projeto.deletedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRestore(projeto)}
                    disabled={working === projeto.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#57B952]/10 border border-[#57B952]/20 text-[#57B952] hover:bg-[#57B952]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
          <div className="bg-gray-800 border border-white/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} className="text-red-400" />
            </div>
            <h3 className="text-base font-bold text-white text-center mb-2">Excluir permanentemente?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              O projeto <span className="text-white font-semibold">"{confirmPerm.nome}"</span> será removido para sempre. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmPerm(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/20 text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors"
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
