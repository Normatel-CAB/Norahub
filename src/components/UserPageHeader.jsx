import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import NotificationCenter from './NotificationCenter';

export function UserPageHeader({ backTo, backLabel = 'Voltar', children }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { currentUser, userProfile } = useAuth();
  const isDark = theme === 'dark';
  const primeiroNome =
    userProfile?.nome?.split(' ')[0] ||
    currentUser?.displayName?.split(' ')[0] ||
    'Usuário';
  const fotoURL = currentUser?.photoURL || userProfile?.fotoURL;

  return (
    <header className="relative w-full flex items-center justify-between py-3 md:py-6 px-3 md:px-8 border-b border-gray-700 min-h-[56px] md:h-20 bg-gray-900/50 backdrop-blur-md z-20">
      <div className="flex items-center min-w-[44px]">
        <button
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          className="flex items-center gap-1 md:gap-2 text-gray-300 hover:text-[#57B952] hover:bg-white/5 px-2 sm:px-4 py-2 rounded-lg transition-all font-semibold text-xs md:text-sm shrink-0"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">{backLabel}</span>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center gap-2 md:gap-4 px-2">
        {children ?? (
          <>
            <img
              src="/img/Designer (6).png"
              alt="Nora"
              className="h-9 sm:h-10 md:h-14 w-auto object-contain drop-shadow-lg"
            />
            <span className="text-gray-500 text-lg md:text-2xl font-light">|</span>
            <img
              src={
                isDark
                  ? '/img/Normatel Engenharia_BRANCO.png'
                  : '/img/Normatel Engenharia_PRETO.png'
              }
              alt="Normatel"
              className="h-5 sm:h-6 md:h-10 w-auto object-contain drop-shadow-lg"
            />
          </>
        )}
      </div>

      {currentUser && (
        <div className="flex items-center gap-2 md:gap-3 min-w-[80px] justify-end shrink-0">
          <NotificationCenter />
          <button
            onClick={() => navigate('/perfil')}
            className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-[#57B952] bg-gray-700 flex items-center justify-center hover:border-green-600 transition-colors cursor-pointer shrink-0"
          >
            {fotoURL ? (
              <img src={fotoURL} className="w-full h-full object-cover" alt="Avatar" />
            ) : (
              <User size={16} className="md:w-5 md:h-5 text-gray-500" />
            )}
          </button>
          <span className="hidden sm:inline text-xs md:text-base font-semibold text-white truncate max-w-[80px] md:max-w-none">
            <span className="hidden md:inline">Olá, </span>
            {primeiroNome}
          </span>
        </div>
      )}
    </header>
  );
}
