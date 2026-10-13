/**
 * ui/dividas.js — Tela "Dívidas": quanto falta para quitar cada dívida,
 * quando cada uma termina e o dia em que você fica livre de dívidas.
 *
 * Também tem o botão "Paguei" das faturas: marca como paga, registra a data
 * e ajusta o saldo da conta (mesma regra das compras, ver dados.js).
 */
import { listarDividas } from '../calculos.js';
import { formatarBRL } from '../dinheiro.js';
import { formatarData, formatarDataCurta, nomeMes, chaveMes, hojeISO, listaMeses } from '../datas.js';
import { ajustarSaldoSeNecessario } from '../dados.js';
import { esc, valorNeutro, cabecalho, botaoAcao, barra, abrirModal, avisar, campoValor, lerValor } from './comum.js';
import { icone, avatarInicial, avatarCategoria } from './icones.js';
import { modalEvento, modalCartao } from './cadastros.js';

/** "em 3 meses" / "este mês" a partir de hoje até a data. */
function emQuantoTempo(hoje, data) {
  const meses = listaMeses(chaveMes(hoje), chaveMes(data)).length - 1;
  if (meses <= 0) return 'este mês';
  return `em ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
}

// ================================================================== Tela

export function telaDividas({ dados, hoje }) {
  const r = listarDividas(dados, hoje);

  return `
    ${hero(r, hoje)}
    ${r.itens.map((item) => (item.tipo === 'cartao' ? cartaoCredito(item, hoje) : cartaoParcela(item, hoje))).join('')}
    <button class="btn btn-bloco btn-tracejado" data-acao="nova-parcela">${icone('mais')}Nova dívida parcelada</button>
    <p class="dica centro">Financiamentos e compras parceladas entram aqui quando cadastrados como saída com categoria
      <strong>Parcela</strong>. Informe o mês final ("Até") para o app calcular quanto falta.</p>
  `;
}

function hero(r, hoje) {
  if (!r.itens.length) {
    return `
      <section class="hero hero-verde">
        <p class="hero-rotulo">Dívidas</p>
        <p class="hero-valor">Nenhuma</p>
        <p class="hero-sub">Você não tem faturas em aberto nem parcelas cadastradas.</p>
      </section>`;
  }
  return `
    <section class="hero">
      <p class="hero-rotulo">Falta pagar</p>
      <p class="hero-valor">${valorNeutro(r.total)}</p>
      <p class="hero-sub">${r.livreEm
        ? `Livre de dívidas em <strong>${nomeMes(chaveMes(r.livreEm))}</strong> · ${emQuantoTempo(hoje, r.livreEm)}`
        : 'Alguma parcela está sem mês final, então não dá para calcular quando termina.'}</p>
    </section>`;
}

function blocoProgresso(item, rotuloPago) {
  return `
    ${barra(item.progresso, item.progresso >= 100 ? 'ok' : 'destaque')}
    <div class="linha-valores mt">
      <span><small>${rotuloPago}</small>${Math.round(item.progresso)}%</span>
      <span class="direita"><small>Quitado em</small>${formatarData(item.quitaEm)}</span>
    </div>`;
}

function cartaoCredito(item, hoje) {
  const p = item.parcelamento;
  const prox = item.proximo;
  const vencida = prox.vencimento < hoje;
  return `
    <section class="cartao">
      <div class="cartao-cabecalho">
        <div class="titulo-com-avatar">${avatarInicial(item.nome)}<span><h2>${esc(item.nome)}</h2>
          <small class="secundario">${item.faltam} fatura(s) em aberto</small></span></div>
        ${botaoAcao('editar-cartao', '', 'editar', `data-id="${item.id}" aria-label="Editar cartão"`)}
      </div>
      <p class="valor-medio">${valorNeutro(item.restante)}</p>
      ${blocoProgresso(item, 'Faturas pagas')}
      ${p ? `<p class="secundario">Parcelamento de fatura: ${p.pagas} de ${p.parcelas} parcelas pagas (${formatarBRL(p.valor)} cada).</p>` : ''}
      ${item.vencidas ? `<p class="alerta aviso mt">${icone('alerta')}<span>${item.vencidas} fatura(s) com data passada. Se já pagou, toque em "Paguei".</span></p>` : ''}
      <button class="btn btn-primario btn-bloco" data-acao="paguei" data-cartao="${item.id}" data-fatura="${prox.id}">
        ${icone('ok')}Paguei a fatura de ${formatarDataCurta(prox.vencimento)} · ${formatarBRL(prox.valor)}</button>
      ${vencida ? '' : `<p class="dica centro">Próximo pagamento ${emQuantoTempo(hoje, prox.vencimento) === 'este mês' ? 'ainda este mês' : emQuantoTempo(hoje, prox.vencimento)}.</p>`}
    </section>`;
}

function cartaoParcela(item, hoje) {
  const cabecalhoItem = `
      <div class="cartao-cabecalho">
        <div class="titulo-com-avatar">${avatarCategoria('Parcela')}<span><h2>${esc(item.nome)}</h2>
          <small class="secundario">${formatarBRL(item.valorMensal)} por mês</small></span></div>
        ${botaoAcao('editar-parcela', '', 'editar', `data-id="${item.id}" aria-label="Editar parcela"`)}
      </div>`;
  if (item.semFim) {
    return `
      <section class="cartao">
        ${cabecalhoItem}
        <p class="alerta info">${icone('info')}<span>Sem mês final cadastrado. Edite e preencha o campo "Até" para ver quanto falta e quando termina.</span></p>
        ${item.proximo ? `<p class="secundario">Próxima parcela: ${formatarData(item.proximo.data)}.</p>` : ''}
      </section>`;
  }
  return `
    <section class="cartao">
      ${cabecalhoItem}
      <p class="valor-medio">${valorNeutro(item.restante)}</p>
      ${blocoProgresso(item, `${item.pagas} de ${item.totalParcelas} parcelas pagas`)}
      <p class="secundario">Faltam ${item.faltam} · próxima em ${formatarData(item.proximo.data)} (${emQuantoTempo(hoje, item.proximo.data) === 'este mês' ? 'este mês' : emQuantoTempo(hoje, item.proximo.data)}).</p>
    </section>`;
}

// ================================================================== Cliques

export function ligarDividas(raiz, ctx) {
  raiz.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-acao]');
    if (!alvo) return;
    const acoes = {
      paguei: () => modalPaguei(ctx, alvo.dataset.cartao, alvo.dataset.fatura),
      'editar-cartao': () => modalCartao(ctx, ctx.dados.cartoes.find((c) => c.id === alvo.dataset.id)),
      'editar-parcela': () => modalEvento(ctx, ctx.dados.eventos.find((ev) => ev.id === alvo.dataset.id)),
      'nova-parcela': () => modalEvento(ctx, null, 'saida', { categoria: 'Parcela', nome: '' }),
    };
    acoes[alvo.dataset.acao]?.();
  });
}

/** Confirma o pagamento de uma fatura (data e valor pago). */
function modalPaguei(ctx, idCartao, idFatura) {
  const cartao = ctx.dados.cartoes.find((c) => c.id === idCartao);
  const fatura = cartao?.faturas.find((f) => f.id === idFatura);
  if (!fatura) return;
  const p = cartao.parcelamento;
  const temParcela = p && p.pagas < p.parcelas;

  abrirModal({
    titulo: `Pagar fatura ${cartao.nome}`,
    textoSalvar: 'Confirmar pagamento',
    corpo: `
      ${campoValor('valor', 'Valor pago (R$)', fatura.valor, 'Se pagou um valor diferente, ajuste aqui.')}
      <label>Data do pagamento<input type="date" name="data" value="${hojeISO()}" max="${hojeISO()}"></label>
      ${temParcela ? `<label class="check"><input type="checkbox" name="parcela" checked> Esta fatura incluía a parcela ${p.pagas + 1} de ${p.parcelas} do parcelamento</label>` : ''}
      <p class="dica">O valor sai do saldo da conta na data do pagamento.</p>`,
    aoSalvar: (f) => {
      const valor = lerValor(f, 'valor', 'Valor pago', { permitirZero: false });
      const data = f.elements.data.value;
      if (!data || data > hojeISO()) throw new Error('Use a data de hoje ou de um dia que já passou.');
      ctx.alterar((d) => {
        const c = d.cartoes.find((x) => x.id === idCartao);
        const fat = c.faturas.find((x) => x.id === idFatura);
        Object.assign(fat, { valor, paga: true, pagaEm: data, criadoEm: Date.now() });
        fat.abateuSaldo = ajustarSaldoSeNecessario(d, data, -valor);
        if (temParcela && f.elements.parcela?.checked) {
          c.parcelamento.pagas += 1;
          fat.contouParcela = true; // para desfazer certo, se desmarcar depois
        }
      });
      avisar('Fatura paga. Uma a menos!');
    },
  });
}
