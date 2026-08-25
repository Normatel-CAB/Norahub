/**
 * Validação de reCAPTCHA no servidor
 * Deve ser usado em Cloud Functions para validar tokens
 */

const functions = require('firebase-functions');

/**
 * Valida token reCAPTCHA v3 no servidor
 */
async function verifyRecaptchaToken(token) {
  if (!token) {
    return { valid: false, score: 0, error: 'Token não fornecido' };
  }

  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      // Fail-closed: sem chave configurada, bloquear para não expor a função sem proteção
      return { valid: false, score: 0, error: 'RECAPTCHA_SECRET_KEY não configurada no servidor' };
    }

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    });

    const data = await response.json();

    return {
      valid: data.success,
      score: data.score || 0, // 0.0 = bot, 1.0 = humano
      action: data.action,
      challengeTs: data.challenge_ts,
      hostname: data.hostname,
      error: data['error-codes'] ? data['error-codes'][0] : null
    };
  } catch (error) {
    console.error('Erro ao validar reCAPTCHA:', error);
    return { valid: false, score: 0, error: error.message };
  }
}

/**
 * Middleware para validar reCAPTCHA em Cloud Functions
 */
function validateRecaptchaMiddleware(minScore = 0.5) {
  return async (data, context) => {
    const token = data.recaptchaToken;
    
    if (!token) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'reCAPTCHA token não fornecido'
      );
    }

    const verification = await verifyRecaptchaToken(token);

    if (!verification.valid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        `reCAPTCHA validation failed: ${verification.error}`
      );
    }

    if (verification.score < minScore) {
      throw new functions.https.HttpsError(
        'permission-denied',
        `Atividade suspeita detectada (score: ${verification.score}). Tente novamente.`
      );
    }

    return verification;
  };
}

module.exports = {
  verifyRecaptchaToken,
  validateRecaptchaMiddleware
};
