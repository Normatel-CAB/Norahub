import { X, Layers, Shield } from 'lucide-react';
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
  'w-full px-3 py-2.5 bg-surface border border-hairline rounded-xl text-sm text-txt placeholder-txt-faint focus:outline-none focus:border-brand/60 focus:bg-surface-2 transition-all';

export function CardFieldsForm({ cards, onAdd, onUpdate, onRemove, cargosLista = [] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-txt-dim uppercase tracking-widest">
            Cards
          </label>
          {cards.filter(c => (c.name ?? c.nome ?? '').trim()).length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand/20 text-brand-lite text-[10px] font-bold">
              {cards.filter(c => (c.name ?? c.nome ?? '').trim()).length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand/10 text-brand-lite border border-brand/20 hover:bg-brand/20 font-semibold transition-colors"
        >
          + Novo card
        </button>
      </div>

      {cards.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="w-full flex flex-col items-center justify-center gap-2 py-8 border border-dashed border-hairline rounded-2xl hover:border-brand/30 hover:bg-brand/[0.03] transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-surface group-hover:bg-brand/10 flex items-center justify-center transition-colors">
            <span className="text-xl text-txt-faint group-hover:text-brand-lite transition-colors">+</span>
          </div>
          <p className="text-xs font-medium text-txt-faint group-hover:text-txt-dim transition-colors">
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
            const cardCargos = card.cargos ?? [];
            const noUrl = NO_URL_TYPES.has(type);
            const isForm = CUSTOM_FORM_TYPES.has(type);

            return (
              <div
                key={idx}
                className="group nt-glass p-4 space-y-3 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-brand/15 border border-brand/20 flex items-center justify-center text-[11px] font-bold text-brand-lite flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs text-txt-faint font-medium">Card {idx + 1}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/15 text-txt-faint hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
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
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--txt)' }}
                  >
                    {CARD_TYPES.map(t => (
                      <option key={t.v} value={t.v} style={{ backgroundColor: 'var(--surface-solid)', color: 'var(--txt)' }}>
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
                <div className="flex items-center gap-2 pt-1 border-t border-hairline">
                  <Layers size={13} className="text-txt-faint flex-shrink-0" />
                  <select
                    value={carteiraId ?? ''}
                    onChange={e => onUpdate(idx, 'carteiraId', e.target.value || null)}
                    className={`flex-1 ${inputCls} text-xs py-2`}
                    style={{ backgroundColor: 'var(--surface)', color: carteiraId ? 'var(--txt)' : 'var(--txt-faint)' }}
                  >
                    <option value="" style={{ backgroundColor: 'var(--surface-solid)', color: 'var(--txt-faint)' }}>
                      Sem restrição de setor
                    </option>
                    {SETORES_PADRAO.map(s => (
                      <option key={s.id} value={s.id} style={{ backgroundColor: 'var(--surface-solid)', color: 'var(--txt)' }}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cargos que podem ver este card */}
                {cargosLista.length > 0 && (
                  <div className="flex items-start gap-2 pt-1 border-t border-hairline">
                    <Shield size={13} className="text-purple-500 flex-shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-txt-faint mb-2">
                        Restringir por cargo
                        {cardCargos.length > 0
                          ? <span className="ml-1.5 text-purple-400 font-semibold">({cardCargos.length} selecionado{cardCargos.length > 1 ? 's' : ''})</span>
                          : <span className="ml-1.5 text-txt-faint">— vazio = todos os cargos</span>
                        }
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {cargosLista.map(c => {
                          const selected = cardCargos.includes(c.nome);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                const next = selected
                                  ? cardCargos.filter(x => x !== c.nome)
                                  : [...cardCargos, c.nome];
                                onUpdate(idx, 'cargos', next);
                              }}
                              className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold transition-all ${
                                selected
                                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                                  : 'bg-surface border-hairline text-txt-faint hover:text-txt-dim hover:border-hairline-hi'
                              }`}
                            >
                              {c.nome}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
