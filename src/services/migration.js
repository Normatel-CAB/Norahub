import { supabase } from './supabase';

/**
 * Migra usuários que ainda usam o campo legado `carteira` (singular), dentro de
 * `usuarios.data`, para o campo `cargo` — e remove o campo legado.
 *
 * Regras:
 * - Se o usuário tem `data.carteira` mas não tem `data.cargo`, copia carteira → cargo
 * - Remove o campo `carteira` legado
 * - Não altera o campo `funcao` (coluna própria, mantida para permissões)
 *
 * Retorna: { migrated: number, skipped: number, errors: number }
 */
export async function migrarCarteiraParaCargo() {
  const results = { migrated: 0, skipped: 0, errors: 0 };

  try {
    const { data: usuarios, error } = await supabase.from('usuarios').select('id, data');
    if (error) throw error;

    for (const u of usuarios || []) {
      const d = u.data || {};
      if (d.carteira === undefined) {
        results.skipped++;
        continue;
      }

      const novoData = { ...d };
      if (novoData.cargo === undefined && novoData.carteira) {
        novoData.cargo = novoData.carteira;
      }
      delete novoData.carteira;

      const { error: updErr } = await supabase.from('usuarios').update({ data: novoData }).eq('id', u.id);
      if (updErr) {
        results.errors++;
        continue;
      }
      results.migrated++;
    }
  } catch (err) {
    results.errors++;
    console.error('Erro na migração carteira→cargo:', err);
  }

  return results;
}

/**
 * Verifica quantos usuários ainda têm o campo `carteira` legado.
 * Use para checar se a migração é necessária.
 */
export async function verificarMigracaoNecessaria() {
  try {
    const { data: usuarios, error } = await supabase.from('usuarios').select('data');
    if (error) throw error;
    const pendentes = (usuarios || []).filter(u => u.data && u.data.carteira !== undefined).length;
    return { necessaria: pendentes > 0, pendentes };
  } catch {
    return { necessaria: false, pendentes: 0 };
  }
}
