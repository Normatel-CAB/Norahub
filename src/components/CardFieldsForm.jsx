import { X, Layers } from 'lucide-react';
import { SETORES_PADRAO } from '../services/carteirasDeProjeto';

export const CARD_TYPES = [
  { v: 'link',         l: '🔗 Link Externo' },
  { v: 'documents',    l: '📁 Documentos' },
  { v: 'reports',      l: '📊 Relatórios' },
  { v: 'files',        l: '📄 Arquivos PDF' },
  { v: 'spreadsheets', l: '📈 Planilhas' },
  { v: 'forms',        l: '📝 Formulários' },
  { v: 'approvals',    l: '✅ Aprovações' },
  { v: 'inventory',    l: '📦 Estoque' },
  { v: 'financial',    l: '💰 Financeiro' },
  { v: 'hr',           l: '👥 RH' },
];

export const NO_URL_TYPES = new Set(['documents', 'files', 'spreadsheets']);
export const CUSTOM_FORM_TYPES = new Set(['forms']);

const inputCls =
  'w-full px-3 py-2.5 bg-white/[0.05] border border-white/[0.10] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#57B952]/60 focus:bg-white/[0.07] transition-all';

export function CardFieldsForm({ cards, onAdd, onUpdate, onRemove }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Cards
          </label>
          {cards.filter(c => (c.name ?? c.nome ?? '').trim()).length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#57B952]/20 text-[#57B952] text-[10px] font-bold">
              {cards.filter(c => (c.name ?? c.nome ?? '').trim()).length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#57B952]/10 text-[#57B952] border border-[#57B952]/20 hover:bg-[#57B952]/20 font-semibold transition-colors"
        >
          + Novo card
        </button>
      </div>

      {cards.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="w-full flex flex-col items-center justify-center gap-2 py-8 border border-dashed border-white/[0.10] rounded-2xl hover:border-[#57B952]/30 hover:bg-[#57B952]/[0.03] transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] group-hover:bg-[#57B952]/10 flex items-center justify-center transition-colors">
            <span className="text-xl text-gray-600 group-hover:text-[#57B952] transition-colors">+</span>
          </div>
          <p className="text-xs font-medium text-gray-500 group-hover:text-gray-400 transition-colors">
            Clique para adicionar um card
          </p>
        </button>
      ) : (
        <div className="space-y-3">
          {cards.map((card, idx) => {
            const name = card.name ?? card.nome ?? '';
            const type = card.type ?? card.tipo ?? 'link';
            const description = card.description ?? card.descricao ?? '';
            const url = card.url ?? '';
            const carteiraId = card.carteiraId ?? null;
            const noUrl = NO_URL_TYPES.has(type);
            const isForm = CUSTOM_FORM_TYPES.has(type);

            return (
              <div
                key={idx}
                className="group bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.14] rounded-2xl p-4 space-y-3 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#57B952]/15 border border-[#57B952]/20 flex items-center justify-center text-[11px] font-bold text-[#57B952] flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">Card {idx + 1}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/15 text-gray-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  <input
                    type="text"
                    placeholder="Nome do card *"
                    value={name}
                    onChange={e => onUpdate(idx, 'name', e.target.value)}
                    className={`sm:col-span-3 ${inputCls}`}
                  />
                  <select
                    value={type}
                    onChange={e => onUpdate(idx, 'type', e.target.value)}
                    className={`sm:col-span-2 ${inputCls} cursor-pointer`}
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#f9fafb' }}
                  >
                    {CARD_TYPES.map(t => (
                      <option key={t.v} value={t.v} style={{ backgroundColor: '#ffffff', color: '#111827' }}>
                        {t.l}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  placeholder="Descrição (opcional)"
                  value={description}
                  onChange={e => onUpdate(idx, 'description', e.target.value)}
                  className={inputCls}
                />

                {!noUrl && !isForm && (
                  <input
                    type="text"
                    placeholder="URL (https://...)"
                    value={url}
                    onChange={e => onUpdate(idx, 'url', e.target.value)}
                    className={inputCls}
                  />
                )}
                {noUrl && (
                  <p className="flex items-center gap-2 text-xs text-blue-300 bg-blue-500/10 border border-blue-400/20 rounded-xl px-3 py-2">
                    📁 Permite upload de arquivos após criado
                  </p>
                )}
                {isForm && (
                  <p className="flex items-center gap-2 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-400/20 rounded-xl px-3 py-2">
                    📝 Abrirá o construtor de formulário personalizado
                  </p>
                )}

                {/* Carteira associada */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
                  <Layers size={13} className="text-gray-600 flex-shrink-0" />
                  <select
                    value={carteiraId ?? ''}
                    onChange={e => onUpdate(idx, 'carteiraId', e.target.value || null)}
                    className={`flex-1 ${inputCls} text-xs py-2`}
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: carteiraId ? '#f9fafb' : '#9ca3af' }}
                  >
                    <option value="" style={{ backgroundColor: '#111827', color: '#9ca3af' }}>
                      Sem restrição — visível para todos
                    </option>
                    {SETORES_PADRAO.map(s => (
                      <option key={s.id} value={s.id} style={{ backgroundColor: '#111827', color: '#f9fafb' }}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
