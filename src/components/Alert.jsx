import { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

function Alert({ message, type, onClose }) {
  // Fecha automaticamente após 5 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  // Definição de cores baseada no tipo
  const isSuccess = type === 'success';
  
  const successClasses = "bg-green-500/15 border-green-500 text-green-300";
  const errorClasses = "bg-red-500/15 border-red-500 text-red-300";

  return (
    <div className={`fixed top-4 right-4 z-[100] flex items-center p-4 rounded-lg border-l-4 shadow-xl transition-all duration-500 transform translate-y-0 animate-fade-in ${isSuccess ? successClasses : errorClasses} max-w-sm w-full`}>
      
      {/* Ícone */}
      <div className="flex-shrink-0">
        {isSuccess ? (
          <CheckCircle className={`w-6 h-6 ${isSuccess ? 'text-green-500' : 'text-red-500'}`} />
        ) : (
          <AlertCircle className={`w-6 h-6 ${isSuccess ? 'text-green-500' : 'text-red-500'}`} />
        )}
      </div>

      {/* Mensagem */}
      <div className="ml-3 flex-1">
        <p className="text-sm font-medium">
          {isSuccess ? 'Sucesso!' : 'Atenção'}
        </p>
        <p className="text-sm opacity-90 mt-1">
          {message}
        </p>
      </div>

      {/* Botão Fechar */}
      <button 
        onClick={onClose}
        className={`ml-4 inline-flex flex-shrink-0 justify-center items-center h-5 w-5 rounded-md hover:opacity-50 focus:outline-none ${isSuccess ? 'text-green-300' : 'text-red-300'}`}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default Alert;