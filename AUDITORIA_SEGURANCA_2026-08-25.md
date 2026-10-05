# Auditoria de Segurança — NoraHub (Normatel)

> ⚠️ **REGISTRO HISTÓRICO, ANTERIOR À MIGRAÇÃO.** Esta auditoria avaliou a arquitetura
> Firebase (Firestore Rules, Cloud Functions, Storage Rules) que o NoraHub usava em
> agosto de 2026. O sistema migrou para **Supabase + Vercel** e nada do que está
> verificado abaixo vale para a arquitetura atual, porque os mecanismos de autorização
> são outros. Os comandos, caminhos de arquivo e vereditos aqui **não** devem ser
> seguidos como orientação. Para o estado atual, ver [SEGURANCA.md](SEGURANCA.md), que
> inclui uma comparação dos controles que sobreviveram e dos que foram perdidos.
>
> Mantido como trilha de auditoria para fins de compliance.

**Projeto Firebase:** `norahub-2655f` (descontinuado)
**Data:** 25/08/2026
**Escopo:** Firestore Rules, Storage Rules, Cloud Functions, segredos (repo + histórico Git), headers HTTP, CORS, fluxo de auth/admin.
**Método:** leitura do código-fonte + testes reais contra a API REST do Firestore (sem autenticação), varredura do histórico do Git por segredos commitados.

---

## Resumo

O NoraHub já passou por um trabalho de segurança sério antes desta auditoria: as Firestore Rules verificam papel (`funcao`) direto no documento do usuário no servidor (não confiam em nada vindo do cliente), o CPF é criptografado no servidor com AES-256-GCM e só um admin pode descriptografar, as Cloud Functions sensíveis têm rate limiting + validação + log de auditoria, os headers de segurança estão praticamente completos, e não há nenhuma chave sensível (`service_role`/service account) commitada no histórico do Git — só o `.env.example` (sem valores reais) foi commitado.

Testei ao vivo, sem autenticação, contra a API REST do Firestore do projeto:

```
GET https://firestore.googleapis.com/v1/projects/norahub-2655f/databases/(default)/documents/usuarios       → HTTP 403
GET https://firestore.googleapis.com/v1/projects/norahub-2655f/databases/(default)/documents/security_logs  → HTTP 403
GET https://firestore.googleapis.com/v1/projects/norahub-2655f/databases/(default)/documents/rate_limits    → HTTP 403
```

Nenhuma dessas coleções devolveu dado sem login — o que é o esperado e o correto.

Isso dito, encontrei pontos que merecem atenção antes de eu (ou qualquer pessoa) começar a mexer na base de código, ordenados por gravidade real:

---

## [Alta] Confirmar se as regras publicadas no Firebase Console são as do repositório

**O que é:** o arquivo `RECUPERAR_ADMIN.md`, presente no próprio repositório, documenta um incidente em que as Firestore Rules foram **deliberadamente afrouxadas** para recuperar acesso de admin perdido, com a recomendação explícita no final: *"Depois de migrar todos os usuários, você pode desativar as Firestore Rules muito permissivas e usar versão mais restrita"*. O procedimento também envolvia colar um script (`SCRIPT_MIGRAR_ADMIN.js`) no console do navegador para migrar dados de `users` para `usuarios`.

**Evidência:** `RECUPERAR_ADMIN.md`, linhas 95-99; `scripts/SCRIPT_MIGRAR_ADMIN.js` completo.

**Impacto:** o arquivo `firestore.rules` que está no repositório hoje está bem escrito (autorização real, verificada no servidor). Mas regra em arquivo só protege depois de publicada com `firebase deploy --only firestore:rules`. Se, na correria daquele incidente, a versão "muito permissiva se algo ficou de fora do deploy final, o Console pode estar rodando uma regra mais aberta do que a que estou lendo aqui — e eu não tenho como confirmar isso sem acesso ao Firebase Console do projeto.

**Correção:** antes de qualquer alteração no app, entre em https://console.firebase.google.com/project/norahub-2655f/firestore/rules e compare visualmente o texto publicado com o `firestore.rules` do repositório (git diff mental linha a linha). Se divergirem, publique a versão do repositório. Depois, pode apagar o `RECUPERAR_ADMIN.md` e o `SCRIPT_MIGRAR_ADMIN.js` do repo (ou mover para uma pasta `docs/incidentes-resolvidos/`) — hoje eles são uma receita de bolo para reabrir o mesmo buraco caso alguém rode o script sem entender o contexto.

**Como verificar:** o texto em "Rules" no Firebase Console deve ser byte-a-byte igual ao `firestore.rules` do repositório atual.

---

## [Média] CSP permite `'unsafe-inline'` em `script-src`

**O que é:** o Content-Security-Policy publicado em `firebase.json` inclui `script-src 'self' 'unsafe-inline' ...`.

**Evidência:**
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com ...
```
(`firebase.json`, linha 51)

**Impacto:** `'unsafe-inline'` neutraliza boa parte da proteção do CSP contra XSS: se por algum caminho um atacante conseguir injetar um `<script>` inline (ex.: um campo mal sanitizado renderizado sem escaping em algum lugar do app), o navegador vai executá-lo mesmo com o CSP ativo. O CSP hoje protege contra scripts de origem externa, mas não contra inline.

**Correção:** migrar para nonce ou hash nos poucos scripts inline que existirem (o Vite/React normalmente não precisa de inline script em produção — vale checar se `index.html` tem algum). Trocar para:
```
script-src 'self' 'nonce-<gerado-por-request>' https://apis.google.com https://www.gstatic.com https://www.google.com https://www.recaptcha.net;
```
Como o hosting é estático (Firebase Hosting, sem servidor por request), a alternativa prática é usar **hash** dos scripts inline conhecidos, ou eliminar inline scripts do build.

**Como verificar:** `curl -sI https://<domínio>/ | grep -i content-security-policy` deve mostrar o CSP sem `'unsafe-inline'`, e o app deve continuar funcionando normalmente (login, upload, dashboard).

---

## [Média] Rate limiter das Cloud Functions falha aberto (fail-open)

**O que é:** em `functions/securityMiddleware.js`, se a transação do Firestore que checa o rate limit falhar por qualquer motivo, a função **permite** a requisição em vez de bloquear.

**Evidência:**
```js
} catch (error) {
  if (error.code === 'resource-exhausted') { throw error; }
  // Em caso de erro no rate limiter, permitir (fail-open)
  console.error('Rate limiter error:', error);
  return { allowed: true, remaining: this.maxRequests };
}
```
(`functions/securityMiddleware.js`, linhas 64-71)

**Impacto:** é uma escolha consciente de disponibilidade sobre segurança (documentada no próprio código), o que é aceitável em muitos produtos — mas significa que um atacante que consiga forçar erro no rate limiter (ex.: sobrecarregar o Firestore, gerar contenção na coleção `rate_limits`) contorna o limite de tentativas em funções sensíveis como `decryptPersonalData` e `deleteUser`.

**Correção:** manter fail-open é uma decisão de produto válida, mas registre esse evento em `security_logs` com severidade alta quando cair no catch (hoje só vai pro `console.error`, que se perde) para que dê pra monitorar se está sendo abusado.

**Como verificar:** simular falha no Firestore (ou revisar `security_logs` depois da mudança) e confirmar que aparece um evento tipo `rate_limiter_failure` com severidade `high`.

---

## [Baixa] `PrivateRouteSecure.jsx` é código morto e está quebrado

**O que é:** existe um componente `EnhancedPrivateRoute` (exportado como default de `PrivateRouteSecure.jsx`) que lê `sessionValid` de `useAuth()` — mas `AuthContext.jsx` nunca fornece esse campo (`AUTH_DEFAULT = { currentUser, userProfile, loading }`). Ou seja, `sessionValid` é sempre `undefined`, e o componente sempre redirecionaria para `/login`.

**Evidência:** `src/components/PrivateRouteSecure.jsx`, linha 11 e 54; `src/context/AuthContext.jsx`, linha 6 (sem `sessionValid`).

**Impacto:** nenhum hoje — conferi `App.jsx` e o roteamento real usa `./components/PrivateRoute` (o outro arquivo), não este. Mas é uma armadilha: se alguém no futuro trocar o import achando que está usando a versão "reforçada", quebra o login de todo mundo.

**Correção:** apagar `PrivateRouteSecure.jsx`, ou terminar a implementação (adicionar `sessionValid` de verdade ao `AuthContext`, ligado a `sessionSecurity.validateSession()` de `utils/security.js`, que já existe e não é usado em lugar nenhum hoje).

**Como verificar:** `grep -r "PrivateRouteSecure" src/` não deve retornar nenhum import ativo em rota.

---

## [Info] Foto de perfil é pública por design

**O que é:** `storage.rules` permite `read: if true` em `/users/{userId}/profile.jpg`.

**Impacto:** qualquer pessoa com o link direto vê a foto de perfil de qualquer colaborador (não o resto dos dados, só a foto). Normalmente é intencional (evita re-autenticar pra mostrar avatar em toda tela), mas fica registrado para confirmação — se a Normatel considerar até a foto sensível, dá pra trocar para leitura autenticada.

**Como verificar (se decidir restringir):** trocar `allow read: if true;` por `allow read: if isSignedIn();` e testar se avatares ainda carregam dentro do app logado.

---

## O que já está bem feito (vale registrar, não é achado)

- Firestore Rules: toda coleção tem regra explícita, autorização checada no servidor (`get()` no documento de `usuarios`), nenhuma regra `match /{document=**}` genérica no fim do arquivo que anularia as outras.
- `security_logs` e `rate_limits`: escrita bloqueada para o cliente (`allow write: if false`), só Cloud Functions com Admin SDK escrevem.
- CPF: nunca trafega nem fica em texto puro no Firestore — é criptografado (AES-256-GCM) numa Cloud Function, com a chave só em variável de ambiente do servidor; descriptografar exige admin + rate limit + log.
- Nenhum segredo (chave de API real, service account) foi encontrado no histórico do Git — só o `.env.example` com placeholders.
- Headers HTTP (HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy) presentes e bem configurados no `firebase.json`.
- CORS do Storage restrito às origens reais do app (`norahub-2655f.web.app`, `.firebaseapp.com`, `localhost` para dev) — não usa `*`.
- Autenticação Microsoft (OIDC) configurada via Firebase Auth, sem client secret exposto no frontend (fica no console do Firebase, como deveria).

---

## Escopo não coberto nesta rodada

Não revisei código de cada página administrativa linha a linha (ex.: `AdminAnalytics`, `GerenciaCarteiras`), nem testei upload real de arquivo contra o Storage (precisaria de uma conta de teste autenticada). Se quiser, faço uma segunda passada focada nisso antes de qualquer mudança grande no app.
