import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const logActivity = async (
  action,
  title,
  description,
  userId,
  userName,
  type = 'general',
  metadata = {}
) => {
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
      metadata,
    });
  } catch {
    // falhas de log não devem quebrar o fluxo principal
  }
};

export const ActivityLogger = {
  // ─── Projetos ───────────────────────────────────────────
  projectCreated: (projectName, userId, userName) =>
    logActivity('project_created', 'Projeto Criado', `${userName} criou o projeto "${projectName}"`, userId, userName, 'general', { projectName }),

  projectEdited: (projectName, userId, userName) =>
    logActivity('project_edited', 'Projeto Editado', `${userName} editou o projeto "${projectName}"`, userId, userName, 'general', { projectName }),

  projectDeleted: (projectName, userId, userName) =>
    logActivity('project_deleted', 'Projeto Excluído', `${userName} excluiu o projeto "${projectName}"`, userId, userName, 'general', { projectName }),

  projectRestored: (projectName, userId, userName) =>
    logActivity('project_restored', 'Projeto Restaurado', `${userName} restaurou o projeto "${projectName}"`, userId, userName, 'general', { projectName }),

  // ─── Cards ──────────────────────────────────────────────
  cardCreated: (cardName, projectName, userId, userName) =>
    logActivity('card_created', 'Card Criado', `${userName} criou o card "${cardName}" no projeto "${projectName}"`, userId, userName, 'general', { cardName, projectName }),

  cardDeleted: (cardName, projectName, userId, userName) =>
    logActivity('card_deleted', 'Card Excluído', `${userName} excluiu o card "${cardName}" do projeto "${projectName}"`, userId, userName, 'general', { cardName, projectName }),

  // ─── Arquivos ───────────────────────────────────────────
  fileUploaded: (fileName, cardName, projectName, userId, userName) =>
    logActivity('file_upload', 'Arquivo Enviado', `${userName} enviou "${fileName}" em "${cardName}"`, userId, userName, 'file_upload', { fileName, cardName, projectName }),

  fileDeleted: (fileName, cardName, projectName, userId, userName) =>
    logActivity('file_deleted', 'Arquivo Excluído', `${userName} excluiu "${fileName}" de "${cardName}"`, userId, userName, 'file_upload', { fileName, cardName, projectName }),

  folderCreated: (folderName, cardName, projectName, userId, userName) =>
    logActivity('folder_created', 'Pasta Criada', `${userName} criou a pasta "${folderName}" em "${cardName}"`, userId, userName, 'file_upload', { folderName, cardName, projectName }),

  // ─── Formulários ────────────────────────────────────────
  formSubmitted: (formName, projectName, userId, userName) =>
    logActivity('form_response', 'Formulário Respondido', `${userName} respondeu o formulário "${formName}" no projeto "${projectName}"`, userId, userName, 'form_response', { formName, projectName }),

  // ─── Usuários ───────────────────────────────────────────
  userCreated: (newUserName, createdBy, createdByName) =>
    logActivity('user_created', 'Usuário Criado', `${createdByName} criou o usuário "${newUserName}"`, createdBy, createdByName, 'general', { newUserName }),

  userApproved: (approvedName, approvedBy, approvedByName, role) =>
    logActivity('user_approved', 'Usuário Aprovado', `${approvedByName} aprovou "${approvedName}" como ${role}`, approvedBy, approvedByName, 'general', { approvedName, role }),

  userRejected: (rejectedName, rejectedBy, rejectedByName) =>
    logActivity('user_rejected', 'Usuário Rejeitado', `${rejectedByName} rejeitou o cadastro de "${rejectedName}"`, rejectedBy, rejectedByName, 'general', { rejectedName }),

  userDeleted: (deletedName, deletedBy, deletedByName) =>
    logActivity('user_deleted', 'Usuário Removido', `${deletedByName} removeu "${deletedName}" do sistema`, deletedBy, deletedByName, 'general', { deletedName }),

  userRoleChanged: (targetName, newRole, changedBy, changedByName) =>
    logActivity('role_changed', 'Cargo Alterado', `${changedByName} alterou o cargo de "${targetName}" para "${newRole}"`, changedBy, changedByName, 'general', { targetName, newRole }),

  userProjectsChanged: (targetName, projects, changedBy, changedByName) =>
    logActivity('projects_changed', 'Projetos Atualizados', `${changedByName} atualizou projetos de "${targetName}"`, changedBy, changedByName, 'general', { targetName, projectCount: projects.length }),

  // ─── Auth ───────────────────────────────────────────────
  userLogin: (userId, userName) =>
    logActivity('user_login', 'Login Realizado', `${userName} fez login no sistema`, userId, userName, 'general'),

  // ─── Cargos ─────────────────────────────────────────────
  cargoCreated: (cargoName, userId, userName) =>
    logActivity('cargo_created', 'Cargo Criado', `${userName} criou o cargo "${cargoName}"`, userId, userName, 'general', { cargoName }),

  cargoEdited: (cargoName, userId, userName) =>
    logActivity('cargo_edited', 'Cargo Editado', `${userName} editou o cargo "${cargoName}"`, userId, userName, 'general', { cargoName }),

  cargoDeleted: (cargoName, userId, userName) =>
    logActivity('cargo_deleted', 'Cargo Excluído', `${userName} excluiu o cargo "${cargoName}"`, userId, userName, 'general', { cargoName }),
};

export default ActivityLogger;
