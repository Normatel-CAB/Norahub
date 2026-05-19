const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Resend } = require('resend');
const { secureFunction, InputValidator, SecurityLogger } = require('./securityMiddleware');

admin.initializeApp();

// Instância do Resend (usa variável de ambiente RESEND_API_KEY ou functions config resend.key)
const resendApiKey = process.env.RESEND_API_KEY || functions.config().resend?.key;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Cloud Function para enviar e-mail via Resend (com segurança)
// Região: São Paulo (southamerica-east1) para evitar latência/CORS em projetos nessa região
exports.sendEmailResend = functions.region('southamerica-east1').https.onCall(
  secureFunction(async (data, context) => {
    if (!resend) {
      throw new functions.https.HttpsError('failed-precondition', 'RESEND_API_KEY não configurada. Defina em env ou functions:config:set resend.key=...');
    }

    const { to, subject, html, from } = data;

    // Validação adicional de email
    const validatedTo = InputValidator.validateEmail(to);

    // Sanitiza HTML: remove scripts, event handlers e javascript: URIs para evitar XSS em emails
    const sanitizedHtml = InputValidator.sanitizeHtml(html);

    const fromAddress = from || process.env.RESEND_FROM || 'NoraHub <notificacoes@noreply.norahub.com>';

    try {
      const response = await resend.emails.send({
        from: fromAddress,
        to: validatedTo,
        subject: InputValidator.sanitizeString(subject),
        html: sanitizedHtml
      });

      await SecurityLogger.log({
        type: 'email_sent',
        severity: 'info',
        userId: context.auth.uid,
        action: 'send_email',
        success: true,
        details: { to: validatedTo, subject }
      });

      return { success: true, id: response?.id || null };
    } catch (error) {
      console.error('Erro ao enviar e-mail via Resend:', error);
      throw new functions.https.HttpsError('internal', error.message || 'Falha ao enviar e-mail');
    }
  }, {
    requireAuth: true,
    validate: {
      required: ['to', 'subject', 'html'],
      schema: { to: 'email' }
    },
    rateLimit: {
      windowMs: 60000, // 1 minuto
      maxRequests: 10 // Max 10 emails por minuto
    },
    functionName: 'sendEmailResend',
    logAccess: true
  })
);

// Cloud Function para migrar usuários da coleção 'users' para 'usuarios' (com segurança)
exports.migrateUsersCollection = functions.region('southamerica-east1').https.onCall(
  secureFunction(async (data, context) => {
    try {
      const db = admin.firestore();
      const usersCollection = db.collection('users');
      const usuariosCollection = db.collection('usuarios');
      
      // Busca todos os usuários da coleção antiga
      const snapshot = await usersCollection.get();
      
      if (snapshot.empty) {
        return { success: true, message: 'Nenhum usuário para migrar', count: 0 };
      }

      let migratedCount = 0;
      const batch = db.batch();

      // Itera sobre todos os documentos
      snapshot.forEach(doc => {
        const userData = doc.data();
        const docRef = usuariosCollection.doc(doc.id);
        batch.set(docRef, userData, { merge: true });
        migratedCount++;
      });

      // Executa a migração
      await batch.commit();

      await SecurityLogger.log({
        type: 'migration',
        severity: 'info',
        userId: context.auth.uid,
        action: 'migrate_users',
        success: true,
        details: { count: migratedCount }
      });

      return { 
        success: true, 
        message: `${migratedCount} usuários migrados com sucesso para a coleção 'usuarios'`,
        count: migratedCount 
      };
    } catch (error) {
      console.error('Erro ao migrar usuários:', error);
      throw new functions.https.HttpsError('internal', 'Erro ao migrar usuários: ' + error.message);
    }
  }, {
    requireAdmin: true,
    rateLimit: {
      windowMs: 3600000, // 1 hora
      maxRequests: 5 // Max 5 migrações por hora
    },
    functionName: 'migrateUsersCollection',
    logAccess: true
  })
);

// Cloud Function para deletar usuário (Auth + Firestore) com segurança
exports.deleteUser = functions.region('southamerica-east1').https.onCall(
  secureFunction(async (data, context) => {
    const { userId } = data;

    // Validação adicional do userId
    const validatedUserId = InputValidator.validateUid(userId);

    try {
      // 1. Deleta a conta do Authentication
      await admin.auth().deleteUser(validatedUserId);
      
      // 2. Deleta o documento do Firestore
      await admin.firestore().collection('usuarios').doc(validatedUserId).delete();

      await SecurityLogger.log({
        type: 'user_deletion',
        severity: 'warning',
        userId: context.auth.uid,
        action: 'delete_user',
        success: true,
        details: { deletedUserId: validatedUserId }
      });

      return { success: true, message: 'Usuário deletado com sucesso' };
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      throw new functions.https.HttpsError('internal', 'Erro ao deletar usuário: ' + error.message);
    }
  }, {
    requireAdmin: true,
    validate: {
      required: ['userId'],
      schema: { userId: 'uid' }
    },
    rateLimit: {
      windowMs: 60000, // 1 minuto
      maxRequests: 20 // Max 20 deleções por minuto
    },
    functionName: 'deleteUser',
    logAccess: true
  })
);
