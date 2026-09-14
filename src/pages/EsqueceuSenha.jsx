import { Link } from 'react-router-dom';
import { Mail, Send, ArrowLeft, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
// ThemeToggle removed: app forced to light mode
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';

function EsqueceuSenha() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });

  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;

      setSuccess(true);
      setEmail('');

    } catch (error) {
      console.error("Erro ao recuperar senha:", error);

      let mensagem = "Erro ao enviar e-mail. Tente novamente.";
      const msg = error.message?.toLowerCase() || '';

      if (msg.includes('rate limit') || error.status === 429) {
        mensagem = "Muitas tentativas. Aguarde um pouco.";
      } else if (msg.includes('email')) {
        mensagem = "E-mail inválido.";
      }

      showToast(mensagem, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nt-page-bg min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden relative text-txt">
      {/* ThemeToggle removed */}

        <header className="relative w-full flex justify-center py-8 md:py-12 shrink-0 z-10">
        <Link to="/">
          <img
            src={isDark ? "/img/Normatel Engenharia_BRANCO.png" : "/img/Normatel Engenharia_PRETO.png"}
            alt="Logo Normatel"
            className="h-6 sm:h-8 md:h-10 w-auto object-contain drop-shadow-lg"
          />
        </Link>
      </header>

      <main className="relative z-10 flex-grow flex flex-col items-center justify-center p-3 md:p-4">

        <div className="nt-glass w-full max-w-sm p-4 md:p-8 rounded-xl">

          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-txt mb-2">Recuperar Senha</h2>
            {!success && <p className="text-sm text-txt-dim mb-6">Digite seu e-mail para enviarmos o link de recuperação.</p>}
          </div>

          {success ? (
            // Tela de Sucesso (Com aviso de Spam reforçado)
            <div className="flex flex-col items-center text-center animate-fade-in">
              <div className="bg-brand/20 p-4 rounded-full mb-4">
                <CheckCircle size={48} className="text-brand-lite" />
              </div>
              <h3 className="text-xl font-bold text-txt mb-2">E-mail Enviado!</h3>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6 w-full">
                <div className="flex items-center justify-center gap-2 text-yellow-400 font-semibold mb-1">
                    <AlertTriangle size={18} />
                    <span>Atenção</span>
                </div>
                <p className="text-sm text-yellow-300">
                  Verifique sua pasta de <strong>Spam</strong> ou <strong>Lixo Eletrônico</strong>.
                </p>
              </div>

              <button
                onClick={() => setSuccess(false)}
                className="text-brand-lite hover:underline font-medium mb-4"
              >
                Tentar outro e-mail
              </button>

              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-lite via-brand to-brand-deep text-white font-bold py-3 px-4 rounded-md hover:brightness-110 transition-all shadow-md"
              >
                Voltar para o Login
              </Link>
            </div>
          ) : (
            // Formulário
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-txt-dim">Email</label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-5 w-5 text-txt-faint" />
                  </span>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@normatel.com.br"
                    className="w-full pl-10 pr-4 py-2 bg-white/5 text-txt border border-hairline rounded-md placeholder-txt-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-lite via-brand to-brand-deep text-white font-bold py-3 px-4 rounded-md hover:brightness-110 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviando...' : (
                    <>
                        <Send size={20} />
                        Enviar Link
                    </>
                )}
              </button>

              <div className="text-center mt-6 text-sm">
                <Link to="/login" className="font-medium text-txt-faint hover:text-brand-lite transition-colors flex items-center justify-center gap-1">
                  <ArrowLeft size={16} />
                  Voltar para o Login
                </Link>
              </div>
            </form>
          )}

        </div>
      </main>

      {/* TOAST NOTIFICATION */}
      {toast.show && (
        <div className="fixed top-8 right-8 z-[200] animate-fade-in">
          <div className="nt-glass border-l-4 border-red-400 rounded-lg p-4 flex items-center gap-3 min-w-[300px]">
            <div className="bg-red-100 p-2 rounded-full">
              <X size={24} className="text-red-500" />
            </div>
            <div>
              <p className="font-bold text-txt">Erro!</p>
              <p className="text-sm text-txt-dim">{toast.message}</p>
            </div>
          </div>
        </div>
      )}

      <footer className="relative w-full py-4 text-center text-txt-faint text-xs shrink-0 z-10">
        &copy; 2025 Normatel Engenharia
      </footer>
    </div>
  );
}

export default EsqueceuSenha;
