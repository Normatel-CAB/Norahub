import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useRecaptcha } from '../components/RecaptchaLoader';
import { encryptCPF } from '../services/encryptionService';

// Mínimo 8 caracteres, pelo menos: 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

const AUTH_ERROR_MESSAGES = {
  'dominio-invalido': 'Acesso restrito a contas @normatel.com.br.',
  'email-indisponivel': 'A Microsoft não retornou seu e-mail. Verifique as permissões da conta.',
  'pendente': 'Cadastro realizado! Aguarde aprovação do administrador.',
};

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password))   score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return { score, label: 'Fraca',   color: 'bg-red-500'    };
  if (score <= 4) return { score, label: 'Média',   color: 'bg-yellow-500' };
  return              { score, label: 'Forte',   color: 'bg-brand'  };
}

function Cadastro() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const { currentUser, userProfile, loading: authLoading, authError, clearAuthError } = useAuth();

  const { executeRecaptcha } = useRecaptcha();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [cpfMatricula, setCpfMatricula] = useState('');
  const [funcao, setFuncao] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);
  const passwordStrength = getPasswordStrength(senha);

  const formatCPF = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    const p1 = digits.slice(0, 3);
    const p2 = digits.slice(3, 6);
    const p3 = digits.slice(6, 9);
    const p4 = digits.slice(9, 11);
    let r = p1;
    if (p2) r += `.${p2}`;
    if (p3) r += `.${p3}`;
    if (p4) r += `-${p4}`;
    return r;
  };

  const getAutoApprovalStatus = async () => {
    try {
      const { data } = await supabase.from('settings').select('data').eq('id', 'autoApproval').maybeSingle();
      return data?.data?.enabled === true;
    } catch {
      return false;
    }
  };

  // Erros de domínio/conta pendente do fluxo Microsoft resolvidos centralmente no
  // AuthContext (mesmo mecanismo usado no Login) — aqui só exibimos a mensagem.
  useEffect(() => {
    if (!authError) return;
    const message = AUTH_ERROR_MESSAGES[authError] || 'Não foi possível cadastrar com Microsoft. Tente novamente.';
    setAlertInfo({ message, type: authError === 'pendente' ? 'success' : 'error' });
    clearAuthError();
    if (authError === 'pendente') {
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    }
  }, [authError, clearAuthError, navigate]);

  // Se já está logado (ex: voltou de um cadastro Microsoft bem-sucedido e já aprovado),
  // manda direto pro sistema em vez de deixar na tela de cadastro.
  useEffect(() => {
    if (!authLoading && currentUser && userProfile) {
      navigate('/selecao-projeto');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, currentUser?.id, navigate]);

  const handleMicrosoftRegister = async () => {
    setLoading(true);
    setAlertInfo(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email',
          redirectTo: `${window.location.origin}/cadastro`,
        },
      });
      if (error) throw error;
      // Daqui em diante o navegador é redirecionado pra Microsoft — a volta é tratada
      // pelo AuthContext (cria o perfil pendente automaticamente) e pelo useEffect acima.
    } catch {
      setAlertInfo({ message: 'Não foi possível abrir a janela da Microsoft. Tente novamente.', type: 'error' });
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlertInfo(null);

    if (!PASSWORD_REGEX.test(senha)) {
      setAlertInfo({ message: 'Senha fraca. Use mínimo 8 caracteres com maiúscula, minúscula, número e símbolo.', type: 'error' });
      setLoading(false);
      return;
    }

    try {
      const recaptchaToken = await executeRecaptcha('register');
      if (!recaptchaToken) {
        setAlertInfo({ message: 'Verificação de segurança falhou. Tente novamente.', type: 'error' });
        setLoading(false);
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: senha,
      });
      if (signUpError) throw signUpError;

      const user = signUpData?.user;
      if (!user?.id) throw new Error('Usuário não autenticado após cadastro.');
      if (!signUpData.session) {
        // Projeto está com confirmação de e-mail ativada: não há sessão ainda pra
        // gravar o perfil (a RLS exige auth.uid() = id). O perfil "pendente" será
        // criado automaticamente no primeiro login, após a confirmação.
        throw new Error('sem-sessao');
      }

      const [autoApprove, encryptedCPF] = await Promise.all([
        getAutoApprovalStatus(),
        encryptCPF(cpfMatricula),
      ]);

      const usuarioData = {
        id: user.id,
        nome,
        email,
        funcao: 'colaborador',
        status_acesso: autoApprove ? 'ativo' : 'pendente',
        data: { cargo: funcao, cpfMatricula: encryptedCPF },
      };

      let success = false;
      let lastError = null;
      for (let i = 0; i < 3; i++) {
        const { error: insertError } = await supabase.from('usuarios').insert(usuarioData);
        if (!insertError) { success = true; break; }
        lastError = insertError;
        if (i < 2) await new Promise((r) => setTimeout(r, 800));
      }
      if (!success) throw lastError;

      await supabase.auth.signOut();
      setAlertInfo({
        message: autoApprove
          ? 'Cadastro realizado! Você já pode fazer login.'
          : 'Cadastro realizado! Aguarde aprovação do administrador.',
        type: 'success',
      });
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (error) {
      if (error.message === 'sem-sessao') {
        setAlertInfo({ message: 'Cadastro criado! Confirme seu e-mail para poder acessar.', type: 'success' });
        setTimeout(() => navigate('/login', { replace: true }), 1500);
      } else if (error.message?.toLowerCase().includes('already registered')) {
        setAlertInfo({ message: 'Este e-mail já está cadastrado.', type: 'error' });
      } else if (error.message?.toLowerCase().includes('password')) {
        setAlertInfo({ message: 'A senha deve ter pelo menos 6 caracteres.', type: 'error' });
      } else if (error.message?.toLowerCase().includes('email')) {
        setAlertInfo({ message: 'E-mail inválido.', type: 'error' });
      } else if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
        setAlertInfo({ message: 'Muitas tentativas. Aguarde alguns minutos.', type: 'error' });
      } else {
        setAlertInfo({ message: 'Erro ao criar conta. Tente novamente.', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden relative nt-page-bg transition-colors duration-200">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/3 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-brand-deep/10 rounded-full blur-3xl" />
      </div>

      {alertInfo && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-xl backdrop-blur-md border font-semibold text-sm max-w-sm animate-fade-in ${
            alertInfo.type === 'error'
              ? 'bg-red-500/90 border-red-400 text-txt'
              : 'bg-brand/90 border-brand-lite text-txt'
          }`}
        >
          {alertInfo.message}
        </div>
      )}

      <header className="relative w-full flex items-center justify-center py-4 sm:py-5 md:py-8 px-2 sm:px-4 md:px-8 min-h-[56px] sm:min-h-[64px] md:h-24 bg-[#050b06]/50 backdrop-blur-md border-b border-hairline z-20">
        <button
          onClick={() => navigate('/')}
          className="absolute left-2 sm:left-4 md:left-8 flex items-center gap-2 text-txt-dim hover:text-brand-lite hover:bg-surface px-4 py-2 rounded-lg transition-all font-semibold text-xs sm:text-sm backdrop-blur-sm"
        >
          <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Voltar</span>
        </button>
        <img
          src={isDark ? '/img/Normatel Engenharia_BRANCO.png' : '/img/Normatel Engenharia_PRETO.png'}
          alt="Logo"
          className="h-6 sm:h-8 md:h-10 w-auto object-contain drop-shadow-lg"
        />
      </header>

      <main className="flex-grow flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 min-h-screen relative z-10">
        <div className="w-full max-w-xs sm:max-w-sm nt-glass p-6 sm:p-8 md:p-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-center text-txt mb-8">Criar Conta</h2>

          {/* Botão Microsoft */}
          <button
            type="button"
            onClick={handleMicrosoftRegister}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#2F2F2F] to-[#1a1a1a] hover:from-[#444] hover:to-[#222] disabled:opacity-50 disabled:cursor-not-allowed text-txt font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-all mb-6 sm:mb-8 border border-hairline hover:border-hairline-hi shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-txt" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Processando...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="sm:w-6 sm:h-6" viewBox="0 0 21 21">
                  <path fill="#f25022" d="M1 1h9v9H1z" />
                  <path fill="#00a4ef" d="M1 11h9v9H1z" />
                  <path fill="#7fba00" d="M11 1h9v9h-9z" />
                  <path fill="#ffb900" d="M11 11h9v9h-9z" />
                </svg>
                <span>Cadastrar com Microsoft</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-4 mb-6 sm:mb-8">
            <div className="h-px bg-hairline flex-1" />
            <span className="text-xs sm:text-sm text-txt-dim whitespace-nowrap font-medium">ou manual</span>
            <div className="h-px bg-hairline flex-1" />
          </div>

          <form onSubmit={handleRegisterSubmit} className="space-y-4 sm:space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs sm:text-sm font-semibold text-txt-dim ml-1 mb-2">Nome Completo</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-4 py-3 sm:py-3.5 bg-surface border border-hairline rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent placeholder-txt-faint text-txt text-sm outline-none backdrop-blur-sm transition-all hover:bg-surface-2"
                  placeholder="Ex: João Silva"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs sm:text-sm font-semibold text-txt-dim ml-1 mb-2">Email Corporativo</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 sm:py-3.5 bg-surface border border-hairline rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent placeholder-txt-faint text-txt text-sm outline-none backdrop-blur-sm transition-all hover:bg-surface-2"
                  placeholder="seu.nome@normatel.com.br"
                  required
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-txt-dim ml-1 mb-2">Senha</label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full px-4 py-3 sm:py-3.5 bg-surface border border-hairline rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent placeholder-txt-faint text-txt text-sm outline-none backdrop-blur-sm transition-all hover:bg-surface-2"
                  placeholder="Mín. 8 chars + símbolo"
                  required
                />
                {senha && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1 h-1">
                      {[1,2,3,4,5,6].map(i => (
                        <div key={i} className={`flex-1 rounded-full transition-colors ${i <= passwordStrength.score ? passwordStrength.color : 'bg-surface'}`} />
                      ))}
                    </div>
                    <p className={`text-[10px] ml-0.5 ${passwordStrength.score <= 2 ? 'text-red-400' : passwordStrength.score <= 4 ? 'text-yellow-400' : 'text-brand-lite'}`}>
                      Senha {passwordStrength.label} — use maiúscula, número e símbolo
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-txt-dim ml-1 mb-2">CPF</label>
                <input
                  type="text"
                  value={cpfMatricula}
                  onChange={(e) => setCpfMatricula(formatCPF(e.target.value))}
                  className="w-full px-4 py-3 sm:py-3.5 bg-surface border border-hairline rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent placeholder-txt-faint text-txt text-sm outline-none backdrop-blur-sm transition-all hover:bg-surface-2"
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs sm:text-sm font-semibold text-txt-dim ml-1 mb-2">Cargo</label>
                <input
                  type="text"
                  value={funcao}
                  onChange={(e) => setFuncao(e.target.value)}
                  className="w-full px-4 py-3 sm:py-3.5 bg-surface border border-hairline rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent placeholder-txt-faint text-txt text-sm outline-none backdrop-blur-sm transition-all hover:bg-surface-2"
                  placeholder="Ex: Analista"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="nt-glow-btn w-full bg-gradient-to-r from-brand-lite via-brand to-brand-deep hover:brightness-110 text-white font-bold py-3 sm:py-4 rounded-xl transition-all mt-6 sm:mt-8 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-txt" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Cadastrando...
                </span>
              ) : (
                'Cadastrar'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-txt-dim text-xs sm:text-sm mb-3">Já tem conta?</p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full py-3 sm:py-4 border-2 border-brand text-brand-lite rounded-xl font-bold hover:bg-brand/20 hover:border-brand-lite hover:text-brand-lite transition-all backdrop-blur-sm text-xs sm:text-sm"
            >
              Fazer Login
            </Link>
          </div>
        </div>
      </main>

      <footer className="w-full py-4 sm:py-6 text-center text-txt-dim text-xs shrink-0 bg-surface backdrop-blur-md border-t border-hairline px-2 z-20">
        &copy; 2025 Normatel Engenharia
      </footer>
    </div>
  );
}

export default Cadastro;
