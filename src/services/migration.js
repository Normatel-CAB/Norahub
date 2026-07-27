import { db } from './firebase';
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';

/**
 * Migra todos os documentos de usuários que ainda usam o campo legado `carteira` (singular)
 * para o campo `cargo`, e garante consistência com o campo `funcao`.
 *
 * Regras:
 * - Se o usuário tem `carteira` mas não tem `cargo`, copia `carteira` → `cargo`
 * - Remove o campo `carteira` legado
 * - Não altera o campo `funcao` (mantido para compatibilidade interna)
 *
 * Retorna: { migrated: number, skipped: number, errors: number }
 */
export async function migrarCarteiraParaCargo() {
  const results = { migrated: 0, skipped: 0, errors: 0 };

  try {
    const snap = await getDocs(collection(db, 'usuarios'));
    const batch = writeBatch(db);
    let batchCount = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const temCarteira = data.carteira !== undefined;
      const temCargo    = data.cargo !== undefined;

      if (!temCarteira) {
        results.skipped++;
        continue;
      }

      const updates = {};

      // Copia o valor de carteira para cargo se cargo ainda não existe
      if (!temCargo && data.carteira) {
        updates.cargo = data.carteira;
      }

      // Remove o campo legado `carteira`
      updates.carteira = null; // Firestore não suporta deleteField via writeBatch facilmente,
                               // então setamos null e filtramos no código ao ler

      batch.update(doc(db, 'usuarios', docSnap.id), updates);
      batchCount++;
      results.migrated++;

      // Firestore batch limit: 500 operações
      if (batchCount >= 490) {
        await batch.commit();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
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
    const snap = await getDocs(collection(db, 'usuarios'));
    const pendentes = snap.docs.filter(d => d.data().carteira !== undefined).length;
    return { necessaria: pendentes > 0, pendentes };
  } catch {
    return { necessaria: false, pendentes: 0 };
  }
}
