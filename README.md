# 💰 Minhas Finanças — PWA de controle e projeção financeira

App web instalável (PWA) que projeta o saldo da conta **dia a dia**, mostra o uso do cheque especial, as faturas de cartão e avisa quando a conta vai apertar.
Feito em **HTML, CSS e JavaScript puros**: sem build, sem bibliotecas, sem CDN, e funciona offline.

> ⚠️ **PRIVACIDADE: leia antes de usar**
>
> - Este repositório é **público**. Ele **não contém e nunca deve conter** dados financeiros reais.
> - O app abre **vazio** (ou com dados de exemplo **fictícios**). Os dados reais são importados pelo botão **Importar** e ficam salvos **só no navegador do aparelho** (localStorage). Nada é enviado para servidor nenhum.
> - **Nunca** faça commit de arquivos de dados ou backup (`dados-iniciais.json`, `financas-backup-*.json`). O `.gitignore` já ignora esses nomes, mas confira antes de enviar.
>
> As projeções são **estimativas** baseadas nos números que o usuário cadastra. Isto não é consultoria financeira.

## Telas

| Aba | O que mostra |
|---|---|
| **Início** | Saldo, entradas/saídas do mês, alertas, cheque especial, cartões e próximos lançamentos |
| **Fluxo** | Um mês por vez: resumo, gráfico do saldo, saídas por categoria e extrato dia a dia |
| **+** | Atalho para nova entrada, nova saída ou atualizar o saldo de hoje |
| **Dívidas** | Conta e cheque especial, cartões com faturas e parcelamento |
| **Mais** | Entradas e saídas cadastradas, configurações (feriados etc.) e backup |

O ícone de **olho** no topo esconde todos os valores (útil para abrir o app em público).
Tema escuro por padrão, com tema claro automático se o celular estiver no modo claro.

## Como o cálculo funciona

1. Você informa o **saldo real** da conta numa data (negativo = usando o cheque especial).
2. O motor (`js/calculos.js`) transforma os eventos recorrentes em lançamentos com data e simula **cada dia** até o mês final.
3. Quando o **salário** entra com a conta negativa, o app mostra o **desconto automático** do cheque especial e cobra o **IOF estimado** (e juros, se você cadastrar uma taxa).
4. O prazo sem juros é contado a partir do dia em que a conta ficou negativa e recomeça quando ela volta ao positivo.
5. Todos os valores são **centavos inteiros**, o que evita erros de arredondamento (`0.1 + 0.2 ≠ 0.3`).

## Estrutura

```
index.html          Página única do app
manifest.json       Configuração de instalação (PWA)
sw.js               Service worker: cache offline
css/style.css       Visual (mobile-first, escuro/claro)
icons/              Ícones do app
js/
  app.js            Ponto de entrada: estado e navegação
  datas.js          Datas, dias úteis e formatação dd/mm/aaaa
  dinheiro.js       Centavos <-> R$ 1.234,56
  dados.js          Formato dos dados, localStorage e backup
  calculos.js       Motor da projeção (não mexe na tela)
  grafico.js        Gráficos SVG (linha do saldo e rosca)
  ui/
    comum.js        Peças compartilhadas (extrato, modal, formatação)
    icones.js       Ícones SVG e cores das categorias
    painel.js       Aba Início
    fluxo.js        Aba Fluxo
    cadastros.js    Abas Dívidas e Mais + formulários
```

## Publicar no GitHub Pages

1. Em github.com, clique em **New repository**, dê o nome `financas-pwa`, marque **Public** e clique em **Create repository**.
2. **Extraia o .zip** (botão direito → Extrair tudo). Na página do repositório, clique em **Add file → Upload files** e **arraste** o conteúdo da pasta extraída, incluindo as pastas. Depois clique em **Commit changes**.
3. Vá em **Settings → Pages**. Em *Source*, escolha **Deploy from a branch**, branch **main** e pasta **/ (root)**, e clique em **Save**.
4. Aguarde 1 a 2 minutos. O link aparece na mesma tela: `https://SEU-USUARIO.github.io/financas-pwa/`.

## Instalar no celular

- **Android (Chrome):** abra o link, toque em **⋮ → Instalar app** (ou **Adicionar à tela inicial**).
- **iPhone (Safari):** abra o link **no Safari**, toque em **Compartilhar** (quadrado com seta) **→ Adicionar à Tela de Início**.

Depois de instalado, abra pelo ícone, vá em **Mais → Backup → Importar** e escolha o seu arquivo de dados guardado no celular.

> No iPhone, o app instalado e o Safari guardam dados **separadamente**. Importe os dados **dentro do app instalado**.

## Atualizar o app depois de mudanças

Sempre que alterar algum arquivo, abra o `sw.js` e aumente a `VERSAO` (`financas-v2` → `financas-v3`). Isso força o celular a baixar a versão nova. Pode ser preciso fechar e abrir o app duas vezes.

## Testar no computador

Módulos JavaScript não funcionam abrindo o `index.html` com duplo clique. Use um servidor local, por exemplo:

```
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.
