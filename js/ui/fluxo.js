/**
 * ui/fluxo.js — Fluxo de caixa de UM mês por vez (com setas para trocar),
 * gráfico do período inteiro, saídas por categoria e extrato dia a dia.
 */
import { CATEGORIAS } from '../calculos.js';
import { formatarBRL } from '../dinheiro.js';
import { nomeMes, formatarData, formatarDataCurta } from '../datas.js';
import { svgSaldo, svgRosca } from '../grafico.js';
import { valorHTML, valorNeutro, listaExtrato, cabecalho } from './comum.js';
import { icone, CORES_CATEGORIA } from './icones.js';

export function telaFluxo({ dados, projecao, hoje, mesFluxo }) {
  const meses = projecao.meses;
  const i = Math.max(0, meses.findIndex((m) => m.chave === mesFluxo));
  const m = meses[i];
  const [nome, ano] = nomeMes(m.chave).split('/');

  const grupos = m.dias
    .filter((d) => d.itens.length)
    .map((d) => ({ data: d.data, saldo: d.saldo, itens: d.itens }));

  return `
    <div class="seletor-mes">
      <button class="btn-redondo" data-mes="-1" ${i === 0 ? 'disabled' : ''} aria-label="Mês anterior">${icone('esquerda')}</button>
      <span class="seletor-nome">${nome} <small>${ano}</small></span>
      <button class="btn-redondo" data-mes="1" ${i === meses.length - 1 ? 'disabled' : ''} aria-label="Próximo mês">${icone('direita')}</button>
    </div>

    <section class="cartao">
      <div class="grade-2">
        <div class="bloco"><small>Saldo no início</small>${valorHTML(m.saldoInicio)}</div>
        <div class="bloco"><small>Saldo no fim</small>${valorHTML(m.saldoFim)}</div>
        <div class="bloco"><small>Entradas</small><span class="valor positivo">${formatarBRL(m.entradas)}</span></div>
        <div class="bloco"><small>Saídas</small><span class="valor negativo">${formatarBRL(m.saidas)}</span></div>
      </div>
      <div class="pior-momento ${m.minimo.saldo < 0 ? 'ruim' : ''}">
        ${icone(m.minimo.saldo < 0 ? 'alerta' : 'info')}
        <span>Pior momento: ${valorHTML(m.minimo.saldo)} em ${formatarDataCurta(m.minimo.data)}${m.diasNegativos ? ` · ${m.diasNegativos} dia(s) no cheque especial` : ''}</span>
      </div>
      ${m.estouraLimite ? `<p class="alerta perigo">${icone('perigo')}<span>O saldo passa do limite do cheque (${formatarBRL(dados.cheque.limite)}) neste mês.</span></p>` : ''}
    </section>

    <section class="cartao">
      ${cabecalho('Saldo projetado')}
      ${svgSaldo(projecao.dias, dados.cheque.limite, hoje, m.chave)}
      <p class="legenda"><span class="leg pos"></span>positivo <span class="leg neg"></span>cheque especial
        <span class="leg lim"></span>limite <span class="leg hoje"></span>hoje <span class="leg sel"></span>mês selecionado</p>
    </section>

    ${cartaoCategorias(m)}

    <section class="cartao">
      ${cabecalho('Lançamentos do mês')}
      ${listaExtrato(grupos, hoje)}
      ${m.descontoCheque ? `<p class="secundario">O desconto automático (${formatarBRL(m.descontoCheque)}) já está dentro do saldo: o salário entra e cobre o negativo.</p>` : ''}
    </section>

    <p class="nota">${icone('escudo')} Valores estimados. Ponto de partida: saldo informado em ${formatarData(projecao.inicio)}.</p>
  `;
}

/** Rosca com as saídas do mês por categoria + legenda com valor e %. */
function cartaoCategorias(m) {
  const fatias = Object.keys(CATEGORIAS)
    .filter((cat) => CATEGORIAS[cat].tipo === 'saida' && m.porCategoria[cat])
    .map((cat) => ({ cat, valor: m.porCategoria[cat], cor: CORES_CATEGORIA[cat] }))
    .sort((a, b) => b.valor - a.valor);
  if (!fatias.length) return '';
  const total = fatias.reduce((s, f) => s + f.valor, 0);

  return `
    <section class="cartao">
      ${cabecalho('Saídas por categoria')}
      <div class="categorias">
        <div class="rosca-caixa">
          ${svgRosca(fatias)}
          <span class="rosca-centro"><small>Total</small>${valorNeutro(total)}</span>
        </div>
        <ul class="legenda-categorias">
          ${fatias.map((f) => `
            <li>
              <span class="ponto" style="background:${f.cor}"></span>
              <span class="leg-nome">${CATEGORIAS[f.cat].nome}<small>${Math.round((f.valor / total) * 100)}%</small></span>
              ${valorNeutro(f.valor)}
            </li>`).join('')}
        </ul>
      </div>
    </section>`;
}

/** Liga as setas de troca de mês. */
export function ligarFluxo(raiz, ctx) {
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mes]');
    if (!b || b.disabled) return;
    const meses = ctx.projecao.meses.map((m) => m.chave);
    const i = Math.max(0, meses.indexOf(ctx.mesFluxo)) + Number(b.dataset.mes);
    if (meses[i]) ctx.mudarMes(meses[i]);
  });
}
