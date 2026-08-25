export function CarteiraBadge({ nome, cor, size = 'md' }) {
  const textSize = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${textSize}`}
      style={{
        backgroundColor: `${cor}20`,
        borderColor: `${cor}40`,
        color: cor,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cor }} />
      {nome}
    </span>
  );
}
