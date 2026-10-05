import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

const AUTH_ERROR_MESSAGES = {
  'dominio-invalido': 'Acesso restrito a contas @normatel.com.br.',
  'email-indisponivel': 'A Microsoft não retornou seu e-mail. Verifique as permissões da conta.',
  'pendente': 'Cadastro realizado! Aguarde aprovação do administrador.',
};

function Cadastro() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const { currentUser, userProfile, loading: authLoading, authError, clearAuthError } = useAuth();

  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);

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

          <p className="text-txt-faint text-xs sm:text-sm text-center leading-relaxed">
            O acesso é liberado apenas para contas <strong className="text-txt-dim">@normatel.com.br</strong>.
            Depois do cadastro, um administrador precisa aprovar sua conta.
          </p>

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
