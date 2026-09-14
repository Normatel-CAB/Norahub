import { useEffect } from 'react';

function AprovacaoCompras() {
  useEffect(() => {
    // Redireciona para o link SAML da Microsoft fornecido
    window.location.href = "https://normatelce.sharepoint.com/:l:/s/Projeto743-FacilitiesMultiserviosCabinas/JACsQKjPAViPSbfkQUOC15tGAd2cfqyNH50fZdhoUaX5HG0?e=AdKqXJ";
  }, []);

  // Interface de carregamento enquanto redireciona
  return (
    <div className="min-h-screen w-full flex items-center justify-center nt-page-bg text-txt-dim font-[Outfit,Poppins]">
      <div className="relative z-10 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-lite mx-auto mb-4"></div>
        <p>Redirecionando para Login Microsoft...</p>
      </div>
    </div>
  );
}

export default AprovacaoCompras;
