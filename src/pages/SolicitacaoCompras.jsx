import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function SolicitacaoCompras() {
  const location = useLocation();
  const navigate = useNavigate();

  // Pega a URL enviada pela página de Seleção de Projeto
  const targetUrl = location.state?.targetUrl;

  // URL de fallback caso acessem direto (pode deixar vazio ou usar a do 743)
  const DEFAULT_URL = "https://normatelce.sharepoint.com/:l:/s/Projeto743-FacilitiesMultiserviosCabinas/JACsQKjPAViPSbfkQUOC15tGARSUJt6NWklSnGKDPKx3DUA?nav=MjcyYzUzOTAtZTkzYi00Y2I1LTg1MDMtMDFkMWQwZmU1MGE4";

  useEffect(() => {
    if (targetUrl) {
        window.location.href = targetUrl;
    } else {
        // Se não tiver URL específica, usa a padrão ou volta pra seleção
        window.location.href = DEFAULT_URL;
    }
  }, [targetUrl]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center nt-page-bg text-txt-dim font-[Outfit,Poppins]">
      <div className="relative z-10 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand mx-auto mb-4"></div>
        <p>Redirecionando para o SharePoint do Projeto...</p>
      </div>
    </div>
  );
}

export default SolicitacaoCompras;
