import { Sun, Moon, Palette } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { name: 'light', icon: Sun, label: 'Claro' },
    { name: 'dark', icon: Moon, label: 'Escuro' },
    // Removida a opção 'system'
  ];

  return (
    <div className="fixed bottom-6 right-6 z-[90] group">
      <div className="absolute bottom-0 right-0 bg-gradient-to-r from-brand-lite via-brand to-brand-deep text-white p-3 rounded-full shadow-lg transition-all duration-300 group-hover:w-36 group-hover:h-14 w-12 h-12 flex items-center justify-end overflow-hidden">
         <div className="absolute right-3 top-1/2 -translate-y-1/2"><Palette size={24} /></div>
         <div className="flex items-center gap-2 mr-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
            {themes.map((t) => {
              const Icon = t.icon;
              const isActive = theme === t.name;
              return (
                <button key={t.name} onClick={() => setTheme(t.name)} className={`p-1.5 rounded-full transition-all duration-200 ${isActive ? 'bg-white/20 backdrop-blur-md text-brand-lite shadow-sm scale-110 border border-white/30' : 'text-white/80 hover:bg-white/20 hover:text-white'}`} title={t.label}>
                  <Icon size={18} />
                </button>
              );
            })}
         </div>
      </div>
    </div>
  );
}