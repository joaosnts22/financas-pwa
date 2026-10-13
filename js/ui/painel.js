/**
 * ui/painel.js — Tela "Início": saldo, entradas/saídas do mês, alertas,
 * cheque especial, cartões e próximos lançamentos.
 */
import { diaAtual, proximosEventos, resumoDividas, gerarAlertas } from '../calculos.js';
import { formatarBRL } from '../dinheiro.js';
import { formatarData, formatarDataCurta, chaveMes, nomeMes, somarDias, diferencaDias } from '../datas.js';
import { esc, valorHTML, valorNeutro, fmt, listaExtrato, cabecalho } from './comum.js';
import { icone, avatarInicial } from './icones.js';

const ICONE_ALERTA = { perigo: 'perigo', aviso: 'alerta', info: 'info' };

export function telaPainel({ dados, projecao, hoje }) {
  const atual = diaAtual(projecao, hoje);
  const mesAtual = projecao.meses.find((m) => m.chave === chaveMes(atual.data)) || projecao.meses[0];
  const limite = dados.cheque.limite;

  return `
    ${heroSaldo(atual, mesAtual, limite)}
    ${cartaoAlertas(gerarAlertas(dados, projecao, hoje, fmt))}
    ${cartaoCheque(dados, atual)}
    ${cartaoCartoes(dados, projecao, hoje, atual)}
    ${cartaoProximos(projecao, hoje)}
    <p class="nota">${icone('escudo')} Projeções são <strong>estimativas</strong> com base nos números que você cadastrou. Confira sempre no app do banco.</p>
  `;
}

/** Bloco principal com o saldo (o "cartão roxo" do topo). */
function heroSaldo(atual, mes, limite) {
  const nomeDoMes = nomeMes(mes.chave).slice(0, 3); // "out", "nov"...
  return `
    <section class="hero">
      <p class="hero-rotulo">Saldo em conta · ${formatarData(atual.data)}</p>
      <p class="hero-valor">${valorHTML(atual.saldo, { neutro: true })}</p>
      <p class="hero-sub">Disponível com limite: ${valorNeutro(atual.saldo + limite)}</p>
      <div class="hero-resumo">
        <div class="resumo-item">
          <span class="resumo-icone entrada">${icone('setaCima')}</span>
          <span><small>Entradas · ${nomeDoMes}</small>${valorNeutro(mes.entradas)}</span>
        </div>
        <div class="resumo-item">
          <span class="resumo-icone saida">${icone('setaBaixo')}</span>
          <span><small>Saídas · ${nomeDoMes}</small>${valorNeutro(mes.saidas)}</span>
        </div>
      </div>
    </section>`;
}

function cartaoAlertas(alertas) {
  if (!alertas.length) return '';
  return `
    <section class="cartao">
      ${cabecalho('Alertas')}
      <ul class="alertas">
        ${alertas.map((a) => `<li class="alerta ${a.nivel}">${icone(ICONE_ALERTA[a.nivel])}<span>${esc(a.texto)}</span></li>`).join('')}
      </ul>
    </section>`;
}

function cartaoCheque(dados, atual) {
  const { limite, diasSemJuros } = dados.cheque;
  const usado = Math.max(0, -atual.saldo);
  const pct = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0;
  const nivel = pct >= 100 ? 'perigo' : pct >= dados.config.alertaChequePct ? 'aviso' : 'ok';

  let prazo = 'Sem uso no momento';
  if (usado > 0 && atual.negativoDesde) {
    const restantes = diasSemJuros - atual.diasNegativo;
    const fimPrazo = somarDias(atual.negativoDesde, diasSemJuros);
    prazo = restantes >= 0
      ? `Sem juros até ${formatarData(fimPrazo)} · ${restantes} dia(s)`
      : `Prazo sem juros encerrado em ${formatarData(fimPrazo)}`;
  }

  return `
    <section class="cartao">
      ${cabecalho('Cheque especial', `<span class="chip ${nivel}">${pct}% usado</span>`)}
      <div class="linha-valores">
        <span><small>Em uso</small>${valorNeutro(usado)}</span>
        <span class="direita"><small>Limite</small>${valorNeutro(limite)}</span>
      </div>
      <div class="barra" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="barra-preenchida ${nivel}" style="width:${pct}%"></div>
      </div>
      <p class="secundario">${prazo}</p>
    </section>`;
}

function cartaoCartoes(dados, projecao, hoje, atual) {
  const dividas = resumoDividas(dados, projecao, hoje);
  const linhas = dados.cartoes.map((c) => {
    const proxima = c.faturas.find((f) => !f.paga && f.vencimento > atual.data);
    const resumo = dividas.cartoes.find((r) => r.nome === c.nome);
    const dias = proxima ? diferencaDias(hoje, proxima.vencimento) : null;
    const quando = proxima
      ? `Pagar em ${formatarDataCurta(proxima.vencimento)} · ${dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`}`
      : 'Nenhuma fatura em aberto';
    return `
      <li class="linha-cartao">
        ${avatarInicial(c.nome)}
        <span class="extrato-texto">
          <strong>${esc(c.nome)}</strong>
          <small>${quando}</small>
        </span>
        <span class="direita">
          ${proxima ? valorHTML(-proxima.valor) : valorNeutro(0)}
          ${resumo && resumo.quantidadeFaturas > 1 ? `<small>total ${formatarBRL(resumo.emAberto)}</small>` : ''}
        </span>
      </li>`;
  }).join('');

  return `
    <section class="cartao">
      ${cabecalho('Cartões de crédito', '<button class="btn-texto" data-ir="dividas">Ver tudo</button>')}
      ${linhas ? `<ul class="lista-cartoes">${linhas}</ul>` : '<p class="vazio">Nenhum cartão cadastrado.</p>'}
      <div class="rodape-total">
        <span>Dívida total <small>(cheque + faturas)</small></span>
        ${valorHTML(-dividas.total)}
      </div>
    </section>`;
}

function cartaoProximos(projecao, hoje) {
  // Agrupa os próximos lançamentos por dia, guardando o saldo ao fim de cada dia
  const grupos = [];
  for (const it of proximosEventos(projecao, hoje, 8)) {
    let g = grupos[grupos.length - 1];
    if (!g || g.data !== it.data) grupos.push(g = { data: it.data, saldo: it.saldoDepois, itens: [] });
    g.itens.push(it);
  }
  return `
    <section class="cartao">
      ${cabecalho('Próximos lançamentos', '<button class="btn-texto" data-ir="fluxo">Ver fluxo</button>')}
      ${listaExtrato(grupos, hoje)}
    </section>`;
}
