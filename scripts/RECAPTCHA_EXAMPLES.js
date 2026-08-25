/**
 * Exemplos de Integração reCAPTCHA v3
 * Copie e adapte para suas páginas
 */

// ============================================
// EXEMPLO 1: Formulário de Cadastro
// ============================================

import { useRecaptcha } from '../components/RecaptchaLoader';

export default function Cadastro() {
  const { executeRecaptcha } = useRecaptcha();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // 1. Executar reCAPTCHA
      const recaptchaToken = await executeRecaptcha('signup');
      
      if (!recaptchaToken) {
        console.warn('reCAPTCHA não disponível');
        // Pode continuar ou bloquear
      }

      // 2. Enviar para Cloud Function com token
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          password: userPassword,
          recaptchaToken // Enviar token
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Cadastro bem-sucedido');
      }
    } catch (error) {
      console.error('Erro no cadastro:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* seu formulário aqui */}
      <button type="submit">Cadastrar</button>
    </form>
  );
}

// ============================================
// EXEMPLO 2: Esqueci a Senha
// ============================================

export default function EsqueceuSenha() {
  const { executeRecaptcha } = useRecaptcha();

  const handlePasswordReset = async (email) => {
    try {
      const token = await executeRecaptcha('password_reset');
      
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          recaptchaToken: token
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Email de redefinição enviado!');
      }
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
    }
  };

  return (
    <div>
      <button onClick={() => handlePasswordReset(userEmail)}>
        Redefinir Senha
      </button>
    </div>
  );
}

// ============================================
// EXEMPLO 3: Operação Sensível (Admin)
// ============================================

export default function DeleteUserAdmin() {
  const { executeRecaptcha } = useRecaptcha();

  const handleDeleteUser = async (userId) => {
    try {
      const token = await executeRecaptcha('delete_user');
      
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          recaptchaToken: token
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Usuário deletado');
      }
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
    }
  };

  return (
    <button onClick={() => handleDeleteUser('user-id')}>
      Deletar Usuário (Admin)
    </button>
  );
}

// ============================================
// EXEMPLO 4: Cloud Function com Validação
// ============================================

// Em functions/index.js

const functions = require('firebase-functions');
const { verifyRecaptchaToken } = require('./recaptchaValidator');

/**
 * Register User com validação reCAPTCHA
 */
exports.registerUser = functions.https.onCall(async (data, context) => {
  try {
    const { email, password, recaptchaToken } = data;

    // 1. Validar reCAPTCHA
    const recaptchaResult = await verifyRecaptchaToken(recaptchaToken);
    
    if (!recaptchaResult.valid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Verificação reCAPTCHA falhou'
      );
    }

    // 2. Checar score (0.5 = threshold padrão)
    if (recaptchaResult.score < 0.5) {
      // Log para análise posterior
      console.warn(`Baixo score para cadastro: ${recaptchaResult.score}`);
      
      // Pode: rejeitar, exigir desafio extra, ou apenas alertar
      // Para agora, apenas alertamos
    }

    // 3. Validar email corporativo
    if (!email.endsWith('@normatel.com.br')) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Deve usar email corporativo'
      );
    }

    // 4. Criar usuário Firebase
    const user = await admin.auth().createUser({
      email,
      password,
      displayName: email.split('@')[0]
    });

    // 5. Salvar dados no Firestore
    await admin.firestore().collection('users').doc(user.uid).set({
      email,
      displayName: user.displayName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      recaptchaScore: recaptchaResult.score // Para tracking
    });

    return { success: true, uid: user.uid };
  } catch (error) {
    console.error('Erro no registro:', error);
    throw error;
  }
});

/**
 * Reset Password com validação reCAPTCHA
 */
exports.resetPassword = functions.https.onCall(async (data, context) => {
  try {
    const { email, recaptchaToken } = data;

    // 1. Validar reCAPTCHA (threshold mais baixo para reset)
    const recaptchaResult = await verifyRecaptchaToken(recaptchaToken);
    
    if (!recaptchaResult.valid || recaptchaResult.score < 0.3) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Falha na verificação de segurança'
      );
    }

    // 2. Gerar link de reset
    const resetLink = await admin.auth().generatePasswordResetLink(email);

    // 3. Enviar email
    // await sendEmail(email, resetLink);

    return { success: true };
  } catch (error) {
    console.error('Erro ao resetar senha:', error);
    throw error;
  }
});

/**
 * Delete User (Admin) com validação reCAPTCHA
 */
exports.deleteUserAdmin = functions.https.onCall(async (data, context) => {
  try {
    const { userId, recaptchaToken } = data;

    // 1. Verificar permissão de admin
    const callerUser = await admin.auth().getUser(context.auth.uid);
    const callerDoc = await admin.firestore()
      .collection('users')
      .doc(context.auth.uid)
      .get();

    if (!callerDoc.data()?.isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Apenas admin pode deletar usuários'
      );
    }

    // 2. Validar reCAPTCHA (threshold alto para operação sensível)
    const recaptchaResult = await verifyRecaptchaToken(recaptchaToken);
    
    if (!recaptchaResult.valid || recaptchaResult.score < 0.7) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Falha na verificação de segurança'
      );
    }

    // 3. Log da ação
    console.log(`Admin ${context.auth.uid} deletando usuário ${userId}`);

    // 4. Deletar usuário
    await admin.auth().deleteUser(userId);
    await admin.firestore().collection('users').doc(userId).delete();

    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    throw error;
  }
});

// ============================================
// EXEMPLO 5: Configuração de Thresholds por Ação
// ============================================

const RECAPTCHA_THRESHOLDS = {
  login: 0.5,           // Leniente - maioria de logins são legítimos
  signup: 0.5,          // Leniente
  password_reset: 0.3,  // Bem leniente - usuários podem estar com pressa
  delete_user: 0.8,     // Rigoroso - ação sensível de admin
  create_project: 0.6,  // Moderado
  delete_project: 0.8   // Rigoroso
};

/**
 * Validar reCAPTCHA com threshold por ação
 */
async function validateByAction(token, action) {
  const result = await verifyRecaptchaToken(token);
  const threshold = RECAPTCHA_THRESHOLDS[action] || 0.5;

  if (result.score < threshold) {
    console.warn(
      `Ação ${action} rejeitada. Score: ${result.score}, Threshold: ${threshold}`
    );
    return { allowed: false, reason: 'low_score' };
  }

  return { allowed: true, score: result.score };
}

// ============================================
// EXEMPLO 6: Tratamento de Erros
// ============================================

async function handleLoginWithRecaptcha(email, password) {
  try {
    const { executeRecaptcha } = useRecaptcha();
    const token = await executeRecaptcha('login');

    if (!token) {
      console.warn('reCAPTCHA não disponível, continuando sem validação');
      // Continuar com login normal
      return loginUser(email, password);
    }

    // Enviar com token
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, recaptchaToken: token })
    });

    if (response.status === 403) {
      // Falha na verificação reCAPTCHA
      throw new Error('Verificação de segurança falhou');
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('reCAPTCHA')) {
      // Erro de segurança - bloquear
      console.error('Erro de segurança:', error);
      throw error;
    }
    // Outro erro - pode tentar novamente
    console.error('Erro no login:', error);
    throw error;
  }
}

// ============================================
// EXEMPLO 7: Testing
// ============================================

// Para testar localmente, você pode mockar reCAPTCHA

// __mocks__/recaptcha.js
export const mockRecaptcha = () => {
  window.grecaptcha = {
    execute: async (siteKey, options) => {
      // Retorna token fake para testes
      return Promise.resolve('fake-token-for-testing');
    }
  };
};

// No seu teste
test('login with reCAPTCHA', async () => {
  mockRecaptcha();
  
  const { getByText, getByPlaceholderText } = render(<Login />);
  
  fireEvent.change(getByPlaceholderText('Email'), { target: { value: 'user@normatel.com.br' } });
  fireEvent.change(getByPlaceholderText('Senha'), { target: { value: 'password123' } });
  fireEvent.click(getByText('Entrar'));
  
  // Verificar se reCAPTCHA foi executado
  expect(window.grecaptcha.execute).toHaveBeenCalledWith(
    expect.any(String),
    { action: 'login' }
  );
});

// ============================================
// RESUMO DOS PASSOS
// ============================================

/*
1. Frontend (React Component):
   - Importar useRecaptcha hook
   - Chamar executeRecaptcha('action') antes de enviar dados
   - Incluir token na requisição

2. Backend (Cloud Function):
   - Receber token na requisição
   - Chamar verifyRecaptchaToken(token)
   - Validar resultado.score contra threshold
   - Proceder com lógica ou rejeitar

3. Configuração:
   - VITE_RECAPTCHA_SITE_KEY no .env (frontend)
   - RECAPTCHA_SECRET_KEY no .env (backend)
   - Domínios configurados no Google Console

4. Monitoramento:
   - Ver analytics no Google reCAPTCHA Console
   - Logar scores para análise
   - Ajustar thresholds baseado em padrões
*/
