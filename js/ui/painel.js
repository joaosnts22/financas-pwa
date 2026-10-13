/**
 * ui/painel.js — Tela inicial: saldo, dívidas, uso do cheque, alertas e próximos eventos.
 */
import { diaAtual, proximosEventos, resumoDividas, gerarAlertas } from '../calculos.js';
import { formatarBRL } from '../dinheiro.js';
import { formatarData, formatarDataCurta, diaDaSemana } from '../datas.js';
import { esc, valorHTML, fmt } from './comum.js';

const ICONES = { perigo: '⛔', aviso: '⚠️', info: 'ℹ️' };

export function telaPainel({ dados, projecao, hoje }) {
  const atual = diaAtual(projecao, hoje);
  const dividas = resumoDividas(dados, projecao, hoje);
  const alertas = gerarAlertas(dados, projecao, hoje, fmt);
  const proximos = proximosEventos(projecao, hoje, 8);
  const { limite } = dados.cheque;
  const usado = Math.max(0, -atual.saldo);
  const pct = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0;
  const disponivel = atual.saldo + limite;
  const classeBarra = pct >= 100 ? 'perigo' : pct >= dados.config.alertaChequePct ? 'aviso' : 'ok';

  return `
    <section class="cartao destaque">
      <p class="rotulo">Saldo em conta · ${formatarData(atual.data)}</p>
      <p class="valor-grande">${valorHTML(atual.saldo)}</p>
      <p class="secundario">Disponível com o limite: <strong>${formatarBRL(disponivel)}</strong></p>
    </section>

    <section class="cartao">
      <div class="linha-titulo">
        <h2>Cheque especial</h2>
        <span class="secundario">${formatarBRL(usado)} de ${formatarBRL(limite)}</span>
      </div>
      <div class="barra" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="barra-preenchida ${classeBarra}" style="width:${pct}%"></div>
      </div>
      <p class="secundario">${pct}% do limite em uso</p>
    </section>

    <section class="cartao">
      <div class="linha-titulo">
        <h2>Dívida total</h2>
        <span class="valor negativo forte">${formatarBRL(dividas.total)}</span>
      </div>
      <ul class="lista-simples">
        <li><span>Cheque especial</span>${formatarBRL(dividas.cheque)}</li>
        ${dividas.cartoes.map((c) => `
          <li>
            <span>${esc(c.nome)} <small class="secundario">(${c.quantidadeFaturas} fatura(s)${c.parcelasRestantes ? ` · ${c.parcelasRestantes} parcela(s) de ${formatarBRL(c.valorParcela)}` : ''})</small></span>
            ${formatarBRL(c.emAberto)}
          </li>`).join('')}
      </ul>
    </section>

    ${alertas.length ? `
    <section class="cartao">
      <h2>Alertas</h2>
      <ul class="alertas">
        ${alertas.map((a) => `<li class="alerta ${a.nivel}"><span aria-hidden="true">${ICONES[a.nivel]}</span>${esc(a.texto)}</li>`).join('')}
      </ul>
    </section>` : ''}

    <section class="cartao">
      <h2>Próximos eventos</h2>
      ${proximos.length ? `
      <ul class="eventos">
        ${proximos.map((e) => `
          <li class="evento ${e.tipo}">
            <span class="evento-data">${formatarDataCurta(e.data)}<small>${diaDaSemana(e.data)}</small></span>
            <span class="evento-nome">${esc(e.nome)}${e.cenario ? ' <span class="selo">cenário</span>' : ''}
              <small>saldo depois: ${formatarBRL(e.saldoDepois)}</small></span>
            <span class="evento-valor">${e.tipo === 'info'
              ? `<span class="valor info">${formatarBRL(e.valor)}</span>`
              : valorHTML(e.tipo === 'entrada' ? e.valor : -e.valor, { sinal: true })}</span>
          </li>`).join('')}
      </ul>` : '<p class="vazio">Nenhum evento futuro cadastrado.</p>'}
    </section>

    <p class="nota">⚖️ Projeções são <strong>estimativas</strong> baseadas nos números que você cadastrou. Confira sempre no app do banco.</p>
  `;
}
