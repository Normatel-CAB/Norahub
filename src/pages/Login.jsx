import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
// ThemeToggle removed: app forced to light mode
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import { useRecaptcha } from '../components/RecaptchaLoader';
import { auth, db } from '../services/firebase';
import { signInWithEmailAndPassword, signOut, OAuthProvider, signInWithPopup, signInWithRedirect, updateProfile, getRedirectResult } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import ActivityLogger from '../services/activityLogger';

function Login() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { executeRecaptcha } = useRecaptcha();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);

  const checkUserProfile = async (user) => {
      // Normaliza email vindo do auth ou dos dados do provedor
      const providerEmail = user.providerData?.[0]?.email;
      const effectiveEmail = user.email || providerEmail || null;

      // Se for login Microsoft, garanta que exista email e que seja do domínio esperado
      if (user.providerData[0]?.providerId === 'microsoft.com') {
        if (!effectiveEmail) {
          await signOut(auth);
          throw new Error('email-indisponivel');
        }
        if (!effectiveEmail.endsWith('@normatel.com.br')) {
          await signOut(auth);
          throw new Error('dominio-invalido');
        }
      }
      
      const docSnap = await getDoc(doc(db, 'usuarios', user.uid));

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.statusAcesso === 'pendente') {
            await signOut(auth);
            throw new Error("pendente");
        }

        // Se for Microsoft e ativo, atualiza foto
        if (user.providerData[0]?.providerId === 'microsoft.com' && user.photoURL) {
          await updateDoc(doc(db, 'usuarios', user.uid), { fotoURL: user.photoURL });
          await updateProfile(user, { photoURL: user.photoURL });
        }

        navigate('/selecao-projeto');

      } else {
        // Cria perfil se não existir (Primeiro acesso Microsoft → pendente para aprovação)
        await setDoc(doc(db, 'usuarios', user.uid), {
          nome: user.displayName || 'Usuário Microsoft',
          email: effectiveEmail,
          cargo: 'Colaborador',
          funcao: 'colaborador',
          statusAcesso: 'pendente',
          uid: user.uid,
          fotoURL: user.photoURL || null,
          createdAt: new Date()
        });
        if (user.photoURL) {
          await updateProfile(user, { photoURL: user.photoURL });
        }
        await signOut(auth);
        throw new Error("pendente");
      }
  };

  // Lê o resultado do signInWithRedirect ao voltar da Microsoft
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          setLoading(true);
          await checkUserProfile(result.user);
        }
      } catch (error) {
        console.error('Erro no redirect Microsoft:', error);
        if (error?.message === 'dominio-invalido') {
          setAlertInfo({ message: 'Acesso restrito a @normatel.com.br', type: 'error' });
        } else if (error?.message === 'email-indisponivel') {
          setAlertInfo({ message: 'A Microsoft não retornou seu e-mail. Verifique as permissões.', type: 'error' });
        } else if (error?.message === 'pendente') {
          setAlertInfo({ message: 'Conta em análise. Aguarde aprovação.', type: 'error' });
        } else if (error?.code === 'auth/account-exists-with-different-credential') {
          setAlertInfo({ message: 'E-mail já existe com senha.', type: 'warning' });
        } else if (error?.code) {
          setAlertInfo({ message: `Erro Microsoft: ${error.code}`, type: 'error' });
        }
      } finally {
        setLoading(false);
      }
    };
    handleRedirectResult();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirecionamento automático se já está logado
  useEffect(() => {
    if (!authLoading && currentUser && userProfile) {
      if (userProfile.statusAcesso === 'pendente') return;
      navigate('/selecao-projeto');
    }
  }, [authLoading, currentUser, userProfile, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setLoading(true); 
    setAlertInfo(null);
    
    if (!email.endsWith('@normatel.com.br')) { 
      setAlertInfo({ message: "Use email corporativo.", type: 'error' }); 
      setLoading(false); 
      return; 
    }
    
    try {
      // Executar reCAPTCHA antes do login
      const recaptchaToken = await executeRecaptcha('login');
      if (!recaptchaToken) {
        console.warn('reCAPTCHA não disponível, continuando login');
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      
      // Verificação específica para senha (mantém a regra de pendente)
      const docSnap = await getDoc(doc(db, 'usuarios', userCredential.user.uid));
      if (docSnap.exists()) {
         if (docSnap.data().statusAcesso === 'pendente') {
            await signOut(auth);
            throw new Error("pendente");
         }
         const userData = docSnap.data();
         await ActivityLogger.userLogin(userCredential.user.uid, userData.nome || email.split('@')[0]);
      } else {
         // Usuário existe no Auth mas não no Firestore (conta legada)
         await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
           nome: userCredential.user.displayName || email.split('@')[0],
           email: userCredential.user.email,
           funcao: 'colaborador',
           statusAcesso: 'pendente',
           fotoURL: userCredential.user.photoURL || null,
           createdAt: new Date()
         });
         await signOut(auth);
         throw new Error("pendente");
      }
    } catch (error) {
      console.error("Erro:", error);
      if (error.message === 'pendente') setAlertInfo({ message: "Conta em análise. Aguarde aprovação.", type: 'error' });
      else if (error.code === 'auth/user-not-found') setAlertInfo({ message: "Usuário não encontrado. Faça o cadastro primeiro.", type: 'error' });
      else if (error.code === 'auth/wrong-password') setAlertInfo({ message: "Senha incorreta.", type: 'error' });
      else setAlertInfo({ message: "Email ou senha incorretos.", type: 'error' });
    } finally { setLoading(false); }
  };

  const handleMicrosoftLogin = async () => {
    setLoading(true); setAlertInfo(null);
    const provider = new OAuthProvider('microsoft.com');
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
        const result = await signInWithPopup(auth, provider);
        await checkUserProfile(result.user);
    } catch (error) {
        console.error("Erro Microsoft:", error);
      // Alguns navegadores com COOP/COEP bloqueiam o polling do popup; usamos redirect como fallback seguro
      const coopBlocked = error?.message?.includes('window.closed');
      if (coopBlocked) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          console.error('Erro Microsoft (redirect):', redirectError);
          setAlertInfo({ message: 'Erro ao redirecionar para login Microsoft.', type: 'error' });
          return;
        }
      }
      if (error?.message === 'dominio-invalido') {
        setAlertInfo({ message: "Acesso restrito a @normatel.com.br", type: 'error' });
      } else if (error?.message === 'email-indisponivel') {
        setAlertInfo({ message: "A Microsoft não retornou seu e-mail. Verifique as permissões da conta.", type: 'error' });
      } else if (error?.message === 'pendente') {
        setAlertInfo({ message: "Conta em análise.", type: 'error' });
      } else if (error?.code === 'auth/account-exists-with-different-credential') {
        setAlertInfo({ message: "E-mail já existe com senha.", type: 'warning' });
      } else if (error?.code === 'auth/popup-closed-by-user') {
        setAlertInfo({ message: "Login cancelado.", type: 'error' });
      } else {
        const fallback = error?.code || error?.message || 'Erro desconhecido.';
        setAlertInfo({ message: `Erro: ${fallback}`, type: 'error' });
      }
    } finally { setLoading(false); }
  };

  if (authLoading) return <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-white to-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#57B952]"></div></div>;

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 transition-colors duration-200">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/3 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl"></div>
      </div>
      
      {alertInfo && <Alert message={alertInfo.message} type={alertInfo.type} onClose={() => setAlertInfo(null)} />}
      {/* ThemeToggle removed */}
      <header className="relative w-full flex items-center justify-center py-4 sm:py-5 md:py-8 px-2 sm:px-4 md:px-8 min-h-[56px] sm:min-h-[64px] md:h-24 bg-white/5 backdrop-blur-md border-b border-white/10 z-20">
        <button onClick={() => navigate('/')} className="absolute left-2 sm:left-4 md:left-8 flex items-center gap-2 text-gray-300 hover:text-[#57B952] hover:bg-white/5 px-4 py-2 rounded-lg transition-all font-semibold text-xs sm:text-sm backdrop-blur-sm">
             <ArrowLeft size={18} className="sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Voltar</span>
        </button>
        <img 
          src={isDark ? "/img/Normatel Engenharia_BRANCO.png" : "/img/Normatel Engenharia_PRETO.png"} 
          alt="Logo" 
          className="h-6 sm:h-8 md:h-10 w-auto object-contain drop-shadow-lg" 
        />
      </header>
      <main className="flex-grow flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 min-h-screen relative z-10">
        <div className="w-full max-w-xs sm:max-w-sm bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 md:p-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-center text-white mb-8 md:mb-10">Acessar Sistema</h2>
          
          <button type="button" onClick={handleMicrosoftLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#2F2F2F] to-[#1a1a1a] hover:from-[#444] hover:to-[#222] text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-all mb-6 sm:mb-8 border border-white/20 hover:border-white/40 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="sm:w-6 sm:h-6" viewBox="0 0 21 21"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#00a4ef" d="M1 11h9v9H1z"/><path fill="#7fba00" d="M11 1h9v9h-9z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>
            <span>{loading ? 'Processando...' : 'Entrar com Microsoft'}</span>
          </button>
          
          <div className="flex items-center gap-4 mb-6 sm:mb-8">
            <div className="h-px bg-white/20 flex-1"></div>
            <span className="text-xs sm:text-sm text-gray-200 whitespace-nowrap font-medium">ou email corporativo</span>
            <div className="h-px bg-white/20 flex-1"></div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-2">
              <label className="block text-xs sm:text-sm font-semibold text-gray-200 ml-1">Email</label>
              <div className="relative flex items-center">
                <Mail size={18} className="absolute left-3 sm:left-4 text-gray-400 flex-shrink-0 pointer-events-none z-10" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-12 sm:pl-14 pr-4 py-2.5 sm:py-3.5 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#57B952] focus:border-transparent text-white text-sm sm:text-base outline-none backdrop-blur-sm transition-all hover:bg-white/15" style={{paddingLeft: '2.75rem'}} placeholder="seu.nome@normatel.com.br" required />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="block text-xs sm:text-sm font-semibold text-gray-200 ml-1">Senha</label>
              <div className="relative flex items-center">
                <Lock size={18} className="absolute left-3 sm:left-4 text-gray-400 flex-shrink-0 pointer-events-none z-10" />
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full pl-12 sm:pl-14 pr-4 py-2.5 sm:py-3.5 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#57B952] focus:border-transparent text-white text-sm sm:text-base outline-none backdrop-blur-sm transition-all hover:bg-white/15" style={{paddingLeft: '2.75rem'}} placeholder="••••••" required />
              </div>
            </div>
            
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#57B952] to-[#3d8c38] hover:from-[#6BC962] hover:to-[#45a241] text-white font-bold py-3 sm:py-4 rounded-xl transition-all mt-6 sm:mt-8 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          
          {/* ÁREA DE LINKS DESTACADA */}
          <div className="mt-8 sm:mt-10 space-y-4">
            <Link 
              to="/esqueceu-senha" 
              className="block text-center text-xs sm:text-sm font-semibold text-[#57B952] hover:text-[#6BC962] hover:underline transition-all"
            >
              Esqueceu sua senha?
            </Link>
            
            <div className="relative flex py-3 items-center">
              <div className="flex-grow border-t border-white/20"></div>
              <span className="flex-shrink-0 mx-3 text-gray-600 text-xs uppercase tracking-widest font-bold">Novo aqui?</span>
              <div className="flex-grow border-t border-white/20"></div>
            </div>

            <Link 
              to="/cadastro" 
              className="flex items-center justify-center w-full py-3 sm:py-4 px-4 sm:px-6 border-2 border-[#57B952] text-[#57B952] rounded-xl font-bold hover:bg-[#57B952]/20 hover:border-[#6BC962] hover:text-[#6BC962] transition-all text-xs sm:text-sm backdrop-blur-sm"
            >
              Criar Novo Cadastro
            </Link>
          </div>

        </div>
      </main>
      <footer className="w-full py-4 sm:py-6 text-center text-gray-300 text-xs shrink-0 bg-gray-900/50 backdrop-blur-md border-t border-gray-700 px-2 z-20">
        &copy; 2025 Normatel Engenharia
      </footer>
    </div>
  );
}
export default Login;
