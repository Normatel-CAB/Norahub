import { supabase } from './supabase';

function mapNotificationRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    read: row.lida,
    createdAt: row.created_at,
    ...(row.data || {}),
  };
}

/**
 * Criar uma notificação
 * @param {string} userId - ID do usuário que receberá a notificação
 * @param {string} type - Tipo: 'form_response', 'file_upload', 'approval', 'comment', 'system'
 * @param {string} title - Título da notificação
 * @param {string} message - Mensagem
 * @param {string} link - Link opcional para redirecionar
 * @param {object} metadata - Dados adicionais (projectId, formId, etc)
 */
export const createNotification = async (userId, type, title, message, link = null, metadata = {}) => {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      lida: false,
      data: { type, title, message, link, metadata },
    });
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
  }
};

// Enviar notificação por e-mail via Resend (Edge Function)
export const sendEmailNotification = async ({ to, subject, html, from }) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, html, from },
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao enviar notificação por e-mail:', error);
    return { success: false, error: error.message };
  }
};

// Helper simples: enviar e-mail formatado para colaborador (CTA opcional)
export const sendEmailToCollaborator = async ({ email, title, message, actionUrl = null, from = null }) => {
  if (!email || !title || !message) {
    return { success: false, error: 'Parâmetros obrigatórios: email, title, message' };
  }

  const subject = title;
  const safeMessage = String(message);
  const safeTitle = String(title);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
      <h2 style="margin:0 0 12px; color:#111;">${safeTitle}</h2>
      <p style="margin:0 0 16px;">${safeMessage}</p>
      ${actionUrl ? `<a href="${actionUrl}" style="display:inline-block;padding:10px 16px;background:#57B952;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Abrir</a>` : ''}
      <p style="margin:16px 0 0; color:#555; font-size:12px;">Enviado via NoraHub</p>
    </div>
  `;

  return sendEmailNotification({ to: email, subject, html, from });
};

/**
 * Criar notificações para múltiplos usuários
 */
export const createBulkNotifications = async (userIds, type, title, message, link = null, metadata = {}) => {
  try {
    const rows = userIds.map(userId => ({
      user_id: userId,
      lida: false,
      data: { type, title, message, link, metadata },
    }));
    const { error } = await supabase.from('notifications').insert(rows);
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao criar notificações em lote:', error);
  }
};

/**
 * Marcar notificação como lida
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const { error } = await supabase.from('notifications').update({ lida: true }).eq('id', notificationId);
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
  }
};

/**
 * Marcar todas as notificações como lidas
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ lida: true })
      .eq('user_id', userId)
      .eq('lida', false);
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao marcar todas como lidas:', error);
  }
};

/**
 * Obter notificações em tempo real (busca inicial + subscription do Realtime).
 * Retorna uma função de unsubscribe (mesmo formato do onSnapshot do Firestore).
 */
export const subscribeToNotifications = (userId, callback) => {
  let notifications = [];

  const emit = () => {
    const sorted = [...notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    callback(sorted.map(mapNotificationRow));
  };

  const upsertLocal = (row) => {
    const idx = notifications.findIndex(n => n.id === row.id);
    if (idx >= 0) notifications[idx] = row;
    else notifications = [row, ...notifications];
    if (notifications.length > 50) notifications = notifications.slice(0, 50);
  };

  const removeLocal = (id) => {
    notifications = notifications.filter(n => n.id !== id);
  };

  supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
    .then(({ data, error }) => {
      if (error) { console.error('Erro ao buscar notificações:', error); return; }
      notifications = data || [];
      emit();
    });

  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          removeLocal(payload.old.id);
        } else {
          upsertLocal(payload.new);
        }
        emit();
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};

/**
 * Funções auxiliares para criar notificações em eventos específicos
 */

// Quando alguém responde um formulário
export const notifyFormResponse = async (formOwnerId, formName, responderName, projectId) => {
  await createNotification(
    formOwnerId,
    'form_response',
    'Nova resposta de formulário',
    `${responderName} respondeu ao formulário "${formName}"`,
    `/projeto/${projectId}`,
    { formName, responderName, projectId }
  );
};

// Quando alguém faz upload de arquivo
export const notifyFileUpload = async (projectManagerIds, fileName, uploaderName, projectId) => {
  await createBulkNotifications(
    projectManagerIds,
    'file_upload',
    'Novo arquivo enviado',
    `${uploaderName} enviou o arquivo "${fileName}"`,
    `/projeto/${projectId}`,
    { fileName, uploaderName, projectId }
  );
};

// Quando uma aprovação é solicitada
export const notifyApprovalRequest = async (approverIds, itemName, requesterName, projectId) => {
  await createBulkNotifications(
    approverIds,
    'approval',
    'Nova solicitação de aprovação',
    `${requesterName} solicitou aprovação para "${itemName}"`,
    `/projeto/${projectId}`,
    { itemName, requesterName, projectId }
  );
};

// Quando uma aprovação é concedida/negada
export const notifyApprovalResult = async (requesterId, itemName, approved, approverName, projectId) => {
  await createNotification(
    requesterId,
    'approval',
    approved ? 'Aprovação concedida' : 'Aprovação negada',
    `${approverName} ${approved ? 'aprovou' : 'negou'} "${itemName}"`,
    `/projeto/${projectId}`,
    { itemName, approved, approverName, projectId }
  );
};

// Quando alguém comenta (para implementação futura)
export const notifyComment = async (userIds, commenterName, location, projectId) => {
  await createBulkNotifications(
    userIds,
    'comment',
    'Novo comentário',
    `${commenterName} comentou em ${location}`,
    `/projeto/${projectId}`,
    { commenterName, location, projectId }
  );
};

// Notificações do sistema (atualizações, manutenção, etc)
export const notifySystem = async (userIds, title, message, link = null) => {
  await createBulkNotifications(
    userIds,
    'system',
    title,
    message,
    link,
    {}
  );
};
