import { Link } from 'react-router-dom';
import { Mail, Send, ArrowLeft, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
// ThemeToggle removed: app forced to light mode
import { useTheme } from '../context/ThemeContext';

// Imports do Firebase
import { auth } from '../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

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
      // Configurações opcionais para o email (redirecionar de volta para o site após a troca)
      const actionCodeSettings = {
        url: window.location.origin + '/login', // Redireciona para o login após resetar
        handleCodeInApp: true,
      };

      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      
      setSuccess(true);
      setEmail(''); 

    } catch (error) {
      console.error("Erro ao recuperar senha:", error);
      
      let mensagem = "Erro ao enviar e-mail. Tente novamente.";
      
      if (error.code === 'auth/user-not-found') {
        mensagem = "Este e-mail não está cadastrado.";
      } else if (error.code === 'auth/invalid-email') {
        mensagem = "E-mail inválido.";
      } else if (error.code === 'auth/too-many-requests') {
        mensagem = "Muitas tentativas. Aguarde um pouco.";
      }

      showToast(mensagem, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl"></div>
      </div>
      
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
        
        <div className="w-full max-w-sm bg-white/10 backdrop-blur-xl p-4 md:p-8 rounded-xl shadow-2xl border border-white/20">
          
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Recuperar Senha</h2>
            {!success && <p className="text-sm text-gray-300 mb-6">Digite seu e-mail para enviarmos o link de recuperação.</p>}
          </div>

          {success ? (
            // Tela de Sucesso (Com aviso de Spam reforçado)
            <div className="flex flex-col items-center text-center animate-fade-in">
              <div className="bg-green-500/20 p-4 rounded-full mb-4">
                <CheckCircle size={48} className="text-[#57B952]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">E-mail Enviado!</h3>
              
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
                className="text-[#57B952] hover:underline font-medium mb-4"
              >
                Tentar outro e-mail
              </button>
              
              <Link 
                to="/login"
                className="w-full flex items-center justify-center gap-2 bg-[#57B952] text-white font-bold py-3 px-4 rounded-md hover:bg-green-600 transition-colors shadow-md"
              >
                Voltar para o Login
              </Link>
            </div>
          ) : (
            // Formulário
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-300">Email</label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </span>
                  <input 
                    type="email" 
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@normatel.com.br"
                    className="w-full pl-10 pr-4 py-2 bg-white/10 text-white border border-white/20 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#57B952] focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#57B952] text-white font-bold py-3 px-4 rounded-md hover:bg-green-600 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviando...' : (
                    <>
                        <Send size={20} />
                        Enviar Link
                    </>
                )}
              </button>
              
              <div className="text-center mt-6 text-sm">
                <Link to="/login" className="font-medium text-gray-600 text-gray-400 hover:text-[#57B952] hover:text-[#57B952] transition-colors flex items-center justify-center gap-1">
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
          <div className="bg-white/10 backdrop-blur-md border-l-4 border-red-400 rounded-lg shadow-2xl p-4 flex items-center gap-3 min-w-[300px]">
            <div className="bg-red-100 p-2 rounded-full">
              <X size={24} className="text-red-500" />
            </div>
            <div>
              <p className="font-bold text-white">Erro!</p>
              <p className="text-sm text-gray-600">{toast.message}</p>
            </div>
          </div>
        </div>
      )}

      <footer className="w-full py-4 text-center text-gray-500 text-xs shrink-0">
        &copy; 2025 Normatel Engenharia
      </footer>
    </div>
  );
}

export default EsqueceuSenha;
