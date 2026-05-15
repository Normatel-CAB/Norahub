import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Calendar, MoreVertical, ChevronDown, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { migrateUsersCollection } from '../services/migrationService';

function GerenciaUsuarios() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState(null);
  const [cargos, setCargos] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [editingCargo, setEditingCargo] = useState({ userId: null, cargo: '' });
  const [migratingData, setMigratingData] = useState(false);

  const primeiroNome = userProfile?.nome?.split(' ')[0] || currentUser?.displayName?.split(' ')[0] || 'Usuário';

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    fetchData();
  }, [userProfile]);

  const fetchData = async () => {
    try {
      // Buscar usuários
      const usuariosSnapshot = await getDocs(collection(db, 'usuarios'));
      let usuariosList = usuariosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      console.log('Usuários carregados:', usuariosList);
      console.log('Função do usuário logado:', userProfile?.funcao);

      // Se NÃO é admin, filtrar para não mostrar admins e administrador geral
      const isAdmin = userProfile?.funcao === 'admin';
      if (!isAdmin) {
        usuariosList = usuariosList.filter(u => {
          const funcao = u.funcao?.toLowerCase();
          return funcao !== 'admin' && funcao !== 'administrador geral';
        });
        console.log('Usuários após filtro (sem admins):', usuariosList);
      }

      setUsuarios(usuariosList);

      // Buscar cargos
      const cargosSnapshot = await getDocs(collection(db, 'cargos'));
      let cargosList = cargosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Se NÃO é admin, filtrar para não mostrar cargo 'admin' e 'administrador geral'
      if (!isAdmin) {
        cargosList = cargosList.filter(c => {
          const nome = c.nome?.toLowerCase();
          return nome !== 'admin' && nome !== 'administrador geral';
        });
      }
      
      setCargos(cargosList);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (userId) => {
    try {
      await updateDoc(doc(db, 'usuarios', userId), {
        statusAcesso: 'ativo'
      });
      showToast('Usuário aprovado com sucesso!', 'success');
      fetchData();
    } catch (error) {
      console.error('Erro ao aprovar usuário:', error);
      showToast('Erro ao aprovar usuário!', 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Tem certeza que deseja deletar este usuário?')) {
      try {
        await deleteDoc(doc(db, 'usuarios', userId));
        showToast('Usuário deletado com sucesso!', 'success');
        fetchData();
      } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        showToast('Erro ao deletar usuário!', 'error');
      }
    }
  };

  const handleUpdateCargo = async (userId, novoCargo) => {
    try {
      await updateDoc(doc(db, 'usuarios', userId), {
        funcao: novoCargo
      });
      showToast('Cargo alterado com sucesso!', 'success');
      setEditingCargo({ userId: null, cargo: '' });
      fetchData();
    } catch (error) {
      console.error('Erro ao atualizar cargo:', error);
      showToast('Erro ao atualizar cargo!', 'error');
    }
  };

  const startEditingCargo = (userId, currentCargo) => {
    setEditingCargo({ userId, cargo: currentCargo });
  };

  const cancelEditingCargo = () => {
    setEditingCargo({ userId: null, cargo: '' });
  };

  const saveCargoChange = async (userId) => {
    if (!editingCargo.cargo) {
      showToast('Selecione um cargo!', 'error');
      return;
    }
    await handleUpdateCargo(userId, editingCargo.cargo);
  };

  const handleMigrateData = async () => {
    if (!window.confirm('Tem certeza? Isso vai importar os usuários antigos do Firebase para o novo sistema.')) {
      return;
    }
    
    setMigratingData(true);
    try {
      // Primeiro tenta com a Cloud Function
      try {
        const result = await migrateUsersCollection();
        showToast(`Migração realizada! ${result.count} usuários importados.`, 'success');
      } catch (functionError) {
        console.log('Cloud Function não disponível, usando migração local...', functionError);
        // Se a Cloud Function não estiver disponível, faz migração local
        const batch = writeBatch(db);
        const usersSnapshot = await getDocs(collection(db, 'users'));
        
        if (usersSnapshot.empty) {
          showToast('Nenhum usuário para importar.', 'info');
          setMigratingData(false);
          return;
        }

        let count = 0;
        const errors = [];
        
        usersSnapshot.forEach(userDoc => {
          try {
            const userData = userDoc.data();
            const docRef = doc(db, 'usuarios', userDoc.id);
            batch.set(docRef, userData, { merge: true });
            count++;
          } catch (err) {
            errors.push(`Erro ao processar ${userDoc.id}: ${err.message}`);
          }
        });

        try {
          await batch.commit();
          if (errors.length > 0) {
            console.warn('Erros durante a migração:', errors);
            showToast(`Migração parcial! ${count} usuários importados com ${errors.length} erros.`, 'success');
          } else {
            showToast(`Migração realizada! ${count} usuários importados.`, 'success');
          }
        } catch (batchError) {
          console.error('Erro ao confirmar batch:', batchError);
          // Se ainda assim der erro de permissão, mostra mensagem específica
          if (batchError.message?.includes('permission')) {
            showToast('Erro de permissão no Firestore. Verifique as Firestore Rules.', 'error');
          } else {
            showToast('Erro ao migrar dados: ' + batchError.message, 'error');
          }
          setMigratingData(false);
          return;
        }
      }

      // Recarrega os dados
      setTimeout(() => {
        fetchData();
      }, 1000);
    } catch (error) {
      console.error('Erro na migração:', error);
      showToast('Erro ao migrar dados: ' + error.message, 'error');
    } finally {
      setMigratingData(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#57B952]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="w-full flex items-center justify-between py-3 md:py-6 px-3 md:px-8 border-b border-gray-700 bg-gray-900/50 min-h-[56px] text-white">
        <button
          onClick={() => navigate('/gerencia')}
          className="flex items-center gap-1 md:gap-2 text-gray-500 hover:text-[#57B952] transition-colors font-medium text-xs md:text-sm shrink-0"
        >
          <ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" /> <span className="hidden sm:inline">Voltar</span>
        </button>

        <div className="text-center flex-1">
          <h1 className="text-lg md:text-2xl font-bold text-white">Gestão de Usuários</h1>
        </div>

        <div className="w-16"></div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center p-3 md:p-8">
        <div className="w-full max-w-6xl">
          <div className="mb-4 md:mb-8">
            <p className="text-gray-500">
              Total de usuários: <span className="font-bold text-white">{usuarios.length}</span>
            </p>
          </div>

          {usuarios.length === 0 ? (
            <div className="text-center py-20 bg-white/10 backdrop-blur-md rounded-xl shadow border border-white/20 text-gray-300">
              <p className="text-gray-500 mb-4">Nenhum usuário cadastrado.</p>
              <button
                onClick={handleMigrateData}
                disabled={migratingData}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                {migratingData ? 'Importando usuários...' : 'Importar Usuários do Firebase'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {usuarios.map((usuario) => (
                <div
                  key={usuario.id}
                  className="bg-white/10 backdrop-blur-md rounded-lg shadow border border-white/20 overflow-hidden"
                >
                  <div
                    className="p-6 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors text-white"
                    onClick={() => setExpandedUser(expandedUser === usuario.id ? null : usuario.id)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-full bg-[#57B952] flex items-center justify-center text-white font-bold">
                        {usuario.nome?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-white">{usuario.nome}</h3>
                        <p className="text-sm text-gray-500">{usuario.email}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                          {usuario.funcao}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          {usuario.statusAcesso === 'ativo' ? '✓ Ativo' : '⏳ Pendente'}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      size={20}
                      className={`text-gray-400 transition-transform ${expandedUser === usuario.id ? 'rotate-180' : ''}`}
                    />
                  </div>

                  {expandedUser === usuario.id && (
                    <div className="border-t border-gray-700 p-6 bg-white/5">
                      <div className="space-y-4">
                        {/* Alterar Cargo */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Alterar Cargo
                          </label>
                          {(usuario.funcao === 'admin' || usuario.funcao?.toLowerCase() === 'administrador geral') && userProfile?.funcao !== 'admin' ? (
                            <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-between">
                              <span>{usuario.funcao}</span>
                              <span className="text-xs text-gray-500">🔒 Apenas admins podem alterar</span>
                            </div>
                          ) : (
                            <select
                              value={editingCargo.userId === usuario.id ? editingCargo.cargo : usuario.funcao || ''}
                              onChange={(e) => setEditingCargo({ userId: usuario.id, cargo: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#57B952] focus:border-transparent"
                            >
                              <option value="">Selecione um cargo</option>
                              {cargos.map((cargo) => (
                                <option key={cargo.id} value={cargo.nome}>
                                  {cargo.nome}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Botões Salvar/Cancelar */}
                        {editingCargo.userId === usuario.id && editingCargo.cargo !== usuario.funcao && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => saveCargoChange(usuario.id)}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                              <Check size={18} /> Salvar Alteração
                            </button>
                            <button
                              onClick={cancelEditingCargo}
                              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                              <X size={18} /> Cancelar
                            </button>
                          </div>
                        )}

                        {/* Aprovar/Rejeitar */}
                        {usuario.statusAcesso === 'pendente' && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleApproveUser(usuario.id)}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                              <Check size={18} /> Aprovar
                            </button>
                            <button
                              onClick={() => handleDeleteUser(usuario.id)}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                              <X size={18} /> Rejeitar
                            </button>
                          </div>
                        )}

                        {/* Deletar */}
                        {usuario.statusAcesso === 'ativo' && (
                          <button
                            onClick={() => handleDeleteUser(usuario.id)}
                            className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                          >
                            Deletar Usuário
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-gray-300 text-xs border-t border-gray-700 bg-gray-900/50">
        &copy; 2025 Parceria Petrobras & Normatel Engenharia
      </footer>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-8 right-8 z-50 animate-slide-up">
          <div
            className={`px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            <span className="text-2xl">
              {toast.type === 'success' ? '✓' : '✕'}
            </span>
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default GerenciaUsuarios;
