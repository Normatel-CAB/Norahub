import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Registra uma atividade no sistema para o Dashboard
 * @param {string} action - Ação realizada (ex: 'project_created', 'file_uploaded', 'form_submitted')
 * @param {string} title - Título da atividade
 * @param {string} description - Descrição detalhada
 * @param {string} userId - ID do usuário que realizou a ação
 * @param {string} userName - Nome do usuário
 * @param {string} type - Tipo de atividade para o ícone (form_response, file_upload, approval, etc)
 * @param {object} metadata - Dados adicionais (opcional)
 */
export const logActivity = async (action, title, description, userId, userName, type = 'general', metadata = {}) => {
  try {
    await addDoc(collection(db, 'activities'), {
      action,
      title,
      message: description,
      description,
      userId,
      userName,
      type,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
      metadata
    });
  } catch {
    // falhas de log não devem quebrar o fluxo principal
  }
};

/**
 * Atalhos para ações comuns
 */
export const ActivityLogger = {
  // Projeto criado
  projectCreated: (projectName, userId, userName) => 
    logActivity('project_created', 'Projeto Criado', `${userName} criou o projeto "${projectName}"`, userId, userName, 'general', { projectName }),

  // Projeto editado
  projectEdited: (projectName, userId, userName) => 
    logActivity('project_edited', 'Projeto Editado', `${userName} editou o projeto "${projectName}"`, userId, userName, 'general', { projectName }),

  // Projeto excluído
  projectDeleted: (projectName, userId, userName) => 
    logActivity('project_deleted', 'Projeto Excluído', `${userName} excluiu o projeto "${projectName}"`, userId, userName, 'general', { projectName }),

  // Card criado
  cardCreated: (cardName, projectName, userId, userName) => 
    logActivity('card_created', 'Card Criado', `${userName} criou o card "${cardName}" no projeto "${projectName}"`, userId, userName, 'general', { cardName, projectName }),

  // Arquivo enviado
  fileUploaded: (fileName, cardName, projectName, userId, userName) => 
    logActivity('file_upload', 'Arquivo Enviado', `${userName} enviou o arquivo "${fileName}" em "${cardName}"`, userId, userName, 'file_upload', { fileName, cardName, projectName }),

  // Arquivo excluído
  fileDeleted: (fileName, cardName, projectName, userId, userName) => 
    logActivity('file_deleted', 'Arquivo Excluído', `${userName} excluiu o arquivo "${fileName}" de "${cardName}"`, userId, userName, 'file_upload', { fileName, cardName, projectName }),

  // Pasta criada
  folderCreated: (folderName, cardName, projectName, userId, userName) => 
    logActivity('folder_created', 'Pasta Criada', `${userName} criou a pasta "${folderName}" em "${cardName}"`, userId, userName, 'file_upload', { folderName, cardName, projectName }),

  // Formulário respondido
  formSubmitted: (formName, projectName, userId, userName) => 
    logActivity('form_response', 'Formulário Respondido', `${userName} respondeu o formulário "${formName}" no projeto "${projectName}"`, userId, userName, 'form_response', { formName, projectName }),

  // Usuário criado
  userCreated: (newUserName, createdBy, createdByName) => 
    logActivity('user_created', 'Usuário Criado', `${createdByName} criou o usuário "${newUserName}"`, createdBy, createdByName, 'general', { newUserName }),

  // Login
  userLogin: (userId, userName) => 
    logActivity('user_login', 'Login Realizado', `${userName} fez login no sistema`, userId, userName, 'general'),
};

export default ActivityLogger;
