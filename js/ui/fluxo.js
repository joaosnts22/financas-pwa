/**
 * ui/fluxo.js — Fluxo de caixa: gráfico + resumo de cada mês + saldo dia a dia.
 */
import { CATEGORIAS } from '../calculos.js';
import { formatarBRL } from '../dinheiro.js';
import { nomeMes, formatarDataCurta, diaDaSemana, formatarData } from '../datas.js';
import { svgSaldo } from '../grafico.js';
import { esc, valorHTML } from './comum.js';

export function telaFluxo({ dados, projecao, hoje }) {
  return `
    <section class="cartao">
      <h2>Saldo projetado</h2>
      ${svgSaldo(projecao.dias, dados.cheque.limite, hoje)}
      <p class="legenda"><span class="leg pos"></span>positivo <span class="leg neg"></span>cheque especial
        <span class="leg lim"></span>limite <span class="leg hoje"></span>hoje</p>
    </section>
    ${projecao.meses.map((m) => cartaoMes(m, dados.cheque.limite)).join('')}
    <p class="nota">⚖️ Valores estimados. O saldo do dia ${formatarData(projecao.inicio)} é o ponto de partida informado em <em>Dados</em>.</p>
  `;
}

function cartaoMes(m, limite) {
  // Linhas por categoria, na ordem definida em CATEGORIAS
  const linhas = Object.keys(CATEGORIAS)
    .filter((cat) => m.porCategoria[cat])
    .map((cat) => {
      const v = m.porCategoria[cat];
      const ehEntrada = CATEGORIAS[cat].tipo === 'entrada';
      return `<li><span>${CATEGORIAS[cat].nome}</span>${valorHTML(ehEntrada ? v : -v, { sinal: true })}</li>`;
    }).join('');

  const diasComMovimento = m.dias.filter((d) => d.itens.length || d.inicial);

  return `
    <section class="cartao mes ${m.estouraLimite ? 'mes-perigo' : m.minimo.saldo < 0 ? 'mes-aviso' : ''}">
      <div class="linha-titulo">
        <h2>${nomeMes(m.chave)}</h2>
        ${valorHTML(m.saldoFim)}
      </div>
      <ul class="lista-simples">
        <li><span>Saldo no início</span>${valorHTML(m.saldoInicio)}</li>
        ${linhas || '<li><span class="secundario">Sem lançamentos</span></li>'}
        ${m.descontoCheque ? `<li class="info"><span>↳ Desconto automático do cheque (já dentro do saldo)</span>${formatarBRL(m.descontoCheque)}</li>` : ''}
        <li class="total"><span>Resultado do mês</span>${valorHTML(m.entradas - m.saidas, { sinal: true })}</li>
        <li class="total"><span>Saldo no fim</span>${valorHTML(m.saldoFim)}</li>
        <li><span>Pior momento</span><span>${valorHTML(m.minimo.saldo)} <small class="secundario">em ${formatarDataCurta(m.minimo.data)}</small></span></li>
        ${m.diasNegativos ? `<li><span>Dias no cheque especial</span>${m.diasNegativos}</li>` : ''}
      </ul>
      ${m.estouraLimite ? `<p class="alerta perigo">⛔ O saldo passa do limite do cheque (${formatarBRL(limite)}) neste mês.</p>` : ''}
      <details>
        <summary>Ver dia a dia</summary>
        <ul class="dia-a-dia">
          ${diasComMovimento.map((d) => `
            <li>
              <div class="dia-topo">
                <strong>${formatarDataCurta(d.data)} <small>${diaDaSemana(d.data)}</small></strong>
                <span>saldo ${valorHTML(d.saldo)}</span>
              </div>
              ${d.inicial ? '<p class="secundario">Saldo informado (ponto de partida)</p>' : ''}
              ${d.itens.map((it) => `
                <div class="dia-item ${it.tipo}">
                  <span>${esc(it.nome)}</span>
                  ${it.tipo === 'info'
                    ? `<span class="valor info">${formatarBRL(it.valor)}</span>`
                    : valorHTML(it.tipo === 'entrada' ? it.valor : -it.valor, { sinal: true })}
                </div>`).join('')}
            </li>`).join('')}
        </ul>
      </details>
    </section>`;
}
