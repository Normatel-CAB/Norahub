import { ChevronRight, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Breadcrumb({ items = [] }) {
  const navigate = useNavigate();
  return (
    <nav className="flex items-center gap-1 text-xs text-txt-faint select-none flex-wrap">
      <button
        onClick={() => navigate('/selecao-projeto')}
        className="flex items-center gap-1 text-txt-faint hover:text-txt-dim transition-colors"
      >
        <Home size={11} />
        <span>Início</span>
      </button>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight size={11} className="text-txt-faint" />
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="text-txt-faint hover:text-txt-dim transition-colors truncate max-w-[180px]"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-txt-dim font-medium truncate max-w-[200px]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
