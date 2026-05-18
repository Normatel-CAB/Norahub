import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Save, Trash2, Users } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import Alert from '../components/Alert';

function AdminProjetos() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const [projetos, setProjetos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingLoading, setSavingLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [projetoSelecionado, setProjetoSelecionado] = useState(null);
  const [membrosAdicionados, setMembrosAdicionados] = useState([]);
  const [usuarioParaAdicionar, setUsuarioParaAdicionar] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [projSnapshot, userSnapshot] = await Promise.all([
        getDocs(collection(db, 'projetos')),
        getDocs(collection(db, 'usuarios')),
      ]);
      setProjetos(projSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setUsuarios(userSnapshot.docs.map(d => ({ id: d.id, uid: d.data()?.uid || d.id, ...d.data() })));
    } catch (error) {
      setAlertInfo({ message: 'Erro ao carregar dados.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (projeto) => {
    setProjetoSelecionado(projeto);
    const membrosExistentes = (projeto.membros || []).map(m => String(m));
    setMembrosAdicionados(membrosExistentes);
    setUsuarioParaAdicionar('');
    setModalOpen(true);
  };

  const fecharModal = () => {
    setModalOpen(false);
    setProjetoSelecionado(null);
    setMembrosAdicionados([]);
    setUsuarioParaAdicionar('');
  };

  const adicionarMembro = () => {
    if (!usuarioParaAdicionar) {
      setAlertInfo({ message: 'Selecione um usuário para adicionar.', type: 'warning' });
      return;
    }
    if (membrosAdicionados.includes(usuarioParaAdicionar)) {
      setAlertInfo({ message: 'Este usuário já foi adicionado.', type: 'warning' });
      return;
    }
    setMembrosAdicionados(prev => [...prev, usuarioParaAdicionar]);
    setUsuarioParaAdicionar('');
    setAlertInfo(null);
  };

  const removerMembro = (userId) => {
    setMembrosAdicionados(prev => prev.filter(id => id !== userId));
  };

  const salvarMembros = async () => {
    if (!projetoSelecionado) return;

    setSavingLoading(true);
    try {
      await updateDoc(doc(db, 'projetos', projetoSelecionado.id), {
        membros: membrosAdicionados,
      });
      setProjetos(prev =>
        prev.map(p => p.id === projetoSelecionado.id ? { ...p, membros: membrosAdicionados } : p)
      );
      setAlertInfo({ message: 'Membros atualizados com sucesso!', type: 'success' });
      setTimeout(fecharModal, 1500);
    } catch (error) {
      setAlertInfo({ message: `Erro ao salvar: ${error.message}`, type: 'error' });
    } finally {
      setSavingLoading(false);
    }
  };

  const getNomeUsuario = (memberId) => {
    const memberIdStr = String(memberId);
    const user = usuarios.find(u => String(u.uid || u.id) === memberIdStr);
    return user ? `${user.nome} (${user.email})` : 'Usuário desconhecido';
  };

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 transition-colors duration-200 relative text-white">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl"></div>
      </div>
      {alertInfo && <Alert message={alertInfo.message} type={alertInfo.type} onClose={() => setAlertInfo(null)} />}

      <header className="relative w-full flex items-center justify-center py-3 md:py-6 px-3 md:px-8 border-b border-gray-700 min-h-[56px] md:h-20 bg-gray-900/50">
        <button onClick={() => navigate('/admin')} className="absolute left-3 md:left-8 flex items-center gap-1 md:gap-2 text-gray-500 hover:text-[#57B952] transition-colors font-medium text-xs md:text-sm shrink-0 z-10">
          <ArrowLeft size={16} className="md:w-5 md:h-5" />
          <span className="hidden sm:inline">Voltar</span>
        </button>
        <div className="flex items-center justify-center">
          <img 
            src={isDark ? "/img/Normatel Engenharia_BRANCO.png" : "/img/Normatel Engenharia_PRETO.png"} 
            alt="Logo" 
            className="h-6 sm:h-8 md:h-10 w-auto object-contain drop-shadow-lg" 
          />
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center p-3 md:p-8">
        <div className="w-full max-w-6xl">
          <div className="mb-4 md:mb-8">
            <h1 className="text-xl md:text-3xl font-bold text-white flex items-center gap-2">
              <Users className="text-[#57B952]" size={24} /> Gerenciar Membros dos Projetos
            </h1>
            <p className="text-gray-500 mt-2">Defina quais usuários podem visualizar cada projeto.</p>
          </div>

          {loading ? (
            <div className="text-center py-20 text-gray-500">Carregando projetos...</div>
          ) : projetos.length === 0 ? (
            <div className="text-center py-20 bg-white/10 backdrop-blur-md rounded-xl shadow border border-white/20 text-gray-300">
              <p className="text-gray-500">Nenhum projeto cadastrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projetos.map((projeto) => (
                <div key={projeto.id} className="bg-white/10 backdrop-blur-md rounded-lg shadow-md border border-white/20 p-6 text-white">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{projeto.nome}</h3>
                      <p className="text-sm text-gray-500 mt-1">{projeto.descricao || '-'}</p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-300 mb-2">
                      Membros: <span className="font-bold text-[#57B952]">{(projeto.membros || []).length}</span>
                    </p>
                    {(projeto.membros || []).length > 0 && (
                      <ul className="text-xs text-gray-300 space-y-1 bg-white/10 p-2 rounded">
                        {projeto.membros.map(userId => (
                          <li key={userId} className="truncate">• {getNomeUsuario(userId)}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <button 
                    onClick={() => abrirModal(projeto)}
                    className="w-full px-4 py-2 bg-[#57B952] hover:bg-green-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={16} /> Gerenciar Membros
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal de Gerenciamento de Membros */}
      {modalOpen && projetoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 mx-4 max-h-[90vh] overflow-y-auto border border-gray-700 text-white">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Membros: {projetoSelecionado.nome}</h2>
              <button onClick={fecharModal} className="text-gray-600 hover:text-red-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Adicionar Usuário</label>
              <div className="flex gap-2">
                <select
                  value={usuarioParaAdicionar}
                  onChange={(e) => {
                    console.log('Usuário selecionado:', e.target.value);
                    setUsuarioParaAdicionar(e.target.value);
                  }}
                  className="flex-1 px-3 py-2 rounded-lg border border-white/20 bg-white/10 text-white focus:ring-2 focus:ring-[#57B952] outline-none text-sm placeholder-gray-400"
                >
                  <option value="">Selecione um usuário... ({usuarios.filter(u => !membrosAdicionados.includes(String(u.uid || u.id))).length} disponíveis)</option>
                  {usuarios
                    .filter(u => !membrosAdicionados.includes(String(u.uid || u.id)))
                    .map(u => (
                      <option key={u.uid || u.id} value={u.uid || u.id}>
                        {u.nome} ({u.email})
                      </option>
                    ))}
                </select>
                <button
                  onClick={adicionarMembro}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Membros Atuais ({membrosAdicionados.length})</label>
              {membrosAdicionados.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nenhum membro adicionado</p>
              ) : (
                <div className="space-y-2 bg-white/5 p-3 rounded-lg max-h-64 overflow-y-auto">
                  {membrosAdicionados.map(userId => (
                    <div key={userId} className="flex items-center justify-between p-2 bg-white/10 rounded border border-white/20 text-white">
                      <span className="text-sm text-white">{getNomeUsuario(userId)}</span>
                      <button
                        onClick={() => removerMembro(userId)}
                        className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={fecharModal}
                disabled={savingLoading}
                className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={salvarMembros}
                disabled={savingLoading}
                className="flex-1 py-2 rounded-lg bg-[#57B952] hover:bg-green-600 text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={16} /> Salvar ({membrosAdicionados.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminProjetos;
