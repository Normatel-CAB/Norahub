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
        className="fixed bottom-4 right-4 p-3 bg-surface-2 backdrop-blur-xl rounded-full shadow-lg hover:shadow-xl transition-all border border-hairline hover:border-hairline-hi z-50 group"
        title="Atalhos de teclado (?)"
      >
        <Keyboard size={20} className="text-txt-dim group-hover:text-brand-lite" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="nt-glass w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-hairline">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/15 rounded-lg flex items-center justify-center">
              <Keyboard size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-txt">Atalhos de Teclado</h2>
              <p className="text-sm text-txt-faint">Aumente sua produtividade</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-surface-2 rounded-lg transition-colors"
          >
            <X size={20} className="text-txt-dim" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {shortcuts.map((category, idx) => (
              <div key={idx}>
                <h3 className="text-sm font-semibold text-txt-faint uppercase mb-3">
                  {category.category}
                </h3>
                <div className="space-y-2">
                  {category.items.map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-surface transition-colors"
                    >
                      <span className="text-txt-dim">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, k) => (
                          <span key={k} className="flex items-center gap-1">
                            <kbd className="px-3 py-1.5 bg-surface-solid border border-hairline rounded-md text-sm font-mono shadow-sm text-txt">
                              {key}
                            </kbd>
                            {k < shortcut.keys.length - 1 && (
                              <span className="text-txt-dim text-xs">+</span>
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
        <div className="border-t border-hairline p-4 bg-surface backdrop-blur-md">
          <p className="text-xs text-center text-txt-faint">
            Pressione <kbd className="px-2 py-1 bg-surface-solid border border-hairline rounded text-xs text-txt">?</kbd> para abrir esta ajuda a qualquer momento
          </p>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcuts;
