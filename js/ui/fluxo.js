/**
 * ui/fluxo.js — Aba "Fluxo": a "planilha" de um mês por vez.
 * Resumo, orçamento, gráfico do saldo, gastos por categoria e todos os lançamentos.
 */
import { resumoMes, orcamentoMes, saldoNoDia } from '../calculos.js';
import { formatarBRL } from '../dinheiro.js';
import { nomeMes, formatarData, chaveMes } from '../datas.js';
import { svgSaldo, svgRosca } from '../grafico.js';
import { valorHTML, valorNeutro, listaExtrato, agruparPorDia, cabecalho, barra, esc } from './comum.js';
import { icone, corCategoria } from './icones.js';

export function telaFluxo({ dados, projecao, hoje, mesFluxo, meses }) {
  const i = Math.max(0, meses.indexOf(mesFluxo));
  const chave = meses[i];
  const [nome, ano] = nomeMes(chave).split('/');
  const r = resumoMes(dados, projecao, chave);
  const orc = orcamentoMes(dados, chave);
  const passado = chave < chaveMes(hoje);

  return `
    <div class="seletor-mes">
      <button class="btn-redondo" data-mes="-1" ${i === 0 ? 'disabled' : ''} aria-label="Mês anterior">${icone('esquerda')}</button>
      <span class="seletor-nome">${nome} <small>${ano}</small></span>
      <button class="btn-redondo" data-mes="1" ${i === meses.length - 1 ? 'disabled' : ''} aria-label="Próximo mês">${icone('direita')}</button>
    </div>

    <section class="cartao">
      <div class="grade-2">
        <div class="bloco"><small>Entradas</small><span class="valor positivo">${formatarBRL(r.entradas)}</span></div>
        <div class="bloco"><small>Saídas da conta</small><span class="valor negativo">${formatarBRL(r.saidas)}</span></div>
        <div class="bloco"><small>Compras${r.comprasCartao ? ' (com cartão)' : ''}</small>${valorNeutro(r.compras)}</div>
        <div class="bloco"><small>Guardado</small><span class="valor ${r.guardado > 0 ? 'positivo' : ''}">${formatarBRL(r.guardado)}</span></div>
      </div>
      ${r.saldoFim !== null ? `
      <div class="linha-valores mt">
        <span><small>${r.saldoInicioData ? `Saldo em ${formatarData(r.saldoInicioData)}` : 'Saldo no início'}</small>${r.saldoInicio !== null ? valorHTML(r.saldoInicio) : '—'}</span>
        <span class="direita"><small>${passado ? 'Saldo no fim' : 'Saldo previsto no fim'}</small>${valorHTML(r.saldoFim)}</span>
      </div>` : '<p class="secundario">Saldo da conta não disponível para meses antes do saldo informado.</p>'}
    </section>

    ${orc.renda > 0 ? `
    <section class="cartao">
      ${cabecalho('Orçamento do mês')}
      <ul class="lista-simples">
        <li><span>Renda mensal</span>${valorHTML(orc.renda)}</li>
        <li><span>Saídas fixas</span>${valorHTML(-orc.fixas)}</li>
        <li><span>Meta de guardar (${String(dados.config.metaGuardarPct).replace('.', ',')}%)</span>${valorHTML(-orc.meta)}</li>
        <li class="total"><span>Livre para gastar</span>${valorHTML(orc.livre)}</li>
        <li><span>Compras do mês</span>${valorHTML(-orc.gasto)}</li>
        <li class="total"><span>${orc.restante >= 0 ? 'Sobra' : 'Passou'}</span>${valorHTML(orc.restante)}</li>
      </ul>
      ${barra(orc.livre > 0 ? (orc.gasto / orc.livre) * 100 : 100, orc.gasto > orc.livre ? 'perigo' : 'ok', true)}
    </section>` : ''}

    ${projecao.dias.length > 1 ? `
    <section class="cartao">
      ${cabecalho('Saldo da conta')}
      ${svgSaldo(projecao.dias, hoje, chave)}
      <p class="legenda"><span class="leg pos"></span>positivo <span class="leg neg"></span>negativo
        <span class="leg hoje"></span>hoje <span class="leg sel"></span>mês selecionado</p>
    </section>` : ''}

    ${cartaoCategorias(r)}

    <section class="cartao">
      ${cabecalho('Lançamentos do mês')}
      ${listaExtrato(agruparPorDia(r.lancamentos), hoje, (d) => (d >= projecao.inicio ? saldoNoDia(projecao, d) : null))}
      ${r.comprasCartao ? '<p class="dica">Valores em cinza: compras no cartão. Elas saem da conta depois, na fatura.</p>' : ''}
    </section>

    <p class="nota">${icone('escudo')}Valores futuros são estimativas. Toque numa compra para editar.</p>
  `;
}

/** Rosca de gastos por categoria (despesas + compras; faturas e investimentos ficam de fora). */
function cartaoCategorias(r) {
  const fatias = Object.entries(r.consumo)
    .filter(([cat]) => cat !== 'Investimento')
    .map(([cat, valor]) => ({ cat, valor, cor: corCategoria(cat) }))
    .sort((a, b) => b.valor - a.valor);
  if (!fatias.length) return '';
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  return `
    <section class="cartao">
      ${cabecalho('Gastos por categoria')}
      <div class="categorias">
        <div class="rosca-caixa">
          ${svgRosca(fatias)}
          <span class="rosca-centro"><small>Total</small>${valorNeutro(total)}</span>
        </div>
        <ul class="legenda-categorias">
          ${fatias.map((f) => `
            <li><span class="ponto" style="background:${f.cor}"></span>
              <span class="leg-nome">${esc(f.cat)}<small>${Math.round((f.valor / total) * 100)}%</small></span>
              ${valorNeutro(f.valor)}</li>`).join('')}
        </ul>
      </div>
      <p class="dica">Faturas não entram aqui: as compras no cartão já contam quando você as registra.</p>
    </section>`;
}

/** Setas de troca de mês. (O toque numa compra é tratado em app.js, para todas as abas.) */
export function ligarFluxo(raiz, ctx) {
  raiz.addEventListener('click', (e) => {
    const seta = e.target.closest('[data-mes]');
    if (!seta || seta.disabled) return;
    const i = Math.max(0, ctx.meses.indexOf(ctx.mesFluxo)) + Number(seta.dataset.mes);
    if (ctx.meses[i]) ctx.mudarMes(ctx.meses[i]);
  });
}
