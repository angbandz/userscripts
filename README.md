# Userscripts

Coleção pessoal de userscripts para Tampermonkey, Violentmonkey ou gerenciadores compatíveis.

Este repositório contém dois scripts principais para Instagram:

1. **Instagram Unfollow Button** — adiciona um painel com botão na tela de `Seguindo/Following` para deixar de seguir contas em rodadas controladas.
2. **Instagram to Imginn Global Redirect** — intercepta cliques em links do Instagram em praticamente qualquer site e redireciona para o equivalente direto no Imginn, exceto quando você já está dentro do próprio Instagram.

> Estes scripts foram feitos para uso pessoal. Sites como Instagram e Imginn mudam HTML, textos, rotas e comportamento com frequência. Se algo parar, provavelmente será necessário ajustar seletores, textos de botão ou mapeamento de URL.

---

## Estrutura

```text
scripts/
├── instagram-unfollow-button.user.js
└── instagram-to-imginn-global.user.js
```

---

## Requisitos

Você precisa de um gerenciador de userscripts no navegador, por exemplo:

- [Tampermonkey](https://www.tampermonkey.net/)
- [Violentmonkey](https://violentmonkey.github.io/)
- Greasemonkey, com ressalvas de compatibilidade

Os scripts foram escritos em JavaScript puro e não dependem de bibliotecas externas.

---

## Como instalar

### Método manual

1. Abra o Tampermonkey ou Violentmonkey.
2. Clique em **Create a new script** / **Novo script**.
3. Apague o conteúdo padrão.
4. Copie o conteúdo de um dos arquivos `.user.js` deste repositório.
5. Cole no editor.
6. Salve.
7. Recarregue a página onde o script deve agir.

### Método por URL raw

Também é possível abrir o arquivo `.user.js` pela URL raw do GitHub e deixar o gerenciador instalar automaticamente, se ele detectar o userscript.

Formato:

```text
https://raw.githubusercontent.com/angbandz/userscripts/main/scripts/NOME-DO-SCRIPT.user.js
```

---

# 1. Instagram Unfollow Button

Arquivo:

```text
scripts/instagram-unfollow-button.user.js
```

## Finalidade

Adiciona um painel fixo no canto inferior direito do Instagram com botões para:

- começar uma rodada de unfollow;
- pausar/retomar;
- parar;
- ver contador da rodada/aba;
- ver status atual da automação.

O objetivo é deixar de seguir contas na lista de **Seguindo / Following** com delays e limite por rodada, evitando comportamento excessivamente agressivo.

## Onde roda

```javascript
@match https://www.instagram.com/*
```

Ou seja: ele roda apenas dentro do Instagram.

## Como usar

1. Abra o Instagram.
2. Vá até o seu perfil.
3. Clique em **Seguindo** / **Following**.
4. Com a lista aberta, use o painel no canto inferior direito.
5. Clique em **Começar**.
6. Espere a rodada terminar ou use **Pausar/Retomar** ou **Parar**.

## Configuração principal

Dentro do script existe este bloco:

```javascript
const CFG = {
  delayAfterFollowingClick: 900,
  delayAfterConfirmClick: 3500,
  delayAfterScroll: 1200,
  maxPerRun: 40,
};
```

### Campos

| Campo | Função |
|---|---|
| `delayAfterFollowingClick` | Tempo, em milissegundos, depois de clicar em `Seguindo/Following` antes de procurar o botão de confirmação. |
| `delayAfterConfirmClick` | Tempo, em milissegundos, depois de confirmar o unfollow. |
| `delayAfterScroll` | Tempo, em milissegundos, depois de rolar a lista. |
| `maxPerRun` | Limite máximo de unfollows por rodada. |

## Configuração conservadora

Para uso mais lento, especialmente se você for deixar a aba rodando enquanto faz outra coisa:

```javascript
const CFG = {
  delayAfterFollowingClick: 900,
  delayAfterConfirmClick: 6000,
  delayAfterScroll: 1200,
  maxPerRun: 20,
};
```

## Textos reconhecidos

O script procura botões com textos em inglês e português.

### Botões de estado

```javascript
const followingTexts = new Set([
  'following',
  'requested',
  'seguindo',
  'solicitado',
  'solicitada',
]);
```

### Botões de confirmação

```javascript
const confirmTexts = new Set([
  'unfollow',
  'deixar de seguir',
  'cancel request',
  'cancelar solicitação',
  'cancelar pedido',
]);
```

Se o Instagram mostrar outro texto no botão de confirmação, adicione esse texto em minúsculas ao conjunto adequado.

## Observações operacionais

- Use rodadas pequenas.
- Não rode centenas de unfollows sem pausa.
- Evite trocar de aba, minimizar o navegador ou bloquear a tela durante a execução.
- O navegador pode reduzir timers de JavaScript em abas em segundo plano.
- O Instagram pode impor bloqueios temporários se detectar ação em massa.

---

# 2. Instagram to Imginn Global Redirect

Arquivo:

```text
scripts/instagram-to-imginn-global.user.js
```

## Finalidade

Intercepta cliques em links do Instagram em qualquer site e redireciona para a URL direta equivalente no Imginn.

Exemplos:

```text
https://www.instagram.com/shakira/
→ https://imginn.com/shakira/
```

```text
https://www.instagram.com/p/ABC123/
→ https://imginn.com/p/ABC123/
```

```text
https://www.instagram.com/reel/ABC123/
→ https://imginn.com/reel/ABC123/
```

```text
https://www.instagram.com/stories/usuario/123456789/
→ https://imginn.com/stories/usuario/123456789/
```

## Onde roda

```javascript
@match   *://*/*
@exclude *://instagram.com/*
@exclude *://www.instagram.com/*
@exclude *://*.instagram.com/*
```

Ou seja: o script age globalmente, mas **não age dentro do Instagram**.

Isso permite que ele funcione em:

- Google;
- Bing;
- DuckDuckGo;
- Brave Search;
- Reddit;
- fóruns;
- sites de notícias;
- páginas com links diretos ou redirecionados para Instagram.

## Por que excluir o Instagram?

Porque dentro do próprio Instagram é comum existir navegação interna, modais, rotas dinâmicas e links que não devem ser reescritos. O objetivo é transformar links encontrados fora do Instagram, sem quebrar o uso normal do site.

## Como funciona

O script:

1. escuta cliques em links (`<a href="...">`);
2. verifica se o link aponta direta ou indiretamente para Instagram;
3. extrai a URL real quando ela está escondida em parâmetros como `q`, `url`, `u`, `uddg`, `target`, `redirect_url`, `adurl`, etc.;
4. identifica o tipo de rota do Instagram;
5. constrói a URL direta no Imginn;
6. abre essa URL no clique.

## Links diretos e redirecionadores

O script lida tanto com links simples:

```text
https://www.instagram.com/usuario/
```

quanto com links de redirecionamento, como:

```text
https://www.google.com/url?q=https://www.instagram.com/usuario/
```

ou parâmetros similares usados por buscadores e agregadores.

## Comportamento de clique

- Clique normal: abre na mesma aba.
- Ctrl+clique / Cmd+clique / Shift+clique / botão do meio: abre em nova aba.

## Limitações

O script só converte a URL. Ele não garante que o Imginn tenha ou consiga abrir aquele conteúdo.

O Imginn pode retornar erro ou `Not Found` quando:

- o perfil é privado;
- o perfil mudou de nome;
- o perfil não está indexado;
- o post/reel/story não está disponível;
- o conteúdo exige login no Instagram;
- o Imginn mudou suas rotas internas.

## Decisão de design

Este script não usa busca do Imginn, não automatiza cliques dentro do Imginn e não tenta simular fluxo interno. Ele apenas reproduz o padrão direto de links do Imginn:

```text
https://imginn.com/usuario/
```

Essa abordagem é mais previsível, menos invasiva e mais fácil de debugar.

---

## Segurança e privacidade

Os scripts não enviam dados para servidor próprio, não usam APIs externas e não armazenam credenciais.

Ainda assim, userscripts rodam com acesso à página onde estão ativos. Instale apenas scripts que você consegue revisar ou em que confia.

---

## Solução de problemas

### O painel de unfollow não aparece

Verifique:

- se o script está ativado no gerenciador;
- se você está em `https://www.instagram.com/`;
- se a página foi recarregada depois da instalação;
- se o gerenciador de userscripts tem permissão para rodar no Instagram.

### O unfollow não confirma

Provável mudança no texto do botão. Abra o modal manualmente, veja o texto exato do botão e adicione em `confirmTexts`.

### O redirect não funciona no Google

Verifique:

- se o script global está ativo;
- se o link realmente aponta para Instagram;
- se o gerenciador de userscripts tem permissão para rodar no Google;
- se outro userscript/extensão está interceptando cliques antes dele.

### O Imginn abre `Not Found`

Isso geralmente significa que a URL foi convertida, mas o Imginn não tem ou não consegue resolver aquele conteúdo. Teste com perfis públicos conhecidos para separar problema de script de problema do próprio Imginn.

---

## Changelog

### 1.0.0 — Instagram Unfollow Button

- Adicionado painel fixo.
- Adicionados botões Começar, Pausar/Retomar e Parar.
- Adicionado contador.
- Adicionado limite por rodada.
- Suporte a textos em português e inglês.

### 4.1.0 — Instagram to Imginn Global Redirect

- Script passou a agir globalmente com `@match *://*/*`.
- Instagram foi excluído com `@exclude`.
- Conversão direta para `imginn.com/usuario/`.
- Suporte a posts, reels e stories.
- Extração de URLs escondidas em parâmetros de redirecionamento.

---

## Licença

Uso pessoal. Adapte como quiser.
