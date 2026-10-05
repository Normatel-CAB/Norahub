# Segurança do NoraHub

**Stack real:** Vite + React (SPA) na Vercel, Supabase (banco, auth, storage, edge functions) e GitHub.
**Última revisão:** 01/10/2026.
**Método desta revisão:** leitura do código e do histórico do Git. Não houve teste contra a API em produção, por falta de acesso de rede no ambiente onde foi feita. O que isso deixa em aberto está em [O que não foi verificado](#o-que-não-foi-verificado).

> A documentação anterior (`SECURITY_ARCHITECTURE.md`, `SECURITY_SUMMARY.md`, `SECURITY_QUICKSTART.md`, `SECURITY_ADDITIONAL.md`) descrevia uma arquitetura Firebase + AWS WAF que não existe mais, e foi removida. A auditoria de 25/08/2026 foi mantida como registro histórico, mas é anterior à migração. Ver [Controles perdidos na migração](#controles-perdidos-na-migração).

---

## Arquitetura

| Camada | Onde está | Observação |
|---|---|---|
| Frontend | SPA estática na Vercel, deploy automático via GitHub | Sem servidor por request, então não dá para gerar nonce de CSP |
| Banco, Auth, Storage | Supabase | A única barreira de autorização é RLS |
| Lógica server-side | Supabase Edge Functions: `encrypt-personal-data` e `send-email` | Código-fonte não está neste repositório |
| Login Microsoft (Entra ID) | Não é do NoraHub, é do app "Gestão de Projetos" listado em /aplicativos | Relevante porque impede embutir aquele app em iframe |

Firebase, Firestore, Cloud Functions e AWS WAF/CloudFront não fazem parte do sistema. Os arquivos de configuração correspondentes foram removidos do repositório em 01/10/2026 por serem configuração morta: o `firebase` nem constava como dependência.

## Modelo de autorização

O ponto que governa tudo: a `anon key` do Supabase é pública. Ela vai no bundle do frontend e aparece no DevTools de qualquer visitante. Ela identifica o projeto, não autoriza nada.

A consequência é que qualquer pessoa na internet pode chamar a API REST do Supabase com essa chave, sem passar pelas telas do app. Portanto a autorização real é 100% RLS no banco. Telas, `PrivateRoute` e checagem de `funcao` no React controlam navegação, não acesso.

O banco tem 11 tabelas no schema `public`, todas usadas pelo app, levantadas em 01/10/2026:

```
activities · apps_normatel · arquivos · cargos · carteiras · chat_history
favorites · notifications · projetos · settings · usuarios
```

Todas com RLS habilitado. A página `/logs-auditoria` lê a tabela `activities`.

Também existe o bucket `avatars` no Storage.

Atenção ao avaliar policies: `auth.role() = 'authenticated'` não é autorização. Se o cadastro for aberto, qualquer pessoa cria conta e se torna "autenticada". A policy precisa perguntar quem é, por exemplo comparando `auth.uid()` ou consultando a `funcao` do usuário, e não apenas se está logada.

## Verificado nesta revisão

**Segredos: nenhuma chave do Supabase vazada. Uma secret do reCAPTCHA vazou, ver achados.**

```bash
git ls-files | grep -E "^\.env"                                # nada rastreado
git log --all --diff-filter=A --name-only | grep -i "\.env"    # so .env.example
git grep -lniE "service_role" -- . ':!node_modules'            # nenhuma chave
git log --all -S "service_role" --oneline                      # nada no historico
```

O `.gitignore` cobre `.env` e variantes. Nenhuma chave `service_role` do Supabase no repositório ou no histórico, e essa é justamente a que ignoraria RLS por completo.

Uma varredura por JWT no histórico retorna três commits, mas é falso positivo: o token estava em `node_modules/zod/src/v4/mini/tests/string.test.ts`, fixture de teste de um pacote npm, de quando `node_modules` chegou a ser commitado.

Vale registrar a lição: varrer por arquivos `.env` não é suficiente. A secret do reCAPTCHA estava hardcoded dentro de documentação `.md`, que nenhum filtro de `.env` pega. Ao auditar segredos, varra o conteúdo do repositório inteiro, não só os nomes de arquivo de ambiente.

**CPF não é mais coletado.** Até 02/10/2026 o cadastro manual coletava CPF e o criptografava chamando a Edge Function `encrypt-personal-data`, com a chave no servidor, o que era o desenho correto. Com a remoção do cadastro por e-mail e senha, nada no app coleta nem lê CPF: o campo `data.cpfMatricula` era escrito no cadastro e nunca consultado em lugar nenhum. O `encryptionService.js` ficou órfão e foi removido, e a Edge Function `encrypt-personal-data` está sem uso e pode ser apagada no Supabase.

Para LGPD isso é melhoria, porque elimina coleta de dado pessoal sem finalidade. Se o CPF voltar a ser necessário, o padrão correto está no histórico do Git: criptografar em Edge Function, nunca no cliente.

## Achados

### [Corrigido em 01/10/2026, Crítica] Usuário podia se promover a admin editando o próprio perfil

**Correção aplicada:** trigger `usuarios_guarda_cargo` em `usuarios`, que bloqueia alteração de `funcao` e de `status_acesso` quando quem chama não é administrador. Foi preciso usar trigger, e não `revoke update (coluna)`, porque o [AdminDashboard.jsx:195](src/pages/AdminDashboard.jsx#L195) e [:207](src/pages/AdminDashboard.jsx#L207) alteram esses campos pelo cliente com a sessão do próprio admin, e o `revoke` teria derrubado a aprovação de usuário junto.

```sql
create or replace function impedir_mudanca_de_cargo()
returns trigger language plpgsql security definer as $$
begin
  if (new.funcao is distinct from old.funcao
      or new.status_acesso is distinct from old.status_acesso)
     and not is_admin() then
    raise exception 'Alterar cargo ou status de acesso exige administrador';
  end if;
  return new;
end;
$$;

create trigger usuarios_guarda_cargo
  before update on usuarios
  for each row execute function impedir_mudanca_de_cargo();
```

Como o trigger depende de `is_admin()`, e o corpo dessa função não foi revisado, confirmar que aprovar usuário no AdminDashboard continua funcionando. Se falhar, `drop trigger usuarios_guarda_cargo on usuarios;` desfaz.

**O que era, para registro:** a política de UPDATE da `usuarios` é `((auth.uid() = id) OR is_admin_or_manager())` em `qual` e em `with_check`. Lê-se como "cada um edita o próprio perfil", mas política de RLS autoriza por linha, não por coluna, e na linha estão `funcao` e `status_acesso`. Com autocadastro aberto, qualquer pessoa se registrava e depois chamava a API direto:

```
PATCH /rest/v1/usuarios?id=eq.<uid>
{"funcao": "admin", "status_acesso": "ativo"}
```

`auth.uid() = id` era verdadeiro, então passava. Duas chamadas de API separavam um estranho de administrador com acesso a todo o dado pessoal da `usuarios`. É uma pegadinha comum do Postgres, não descuido: praticamente todo projeto Supabase com tabela de perfil editável pelo usuário tem essa exposição se não tratar coluna à parte.

### [Corrigido em 01/10/2026, Alta] Três tabelas aceitavam INSERT de conteúdo arbitrário

**O que era:** `activities`, `arquivos` e `notifications` tinham `with_check = true` na política de INSERT, então qualquer usuário autenticado inseria linha com qualquer conteúdo. Com autocadastro aberto, isso valia para qualquer pessoa que se registrasse.

| Tabela | O que permitia |
|---|---|
| `notifications` | Inserir notificação com o `user_id` de qualquer pessoa e texto escolhido. Phishing dentro do portal interno, que convence muito mais do que e-mail externo |
| `activities` | Forjar registro de auditoria no nome de outra pessoa, ou inundar o log para encobrir evento real. A página `/logs-auditoria` exibe como se fosse legítimo. Compromete a rastreabilidade exigida pela ISO 9001 |
| `arquivos` | Inserir registro de documento com nome confiável e `url` apontando para qualquer lugar |

**Correção aplicada:**

```sql
alter policy activities_insert on activities with check (is_usuario_ativo());
alter policy notifications_insert on notifications with check (is_usuario_ativo());
drop table if exists arquivos;
```

A `arquivos` foi derrubada porque estava vazia e nenhuma parte do código a lê ou escreve: o app usa o Storage direto. Era a quarta tabela órfã.

Nos outros dois casos foi usado `is_usuario_ativo()` em vez de `user_id = auth.uid()`, de propósito. O app cria notificação e registro de log no nome de outras pessoas legitimamente, por exemplo em [notifications.js:74](src/services/notifications.js#L74), que envia em lote. Amarrar em `auth.uid()` quebraria isso, e no caso do log quebraria em silêncio, porque o `activityLogger` engole erro por desenho. Exigir usuário aprovado elimina o vetor real, que é quem acabou de se cadastrar. Forjar log segue possível para funcionário aprovado, que é pessoa identificável.

### [Média] Qualquer pessoa que se cadastre lê cinco tabelas inteiras

**Correção de um erro desta revisão.** A primeira versão deste documento classificou isto como crítico, afirmando que `projetos`, `carteiras`, `cargos`, `settings`, `apps_normatel` e `arquivos` eram legíveis por qualquer pessoa na internet, porque a política de SELECT delas é `qual = true`. **O teste empírico desmentiu isso.** Requisição anônima com a `anon key`, sem sessão, devolveu `HTTP 200` com `[]` em todas, inclusive na `apps_normatel`, que tem 5 linhas conhecidas. Se a tabela tem dado e o anônimo recebe lista vazia, há filtro atuando.

A causa do erro de leitura: a consulta usada trouxe `qual` mas não a coluna `roles` de `pg_policies`. Políticas criadas pela interface do Supabase normalmente ficam restritas ao papel `authenticated`, e nesse caso o papel `anon` não casa com nenhuma política. Com RLS ligado e nenhuma política aplicável, o resultado é negação, que aparece como `200` com `[]`. Portanto `qual = true` significa "qualquer usuário logado", não "qualquer pessoa".

**O que de fato é o problema:** nenhuma política de RLS consulta o `status_acesso`. Então qualquer usuário autenticado lê `projetos`, `carteiras`, `cargos` e `settings` inteiras pela API REST, mesmo estando `pendente` e sem conseguir navegar no app. O `status_acesso` governa a navegação, não o acesso ao dado. É o caso clássico de autenticação sendo usada como se fosse autorização.

**Reduzido em 02/10/2026:** o agravante era o autocadastro por e-mail e senha, aberto a qualquer endereço, que tornava "autenticado" algo que qualquer pessoa na internet conseguia em um minuto. Esse formulário foi removido e o único caminho de entrada passou a ser a Microsoft, travada em `@normatel.com.br` no [AuthContext.jsx:31](src/context/AuthContext.jsx#L31). Hoje é preciso ter caixa de e-mail da empresa para chegar a `authenticated`, o que muda o perfil de quem explora isso: deixa de ser qualquer pessoa e passa a ser alguém de dentro, ainda não aprovado.

Isso expõe a carteira de projetos (quais clientes e obras), quem trabalha em quê, a estrutura de cargos e a configuração do sistema. Não é dado pessoal como na `usuarios`, que está corretamente protegida, mas para empresa de engenharia com contrato de cliente grande é assunto comercial.

**Correção:** seguir o padrão que o projeto já usa com `is_admin()`, criando uma função que exija usuário aprovado, e usá-la no lugar do `true`:

```sql
create or replace function is_usuario_ativo() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from usuarios
    where id = auth.uid() and status_acesso = 'ativo'
  );
$$;
```

Atenção a uma armadilha ao aplicar: a `settings` é lida durante o fluxo de cadastro para descobrir se a auto-aprovação está ligada, num momento em que o usuário ainda não tem linha em `usuarios`. Exigir `is_usuario_ativo()` nessa tabela desliga a auto-aprovação em silêncio. Tratar caso a caso, começando por `projetos` e `carteiras`, que são as de conteúdo comercial.

### [Alta] URL assinada de 5 anos guardada dentro da tabela `projetos`

**O que é:** em [ConstrutorFormulario.jsx:9](src/pages/ConstrutorFormulario.jsx#L9) a validade da URL assinada é `60 * 60 * 24 * 365 * 5`, ou seja 5 anos. A URL é gerada no upload de anexo de formulário ([linha 181](src/pages/ConstrutorFormulario.jsx#L181)) e termina persistida no JSON da tabela `projetos`, em `extras[].formResponses[].answers` ([linha 201](src/pages/ConstrutorFormulario.jsx#L201)).

**Impacto:** URL assinada é credencial ao portador, funciona sem login e sem passar por RLS. Como `projetos_select` é `true` para `authenticated` e o autocadastro é aberto, a cadeia é: a pessoa se registra, lê a `projetos`, colhe as URLs de todo anexo de formulário e baixa os arquivos até 2031, **mesmo depois de a conta dela ser apagada**. Revogar acesso não revoga o que já foi emitido. O anônimo não alcança a tabela, isso foi testado.

**Segundo caminho de vazamento, pior que o primeiro:** a mesma URL é embutida nas exportações. O CSV de respostas monta `answer.map(file => file.url)` em [ConstrutorFormulario.jsx:262](src/pages/ConstrutorFormulario.jsx#L262), e a exportação em texto faz o mesmo em [linha 108](src/pages/ConstrutorFormulario.jsx#L108). Esses arquivos saem do sistema por e-mail, WhatsApp e pasta compartilhada, levando credencial de download válida até 2031 para quem receber ou encaminhar. Aqui não há RLS nenhuma no caminho: basta ter recebido a planilha.

**Correção, em duas frentes.** A rápida, que corta a colheita pela API, é apertar a leitura da `projetos`:

```sql
alter policy projetos_select on projetos using (is_usuario_ativo());
```

A de fundo é parar de guardar URL no banco e passar a gerá-la na hora, com validade de uma hora, como o `GerenciamentoArquivos` já faz em [GerenciamentoArquivos.jsx:56](src/pages/GerenciamentoArquivos.jsx#L56). O objeto salvo já inclui o `path` do arquivo ([linha 183](src/pages/ConstrutorFormulario.jsx#L183)), então a informação necessária existe. Não é troca de constante: a URL guardada é consumida em quatro lugares, e cada um pede tratamento diferente.

| Onde | Linha | O que muda |
|---|---|---|
| Link de abrir | [823](src/pages/ConstrutorFormulario.jsx#L823) | Gerar no clique, porque `createSignedUrl` é assíncrono e `href` é síncrono |
| Prévia de imagem | [830](src/pages/ConstrutorFormulario.jsx#L830) | Precisa resolver antes de renderizar, ou seja estado mais efeito |
| Exportação CSV | [262](src/pages/ConstrutorFormulario.jsx#L262) | Gerar no momento da exportação |
| Exportação em texto | [108](src/pages/ConstrutorFormulario.jsx#L108) | Igual ao CSV |

Respostas antigas podem ter sido salvas sem o `path`, então a implementação precisa cair de volta na `url` guardada quando ele não existir, senão anexo antigo para de abrir. O modo de falha é silencioso, então exige teste no fluxo real: enviar formulário com anexo, abrir, ver a prévia e exportar o CSV.

As URLs já emitidas continuam válidas de qualquer forma. Para invalidar, é preciso mover ou renomear os objetos no bucket `projetos`.

## Estado da RLS, verificado em 01/10/2026

As 42 políticas das 11 tabelas foram levantadas com `roles`, `qual` e `with_check`, e o resultado foi conferido contra a API REST de fora.

**Confirmado como correto:**

- Todas as tabelas têm RLS habilitado. Nenhuma no nível mais grave, que seria RLS desligado.
- Todas as 42 políticas estão restritas ao papel `authenticated`. O papel `anon` não casa com nenhuma, então requisição anônima é negada em tudo. Comprovado de fora: `HTTP 200` com `[]` em `apps_normatel`, `projetos`, `cargos`, `usuarios` e `arquivos`, sendo que a `apps_normatel` tem 5 linhas conhecidas, o que descarta a hipótese de tabela vazia.
- O dado pessoal da `usuarios` está protegido na leitura, por `(auth.uid() = id) OR is_admin_or_manager()`.
- `chat_history`, `favorites` e `notifications` comparam com o dono da linha na leitura.
- `usuarios_insert` está amarrado em `auth.uid() = id`, então ninguém cria linha no nome de outro.
- Operações administrativas de `apps_normatel`, `cargos`, `settings`, `projetos` e `carteiras` exigem `is_admin()` ou `is_admin_or_manager()`.
- `activities` não tem política de UPDATE nem de DELETE, então o cliente não altera nem apaga registro de log. Append-only é o desenho certo.

**Única lacuna que resta:** o corpo das funções `is_admin()` e `is_admin_or_manager()`. Elas sustentam quase toda política, então um erro ali se propaga para tudo, e o achado crítico acima depende de saber de onde elas leem o cargo.

```sql
select proname, prosecdef, prosrc
from pg_proc where proname in ('is_admin', 'is_admin_or_manager');
```

O desenho geral da RLS está certo. O que falha são três políticas de INSERT com `true` e a ausência de restrição por coluna na `usuarios`, tratadas nos achados acima.

### [Média] Secret do reCAPTCHA ficou 8 meses commitada no repositório

**O que é:** a `RECAPTCHA_SECRET_KEY`, que é a chave server-side e não a site key, estava em texto puro em `RECAPTCHA_STATUS.md` e `RECAPTCHA_INTEGRATION.md`. O mesmo documento afirmava, ironicamente, "chaves seguras nunca commitadas no Git".

**Evidência:** presente desde o commit `51a5020`, de 04/02/2026, e ainda em `9eeaebe`.

**Impacto:** limitado, porque o repositório é privado. A exposição fica restrita a quem tem ou já teve acesso, ou seja, membros da organização e colaboradores antigos. Não houve exposição pública na internet. O valor foi redigido em 01/10/2026 e os arquivos foram removidos, mas a secret continua no histórico do Git: apagar arquivo não apaga histórico.

**Correção:** gerar novas chaves em https://www.google.com/recaptcha/admin e descartar a antiga. O custo funcional é zero, porque hoje essa secret não está ligada a nada, já que não existe validação server-side (ver achado seguinte). Reescrever o histórico do Git com `filter-repo` não se justifica aqui: exige force-push e coordenação, e rotacionar a chave já torna a cópia antiga inútil.

**Como verificar:** a chave antiga deve passar a ser rejeitada pelo `siteverify`.

### [Corrigido em 01/10/2026, Média] Produção não enviava nenhum header de segurança

**Correção aplicada:** bloco `headers` adicionado ao [vercel.json](vercel.json), com `frame-ancestors 'self'`, `X-Frame-Options`, HSTS, `nosniff` e `Referrer-Policy`. Passa a valer no próximo deploy. Confirmar depois com `curl -sI` no domínio.

**O que era:** o `vercel.json` não definia `headers`. Os que existiam (HSTS, CSP, X-Frame-Options, Permissions-Policy) estavam no `firebase.json`, que nunca foi aplicado na Vercel e foi removido.

**Impacto:** sem `frame-ancestors` ou `X-Frame-Options`, o NoraHub pode ser embutido em iframe por qualquer site, o que habilita clickjacking: sobrepor uma interface falsa e capturar cliques de um usuário logado. Sem HSTS, a primeira conexão aceita downgrade para HTTP.

**Correção:** adicionar ao `vercel.json`:

```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      { "key": "Content-Security-Policy", "value": "frame-ancestors 'self'" },
      { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
      { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
    ]
  }
]
```

O `frame-ancestors` e o `X-Frame-Options` controlam quem pode embutir o NoraHub. Eles não afetam a capacidade do NoraHub de embutir outros sites em iframe, que é governada pelo `frame-src`. Por isso são seguros para o modo iframe de /aplicativos.

Atenção: se um dia adicionarem um CSP completo, com `default-src`, ele precisa incluir explicitamente os domínios embutidos em /aplicativos, senão o modo iframe quebra:

```
frame-src 'self' https://rh2-sigma.vercel.app https://smsdoutrinas.lovable.app https://pdvnormatel.lovable.app https://gfenormatel.vercel.app;
```

Um CSP completo precisa ser testado com calma, porque o app usa `'unsafe-inline'` em estilos e carrega reCAPTCHA e fontes do Google.

**Como verificar:** `curl -sI https://<dominio> | grep -iE "frame-ancestors|x-frame-options|strict-transport"` deve retornar as linhas.

### [Resolvido em 05/10/2026, Média] reCAPTCHA removido, entrada passou a ser só Microsoft

O reCAPTCHA foi retirado por completo, junto com todo o acesso por senha. O único caminho de entrada agora é a conta Microsoft, travada em `@normatel.com.br` no [AuthContext.jsx:31](src/context/AuthContext.jsx#L31).

Removidos: `RecaptchaLoader.jsx`, `utils/recaptcha.js`, o wrapper no `main.jsx`, os estilos no `index.css`, o formulário de e-mail e senha do Login, o `signInWithPassword`, a página `EsqueceuSenha.jsx` com sua rota, e a seção "Alterar Senha" do Perfil.

A troca vale mais que qualquer CAPTCHA porque muda a natureza do controle: deixa de ser "provar que o visitante é humano" e passa a ser "ter caixa de e-mail da empresa". CAPTCHA serve contra volume, e o risco aqui era pessoa não autorizada, não volume.

**Risco operacional da mudança:** contas criadas pelo cadastro antigo dependiam de senha e perdem acesso. Verificar quem seria afetado antes de publicar:

```sql
select u.email from auth.users u
where not exists (
  select 1 from auth.identities i
  where i.user_id = u.id and i.provider = 'azure'
);
```

Quem aparecer precisa entrar uma vez pela Microsoft com o mesmo e-mail. O Supabase normalmente vincula as identidades e preserva perfil e permissões, mas isso depende de configuração e de e-mail confirmado, então vale testar com uma conta antes.

### [Histórico] reCAPTCHA era decorativo, não havia validação no servidor

**O que é:** [Login.jsx:58](src/pages/Login.jsx#L58) e [Cadastro.jsx:124](src/pages/Cadastro.jsx#L124) geram um token e apenas conferem se ele foi obtido. O token nunca é enviado para validação. O `verifyRecaptchaToken`, em [src/utils/recaptcha.js:57](src/utils/recaptcha.js#L57), nunca é chamado, e não funcionaria como está, porque lê `process.env` em código de cliente (Vite).

**Impacto:** nenhuma proteção real contra bot em login e cadastro. Um script que chame o endpoint de auth do Supabase direto, ou que simplesmente não execute o JS do reCAPTCHA, passa sem obstáculo. Isso é regressão: a validação existia em `functions/recaptchaValidator.js`, que era Cloud Function e foi descontinuada junto com o Firebase.

**Correção:** validar numa Edge Function do Supabase, chamando `POST https://www.google.com/recaptcha/api/siteverify` com a secret em variável de ambiente do Supabase, e rejeitar score abaixo de 0.5 antes de concluir login ou cadastro. Enquanto não houver validação, considere o reCAPTCHA ausente ao avaliar risco de abuso, e remova o código morto para não dar falsa sensação de proteção.

**Como verificar:** chamar o fluxo de cadastro com um token inválido deve ser rejeitado pelo servidor.

### [Média] Edge Functions não têm código-fonte versionado

**O que é:** a `encrypt-personal-data` e a `send-email` são chamadas pelo app, mas não existem neste repositório, que não tem pasta `supabase/`. Elas só existem deployadas no projeto Supabase.

**Impacto:** três problemas. Ninguém pode revisar o que elas fazem, e a de criptografia manipula CPF. Não há histórico de alterações. E se o projeto Supabase for perdido, ou alguém apagar a função, não há de onde restaurar. Para ISO 9001 e para auditoria de cliente, código que trata dado pessoal sem fonte versionada é pendência de rastreabilidade.

**Correção:** rodar `supabase functions download encrypt-personal-data` e o mesmo para `send-email`, commitar em `supabase/functions/` e passar a deployar a partir do repositório.

### [Resolvido em 01/10/2026] Três tabelas órfãs derrubadas

O levantamento encontrou 14 tabelas, sendo que `security_logs`, `rate_limits` e `formularios` não apareciam em lugar nenhum do código. As duas primeiras eram resquício da era Firebase, escritas pelas Cloud Functions com Admin SDK.

Nenhuma exposição ou questão de retenção: as três estavam com zero linhas. Foram derrubadas no mesmo dia, deixando o banco com 11 tabelas, todas em uso.

Quando o rate limiting for reimplementado numa Edge Function, a tabela se cria na hora, com o desenho que a função pedir. Não faz sentido ter guardado o schema vazio.

### [Corrigido em 01/10/2026, Baixa] O `PrivateRouteSecure.jsx` estava morto e quebrado

Achado registrado em 25/08/2026 e não corrigido desde então. O componente lia `sessionValid` de `useAuth()`, campo que o `AuthContext` não fornece, então redirecionaria todo mundo para `/login`. Nada o importava. Arquivo removido.

## Controles perdidos na migração

A auditoria de 25/08/2026 verificou e aprovou controles que viviam nas Cloud Functions do Firebase. Comparando com hoje:

| Controle, na época do Firebase | Hoje |
|---|---|
| Criptografia de CPF (AES-256-GCM, chave no servidor) | Migrado para a Edge Function `encrypt-personal-data` |
| Validação de reCAPTCHA no servidor | Perdido, ver achado acima |
| Rate limiting em funções sensíveis | Perdido, nada equivalente encontrado |
| `security_logs` com escrita bloqueada ao cliente | Existe uma página `/logs-auditoria`, mas não verifiquei se a tabela bloqueia escrita via RLS |
| Headers de segurança (HSTS, CSP, X-Frame-Options) | Perdido, ver achado acima |
| CORS do Storage restrito a origens reais | Era GCS. O bucket `avatars` do Supabase não foi verificado |
| Autorização checada no servidor (Firestore Rules) | Agora é RLS, e não foi verificado |

## O que não foi verificado

Por falta de acesso de rede e ao painel do Supabase nesta revisão:

- O corpo de `is_admin()` e `is_admin_or_manager()`, que sustentam quase toda política de RLS.
- Se o bucket `avatars` e o bucket `projetos` são públicos, e qual a validade das URLs assinadas que o app emite para eles.
- Se o autocadastro está com auto-aprovação ligada. Depende da linha `autoApproval` da tabela `settings`, lida em [Cadastro.jsx:62](src/pages/Cadastro.jsx#L62).
- Se o cadastro é aberto, o que tornaria `authenticated` ainda mais fraco como critério.
- Os headers reais em produção, com `curl -sI` no domínio.
- O que as duas Edge Functions fazem de fato.

Nada aqui deve ser lido como "está seguro". Os itens acima são justamente onde o risco se concentra.

## Conformidade (LGPD, cliente, ISO)

Pendências identificadas, sem avaliação completa:

- **Base legal e retenção:** não há documentação de base legal para tratar CPF e dados de colaboradores, nem política de retenção e descarte.
- **Rastreabilidade (ISO 9001):** existe `/logs-auditoria`, mas as Edge Functions que tratam dado pessoal não têm fonte versionada.
- **Inventário de dados:** este documento é o inventário mais próximo que existe. Falta registrar quais dados pessoais cada tabela guarda e por quê.
- **Continuidade:** não há registro de backup testado do projeto Supabase nem responsável designado.
- **Resposta a incidente:** o `INCIDENT_RESPONSE_PLAN.md` foi removido em 01/10/2026 porque instruía a agir em consoles do Firebase que não existem mais, e seguir aquele plano durante um incidente real custaria tempo crítico. Hoje não existe plano de resposta a incidente. A LGPD exige capacidade de resposta e comunicação ao titular e à ANPD em caso de vazamento, então isso é pendência aberta, não item resolvido. Um plano novo precisa cobrir: quem decide, como revogar acesso no Supabase (rotacionar chaves, desabilitar usuário), como medir o que foi acessado pelos logs do Supabase e em quanto tempo comunicar.

Qualquer aprovação formal para produção depende de resolver primeiro o achado de RLS. Não existe "aprovado com pendência" para exposição potencial de dado pessoal.
