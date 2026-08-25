const CARGO_MAP = {
  'admin':             { bg: 'bg-red-500/15',    border: 'border-red-500/25',    text: 'text-red-400',    dot: 'bg-red-400',    label: 'Administrador' },
  'Gerente de Projeto':{ bg: 'bg-blue-500/15',   border: 'border-blue-500/25',   text: 'text-blue-400',   dot: 'bg-blue-400',   label: 'Gerente de Projeto' },
  'Supervisor':        { bg: 'bg-purple-500/15', border: 'border-purple-500/25', text: 'text-purple-400', dot: 'bg-purple-400', label: 'Supervisor' },
  'Engenheiro':        { bg: 'bg-green-500/15',  border: 'border-green-500/25',  text: 'text-green-400',  dot: 'bg-green-400',  label: 'Engenheiro' },
};

const DEFAULT_CARGO = { bg: 'bg-gray-500/15', border: 'border-gray-500/25', text: 'text-gray-400', dot: 'bg-gray-400' };

function isGerente(funcao) {
  return typeof funcao === 'string' && funcao.toLowerCase().includes('gerente');
}

export function CargoBadge({ funcao, size = 'md' }) {
  const style = CARGO_MAP[funcao] ?? (isGerente(funcao) ? CARGO_MAP['Gerente de Projeto'] : DEFAULT_CARGO);
  const label = style.label ?? funcao ?? 'Colaborador';
  const textSize = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${textSize} ${style.bg} ${style.border} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
      {label}
    </span>
  );
}
