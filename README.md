# 💰 Minhas Finanças — PWA de controle e projeção financeira

App web instalável (PWA) que projeta o saldo da conta **dia a dia**, mostra o uso do cheque especial, as faturas de cartão e avisa quando a conta vai apertar.
Feito em **HTML, CSS e JavaScript puros**: sem build, sem bibliotecas, sem CDN, e funciona offline.

> ⚠️ **PRIVACIDADE: leia antes de usar**
>
> - Este repositório é **público**. Ele **não contém e nunca deve conter** dados financeiros reais.
> - O app abre **vazio** (ou com dados de exemplo **fictícios**). Os dados reais são importados pelo botão **Importar JSON** e ficam salvos **só no navegador do aparelho** (localStorage). Nada é enviado para servidor nenhum.
> - **Nunca** faça commit de arquivos de dados ou backup (`dados-iniciais.json`, `financas-backup-*.json`). O `.gitignore` já ignora esses nomes, mas confira antes de enviar.
>
> As projeções são **estimativas** baseadas nos números que o usuário cadastra. Isto não é consultoria financeira.

## Funcionalidades (Etapa 1: MVP)

- **Painel:** saldo atual, disponível com o limite, barra de uso do cheque especial, dívida total, alertas e próximos eventos.
- **Fluxo de caixa:** gráfico do saldo dia a dia (SVG próprio), resumo por mês e lista dia a dia.
- **Dados:** entradas e saídas (únicas, mensais ou "último dia útil"), cartões com faturas e parcelamento, cheque especial (limite, IOF, prazo sem juros) e feriados.
- **Backup:** exportar e importar tudo em JSON.
- **PWA:** instalável no Android e no iPhone, funciona offline e tem modo escuro automático.

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
css/style.css       Visual (mobile-first, claro/escuro)
icons/              Ícones do app
js/
  app.js            Ponto de entrada: estado e navegação
  datas.js          Datas, dias úteis e formatação dd/mm/aaaa
  dinheiro.js       Centavos <-> R$ 1.234,56
  dados.js          Formato dos dados, localStorage e backup
  calculos.js       Motor da projeção (não mexe na tela)
  grafico.js        Gráfico SVG do saldo
  ui/               Telas (painel, fluxo, cadastros) e peças comuns
```

## Publicar no GitHub Pages

1. Em github.com, clique em **New repository**, dê o nome `financas-pwa`, marque **Public** e clique em **Create repository**.
2. Na página do repositório, clique em **uploading an existing file** e arraste **todo o conteúdo** desta pasta (não a pasta em si). Depois clique em **Commit changes**.
   - O `.gitignore` começa com ponto e pode ficar oculto no seu computador. Se ele não subir, crie pelo site: **Add file → Create new file**, com o nome `.gitignore`, e cole o conteúdo.
3. Vá em **Settings → Pages**. Em *Source*, escolha **Deploy from a branch**, branch **main** e pasta **/ (root)**, e clique em **Save**.
4. Aguarde 1 a 2 minutos. O link aparece na mesma tela: `https://SEU-USUARIO.github.io/financas-pwa/`.

## Instalar no celular

- **Android (Chrome):** abra o link, toque em **⋮ → Instalar app** (ou **Adicionar à tela inicial**).
- **iPhone (Safari):** abra o link **no Safari**, toque em **Compartilhar** (quadrado com seta) **→ Adicionar à Tela de Início**.

Depois de instalado, abra pelo ícone, vá em **Dados → Importar JSON** e escolha o seu arquivo de dados guardado no celular.

> No iPhone, o app instalado e o Safari guardam dados **separadamente**. Importe os dados **dentro do app instalado**.

## Atualizar o app depois de mudanças

Sempre que alterar algum arquivo, abra o `sw.js` e aumente a `VERSAO` (`financas-v1` → `financas-v2`). Isso força o celular a baixar a versão nova. Pode ser preciso fechar e abrir o app duas vezes.

## Testar no computador

Módulos JavaScript não funcionam abrindo o `index.html` com duplo clique. Use um servidor local, por exemplo:

```
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.
