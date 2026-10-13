/**
 * ui/painel.js — Tela "Início": saldo, orçamento do mês, alertas, cartões
 * e próximos lançamentos.
 */
import { orcamentoMes, proximosLancamentos, gerarAlertas, saldoNoDia, listarDividas } from '../calculos.js';
import { formatarBRL } from '../dinheiro.js';
import { formatarData, formatarDataCurta, chaveMes, nomeMesCurto, diferencaDias } from '../datas.js';
import { esc, valorHTML, valorNeutro, fmt, listaExtrato, agruparPorDia, cabecalho, barra, listaAvisos } from './comum.js';
import { icone, avatarInicial, avatarCategoria } from './icones.js';

export function telaPainel({ dados, projecao, hoje }) {
  const saldoHoje = saldoNoDia(projecao, hoje) ?? dados.conta.saldoInicial;
  const orc = orcamentoMes(dados, chaveMes(hoje));
  const alertas = gerarAlertas(dados, projecao, hoje, fmt);

  return `
    ${hero(dados, saldoHoje, orc, hoje)}
    ${cartaoOrcamento(orc, hoje)}
    ${alertas.length ? `<section class="cartao">${cabecalho('Alertas')}${listaAvisos(alertas)}</section>` : ''}
    ${cartaoDividas(dados, hoje)}
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

/** Resumo das dívidas: total, quando termina e o próximo pagamento de cada uma. */
function cartaoDividas(dados, hoje) {
  const r = listarDividas(dados, hoje);
  if (!r.itens.length) {
    return `<section class="cartao">${cabecalho('Dívidas', '<button class="btn-texto" data-ir="dividas">Ver</button>')}
      <p class="secundario">${icone('ok')} Nenhuma dívida em aberto.</p></section>`;
  }
  const linhas = r.itens.map((item) => {
    const prox = item.proximo;
    const data = prox ? (prox.vencimento || prox.data) : null;
    const dias = data ? diferencaDias(hoje, data) : null;
    const quando = !data ? 'sem próxima data'
      : dias < 0 ? `vencida em ${formatarDataCurta(data)}`
        : `Próximo: ${formatarDataCurta(data)} · ${dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`}`;
    return `
      <li class="linha-cartao">
        ${item.tipo === 'cartao' ? avatarInicial(item.nome) : avatarCategoria('Parcela')}
        <span class="extrato-texto"><strong>${esc(item.nome)}</strong><small>${quando}</small></span>
        <span class="direita">${prox ? valorHTML(-prox.valor) : ''}
          <small>${item.restante !== null ? `falta ${formatarBRL(item.restante)}` : `${formatarBRL(item.valorMensal)}/mês`}</small></span>
      </li>`;
  }).join('');
  return `
    <section class="cartao">
      ${cabecalho('Dívidas', '<button class="btn-texto" data-ir="dividas">Ver tudo</button>')}
      <ul class="lista-cartoes">${linhas}</ul>
      <div class="rodape-total"><span>Falta pagar${r.livreEm ? ` <small>· livre em ${nomeMesCurto(chaveMes(r.livreEm)).slice(0, 3)}/${r.livreEm.slice(2, 4)}</small>` : ''}</span>${valorHTML(-r.total)}</div>
    </section>`;
}
