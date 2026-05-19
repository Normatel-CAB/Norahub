import { Link, useNavigate } from 'react-router-dom';
import { LogIn, Building2, HardHat, ChevronRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

function Capa() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 transition-colors duration-200">
      {/* Background decorativo com gradiente */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/5 rounded-full blur-3xl"></div>
      </div>
      
    {/* ThemeToggle removed */}

    <header className="relative w-full flex items-center justify-center py-4 sm:py-5 md:py-8 px-2 sm:px-4 md:px-8 min-h-[56px] sm:min-h-[64px] md:h-24 bg-gray-900/50 backdrop-blur-md border-b border-gray-700 transition-all duration-200 z-20">
        <button 
            onClick={() => navigate('/login')} 
            className="absolute left-2 sm:left-4 md:left-8 flex items-center gap-2 text-gray-300 hover:text-[#57B952] hover:bg-white/5 px-4 py-2 rounded-lg transition-all font-semibold text-xs sm:text-sm backdrop-blur-sm"
        >
            <LogIn size={18} className="sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Login</span>
        </button>

        {/* Logos Centralizadas (Parceria) */}
        <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
            <img src="/img/Designer (6).png" alt="Logo Petrobras" className="h-10 sm:h-12 md:h-14 w-auto object-contain drop-shadow-lg" />
            <div className="h-8 sm:h-10 md:h-12 w-px bg-gradient-to-b from-[#57B952]/0 via-[#57B952]/50 to-[#57B952]/0"></div>
            <img 
              src={isDark ? "/img/Normatel Engenharia_BRANCO.png" : "/img/Normatel Engenharia_PRETO.png"} 
              alt="Logo Normatel" 
              className="h-6 sm:h-8 md:h-10 w-auto object-contain drop-shadow-lg" 
            />
        </div>
      </header>

    <main className="flex-grow flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 relative z-10">
        <div className="text-center mb-12 sm:mb-16 md:mb-20 px-2 max-w-3xl">
            <div className="inline-block mb-4 px-4 py-2 bg-[#57B952]/20 border border-[#57B952]/50 rounded-full backdrop-blur-sm">
              <p className="text-xs sm:text-sm font-semibold text-[#57B952] uppercase tracking-wider">Portal Integrado</p>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4 sm:mb-6 leading-tight">
              Bem-vindo ao <span className="bg-gradient-to-r from-[#57B952] to-[#3d8c38] bg-clip-text text-transparent">NoraHub</span>
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Selecione sua organização para acessar os serviços e gerenciar seus projetos de forma integrada.
            </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 md:gap-8 justify-center items-stretch w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-5xl px-2">
            
            {/* Card PETROBRAS */}
            <Link 
                to="/tutoriais" 
                className="group relative w-full lg:w-96 h-64 sm:h-80 md:h-96 lg:h-96 rounded-2xl sm:rounded-3xl overflow-hidden no-underline transition-all duration-500 hover:-translate-y-2 focus:outline-none focus:ring-2 focus:ring-[#008542] focus:ring-offset-2 focus:ring-offset-gray-900"
            >
                {/* Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#008542] via-[#006b38] to-[#005030]"></div>
                {/* Shine effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-[#00A854] via-transparent to-[#004d2a] opacity-0 group-hover:opacity-20 blur transition-opacity duration-500"></div>
                {/* Content */}
                <div className="relative h-full p-6 sm:p-8 md:p-8 flex flex-col items-center text-center justify-between z-10 backdrop-blur-sm">
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-white/15 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 flex items-center justify-center group-hover:bg-white/25 group-hover:scale-110 transition-all duration-500 backdrop-blur-md border border-white/20">
                        <HardHat size={56} className="sm:w-16 sm:h-16 md:w-20 md:h-20 text-white drop-shadow-lg" />
                      </div>
                    </div>
                    <div className="space-y-3 md:space-y-4">
                      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white drop-shadow-lg">Sou Petrobras</h2>
                      <p className="text-sm sm:text-base text-white/90 leading-relaxed">Acesso à base de conhecimento e tutoriais.</p>
                    </div>
                    <div className="w-full">
                      <div className="inline-flex items-center gap-2 sm:gap-3 font-bold bg-white/20 hover:bg-white/30 text-white px-4 sm:px-6 md:px-8 py-3 sm:py-4 rounded-xl transition-all duration-300 backdrop-blur-md border border-white/30 group-hover:border-white/50 shadow-lg">
                        Acessar Tutoriais <ChevronRight size={18} className="sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                </div>
            </Link>

            {/* Card NORMATEL */}
            <Link 
                to="/login" 
                className="group relative w-full lg:w-96 h-64 sm:h-80 md:h-96 lg:h-96 rounded-2xl sm:rounded-3xl overflow-hidden text-white no-underline transition-all duration-500 hover:-translate-y-2 focus:outline-none focus:ring-2 focus:ring-[#57B952] focus:ring-offset-2 focus:ring-offset-gray-900"
            >
                {/* Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#57B952] via-[#4a9c46] to-[#3d8c38]"></div>
                {/* Shine effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-[#6BC962] via-transparent to-[#2d6a28] opacity-0 group-hover:opacity-20 blur transition-opacity duration-500"></div>
                {/* Content */}
                <div className="relative h-full p-6 sm:p-8 md:p-8 flex flex-col items-center text-center justify-between z-10 backdrop-blur-sm">
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-white/15 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 flex items-center justify-center group-hover:bg-white/25 group-hover:scale-110 transition-all duration-500 backdrop-blur-md border border-white/20">
                        <Building2 size={56} className="sm:w-16 sm:h-16 md:w-20 md:h-20 text-white drop-shadow-lg" />
                      </div>
                    </div>
                    <div className="space-y-3 md:space-y-4">
                      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white drop-shadow-lg">Sou Normatel</h2>
                      <p className="text-sm sm:text-base text-white/90 leading-relaxed">Gestão de compras e solicitações.</p>
                    </div>
                    <div className="w-full">
                      <div className="inline-flex items-center gap-2 sm:gap-3 font-bold bg-white/20 hover:bg-white/30 text-white px-4 sm:px-6 md:px-8 py-3 sm:py-4 rounded-xl transition-all duration-300 backdrop-blur-md border border-white/30 group-hover:border-white/50 shadow-lg">
                        Fazer Login <ChevronRight size={18} className="sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                </div>
            </Link>

        </div>
      </main>
      <footer className="w-full py-4 sm:py-6 text-center text-gray-400 text-xs shrink-0 bg-gray-900/50 backdrop-blur-md border-t border-gray-700 transition-all duration-200 px-2 z-20">
        <p>&copy; 2025 Parceria Petrobras &amp; Normatel Engenharia</p>
      </footer>
    </div>
  );
}
export default Capa;
