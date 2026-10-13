/**
 * ui/painel.js — Tela "Início": saldo, orçamento do mês, alertas, cartões
 * e próximos lançamentos.
 */
import { orcamentoMes, proximosLancamentos, gerarAlertas, saldoNoDia } from '../calculos.js';
import { formatarBRL } from '../dinheiro.js';
import { formatarData, formatarDataCurta, chaveMes, nomeMesCurto, diferencaDias } from '../datas.js';
import { esc, valorHTML, valorNeutro, fmt, listaExtrato, agruparPorDia, cabecalho, barra, listaAvisos } from './comum.js';
import { icone, avatarInicial } from './icones.js';

export function telaPainel({ dados, projecao, hoje }) {
  const saldoHoje = saldoNoDia(projecao, hoje) ?? dados.conta.saldoInicial;
  const orc = orcamentoMes(dados, chaveMes(hoje));
  const alertas = gerarAlertas(dados, projecao, hoje, fmt);

  return `
    ${hero(dados, saldoHoje, orc, hoje)}
    ${cartaoOrcamento(orc, hoje)}
    ${alertas.length ? `<section class="cartao">${cabecalho('Alertas')}${listaAvisos(alertas)}</section>` : ''}
    ${cartaoCartoes(dados, hoje)}
    <section class="cartao">
      ${cabecalho('Próximos lançamentos', '<button class="btn-texto" data-ir="fluxo">Ver mês</button>')}
      ${listaExtrato(agruparPorDia(proximosLancamentos(dados, projecao, hoje, 8)), hoje, (d) => saldoNoDia(projecao, d))}
    </section>
    <p class="nota">${icone('escudo')}Projeções são <strong>estimativas</strong> com base no que você cadastrou.</p>
  `;
}

/** Cartão roxo do topo. */
function hero(dados, saldo, orc, hoje) {
  const mes = nomeMesCurto(chaveMes(hoje)).slice(0, 3);
  const atualizado = dados.conta.dataSaldo === hoje ? 'hoje' : `em ${formatarData(dados.conta.dataSaldo)}`;
  return `
    <section class="hero">
      <p class="hero-rotulo">Saldo em conta</p>
      <p class="hero-valor">${valorHTML(saldo, { neutro: true })}${saldo < 0 ? ' <span class="chip perigo hero-chip">negativo</span>' : ''}</p>
      <p class="hero-sub">Saldo informado ${atualizado}${dados.conta.dataSaldo !== hoje ? ' + lançamentos até hoje' : ''}
        · <button class="link-hero" data-acao-global="atualizar-saldo">atualizar</button></p>
      <div class="hero-resumo">
        <div class="resumo-item">
          <span class="resumo-icone entrada">${icone('setaCima')}</span>
          <span><small>Renda mensal · ${mes}</small>${valorNeutro(orc.renda)}</span>
        </div>
        <div class="resumo-item">
          <span class="resumo-icone saida">${icone('setaBaixo')}</span>
          <span><small>Fixas · ${mes}</small>${valorNeutro(orc.fixas)}</span>
        </div>
      </div>
    </section>`;
}

/** Quanto ainda dá para gastar no mês + meta de guardar. */
function cartaoOrcamento(orc, hoje) {
  const mes = nomeMesCurto(chaveMes(hoje));
  if (orc.renda === 0) {
    return `<section class="cartao">${cabecalho(`Orçamento de ${mes}`)}
      <p class="vazio">Cadastre suas entradas mensais em <strong>Mais</strong> para ver quanto pode gastar.</p></section>`;
  }
  const pct = orc.livre > 0 ? (orc.gasto / orc.livre) * 100 : 100;
  const nivel = orc.gasto > orc.livre ? 'perigo' : pct >= 80 ? 'aviso' : 'ok';
  return `
    <section class="cartao">
      ${cabecalho(`Orçamento de ${mes}`, '<button class="btn-texto" data-ir="fluxo">Detalhes</button>')}
      <div class="linha-valores">
        <span><small>Ainda pode gastar</small>${valorHTML(orc.restante)}</span>
        <span class="direita"><small>Gasto em compras</small>${valorNeutro(orc.gasto)}</span>
      </div>
      ${barra(pct, nivel)}
      <p class="secundario">Livre no mês: ${formatarBRL(orc.livre)} = renda − fixas − meta de guardar (${formatarBRL(orc.meta)}).</p>
      <div class="meta-guardar">
        ${icone('cofre')}
        <span>Guardado no mês: <strong>${valorNeutro(Math.max(0, orc.guardado))}</strong> de ${valorNeutro(orc.meta)}</span>
        <button class="btn-texto" data-ir="investir">Investir</button>
      </div>
    </section>`;
}

function cartaoCartoes(dados, hoje) {
  if (!dados.cartoes.length) return '';
  let total = 0;
  const linhas = dados.cartoes.map((c) => {
    const abertas = c.faturas.filter((f) => !f.paga && f.vencimento >= hoje);
    const proxima = abertas[0];
    total += abertas.reduce((s, f) => s + f.valor, 0);
    const dias = proxima ? diferencaDias(hoje, proxima.vencimento) : null;
    const quando = proxima
      ? `Pagar em ${formatarDataCurta(proxima.vencimento)} · ${dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`}`
      : 'Nenhuma fatura em aberto';
    return `
      <li class="linha-cartao">
        ${avatarInicial(c.nome)}
        <span class="extrato-texto"><strong>${esc(c.nome)}</strong><small>${quando}</small></span>
        <span class="direita">${proxima ? valorHTML(-proxima.valor) : valorNeutro(0)}
          ${abertas.length > 1 ? `<small>${abertas.length} faturas: ${formatarBRL(abertas.reduce((s, f) => s + f.valor, 0))}</small>` : ''}</span>
      </li>`;
  }).join('');
  return `
    <section class="cartao">
      ${cabecalho('Cartões de crédito', '<button class="btn-texto" data-ir="mais">Editar</button>')}
      <ul class="lista-cartoes">${linhas}</ul>
      <div class="rodape-total"><span>Total em faturas</span>${valorHTML(-total)}</div>
    </section>`;
}
