# 💰 Minhas Finanças — PWA de controle financeiro pessoal

App web instalável (PWA) para **registrar o que entra e o que sai, saber quanto ainda dá para gastar no mês, acompanhar faturas e montar a reserva de emergência e os investimentos**.
Feito em **HTML, CSS e JavaScript puros**: sem build, sem bibliotecas, sem CDN, e funciona offline.

## Telas

| Aba | O que mostra |
|---|---|
| **Início** | Saldo da conta, orçamento do mês (quanto ainda pode gastar), meta de guardar, alertas, cartões e próximos lançamentos |
| **Fluxo** | A "planilha" de um mês: entradas, saídas, compras, guardado, orçamento, gráfico do saldo, gastos por categoria e lançamentos |
| **+** | Registrar compra, guardar dinheiro, nova entrada, nova saída fixa, simular cenário ou atualizar o saldo |
| **Investir** | Caixinhas e investimentos com rendimento (% do CDI, % a.a. ou % a.m.), reserva de emergência com valor recomendado e meta mensal |
| **Mais** | Conta, entradas, saídas fixas, cartões, orçamento e metas, lembretes e backup |

| **Dívidas** | (pelo **Início** ou por **Mais**) Quanto falta pagar em cada cartão e parcela, progresso, data em que fica livre de dívidas e botão "Paguei" das faturas |
| **Simulador** | (pelo **+** ou por **Mais**) Comprar, Cortar, Parcelar e Meta: testa ideias sem alterar os dados |

O ícone de **olho** no topo esconde todos os valores.

## Como os cálculos funcionam

- **Saldo da conta:** você informa o saldo real numa data. O app soma os lançamentos seguintes (entradas, saídas fixas, faturas, compras pela conta, dinheiro guardado) e projeta o saldo **dia a dia**.
- **Orçamento livre do mês** = renda recorrente − saídas fixas recorrentes − meta de guardar (% da renda). As compras registradas (conta e cartão) são descontadas dele.
- **Compras no cartão** entram no orçamento e na planilha do mês, mas **não** tiram dinheiro da conta (quem tira é a fatura). Por isso as faturas não entram em "gastos por categoria", para não contar duas vezes.
- **Avisos de compra:** ao digitar o valor, o app mostra o peso na renda, se cabe no orçamento livre e se a conta ficaria negativa.
- **Reserva de emergência** = meses de reserva (padrão 6) × soma das saídas fixas mensais.
- **Rendimento:** % do CDI é convertido em taxa mensal com juros compostos: `(1 + CDI × %)^(1/12) − 1`. É estimativa antes de impostos.
- **Dívidas:** faturas em aberto de cada cartão + saídas com categoria "Parcela". Com mês final, o app conta as parcelas que faltam; a última data de todas é o dia em que você fica livre de dívidas. O botão "Paguei" registra a data do pagamento e tira o valor do saldo da conta.
- **Simulador:** cada simulação faz uma *cópia* dos dados (`structuredClone`), aplica a mudança na cópia e compara com o cenário real. Parcelas com juros usam a Tabela Price: `parcela = valor × i / (1 − (1 + i)^−n)`. Metas usam o valor futuro com aportes mensais.
- Todos os valores são **centavos inteiros**, o que evita erros de arredondamento (`0.1 + 0.2 ≠ 0.3`).

## Lembretes

Um app sem servidor não consegue agendar notificações para o futuro. Por isso:
1. **Notificação do sistema** quando o app é aberto (e, no Android com o app instalado, em segundo plano quando o Chrome permitir, via *Periodic Background Sync*).
2. **Adicionar ao calendário:** gera um `.ics` com as contas e alarmes (9h do dia anterior e 9h do dia). Funciona sempre, no Android e no iPhone.

## Estrutura

```
index.html            Página única do app
manifest.json         Configuração de instalação (PWA)
sw.js                 Service worker: cache offline + lembretes em segundo plano
css/style.css         Visual (mobile-first, escuro/claro)
icons/                Ícones do app
js/
  app.js              Ponto de entrada: estado e navegação
  datas.js            Datas, dias úteis e formatação dd/mm/aaaa
  dinheiro.js         Centavos <-> R$ 1.234,56
  dados.js            Formato dos dados, migração, localStorage e backup
  calculos.js         Motor: lançamentos, projeção, orçamento, investimentos, alertas
  grafico.js          Gráficos SVG (saldo e rosca)
  notificacoes.js     Lembretes (notificação e calendário .ics)
  simulacoes.js       Cálculos do simulador (compra, corte, parcelamento, meta)
  ui/
    comum.js          Peças compartilhadas (extrato, modal, campos)
    icones.js         Ícones SVG e cores das categorias
    painel.js         Aba Início
    fluxo.js          Aba Fluxo
    investimentos.js  Aba Investir
    compras.js        Registro de compras com avisos de orçamento
    cadastros.js      Aba Mais + menu do botão "+"
    simulador.js      Tela do simulador
    dividas.js        Tela de dívidas e botão "Paguei"
```

## Publicar no GitHub Pages

1. Em github.com, clique em **New repository**, dê o nome `financas-pwa`, marque **Public** e clique em **Create repository**.
2. **Extraia o .zip** (botão direito → Extrair tudo). Na página do repositório, clique em **Add file → Upload files** e **arraste** o conteúdo da pasta extraída, incluindo as pastas. Depois clique em **Commit changes**.
3. Vá em **Settings → Pages**. Em *Source*, escolha **Deploy from a branch**, branch **main** e pasta **/ (root)**, e clique em **Save**.
4. Aguarde 1 a 2 minutos. O link fica `https://SEU-USUARIO.github.io/financas-pwa/`.

## Instalar no celular

- **Android (Chrome):** abra o link e toque em **⋮ → Instalar app**.
- **iPhone (Safari):** abra o link **no Safari** e toque em **Compartilhar → Adicionar à Tela de Início**.

Depois de instalado, vá em **Mais → Backup → Importar** e escolha o seu arquivo de dados.

> No iPhone, o app instalado e o Safari guardam dados **separadamente**. Importe os dados **dentro do app instalado**. As notificações no iPhone só funcionam com o app instalado na tela inicial.

## Atualizar o app depois de mudanças

Sempre que alterar algum arquivo, aumente a `VERSAO` no `sw.js` (`financas-v5` → `financas-v6`). Pode ser preciso fechar e abrir o app duas vezes.

## Testar no computador

```
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.
