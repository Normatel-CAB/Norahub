/**
 * Script para atualizar Firestore Rules via Console do Navegador
 * 
 * INSTRUÇÕES:
 * 1. Abra https://console.firebase.google.com
 * 2. Selecione o projeto norahub-2655f
 * 3. Vá para Firestore Database > Rules
 * 4. Abra o Console do Navegador (F12)
 * 5. Cole TODO este script
 * 6. Ou apenas copie o conteúdo de firestore.rules e cole manualmente no editor
 * 
 * CONTEÚDO PARA COLAR NO FIREBASE CONSOLE:
 */

const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Função helper para verificar se usuário está autenticado
    function isSignedIn() {
      return request.auth != null;
    }
    
    // Função helper para verificar se é admin
    function isAdmin() {
      return isSignedIn() && (
        (exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && 
         get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.funcao == 'admin') ||
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.funcao == 'admin')
      );
    }
    
    // Função helper para verificar se é gerente
    function isManager() {
      return isSignedIn() && (
        (exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && 
         get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.funcao.matches('.*gerente.*')) ||
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.funcao.matches('.*gerente.*'))
      );
    }
    
    // Coleção de usuários (usuarios - nova coleção padrão)
    match /usuarios/{userId} {
      // Qualquer usuário autenticado pode ler todos os usuários
      allow read: if isSignedIn();
      
      // Usuário pode criar seu próprio perfil (permite cadastro inicial)
      allow create: if isSignedIn() && request.auth.uid == userId;
      
      // Usuário pode atualizar seu próprio perfil
      // Admin e gerentes podem atualizar qualquer perfil
      allow update: if isSignedIn() && 
                      (request.auth.uid == userId || 
                       (exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && 
                        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.funcao in ['admin', 'gerente']) ||
                       (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
                        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.funcao in ['admin', 'gerente']));
      
      // Apenas admin pode deletar
      allow delete: if isSignedIn() && 
                      ((exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && 
                        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.funcao == 'admin') ||
                       (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
                        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.funcao == 'admin'));
    }
    
    // Coleção de usuários (users - coleção legada para compatibilidade)
    match /users/{userId} {
      // Qualquer usuário autenticado pode ler todos os usuários
      allow read: if isSignedIn();
      
      // Usuário pode criar seu próprio perfil (permite cadastro inicial)
      allow create: if isSignedIn() && request.auth.uid == userId;
      
      // Usuário pode atualizar seu próprio perfil
      // Admin e gerentes podem atualizar qualquer perfil
      allow update: if isSignedIn() && 
                      (request.auth.uid == userId || 
                       (exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && 
                        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.funcao in ['admin', 'gerente']) ||
                       (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
                        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.funcao in ['admin', 'gerente']));
      
      // Apenas admin pode deletar
      allow delete: if isSignedIn() && 
                      ((exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && 
                        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.funcao == 'admin') ||
                       (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
                        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.funcao == 'admin'));
    }
    
    // Coleção de projetos
    match /projetos/{projectId} {
      // Todos os usuários autenticados podem ler projetos
      allow read: if isSignedIn();
      
      // Admin e gerentes podem criar projetos
      allow create: if isSignedIn() && (isAdmin() || isManager());
      
      // Admin, gerentes e qualquer usuário autenticado podem atualizar
      // (necessário para respostas de formulários)
      allow update: if isSignedIn();
      
      // Apenas admin pode deletar
      allow delete: if isAdmin();
    }
    
    // Coleção de cargos
    match /cargos/{cargoId} {
      // Todos podem ler
      allow read: if isSignedIn();
      
      // Apenas admin pode criar, atualizar ou deletar
      allow write: if isAdmin();
    }
    
    // Coleção de formulários
    match /formularios/{formId} {
      // Todos podem ler
      allow read: if isSignedIn();
      
      // Todos podem criar e atualizar (para respostas)
      allow create, update: if isSignedIn();
      
      // Apenas admin e gerentes podem deletar
      allow delete: if isAdmin() || isManager();
    }
    
    // Coleção de arquivos (metadata)
    match /arquivos/{fileId} {
      // Todos podem ler
      allow read: if isSignedIn();
      
      // Todos podem criar (upload)
      allow create: if isSignedIn();
      
      // Apenas o dono, admin ou gerentes podem atualizar
      allow update: if isSignedIn() && 
                      (resource.data.uploadedBy == request.auth.uid || 
                       isAdmin() || 
                       isManager());
      
      // Apenas o dono, admin ou gerentes podem deletar
      allow delete: if isSignedIn() && 
                      (resource.data.uploadedBy == request.auth.uid || 
                       isAdmin() || 
                       isManager());
    }
    
    // Coleção de notificações
    match /notifications/{notificationId} {
      // Usuário só pode ler suas próprias notificações
      allow read: if isSignedIn() && resource.data.userId == request.auth.uid;
      
      // Qualquer usuário autenticado pode criar notificações
      allow create: if isSignedIn();
      
      // Usuário pode atualizar suas próprias notificações (marcar como lida)
      allow update: if isSignedIn() && resource.data.userId == request.auth.uid;
      
      // Apenas admin pode deletar
      allow delete: if isAdmin();
    }

    // Coleção de favoritos
    match /favorites/{userId} {
      // Usuário pode ler, criar, atualizar e deletar apenas o próprio documento de favoritos
      allow read: if isSignedIn() && request.auth.uid == userId;
      allow create: if isSignedIn() && request.auth.uid == userId && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isSignedIn() && request.auth.uid == userId;
    }
  }
}`;

console.log("=== FIRESTORE RULES PARA COLAR ===");
console.log(FIRESTORE_RULES);
console.log("\n=== INSTRUÇÕES ===");
console.log("1. Copie todo o conteúdo acima");
console.log("2. Acesse https://console.firebase.google.com");
console.log("3. Projeto: norahub-2655f");
console.log("4. Firestore Database > Rules");
console.log("5. Cole o conteúdo no editor");
console.log("6. Clique em 'Publish'");
console.log("\nOu execute: navigator.clipboard.writeText(FIRESTORE_RULES).then(() => console.log('Copiado para o clipboard!'))");
