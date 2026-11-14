# LIFE DASHBOARD

Painel pessoal em português com **Escola** (integração com Microsoft Teams), **Academia**, **Calendário**, **Minhas tarefas** e **Estatísticas**. Funciona no navegador e pode ser instalado no Android como aplicativo (PWA). Sem servidor: os dados ficam só no aparelho (localStorage) e podem ser exportados/importados em JSON.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `logic.js` | Regras puras (datas, prazos, estatísticas, mesclagem do Teams). Sem DOM. |
| `ui1.js` … `ui4.js` | Interface, formulários, ações, login Microsoft (OAuth 2.0 + PKCE) e Graph. |
| `head.html` | Todo o CSS. |
| `build.py` | Junta tudo e gera o site. |
| `docs/` | **Site pronto**, servido pelo GitHub Pages. Gerado por `LD_OUT=docs python3 build.py`. |
| `config.js` | ID do aplicativo Microsoft (não é segredo). Copiado para o site no build. |
| `icons/` | Ícones do app (`make.js` regenera os PNG com Playwright). |
| `tests/` | Testes de lógica, de tela, do fluxo Microsoft (simulada) e de PWA/Android. |

## Publicar no GitHub Pages (gratuito, HTTPS)

1. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta **`/docs`**.
2. O endereço será `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`. Esse endereço, com a barra no final, é o URI de redirecionamento do passo seguinte.
3. Abra o endereço no Chrome do Android. Em **Configurações** o app mostra o URI exato e um guia completo.

## Conectar o Microsoft Teams

O app usa OAuth 2.0 com PKCE como aplicativo de página única: **não há segredo, a senha nunca passa pelo app e os tokens ficam só no aparelho**.

1. No Microsoft Entra, registre um aplicativo com contas de qualquer diretório organizacional.
2. Em Autenticação, adicione a plataforma **Aplicativo de página única (SPA)** com o URI do passo 2 acima.
3. Em Permissões de API, adicione as permissões **delegadas** do Microsoft Graph: `User.Read`, `EduRoster.ReadBasic`, `EduAssignments.ReadBasic`.
4. Cole o ID do aplicativo em Configurações do app (ou em `docs/config.js` e `config.js`).
5. `EduRoster.ReadBasic` e `EduAssignments.ReadBasic` **exigem consentimento de um administrador** da escola. O cartão da Escola tem "Preciso da autorização da escola", com a mensagem pronta para o administrador.

Só contas escolares com turmas do Teams for Education funcionam. A sessão dura cerca de 24 horas; depois o app pede para reconectar.

## Desenvolvimento

```bash
python3 build.py                 # gera dist/, standalone.html e life-dashboard.html
LD_OUT=docs python3 build.py     # gera docs/ para o GitHub Pages
```

Testes (precisam de Node e Playwright; o app é servido localmente em HTTP, o que o navegador trata como seguro):

```bash
npm i -D playwright && npx playwright install chromium
python3 -m http.server 8765 --bind 127.0.0.1 &      # na raiz do repositório
node tests/logic-test.js
OUT=docs node tests/e2e.js
OUT=docs node tests/teams-mock.js
OUT=docs node tests/pwa-test.js
```

`tests/teams-mock.js` usa uma Microsoft **simulada**. Ele não prova que o login funciona com uma conta escolar real.

## Privacidade

O repositório não contém dados pessoais, tokens nem segredos. Os dados de exemplo do app são fictícios e marcados como "Exemplo".
