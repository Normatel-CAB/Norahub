import { Link, useNavigate } from 'react-router-dom';
import { UserCheck, ShoppingCart, ArrowLeft, User, LogOut, ChevronRight } from 'lucide-react';
// ThemeToggle removed: app forced to light mode
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';

function MenuNormatel() {
  const { theme } = useTheme();
  const { currentUser, userProfile } = useAuth();
  const fotoURL = currentUser?.photoURL || userProfile?.fotoURL;
  const primeiroNome = (currentUser?.displayName || userProfile?.nome || 'Usuário').split(' ')[0];
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  // Links
  const LINK_COMPRADOR_DESTINO = "https://normatelce.sharepoint.com/"; 
  const LINK_SOLICITANTE = "https://normatelce.sharepoint.com/:l:/s/Projeto743-FacilitiesMultiserviosCabinas/JACsQKjPAViPSbfkQUOC15tGARSUJt6NWklSnGKDPKx3DUA?nav=MjcyYzUzOTAtZTkzYi00Y2I1LTg1MDMtMDFkMWQwZmU1MGE4";

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden relative bg-gray-900 transition-colors duration-200 text-white">
      {/* ThemeToggle removed */}

      <header className="relative w-full flex items-center justify-center py-3 md:py-6 px-3 md:px-8 border-b border-gray-700 min-h-[56px] md:h-20 bg-gray-900/50">
        <button onClick={handleLogout} className="absolute left-3 md:left-8 flex items-center gap-1 md:gap-2 text-gray-500 hover:text-red-500 transition-colors font-medium text-xs md:text-sm shrink-0 z-10">
             <LogOut size={16} className="md:w-[18px] md:h-[18px]" /> <span className="hidden sm:inline">Sair</span>
        </button>
        
        <div className="flex items-center gap-2 md:gap-4">
        <img src="/img/Designer (6).png" alt="Logo Petrobras" className="h-10 sm:h-12 md:h-14 w-auto object-contain drop-shadow-lg" />
        <span className="text-gray-600 text-lg md:text-2xl font-light">|</span>
        <img src={isDark ? "/img/Normatel Engenharia_BRANCO.png" : "/img/Normatel Engenharia_PRETO.png"} alt="Logo Normatel" className="h-6 sm:h-8 md:h-10 w-auto object-contain" />
      </div>

        <div className="absolute right-3 md:right-8 flex items-center gap-2 md:gap-3 mr-12 md:mr-16 shrink-0 z-10">
             <button 
                 onClick={() => navigate('/perfil')} 
                 className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-[#57B952] bg-gray-700 flex items-center justify-center hover:border-green-600 transition-colors cursor-pointer shrink-0"
             >
                 {fotoURL ? <img src={fotoURL} className="w-full h-full object-cover" alt="Avatar" /> : <User size={16} className="md:w-5 md:h-5 text-gray-500" />}
             </button>
             <span className="text-xs md:text-base lg:text-lg font-semibold text-white truncate max-w-[60px] sm:max-w-[100px] md:max-w-none"><span className="hidden md:inline">Olá, </span>{primeiroNome}</span>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center p-3 md:p-8">
        <div className="w-full max-w-4xl">
            <div className="text-center mb-6 md:mb-12">
              <h1 className="text-xl md:text-3xl font-bold text-white mb-2 md:mb-4">Menu Principal</h1>
              <p className="text-sm md:text-base text-gray-500">Selecione seu perfil de acesso.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card Solicitante */}
                <a 
                    href={LINK_SOLICITANTE}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group bg-gray-800 p-10 rounded-2xl shadow-lg border border-gray-700 flex flex-col items-center text-center transition-all transform hover:-translate-y-2 cursor-pointer"
                >
                    <div className="bg-green-900/30 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform text-[#57B952]">
                        <UserCheck size={48} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Sou Solicitante</h3>
                    <p className="text-gray-500 mb-6">Fazer novas solicitações.</p>
                    <span className="text-[#57B952] font-bold flex items-center gap-1">Acessar <ChevronRight size={16} /></span>
                </a>

                {/* Card Comprador */}
                <a 
                    href={LINK_COMPRADOR_DESTINO}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-gray-800 p-10 rounded-2xl shadow-lg border border-gray-700 flex flex-col items-center text-center transition-all transform hover:-translate-y-2 cursor-pointer"
                >
                    <div className="bg-blue-900/30 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform text-blue-400">
                        <ShoppingCart size={48} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Sou Comprador</h3>
                    <p className="text-gray-500 mb-6">Painel de aprovação.</p>
                    <span className="text-blue-400 font-bold flex items-center gap-1">Acessar <ChevronRight size={16} /></span>
                </a>
            </div>
        </div>
      </main>

      <footer className="w-full py-6 text-center text-gray-300 text-xs shrink-0 border-t border-gray-700 bg-gray-900">&copy; 2025 Parceria Petrobras & Normatel Engenharia</footer>
    </div>
  );
}

export default MenuNormatel;
