import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Eye, Settings, FileText, Download, Upload, X, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../services/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sendEmailToCollaborator } from '../services/notifications';

function ConstrutorFormulario() {
  const location = useLocation();
  const navigate = useNavigate();
  const { card, projeto } = location.state || {};
  const { userProfile, currentUser } = useAuth();

  const [mode, setMode] = useState('preview');
  const [formFields, setFormFields] = useState([]);
  const [formResponses, setFormResponses] = useState([]);
  const [currentResponse, setCurrentResponse] = useState({});
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [notificationEmails, setNotificationEmails] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const loadFormFields = async () => {
    setLoading(true);
    try {
      const projetoDoc = await getDoc(doc(db, 'projetos', projeto.id));
      if (!projetoDoc.exists()) {
        showToast('Projeto não encontrado', 'error');
        navigate(-1);
        return;
      }

      const projetoData = projetoDoc.data();
      const extras = projetoData.extras || [];
      const formData = extras.find(e => e.name === card.name) || {};

      const loadedFields = formData.formFields || [];
      const loadedResponses = formData.formResponses || [];
      
      // Log para debug
      console.log('✅ Formulário carregado:', {
        campos: loadedFields.length,
        respostas: loadedResponses.length,
        respostasData: loadedResponses
      });

      setFormFields(loadedFields);
      setFormResponses(loadedResponses);
      setEmailNotifications(!!formData.emailNotifications);
      setNotificationEmails(formData.notificationEmails || '');

      const userFuncao = userProfile?.funcao || userProfile?.role;
      const userCanEdit = !!(
        projetoData.ownerId === currentUser?.uid ||
        formData.createdBy === currentUser?.uid ||
        userFuncao === 'admin' ||
        userFuncao === 'gerente-projeto' ||
        userFuncao === 'gerente-usuario' ||
        userFuncao === 'colaborador' ||
        typeof userFuncao === 'string'
      );
      setCanEdit(userCanEdit);
      setMode(userCanEdit ? 'builder' : 'preview');
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      showToast('Erro ao carregar formulário', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!card || !projeto) {
      navigate(-1);
      return;
    }
    // Recarrega quando dados do usuário chegarem para garantir que admin/owner tenha permissão
    loadFormFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.name, projeto?.id, currentUser?.uid, userProfile?.role]);
  const sendEmailNotification = async (responseName, responseData) => {
    if (!emailNotifications || !notificationEmails.trim()) return;

    const emails = notificationEmails.split(',').map(e => e.trim()).filter(e => e);
    if (emails.length === 0) return;

    try {
      console.log('📧 Iniciando envio de notificações via Resend...');
      console.log('Destinatários:', emails);

      // Formatar respostas do formulário
      let formattedResponses = '';
      formFields.forEach(field => {
        const answer = responseData.answers[field.id];
        let answerText = '';

        if (field.type === 'file' && Array.isArray(answer) && answer[0]?.url) {
          answerText = answer.map(file => `📎 ${file.name}: ${file.url}`).join('\n');
        } else if (Array.isArray(answer)) {
          answerText = answer.join(', ');
        } else {
          answerText = answer || '-';
        }

        formattedResponses += `\n${field.label}:\n${answerText}\n`;
      });

      const subject = `Nova resposta no formulário: ${card.name}`;
      const submittedDate = new Date(responseData.submittedAt).toLocaleString('pt-BR');
      const actionUrl = typeof window !== 'undefined' ? window.location.href : '';
      const message = [
        `Respondido por: ${responseName || 'Anônimo'}`,
        `Projeto: ${projeto?.nome || 'NoraHub'}`,
        `Enviado em: ${submittedDate}`,
        '',
        'Respostas:',
        formattedResponses
      ].join('\n');

      await Promise.all(
        emails.map(email =>
          sendEmailToCollaborator({
            email,
            title: subject,
            message,
            actionUrl
          })
        )
      );

      showToast('Notificações enviadas via Resend!', 'success');
    } catch (error) {
      console.error('Erro ao enviar notificações via Resend:', error);
      showToast('Erro ao enviar notificações por email.', 'error');
    }
  };
  const submitResponse = async () => {
    // Validar campos obrigatórios
    const missingFields = formFields.filter(f => {
      if (!f.required) return false;
      const value = currentResponse[f.id];
      if (!value) return true;
      if (f.type === 'file' && Array.isArray(value)) return value.length === 0;
      return false;
    });
    if (missingFields.length > 0) {
      showToast('Por favor, preencha todos os campos obrigatórios', 'error');
      return;
    }

    setSaving(true);
    try {
      const projetoDoc = await getDoc(doc(db, 'projetos', projeto.id));
      const projetoData = projetoDoc.data();
      
      const responseId = Date.now();
      const processedAnswers = { ...currentResponse };

      // Processar uploads de arquivos
      for (const [fieldId, value] of Object.entries(currentResponse)) {
        const field = formFields.find(f => f.id.toString() === fieldId.toString());
        if (field && field.type === 'file' && Array.isArray(value) && value.length > 0) {
          try {
            const uploadedUrls = [];
            for (const file of value) {
              if (file instanceof File) {
                const storagePath = `projetos/${projeto.id}/forms/${card.name}/responses/${responseId}/${file.name}`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(storageRef);
                uploadedUrls.push({ name: file.name, url: downloadURL, type: file.type });
              }
            }
            processedAnswers[fieldId] = uploadedUrls;
          } catch (uploadError) {
            console.error('Erro ao fazer upload dos arquivos:', uploadError);
            showToast('Erro ao fazer upload dos arquivos', 'error');
            setSaving(false);
            return;
          }
        }
      }
      
      const newResponse = {
        id: responseId,
        submittedAt: new Date().toISOString(),
        submittedBy: currentUser.email,
        userName: userProfile?.nome || currentUser.displayName || 'Anônimo',
        answers: processedAnswers
      };

      const updatedExtras = projetoData.extras.map(e => 
        e.name === card.name 
          ? { 
              ...e, 
              formResponses: [...(e.formResponses || []), newResponse]
            } 
          : e
      );

      await updateDoc(doc(db, 'projetos', projeto.id), {
        extras: updatedExtras,
        updatedAt: new Date()
      });

      showToast('Resposta enviada com sucesso!', 'success');
      
      // Enviar notificação por email se configurado
      console.log('🔔 Verificando notificações...');
      console.log('Email notifications ativo:', emailNotifications);
      console.log('Emails configurados:', notificationEmails);
      
      if (emailNotifications && notificationEmails) {
        await sendEmailNotification(
          newResponse.userName,
          newResponse
        );
      } else {
        console.log('⚠️ Notificações não configuradas ou desativadas');
      }
      
      setCurrentResponse({});
      await loadFormFields();
      setMode('responses');
    } catch (error) {
      console.error('Erro ao enviar resposta:', error);
      showToast('Erro ao enviar resposta', 'error');
    } finally {
      setSaving(false);
    }
  };

  const exportToCSV = () => {
    if (formResponses.length === 0) {
      showToast('Nenhuma resposta para exportar', 'error');
      return;
    }

    // Criar cabeçalho CSV
    const headers = ['Data/Hora', 'Usuário', ...formFields.map(f => f.label)];
    
    // Criar linhas CSV
    const rows = formResponses.map(response => [
      new Date(response.submittedAt).toLocaleString('pt-BR'),
      response.userName,
      ...formFields.map(f => {
        const answer = response.answers[f.id];
        if (f.type === 'file' && Array.isArray(answer) && answer[0]?.url) {
          return answer.map(file => file.url).join('; ');
        }
        return Array.isArray(answer) ? answer.join('; ') : (answer || '');
      })
    ]);

    // Combinar tudo
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${card.name}_respostas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showToast('Arquivo CSV baixado!', 'success');
  };

  const addField = () => {
    setFormFields([...formFields, {
      id: Date.now(),
      label: '',
      type: 'text',
      required: false,
      options: []
    }]);
  };

  const updateField = (id, key, value) => {
    setFormFields(formFields.map(f => 
      f.id === id ? { ...f, [key]: value } : f
    ));
  };

  const removeField = (id) => {
    setFormFields(formFields.filter(f => f.id !== id));
  };

  const saveForm = async () => {
    if (formFields.length === 0) {
      showToast('Adicione pelo menos um campo ao formulário', 'error');
      return;
    }

    setSaving(true);
    try {
      const projetoDoc = await getDoc(doc(db, 'projetos', projeto.id));
      const projetoData = projetoDoc.data();
      
      const updatedExtras = projetoData.extras.map(e => 
        e.name === card.name 
          ? { ...e, formFields, emailNotifications, notificationEmails } 
          : e
      );

      await updateDoc(doc(db, 'projetos', projeto.id), {
        extras: updatedExtras,
        updatedAt: new Date()
      });

      showToast('Formulário salvo com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao salvar formulário:', error);
      showToast('Erro ao salvar formulário', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fieldTypes = [
    { value: 'text', label: 'Texto curto' },
    { value: 'textarea', label: 'Texto longo' },
    { value: 'number', label: 'Número' },
    { value: 'email', label: 'E-mail' },
    { value: 'tel', label: 'Telefone' },
    { value: 'date', label: 'Data' },
    { value: 'link', label: 'Link (com texto customizável)' },
    { value: 'file', label: 'Upload de Arquivo/Foto' },
    { value: 'select', label: 'Seleção única' },
    { value: 'checkbox', label: 'Múltipla escolha' },
    { value: 'radio', label: 'Escolha única (opções)' }
  ];

  if (!card || !projeto) return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <p className="text-gray-600">Carregando formulário...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl"></div>
      </div>
      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="w-full flex items-center justify-between py-3 md:py-6 px-3 md:px-8 border-b border-gray-700 bg-gray-900/50 min-h-[56px]">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-1 md:gap-2 text-gray-500 hover:text-[#57B952] transition-colors font-medium text-xs md:text-sm shrink-0"
        >
          <ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" /> <span className="hidden xs:inline">Voltar</span>
        </button>
        
        <h1 className="text-sm md:text-xl lg:text-2xl font-bold text-white absolute left-1/2 transform -translate-x-1/2 max-w-[50%] truncate">{card.name}</h1>
        
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={() => setMode('builder')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors font-medium text-sm ${
                mode === 'builder' ? 'bg-[#57B952] text-white border-[#57B952]' : 'border-white/20 text-gray-300 hover:bg-white/10'
              }`}
            >
              <Settings size={16} /> Editar
            </button>
          )}

          <button
            onClick={() => setMode('preview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors font-medium text-sm ${
              mode === 'preview' ? 'bg-[#57B952] text-white border-[#57B952]' : 'border-white/20 text-gray-300 hover:bg-white/10'
            }`}
          >
            <Eye size={16} /> Preencher
          </button>

          {canEdit && (
            <button
              onClick={() => setMode('responses')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors font-medium text-sm ${
                mode === 'responses' ? 'bg-[#57B952] text-white border-[#57B952]' : 'border-white/20 text-gray-300 hover:bg-white/10'
              }`}
            >
              <FileText size={16} /> Respostas ({formResponses.length})
            </button>
          )}
          
          {mode === 'builder' && canEdit && (
            <button
              onClick={saveForm}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
            >
              <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-3 md:p-8">
        {mode === 'builder' ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-4 md:p-8 border border-white/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-3">
              <h2 className="text-lg md:text-xl font-bold text-white">Construtor de Formulário</h2>
              <button
                onClick={addField}
                className="flex items-center gap-2 bg-[#57B952] hover:bg-green-600 text-white px-3 md:px-4 py-2 rounded-lg transition-colors font-medium text-sm w-full sm:w-auto justify-center"
              >
                <Plus size={16} /> Adicionar Campo
              </button>
            </div>

            {/* Configurações de Notificação */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                  />
                  <span className="font-medium text-gray-300">📧 Ativar notificações por email</span>
                </label>
              </div>
              {emailNotifications && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Emails para notificação (separados por vírgula)
                  </label>
                  <input
                    type="text"
                    placeholder="email1@exemplo.com, email2@exemplo.com"
                    value={notificationEmails}
                    onChange={(e) => setNotificationEmails(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Estes emails receberão uma notificação sempre que alguém responder o formulário
                  </p>
                </div>
              )}
            </div>

            {formFields.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p>Nenhum campo adicionado ainda</p>
                <p className="text-sm mt-2">Clique em "Adicionar Campo" para começar</p>
              </div>
            ) : (
              <div className="space-y-4">
                {formFields.map((field, idx) => (
                  <div key={field.id} className="border border-white/20 rounded-lg p-4 bg-white/5 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-400">Campo {idx + 1}</span>
                      <button
                        onClick={() => removeField(field.id)}
                        className="text-red-400 hover:bg-red-500/10 p-1 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Rótulo / Pergunta</label>
                        <input
                          type="text"
                          placeholder="Ex: Qual seu nome?"
                          value={field.label}
                          onChange={(e) => updateField(field.id, 'label', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#57B952] outline-none text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Campo</label>
                        <select
                          value={field.type}
                          onChange={(e) => updateField(field.id, 'type', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#57B952] outline-none text-sm"
                        >
                          {fieldTypes.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(field.id, 'required', e.target.checked)}
                            className="w-4 h-4 text-[#57B952] focus:ring-[#57B952] rounded"
                          />
                          <span className="text-sm text-gray-300">Campo obrigatório</span>
                        </label>
                      </div>

                      {(['select', 'radio', 'checkbox'].includes(field.type)) && (
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Opções (separadas por vírgula)
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Sim, Não, Talvez"
                            value={field.options.join(', ')}
                            onChange={(e) => updateField(field.id, 'options', e.target.value.split(',').map(o => o.trim()))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#57B952] outline-none text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : mode === 'preview' ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-gray-100 mb-6">{card.name}</h2>
            <p className="text-gray-300 mb-8">{card.description || 'Preencha os campos abaixo'}</p>

            {formFields.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p>Nenhum campo foi criado ainda</p>
                <p className="text-sm mt-2">Vá para "Editar" para adicionar campos</p>
              </div>
            ) : (
              <div className="space-y-6">
                {formFields.map((field) => (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>

                    {field.type === 'textarea' ? (
                      <textarea
                        rows="4"
                        placeholder="Sua resposta..."
                        value={currentResponse[field.id] || ''}
                        onChange={(e) => setCurrentResponse({...currentResponse, [field.id]: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#57B952] outline-none"
                      />
                    ) : field.type === 'select' ? (
                      <select 
                        value={currentResponse[field.id] || ''}
                        onChange={(e) => setCurrentResponse({...currentResponse, [field.id]: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#57B952] outline-none"
                      >
                        <option value="">Selecione...</option>
                        {field.options.map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'radio' ? (
                      <div className="space-y-2">
                        {field.options.map((opt, i) => (
                          <label key={i} className="flex items-center gap-2">
                            <input 
                              type="radio" 
                              name={`field-${field.id}`} 
                              value={opt}
                              checked={currentResponse[field.id] === opt}
                              onChange={(e) => setCurrentResponse({...currentResponse, [field.id]: e.target.value})}
                              className="text-[#57B952]" 
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <div className="space-y-2">
                        {field.options.map((opt, i) => (
                          <label key={i} className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              value={opt}
                              checked={(currentResponse[field.id] || []).includes(opt)}
                              onChange={(e) => {
                                const current = currentResponse[field.id] || [];
                                const updated = e.target.checked
                                  ? [...current, opt]
                                  : current.filter(v => v !== opt);
                                setCurrentResponse({...currentResponse, [field.id]: updated});
                              }}
                              className="text-[#57B952] rounded" 
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'file' ? (
                      <div className="space-y-3">
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.add('border-[#57B952]', 'bg-green-50');
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.classList.remove('border-[#57B952]', 'bg-green-50');
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('border-[#57B952]', 'bg-green-50');
                            const files = Array.from(e.dataTransfer.files);
                            const validFiles = files.filter(file => {
                              if (file.size > 10 * 1024 * 1024) {
                                showToast(`Arquivo ${file.name} muito grande! Máximo: 10MB`, 'error');
                                return false;
                              }
                              return true;
                            });
                            if (validFiles.length > 0) {
                              const current = currentResponse[field.id] || [];
                              setCurrentResponse({...currentResponse, [field.id]: [...current, ...validFiles]});
                            }
                          }}
                          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center transition-all hover:border-[#57B952] hover:bg-green-50 cursor-pointer"
                        >
                          <input
                            type="file"
                            id={`file-${field.id}`}
                            multiple
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                            onChange={(e) => {
                              const files = Array.from(e.target.files);
                              const validFiles = files.filter(file => {
                                if (file.size > 10 * 1024 * 1024) {
                                  showToast(`Arquivo ${file.name} muito grande! Máximo: 10MB`, 'error');
                                  return false;
                                }
                                return true;
                              });
                              if (validFiles.length > 0) {
                                const current = currentResponse[field.id] || [];
                                setCurrentResponse({...currentResponse, [field.id]: [...current, ...validFiles]});
                              }
                            }}
                            className="hidden"
                          />
                          <label htmlFor={`file-${field.id}`} className="cursor-pointer">
                            <Upload className="mx-auto mb-3 text-[#57B952]" size={40} />
                            <p className="text-gray-300 font-medium mb-1">Clique ou arraste arquivos aqui</p>
                            <p className="text-sm text-gray-500">Suporta imagens, PDFs e documentos (máx 10MB cada)</p>
                          </label>
                        </div>

                        {/* Preview dos arquivos */}
                        {currentResponse[field.id] && currentResponse[field.id].length > 0 && (
                          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {currentResponse[field.id].map((file, idx) => (
                              <div key={idx} className="relative group">
                                <div className="aspect-square rounded-lg overflow-hidden bg-white/10 border-2 border-white/20">
                                  {file.type?.startsWith('image/') ? (
                                    <img
                                      src={URL.createObjectURL(file)}
                                      alt={file.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-3">
                                      <FileText size={32} className="text-gray-400 mb-2" />
                                      <p className="text-xs text-gray-600 text-center truncate w-full">{file.name}</p>
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = currentResponse[field.id].filter((_, i) => i !== idx);
                                    setCurrentResponse({...currentResponse, [field.id]: updated});
                                  }}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                                >
                                  <X size={16} />
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <p className="text-xs text-white truncate">{file.name}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : field.type === 'link' ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-2">URL/Endereço</label>
                          <input 
                            type="text"
                            placeholder="https://exemplo.com ou /pagina-interna"
                            value={currentResponse[field.id]?.url || ''}
                            onChange={(e) => setCurrentResponse({...currentResponse, [field.id]: {...(currentResponse[field.id] || {}), url: e.target.value}})}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#57B952] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-2">Texto do Link</label>
                          <input 
                            type="text"
                            placeholder="Ex: Clique aqui, Ver mais, Acessar portal"
                            value={currentResponse[field.id]?.text || ''}
                            onChange={(e) => setCurrentResponse({...currentResponse, [field.id]: {...(currentResponse[field.id] || {}), text: e.target.value}})}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#57B952] outline-none"
                          />
                        </div>
                        {(currentResponse[field.id]?.url || currentResponse[field.id]?.text) && (
                          <div className="p-3 bg-[#57B952]/10 rounded-lg border border-[#57B952]/30">
                            <p className="text-xs text-gray-400 mb-2">Prévia do link:</p>
                            <a 
                              href={currentResponse[field.id]?.url || '#'} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[#57B952] hover:text-green-400 underline break-all"
                            >
                              {currentResponse[field.id]?.text || currentResponse[field.id]?.url || 'Link'}
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        type={field.type}
                        placeholder="Sua resposta..."
                        value={currentResponse[field.id] || ''}
                        onChange={(e) => setCurrentResponse({...currentResponse, [field.id]: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#57B952] outline-none"
                      />
                    )}
                  </div>
                ))}

                <button 
                  onClick={submitResponse}
                  disabled={saving}
                  className="w-full bg-[#57B952] hover:bg-green-600 text-white py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  {saving ? 'Enviando...' : 'Enviar Respostas'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-100">
                Respostas Recebidas ({formResponses.length})
              </h2>
              {formResponses.length > 0 && (
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 bg-[#57B952] hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
                >
                  <Download size={16} /> Exportar CSV
                </button>
              )}
            </div>

            {formResponses.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p>Nenhuma resposta recebida ainda</p>
              </div>
            ) : (
              <div className="space-y-6">
                {formResponses.length > 0 && formResponses.map((response, idx) => (
                  <div key={response.id || idx} className="border border-white/20 rounded-lg p-6 bg-white/5 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                      <div>
                        <p className="font-semibold text-white">{response.userName || 'Usuário'}</p>
                        <p className="text-xs text-gray-400">
                          {response.submittedAt ? new Date(response.submittedAt).toLocaleString('pt-BR') : 'Data não disponível'}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-gray-400">Resposta #{idx + 1}</span>
                    </div>

                    <div className="space-y-3">
                      {formFields && formFields.length > 0 ? (
                        formFields.map(field => {
                          // Tenta acessar a resposta pelo ID do campo
                          const answer = response.answers?.[field.id];
                          const isFileField = field.type === 'file';
                          const isFileArray = isFileField && Array.isArray(answer) && answer.length > 0 && typeof answer[0] === 'object' && answer[0].url;
                          
                          return (
                            <div key={field.id}>
                              <p className="text-sm font-medium text-gray-400 mb-2">{field.label}</p>
                              {isFileArray ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {answer.map((file, fileIdx) => (
                                    <a
                                      key={fileIdx}
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group relative aspect-square rounded-lg overflow-hidden bg-white/10 backdrop-blur-xl border-2 border-white/20 hover:border-[#57B952] transition-all"
                                    >
                                      {file.type?.startsWith('image/') ? (
                                        <img
                                          src={file.url}
                                          alt={file.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center p-3">
                                          <FileText size={32} className="text-gray-400 mb-2" />
                                          <p className="text-xs text-gray-600 text-center truncate w-full">{file.name}</p>
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                        <Download className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
                                      </div>
                                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                        <p className="text-xs text-white truncate">{file.name}</p>
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-200 mt-1">
                                  {Array.isArray(answer) 
                                    ? answer.length > 0 ? answer.join(', ') : '-'
                                    : answer ? String(answer) : '-'}
                                </p>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-gray-500 italic">Nenhum campo disponível para exibir respostas</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default ConstrutorFormulario;
