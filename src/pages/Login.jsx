import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
// ThemeToggle removed: app forced to light mode
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import { useRecaptcha } from '../components/RecaptchaLoader';
import { supabase } from '../services/supabase';
import ActivityLogger from '../services/activityLogger';

const AUTH_ERROR_MESSAGES = {
  'dominio-invalido': 'Acesso restrito a contas @normatel.com.br.',
  'email-indisponivel': 'A Microsoft não retornou seu e-mail. Verifique as permissões da conta.',
  'pendente': 'Conta em análise. Aguarde aprovação do administrador.',
};

function Login() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { currentUser, userProfile, loading: authLoading, authError, clearAuthError } = useAuth();
  const navigate = useNavigate();
  const { executeRecaptcha } = useRecaptcha();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);

  // Erros de domínio/conta pendente resolvidos centralmente no AuthContext
  // (cobre tanto o retorno do login Microsoft quanto o e-mail/senha)
  useEffect(() => {
    if (!authError) return;
    const message = AUTH_ERROR_MESSAGES[authError] || 'Não foi possível entrar. Tente novamente.';
    setAlertInfo({ message, type: 'error' });
    clearAuthError();
  }, [authError, clearAuthError]);

  // Redirecionamento automático se já está logado
  useEffect(() => {
    if (!authLoading && currentUser && userProfile) {
      navigate('/selecao-projeto');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, currentUser?.id, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlertInfo(null);

    if (!email.endsWith('@normatel.com.br')) {
      setAlertInfo({ message: 'Use email corporativo.', type: 'error' });
      setLoading(false);
      return;
    }

    try {
      const recaptchaToken = await executeRecaptcha('login');
      if (!recaptchaToken) {
        console.warn('reCAPTCHA não disponível, continuando login');
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;

      // AuthContext resolve o perfil/aprovação; aqui só logamos a atividade se deu certo
      if (data?.user) {
        ActivityLogger.userLogin(data.user.id, data.user.user_metadata?.full_name || email.split('@')[0]);
      }
    } catch (error) {
      if (error.message?.includes('Invalid login credentials')) {
        setAlertInfo({ message: 'E-mail ou senha incorretos.', type: 'error' });
      } else if (error.message?.includes('rate limit') || error.status === 429) {
        setAlertInfo({ message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.', type: 'error' });
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        setAlertInfo({ message: 'Sem conexão. Verifique sua internet e tente novamente.', type: 'error' });
      } else {
        setAlertInfo({ message: 'Não foi possível fazer login. Tente novamente.', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setAlertInfo(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email',
          redirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) throw error;
      // A partir daqui o navegador é redirecionado pra Microsoft — não há mais nada
      // a fazer aqui; a volta é tratada pelo AuthContext quando a sessão é restabelecida.
    } catch (error) {
      setAlertInfo({ message: 'Não foi possível fazer login com Microsoft. Tente novamente.', type: 'error' });
      setLoading(false);
    }
  };

  if (authLoading) return <div className="min-h-screen w-full flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand"></div></div>;

  return (
    <div className="nt-page-bg min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden relative transition-colors duration-200">
      {alertInfo && <Alert message={alertInfo.message} type={alertInfo.type} onClose={() => setAlertInfo(null)} />}
      {/* ThemeToggle removed */}
      <header className="relative w-full flex items-center justify-center py-4 sm:py-5 md:py-8 px-2 sm:px-4 md:px-8 min-h-[56px] sm:min-h-[64px] md:h-24 backdrop-blur-md border-b border-hairline z-20" style={{ background: 'rgba(9, 22, 11, 0.6)' }}>
        <button onClick={() => navigate('/')} className="absolute left-2 sm:left-4 md:left-8 flex items-center gap-2 text-txt-dim hover:text-brand-lite hover:bg-white/5 px-4 py-2 rounded-lg transition-all font-semibold text-xs sm:text-sm backdrop-blur-sm">
             <ArrowLeft size={18} className="sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Voltar</span>
        </button>
        <img
          src={isDark ? "/img/Normatel Engenharia_BRANCO.png" : "/img/Normatel Engenharia_PRETO.png"}
          alt="Logo"
          className="h-6 sm:h-8 md:h-10 w-auto object-contain drop-shadow-lg"
        />
      </header>
      <main className="flex-grow flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 min-h-screen relative z-10">
        <div className="nt-glass w-full max-w-xs sm:max-w-sm rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-center text-txt mb-8 md:mb-10">Acessar Sistema</h2>

          <button type="button" onClick={handleMicrosoftLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#2F2F2F] to-[#1a1a1a] hover:from-[#444] hover:to-[#222] text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-all mb-6 sm:mb-8 border border-hairline hover:border-hairline-hi shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="sm:w-6 sm:h-6" viewBox="0 0 21 21"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#00a4ef" d="M1 11h9v9H1z"/><path fill="#7fba00" d="M11 1h9v9h-9z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>
            <span>{loading ? 'Processando...' : 'Entrar com Microsoft'}</span>
          </button>

          <div className="flex items-center gap-4 mb-6 sm:mb-8">
            <div className="h-px bg-hairline flex-1"></div>
            <span className="text-xs sm:text-sm text-txt-dim whitespace-nowrap font-medium">ou email corporativo</span>
            <div className="h-px bg-hairline flex-1"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-2">
              <label className="block text-xs sm:text-sm font-semibold text-txt-dim ml-1">Email</label>
              <div className="relative flex items-center">
                <Mail size={18} className="absolute left-3 sm:left-4 text-txt-faint flex-shrink-0 pointer-events-none z-10" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-12 sm:pl-14 pr-4 py-2.5 sm:py-3.5 bg-white/5 border border-hairline rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent text-txt text-sm sm:text-base outline-none backdrop-blur-sm transition-all hover:bg-white/10" style={{paddingLeft: '2.75rem'}} placeholder="seu.nome@normatel.com.br" required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs sm:text-sm font-semibold text-txt-dim ml-1">Senha</label>
              <div className="relative flex items-center">
                <Lock size={18} className="absolute left-3 sm:left-4 text-txt-faint flex-shrink-0 pointer-events-none z-10" />
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full pl-12 sm:pl-14 pr-4 py-2.5 sm:py-3.5 bg-white/5 border border-hairline rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent text-txt text-sm sm:text-base outline-none backdrop-blur-sm transition-all hover:bg-white/10" style={{paddingLeft: '2.75rem'}} placeholder="••••••" required />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-brand-lite via-brand to-brand-deep text-white font-bold py-3 sm:py-4 rounded-xl hover:brightness-110 transition-all mt-6 sm:mt-8 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* ÁREA DE LINKS DESTACADA */}
          <div className="mt-8 sm:mt-10 space-y-4">
            <Link
              to="/esqueceu-senha"
              className="block text-center text-xs sm:text-sm font-semibold text-brand-lite hover:text-brand-glow hover:underline transition-all"
            >
              Esqueceu sua senha?
            </Link>

            <div className="relative flex py-3 items-center">
              <div className="flex-grow border-t border-hairline"></div>
              <span className="flex-shrink-0 mx-3 text-txt-faint text-xs uppercase tracking-widest font-bold">Novo aqui?</span>
              <div className="flex-grow border-t border-hairline"></div>
            </div>

            <Link
              to="/cadastro"
              className="flex items-center justify-center w-full py-3 sm:py-4 px-4 sm:px-6 border-2 border-brand text-brand-lite rounded-xl font-bold hover:bg-brand/20 hover:border-brand-lite hover:text-brand-glow transition-all text-xs sm:text-sm backdrop-blur-sm"
            >
              Criar Novo Cadastro
            </Link>
          </div>

        </div>
      </main>
      <footer className="relative w-full py-4 sm:py-6 text-center text-txt-dim text-xs shrink-0 backdrop-blur-md border-t border-hairline px-2 z-20" style={{ background: 'rgba(9, 22, 11, 0.6)' }}>
        &copy; 2025 Normatel Engenharia
      </footer>
    </div>
  );
}
export default Login;
