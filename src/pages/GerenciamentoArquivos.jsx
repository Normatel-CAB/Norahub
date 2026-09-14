import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, File, Trash2, Download, Eye, Folder, FolderPlus, Edit2, ChevronRight, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { notifyFileUpload } from '../services/notifications';
import ActivityLogger from '../services/activityLogger';

const BUCKET = 'projetos';

function GerenciamentoArquivos() {
  const location = useLocation();
  const navigate = useNavigate();
  const { card, projeto } = location.state || {};
  const { userProfile, currentUser } = useAuth();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingItem, setRenamingItem] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState({ show: false, type: '', item: null });

  useEffect(() => {
    if (!card || !projeto) {
      navigate(-1);
      return;
    }
    loadFilesAndFolders();
  }, [card, projeto, currentPath]);

  // Caminho base "achatado" dentro do bucket `projetos` (o bucket já substitui o
  // antigo prefixo "projetos/" do Firebase Storage).
  const getBasePath = () => `${projeto.id}/cards/${card.name}${currentPath ? '/' + currentPath : ''}`;

  const loadFilesAndFolders = async () => {
    setLoading(true);
    try {
      const basePath = getBasePath();
      const { data: entries, error } = await supabase.storage.from(BUCKET).list(basePath, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw error;

      // No Supabase Storage, pastas aparecem como entradas com id === null
      const fileEntries = (entries || []).filter(e => e.id !== null && e.name !== '.placeholder');
      const folderEntries = (entries || []).filter(e => e.id === null);

      const filesData = await Promise.all(
        fileEntries.map(async (item) => {
          const fullPath = `${basePath}/${item.name}`;
          const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(fullPath, 3600);
          return {
            name: item.name,
            fullPath,
            url: signed?.signedUrl || '',
            type: 'file',
            uploadedAt: item.created_at ? new Date(item.created_at) : new Date(),
          };
        })
      );

      const foldersData = folderEntries.map((item) => ({
        name: item.name,
        fullPath: `${basePath}/${item.name}`,
        type: 'folder',
      }));

      setFiles(filesData);
      setFolders(foldersData);
    } catch (error) {
      console.error('Erro ao carregar arquivos e pastas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      showToast('Digite um nome para a pasta', 'error');
      return;
    }

    try {
      // Um arquivo .placeholder força a "pasta" a existir (Supabase Storage não
      // tem pastas reais — são só prefixos de caminho).
      const folderPath = `${getBasePath()}/${newFolderName}/.placeholder`;
      const placeholderBlob = new Blob([''], { type: 'text/plain' });
      const { error } = await supabase.storage.from(BUCKET).upload(folderPath, placeholderBlob, { upsert: true });
      if (error) throw error;

      setNewFolderName('');
      setIsCreatingFolder(false);
      await loadFilesAndFolders();
      showToast('Pasta criada com sucesso!', 'success');

      // Registrar atividade
      const userName = userProfile?.nome || currentUser?.user_metadata?.full_name || 'Usuário';
      await ActivityLogger.folderCreated(newFolderName, card.name, projeto.nome, currentUser?.id, userName);
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
      showToast('Erro ao criar pasta', 'error');
    }
  };

  const handleNavigateToFolder = (folderName) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
  };

  const handleNavigateUp = () => {
    if (!currentPath) return;
    const pathParts = currentPath.split('/');
    pathParts.pop();
    setCurrentPath(pathParts.join('/'));
  };

  const handleNavigateToRoot = () => {
    setCurrentPath('');
  };

  const handleNavigateToBreadcrumb = (index) => {
    const pathParts = currentPath.split('/');
    const newPath = pathParts.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
  };

  const getBreadcrumbs = () => {
    if (!currentPath) return [];
    return currentPath.split('/');
  };

  const openDeleteConfirm = (type, item) => {
    setConfirmDelete({ show: true, type, item });
  };

  const closeDeleteConfirm = () => {
    setConfirmDelete({ show: false, type: '', item: null });
  };

  const confirmDeleteAction = async () => {
    const { type, item } = confirmDelete;
    closeDeleteConfirm();
    
    if (type === 'file') {
      await handleDeleteFile(item);
    } else if (type === 'folder') {
      await handleDeleteFolder(item);
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      const basePath = getBasePath();
      for (const file of selectedFiles) {
        // Validar tamanho do arquivo (máx 10MB)
        if (file.size > 10 * 1024 * 1024) {
          showToast(`Arquivo ${file.name} é muito grande (máx 10MB)`, 'error');
          continue;
        }

        const { error } = await supabase.storage.from(BUCKET).upload(`${basePath}/${file.name}`, file, {
          upsert: true,
          contentType: file.type,
        });
        if (error) throw error;
      }

      await loadFilesAndFolders();
      showToast('Arquivo(s) enviado(s) com sucesso!', 'success');

      // Registrar atividade no dashboard
      const userName = userProfile?.nome || currentUser?.user_metadata?.full_name || 'Usuário';
      for (const file of selectedFiles) {
        await ActivityLogger.fileUploaded(file.name, card.name, projeto.nome, currentUser?.id, userName);
      }

      // Notificar gerentes do projeto sobre o upload
      try {
        const { data: gerentes } = await supabase.from('usuarios').select('id').eq('funcao', 'gerente');
        const managerIds = (gerentes || []).map(u => u.id);

        if (managerIds.length > 0) {
          const uploaderName = userProfile?.nome || 'Um usuário';
          await notifyFileUpload(managerIds, selectedFiles[0].name, uploaderName, projeto.id);
        }
      } catch (notifError) {
        console.error('Erro ao enviar notificação:', notifError);
      }
    } catch (error) {
      console.error('Erro completo ao fazer upload:', error);
      showToast('Erro ao enviar arquivo(s).', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (filePath) => {
    try {
      const fileName = filePath.split('/').pop();
      const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
      if (error) throw error;
      await loadFilesAndFolders();
      showToast('Arquivo excluído com sucesso!', 'success');

      // Registrar atividade
      const userName = userProfile?.nome || currentUser?.user_metadata?.full_name || 'Usuário';
      await ActivityLogger.fileDeleted(fileName, card.name, projeto.nome, currentUser?.id, userName);
    } catch (error) {
      console.error('Erro ao excluir arquivo:', error);
      showToast('Erro ao excluir arquivo.', 'error');
    }
  };

  // Lista recursivamente todos os caminhos de arquivo sob um prefixo (pastas no
  // Supabase Storage são só prefixos — não existe operação nativa "deletar pasta").
  const listAllFilesRecursive = async (prefix) => {
    const { data: entries, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
    if (error) throw error;
    let paths = [];
    for (const item of entries || []) {
      const itemPath = `${prefix}/${item.name}`;
      if (item.id === null) {
        const sub = await listAllFilesRecursive(itemPath);
        paths = paths.concat(sub);
      } else {
        paths.push(itemPath);
      }
    }
    return paths;
  };

  const handleDeleteFolder = async (folderPath) => {
    try {
      const allPaths = await listAllFilesRecursive(folderPath);
      if (allPaths.length > 0) {
        const { error } = await supabase.storage.from(BUCKET).remove(allPaths);
        if (error) throw error;
      }

      // Aguarda um momento antes de recarregar
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadFilesAndFolders();

      if (allPaths.length > 0) {
        showToast(`Pasta excluída com sucesso! (${allPaths.length} arquivo(s))`, 'success');
      } else {
        showToast('Pasta vazia foi removida.', 'success');
      }
    } catch (error) {
      console.error('Erro ao excluir pasta:', error);
      showToast('Erro ao excluir pasta.', 'error');
      await loadFilesAndFolders(); // Recarrega mesmo com erro
    }
  };

  const startRename = (item) => {
    setRenamingItem(item);
    setRenameValue(item.name);
  };

  const handleRename = async () => {
    if (!renameValue.trim() || renameValue === renamingItem.name) {
      setRenamingItem(null);
      return;
    }

    try {
      if (renamingItem.type === 'file') {
        const pathParts = renamingItem.fullPath.split('/');
        pathParts[pathParts.length - 1] = renameValue;
        const newPath = pathParts.join('/');

        const { error } = await supabase.storage.from(BUCKET).move(renamingItem.fullPath, newPath);
        if (error) throw error;

        showToast('Arquivo renomeado com sucesso!', 'success');
      } else {
        // Para pastas, move cada arquivo (recursivamente) pro novo prefixo
        await renameFolderRecursive(renamingItem.fullPath, renameValue);
        showToast('Pasta renomeada com sucesso!', 'success');
      }

      setRenamingItem(null);
      await loadFilesAndFolders();
    } catch (error) {
      console.error('Erro ao renomear:', error);
      showToast('Erro ao renomear.', 'error');
    }
  };

  const renameFolderRecursive = async (oldFolderPath, newFolderName) => {
    const allPaths = await listAllFilesRecursive(oldFolderPath);

    const pathParts = oldFolderPath.split('/');
    pathParts[pathParts.length - 1] = newFolderName;
    const newBasePath = pathParts.join('/');

    for (const oldPath of allPaths) {
      const relativePath = oldPath.slice(oldFolderPath.length); // já começa com '/'
      const newPath = newBasePath + relativePath;
      const { error } = await supabase.storage.from(BUCKET).move(oldPath, newPath);
      if (error) throw error;
    }
  };

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    if (['pdf'].includes(extension)) return '📄';
    if (['doc', 'docx'].includes(extension)) return '📝';
    if (['xls', 'xlsx'].includes(extension)) return '📊';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) return '🖼️';
    if (['zip', 'rar'].includes(extension)) return '📦';
    return '📁';
  };

  if (!card || !projeto) return null;

  return (
    <div className="nt-page-bg min-h-screen w-full flex flex-col font-[Outfit,Poppins] relative">
      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-brand' : 'bg-red-500'} text-white`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="relative w-full flex items-center justify-between py-3 md:py-6 px-3 md:px-8 border-b border-hairline backdrop-blur-md min-h-[56px] md:h-20 z-10" style={{ background: 'rgba(9, 22, 11, 0.6)' }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 md:gap-2 text-txt-faint hover:text-brand-lite transition-colors font-medium text-xs md:text-sm shrink-0"
        >
          <ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />
          <span className="hidden sm:inline">Voltar</span>
        </button>
        <h1 className="text-base md:text-2xl font-bold text-txt truncate px-2">{card.name}</h1>
        <div className="w-12 md:w-20 shrink-0"></div>
      </header>

      {/* Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-3 md:p-8 relative z-10">
        <div className="nt-glass rounded-2xl p-4 md:p-8">
          {/* Breadcrumb Navigation */}
          <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleNavigateToRoot}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors text-sm ${!currentPath ? 'bg-blue-500/20 text-blue-300 font-semibold' : 'hover:bg-white/10 text-txt-dim'}`}
                title="Voltar para raiz"
              >
                <Home size={16} />
                <span className="hidden sm:inline">Raiz</span>
              </button>
              {getBreadcrumbs().map((folder, index) => (
                <div key={index} className="flex items-center gap-2">
                  <ChevronRight size={16} className="text-txt-dim" />
                  <button
                    onClick={() => handleNavigateToBreadcrumb(index)}
                    className={`px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${index === getBreadcrumbs().length - 1 ? 'bg-brand/20 text-brand-lite' : 'text-txt-dim hover:bg-white/5'}`}
                  >
                    {folder}
                  </button>
                </div>
              ))}
            </div>

            {currentPath && (
              <button
                onClick={handleNavigateUp}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium text-txt-dim"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Voltar</span>
              </button>
            )}
          </div>

          {/* Actions Bar */}
          <div className="mb-6 md:mb-8 flex flex-wrap gap-3">
            <label className="flex-1 min-w-[200px] flex flex-col items-center justify-center h-32 border-2 border-dashed border-hairline rounded-xl cursor-pointer hover:border-brand transition-colors bg-white/5 hover:bg-brand/10">
              <div className="flex flex-col items-center justify-center">
                <Upload className="w-8 h-8 mb-2 text-txt-dim" />
                <p className="text-xs text-txt-faint">
                  <span className="font-semibold">Upload de Arquivos</span>
                </p>
                <p className="text-[10px] text-txt-dim">Máx. 10MB por arquivo</p>
              </div>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>

            <div className="flex-1 min-w-[200px] h-32 border-2 border-dashed border-blue-500/40 rounded-xl bg-blue-500/10">
              {!isCreatingFolder ? (
                <button
                  onClick={() => setIsCreatingFolder(true)}
                  className="w-full h-full flex flex-col items-center justify-center hover:bg-blue-500/20 transition-colors rounded-xl"
                >
                  <FolderPlus className="w-8 h-8 mb-2 text-blue-400" />
                  <p className="text-xs text-blue-400 font-semibold">Nova Pasta</p>
                </button>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 gap-2">
                  <input
                    type="text"
                    placeholder="Nome da pasta"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                    className="w-full px-3 py-2 rounded-lg border border-blue-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={handleCreateFolder}
                      className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold"
                    >
                      Criar
                    </button>
                    <button
                      onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
                      className="flex-1 px-3 py-1.5 bg-white/10 text-txt-dim rounded-lg hover:bg-white/15 text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {uploading && (
            <div className="mb-4 text-center text-brand-lite font-semibold">
              Enviando arquivo(s)...
            </div>
          )}

          {/* Files and Folders List */}
          <div>
            <h2 className="text-xl font-bold text-txt mb-4">
              {currentPath ? `Pasta: ${currentPath.split('/').pop()}` : 'Todos os arquivos'} ({folders.length + files.length} itens)
            </h2>

            {loading ? (
              <div className="text-center py-12 text-txt-faint">Carregando...</div>
            ) : folders.length === 0 && files.length === 0 ? (
              <div className="text-center py-12 text-txt-dim">
                <File size={48} className="mx-auto mb-3 opacity-30" />
                <p>Pasta vazia</p>
                <p className="text-xs mt-2">Crie uma pasta ou faça upload de arquivos</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {/* Folders First */}
                {folders.map((folder, idx) => (
                  <div 
                    key={`folder-${idx}`}
                    className="border border-blue-500/30 rounded-lg p-3 md:p-4 hover:shadow-md transition-shadow bg-blue-500/10 hover:bg-blue-500/15 cursor-pointer"
                  >
                    {renamingItem?.fullPath === folder.fullPath ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleRename()}
                          className="w-full px-2 py-1 rounded border border-blue-400 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleRename}
                            className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs font-semibold"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setRenamingItem(null)}
                            className="flex-1 px-2 py-1 bg-white/10 text-txt-dim rounded text-xs font-semibold"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-2 md:mb-3">
                          <div
                            className="flex items-center gap-2 flex-1 cursor-pointer"
                            onClick={() => handleNavigateToFolder(folder.name)}
                          >
                            <Folder className="w-8 h-8 text-blue-400" />
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                startRename(folder); 
                              }}
                              className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center bg-white/10 shadow-sm backdrop-blur-sm"
                              title="Renomear pasta"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                openDeleteConfirm('folder', folder.fullPath); 
                              }}
                              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center bg-white/10 shadow-sm hover:shadow-md backdrop-blur-sm"
                              title="Excluir pasta e todo conteúdo"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <p 
                          className="text-sm font-medium text-blue-300 truncate cursor-pointer"
                          title={folder.name}
                          onClick={() => handleNavigateToFolder(folder.name)}
                        >
                          📁 {folder.name}
                        </p>
                      </>
                    )}
                  </div>
                ))}
                
                {/* Files */}
                {files.map((file, idx) => (
                  <div
                    key={`file-${idx}`}
                    className="nt-glass rounded-lg p-3 md:p-4 hover:shadow-md transition-shadow"
                  >
                    {renamingItem?.fullPath === file.fullPath ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleRename()}
                          className="w-full px-2 py-1 rounded border border-hairline focus:ring-2 focus:ring-brand outline-none text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleRename}
                            className="flex-1 px-2 py-1 bg-gradient-to-r from-brand-lite via-brand to-brand-deep text-white rounded text-xs font-semibold"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setRenamingItem(null)}
                            className="flex-1 px-2 py-1 bg-white/10 text-txt-dim rounded text-xs font-semibold"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-2 md:mb-3">
                          <div className="text-2xl md:text-3xl">{getFileIcon(file.name)}</div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => navigate('/visualizador-arquivo', { state: { fileUrl: file.url, fileName: file.name } })}
                              className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                              title="Visualizar"
                            >
                              <Eye size={16} />
                            </button>
                            <a
                              href={file.url}
                              download
                              className="p-1.5 text-brand-lite hover:bg-brand/20 rounded transition-colors"
                              title="Baixar"
                            >
                              <Download size={16} />
                            </a>
                            <button
                              onClick={() => startRename(file)}
                              className="p-1.5 text-txt-dim hover:bg-white/10 rounded transition-colors"
                              title="Renomear"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => openDeleteConfirm('file', file.fullPath)}
                              className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-txt-dim truncate" title={file.name}>
                          {file.name}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal de Confirmação de Exclusão */}
      {confirmDelete.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="nt-glass rounded-xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <Trash2 size={24} className="text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-txt">
                Confirmar Exclusão
              </h3>
            </div>

            <p className="text-txt-faint mb-6">
              {confirmDelete.type === 'folder'
                ? 'Deseja realmente excluir esta pasta e todo seu conteúdo? Esta ação não pode ser desfeita.'
                : 'Deseja realmente excluir este arquivo? Esta ação não pode ser desfeita.'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={closeDeleteConfirm}
                className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-txt-dim rounded-lg font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteAction}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
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

export default GerenciamentoArquivos;
