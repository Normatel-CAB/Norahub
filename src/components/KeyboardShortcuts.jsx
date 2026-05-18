import { useState, useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // ? para abrir ajuda de atalhos
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const activeElement = document.activeElement;
        const isInputActive = activeElement?.tagName === 'INPUT' || 
                             activeElement?.tagName === 'TEXTAREA' ||
                             activeElement?.isContentEditable;
        
        if (!isInputActive) {
          e.preventDefault();
          setIsOpen(true);
        }
      }
      
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const shortcuts = [
    { category: 'Navegação', items: [
      { keys: ['Ctrl', 'K'], description: 'Abrir busca global' },
      { keys: ['?'], description: 'Mostrar atalhos de teclado' },
      { keys: ['Esc'], description: 'Fechar modal/busca' },
      { keys: ['Alt', '←'], description: 'Voltar' },
    ]},
    { category: 'Ações', items: [
      { keys: ['Ctrl', 'N'], description: 'Novo projeto (em breve)' },
      { keys: ['Ctrl', 'U'], description: 'Upload de arquivo (em breve)' },
      { keys: ['Ctrl', 'S'], description: 'Salvar' },
    ]},
    { category: 'Interface', items: [
      { keys: ['Ctrl', 'B'], description: 'Toggle sidebar (em breve)' },
      { keys: ['Ctrl', 'D'], description: 'Alternar tema claro/escuro (em breve)' },
    ]},
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-white/10 backdrop-blur-xl rounded-full shadow-lg hover:shadow-xl transition-all border border-white/20 z-50 group"
        title="Atalhos de teclado (?)"
      >
        <Keyboard size={20} className="text-gray-400 group-hover:text-[#57B952]" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-800 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/15 rounded-lg flex items-center justify-center">
              <Keyboard size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Atalhos de Teclado</h2>
              <p className="text-sm text-gray-500">Aumente sua produtividade</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {shortcuts.map((category, idx) => (
              <div key={idx}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  {category.category}
                </h3>
                <div className="space-y-2">
                  {category.items.map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.05] transition-colors"
                    >
                      <span className="text-gray-300">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, k) => (
                          <span key={k} className="flex items-center gap-1">
                            <kbd className="px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-md text-sm font-mono shadow-sm text-white">
                              {key}
                            </kbd>
                            {k < shortcut.keys.length - 1 && (
                              <span className="text-gray-400 text-xs">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4 bg-gray-900/50 backdrop-blur-md">
          <p className="text-xs text-center text-gray-500">
            Pressione <kbd className="px-2 py-1 bg-gray-900 border border-gray-600 rounded text-xs text-white">?</kbd> para abrir esta ajuda a qualquer momento
          </p>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcuts;
