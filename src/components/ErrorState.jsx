import { AlertTriangle, RefreshCw, WifiOff, ShieldOff, Search } from 'lucide-react';

const CONFIGS = {
  network:    { Icon: WifiOff,       title: 'Sem conexão',     message: 'Verifique sua internet e tente novamente.',  color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  permission: { Icon: ShieldOff,     title: 'Acesso negado',   message: 'Você não tem permissão para este conteúdo.', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20' },
  notfound:   { Icon: Search,        title: 'Não encontrado',  message: 'O item não existe ou foi removido.',         color: 'text-gray-400',   bg: 'bg-white/5',       border: 'border-white/10' },
  generic:    { Icon: AlertTriangle, title: 'Erro inesperado', message: 'Algo deu errado. Tente novamente.',          color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
};

export function ErrorState({ type = 'generic', title, message, onRetry, className = '' }) {
  const c = CONFIGS[type] ?? CONFIGS.generic;
  const { Icon } = c;
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 ${className}`}>
      <div className={`${c.bg} ${c.border} border rounded-2xl p-8 max-w-sm w-full text-center`}>
        <div className={`w-14 h-14 ${c.bg} rounded-xl flex items-center justify-center mx-auto mb-4 border ${c.border}`}>
          <Icon size={26} className={c.color} />
        </div>
        <h3 className="text-base font-semibold text-white mb-2">{title ?? c.title}</h3>
        <p className="text-sm text-gray-400 mb-6">{message ?? c.message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
