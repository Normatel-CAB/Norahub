import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Escutar o evento beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Verificar se já foi instalado ou se o usuário já fechou o prompt
      const hasClosedPrompt = localStorage.getItem('pwa-install-prompt-closed');
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      
      if (!hasClosedPrompt && !isStandalone) {
        // Mostrar o prompt após 3 segundos
        setTimeout(() => {
          setShowInstallPrompt(true);
        }, 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Verificar se já está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Mostrar o prompt de instalação
    deferredPrompt.prompt();

    // Esperar pela escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Usuário aceitou instalar o PWA');
    } else {
      console.log('Usuário recusou instalar o PWA');
    }

    // Limpar o prompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleClose = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-prompt-closed', 'true');
  };

  if (!showInstallPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 nt-glass p-4 z-50 animate-slide-up">
      <button
        onClick={handleClose}
        className="absolute top-3 right-3 text-txt-dim hover:text-txt-faint transition-colors"
      >
        <X size={20} />
      </button>

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-brand-lite to-brand rounded-xl flex items-center justify-center shrink-0">
          <img src="/img/noraicon.png" alt="NoraHub" className="w-8 h-8" />
        </div>

        <div className="flex-1">
          <h3 className="font-bold text-txt mb-1">
            Instale o NoraHub
          </h3>
          <p className="text-sm text-txt-faint mb-3">
            Acesse mais rápido e use offline instalando nosso app
          </p>

          <button
            onClick={handleInstallClick}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-lite via-brand to-brand-deep text-white font-semibold py-2.5 px-4 rounded-lg hover:brightness-110 transition-all"
          >
            <Download size={18} />
            Instalar Aplicativo
          </button>
        </div>
      </div>
    </div>
  );
}

export default InstallPWA;
