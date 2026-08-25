/**
 * Script de Migração Automática de Todos os Usuários (incluindo Admin)
 * 
 * Use no Console do Navegador (F12) na página de Gestão de Usuários
 * 
 * INSTRUÇÕES:
 * 1. Abra o Console (F12)
 * 2. Cole este código todo
 * 3. Aperte Enter
 * 4. Espere aparecer "Migração Concluída!"
 */

(async () => {
  try {
    console.log('🔄 Iniciando migração de TODOS os usuários...');
    
    // Importa Firestore
    const { getFirestore, collection, getDocs, doc, writeBatch } = window.firebase;
    const db = getFirestore();
    
    // Busca todos os usuários da coleção antiga "users"
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    if (snapshot.empty) {
      console.log('✅ Nenhum usuário para migrar!');
      return;
    }
    
    console.log(`📋 Encontrados ${snapshot.size} usuários para migrar`);
    
    // Cria um batch para fazer a migração
    const batch = writeBatch(db);
    let count = 0;
    
    // Itera sobre cada usuário
    snapshot.forEach(userDoc => {
      const userData = userDoc.data();
      const docId = userDoc.id;
      
      // Copia para a nova coleção "usuarios"
      const newDocRef = doc(db, 'usuarios', docId);
      batch.set(newDocRef, userData, { merge: true });
      
      console.log(`✓ Preparado: ${userData.nome || docId} (${userData.funcao})`);
      count++;
    });
    
    // Executa a migração
    console.log(`\n📤 Enviando ${count} usuários...`);
    await batch.commit();
    
    console.log(`\n✅ SUCESSO! ${count} usuários foram migrados!\n`);
    console.log('Aguarde 2 segundos e recarregue a página (F5)...');
    
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    console.error('Detalhes:', error.message);
  }
})();
