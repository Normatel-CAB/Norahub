const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { Resend } = require('resend');
const { secureFunction, InputValidator, SecurityLogger } = require('./securityMiddleware');

admin.initializeApp();

const resendApiKey = process.env.RESEND_API_KEY || functions.config().resend?.key;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// ── Helpers de criptografia (AES-256-GCM) ─────────────────────────────────────
// A chave fica APENAS em variável de ambiente do Cloud Functions — nunca no cliente.

function getEncryptionKey() {
  const key = process.env.CPF_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('CPF_ENCRYPTION_KEY inválida ou não configurada (deve ter 64 hex chars = 32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

function encryptValue(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96 bits para GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // formato: iv(24 hex) + authTag(32 hex) + ciphertext(hex)
  return iv.toString('hex') + authTag.toString('hex') + encrypted.toString('hex');
}

function decryptValue(ciphertext) {
  const key = getEncryptionKey();
  const iv = Buffer.from(ciphertext.slice(0, 24), 'hex');
  const authTag = Buffer.from(ciphertext.slice(24, 56), 'hex');
  const encrypted = Buffer.from(ciphertext.slice(56), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// ── encryptPersonalData ────────────────────────────────────────────────────────
// Criptografa dados pessoais (CPF) antes de salvar no Firestore.
// Chave nunca chega ao cliente.
exports.encryptPersonalData = functions.region('southamerica-east1').https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária');
    }

    const { cpf } = data;
    if (!cpf || typeof cpf !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'CPF inválido');
    }

    const cpfDigits = cpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      throw new functions.https.HttpsError('invalid-argument', 'CPF deve ter 11 dígitos');
    }

    try {
      const encrypted = encryptValue(cpfDigits);
      return { encrypted };
    } catch (err) {
      console.error('Erro ao criptografar CPF:', err.message);
      throw new functions.https.HttpsError('internal', 'Falha na criptografia. Verifique a configuração do servidor.');
    }
  }
);

// ── decryptPersonalData ────────────────────────────────────────────────────────
// Descriptografa CPF. Apenas admin pode chamar.
exports.decryptPersonalData = functions.region('southamerica-east1').https.onCall(
  secureFunction(async (data, context) => {
    const { encrypted } = data;
    if (!encrypted || typeof encrypted !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Valor criptografado inválido');
    }

    try {
      const plaintext = decryptValue(encrypted);
      await SecurityLogger.log({
        type: 'cpf_decrypted',
        severity: 'warning',
        userId: context.auth.uid,
        action: 'decrypt_personal_data',
        success: true,
        details: {},
      });
      return { plaintext };
    } catch (err) {
      throw new functions.https.HttpsError('internal', 'Falha ao descriptografar');
    }
  }, {
    requireAdmin: true,
    rateLimit: { windowMs: 60000, maxRequests: 20 },
    functionName: 'decryptPersonalData',
    logAccess: true,
  })
);

// ── sendEmailResend ────────────────────────────────────────────────────────────
exports.sendEmailResend = functions.region('southamerica-east1').https.onCall(
  secureFunction(async (data, context) => {
    if (!resend) {
      throw new functions.https.HttpsError('failed-precondition', 'RESEND_API_KEY não configurada.');
    }

    const { to, subject, html, from } = data;
    const validatedTo = InputValidator.validateEmail(to);
    const sanitizedHtml = InputValidator.sanitizeHtml(html);
    const fromAddress = from || process.env.RESEND_FROM || 'NoraHub <notificacoes@noreply.norahub.com>';

    try {
      const response = await resend.emails.send({
        from: fromAddress,
        to: validatedTo,
        subject: InputValidator.sanitizeString(subject),
        html: sanitizedHtml,
      });

      await SecurityLogger.log({
        type: 'email_sent',
        severity: 'info',
        userId: context.auth.uid,
        action: 'send_email',
        success: true,
        details: { to: validatedTo, subject },
      });

      return { success: true, id: response?.id || null };
    } catch (error) {
      console.error('Erro ao enviar e-mail via Resend:', error);
      throw new functions.https.HttpsError('internal', error.message || 'Falha ao enviar e-mail');
    }
  }, {
    requireAuth: true,
    validate: { required: ['to', 'subject', 'html'], schema: { to: 'email' } },
    rateLimit: { windowMs: 60000, maxRequests: 10 },
    functionName: 'sendEmailResend',
    logAccess: true,
  })
);

// ── migrateUsersCollection ─────────────────────────────────────────────────────
exports.migrateUsersCollection = functions.region('southamerica-east1').https.onCall(
  secureFunction(async (data, context) => {
    try {
      const db = admin.firestore();
      const snapshot = await db.collection('users').get();
      if (snapshot.empty) return { success: true, message: 'Nenhum usuário para migrar', count: 0 };

      let migratedCount = 0;
      const batch = db.batch();
      snapshot.forEach(docSnap => {
        batch.set(db.collection('usuarios').doc(docSnap.id), docSnap.data(), { merge: true });
        migratedCount++;
      });
      await batch.commit();

      await SecurityLogger.log({
        type: 'migration', severity: 'info', userId: context.auth.uid,
        action: 'migrate_users', success: true, details: { count: migratedCount },
      });

      return { success: true, message: `${migratedCount} usuários migrados`, count: migratedCount };
    } catch (error) {
      console.error('Erro ao migrar usuários:', error);
      throw new functions.https.HttpsError('internal', 'Erro ao migrar usuários: ' + error.message);
    }
  }, {
    requireAdmin: true,
    rateLimit: { windowMs: 3600000, maxRequests: 5 },
    functionName: 'migrateUsersCollection',
    logAccess: true,
  })
);

// ── deleteUser ────────────────────────────────────────────────────────────────
exports.deleteUser = functions.region('southamerica-east1').https.onCall(
  secureFunction(async (data, context) => {
    const validatedUserId = InputValidator.validateUid(data.userId);
    try {
      await admin.auth().deleteUser(validatedUserId);
      await admin.firestore().collection('usuarios').doc(validatedUserId).delete();

      await SecurityLogger.log({
        type: 'user_deletion', severity: 'warning', userId: context.auth.uid,
        action: 'delete_user', success: true, details: { deletedUserId: validatedUserId },
      });

      return { success: true, message: 'Usuário deletado com sucesso' };
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      throw new functions.https.HttpsError('internal', 'Erro ao deletar usuário: ' + error.message);
    }
  }, {
    requireAdmin: true,
    validate: { required: ['userId'], schema: { userId: 'uid' } },
    rateLimit: { windowMs: 60000, maxRequests: 20 },
    functionName: 'deleteUser',
    logAccess: true,
  })
);
