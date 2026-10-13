/**
 * simulacoes.js — Cálculos do simulador ("e se...?").
 *
 * Regra de ouro: NADA aqui altera os seus dados. Cada simulação faz uma
 * CÓPIA dos dados (structuredClone), aplica a mudança hipotética na cópia
 * e compara o resultado com o cenário real.
 *
 * Tudo em centavos (inteiros).
 */
import { projetar, orcamentoMes, saldoNoDia, gastosFixosMensais, taxaMensal, mesesParaMeta } from './calculos.js';
import { chaveMes, somarMeses, fimDoMes, listaMeses, diferencaDias } from './datas.js';

const ID_SIM = '__simulacao';

/**
 * Parcela pela Tabela Price (a usada por bancos e lojas):
 *   parcela = valor × i / (1 − (1 + i)^−n)
 * Com juros zero, é só valor ÷ n.
 * @param valor  centavos  @param taxaMes fração (0,03 = 3% a.m.)  @param n parcelas
 */
export function parcelaPrice(valor, taxaMes, n) {
  if (n <= 0) return 0;
  if (!taxaMes) return Math.ceil(valor / n);
  return Math.round((valor * taxaMes) / (1 - Math.pow(1 + taxaMes, -n)));
}

/**
 * Quanto guardar por mês para chegar a `meta` em `meses`, com rendimento.
 * Valor futuro: saldo×(1+i)^n + A×((1+i)^n − 1)/i  ≥  meta   →  isola A.
 */
export function aporteNecessario(meta, saldo, taxaMes, meses) {
  if (meses <= 0) return Math.max(0, meta - saldo);
  if (!taxaMes) return Math.max(0, Math.ceil((meta - saldo) / meses));
  const fator = Math.pow(1 + taxaMes, meses);
  const falta = meta - saldo * fator;
  return Math.max(0, Math.ceil((falta * taxaMes) / (fator - 1)));
}

/** Saldo da conta no último dia de um mês (null se fora da projeção). */
function saldoFimMes(projecao, chave) {
  const fim = fimDoMes(chave);
  if (fim < projecao.inicio || fim > projecao.fim) return null;
  return saldoNoDia(projecao, fim);
}

/**
 * Compara mês a mês o cenário real com o cenário simulado.
 * Para cada mês: sobra do orçamento e saldo da conta no fim do mês.
 */
function compararMeses(real, simulado, hoje, meses) {
  const projReal = projetar(real, hoje);
  const projSim = projetar(simulado, hoje);
  return meses.map((chave) => {
    const oR = orcamentoMes(real, chave);
    const oS = orcamentoMes(simulado, chave);
    return {
      chave,
      sobraAntes: oR.restante,
      sobraDepois: oS.restante,
      saldoAntes: saldoFimMes(projReal, chave),
      saldoDepois: saldoFimMes(projSim, chave),
    };
  });
}

/** Primeiro dia (a partir de `desde`) com saldo negativo, ou null. */
function primeiroNegativo(projecao, desde) {
  return projecao.dias.find((d) => d.data >= desde && d.saldo < 0)?.data || null;
}

/**
 * "E se eu comprar...?"
 * @param compra { valor, data, parcelas (1 = à vista), valorParcela, pagamento: 'conta'|'cartao' }
 *   - À vista na conta: vira uma compra na data.
 *   - Parcelado: vira uma saída mensal de `valorParcela` por `parcelas` meses,
 *     a partir do mês da data (reduz o orçamento livre de cada mês).
 */
export function simularCompra(dados, hoje, compra) {
  const sim = structuredClone(dados);
  const mesInicio = chaveMes(compra.data);
  const n = Math.max(1, compra.parcelas);
  const parcela = n === 1 ? compra.valor : compra.valorParcela;

  if (n === 1) {
    sim.compras.push({ id: ID_SIM, descricao: 'Simulação', valor: compra.valor, data: compra.data,
      categoria: 'Simulação', pagamento: compra.pagamento === 'cartao' ? (dados.cartoes[0]?.id || 'conta') : 'conta' });
  } else {
    sim.eventos.push({ id: ID_SIM, nome: 'Parcela (simulação)', tipo: 'saida', categoria: 'Parcela', valor: parcela,
      recorrencia: 'mensal', dia: Number(compra.data.slice(8, 10)), inicio: mesInicio,
      fim: somarMeses(mesInicio, n - 1), ativo: true });
  }

  // Mostra os meses afetados + 1 mês depois (para ver o alívio), no máximo 13
  const meses = listaMeses(mesInicio, somarMeses(mesInicio, Math.min(n, 12)));
  const linhas = compararMeses(dados, sim, hoje, meses);
  const total = parcela * n;
  const negativoAntes = primeiroNegativo(projetar(dados, hoje), compra.data);
  const negativoDepois = primeiroNegativo(projetar(sim, hoje), compra.data);

  return {
    linhas,
    parcela,
    total,
    juros: Math.max(0, total - compra.valor),
    estouraOrcamento: linhas.filter((l) => l.sobraDepois < 0 && l.sobraAntes >= 0).map((l) => l.chave),
    novoNegativo: negativoDepois && negativoDepois !== negativoAntes ? negativoDepois : null,
    // A conta já ficaria negativa de qualquer jeito; a compra só aumenta o negativo
    aumentaNegativo: Boolean(negativoAntes && negativoDepois === negativoAntes),
  };
}

/**
 * "E se eu cortar...?"
 * @param novosValores { idDoEvento: novoValorEmCentavos }
 */
export function simularCorte(dados, hoje, novosValores) {
  const sim = structuredClone(dados);
  let economia = 0;
  for (const ev of sim.eventos) {
    if (!(ev.id in novosValores)) continue;
    const novo = Math.max(0, novosValores[ev.id]);
    economia += ev.valor - novo;
    ev.valor = novo;
  }

  // Mês de comparação: o primeiro dos próximos 12 em que o corte faz diferença
  // (uma saída pode começar só daqui a alguns meses). Padrão: o próximo mês.
  const proximos = listaMeses(somarMeses(chaveMes(hoje), 1), somarMeses(chaveMes(hoje), 12));
  const mes = proximos.find((m) => orcamentoMes(dados, m).livre !== orcamentoMes(sim, m).livre) || proximos[0];
  const oR = orcamentoMes(dados, mes);
  const oS = orcamentoMes(sim, mes);

  // Reserva de emergência: meta muda junto (ela depende dos gastos fixos)
  const reserva = dados.investimentos.find((i) => i.tipo === 'emergencia');
  const mesesReserva = reserva?.mesesReserva || 6;
  const saldoReserva = reserva?.saldo || 0;
  const taxa = reserva ? taxaMensal(reserva, dados.config.cdiAnual) : taxaMensal({ rendimento: { modo: 'cdi', taxa: 100 } }, dados.config.cdiAnual);
  const metaAntes = gastosFixosMensais(dados, hoje) * mesesReserva;
  const metaDepois = gastosFixosMensais(sim, hoje) * mesesReserva;
  // Aporte: a meta de guardar de sempre; no cenário com corte, + a economia
  const tempoAntes = mesesParaMeta(saldoReserva, metaAntes, oR.meta, taxa);
  const tempoDepois = mesesParaMeta(saldoReserva, metaDepois, oR.meta + Math.max(0, economia), taxa);

  const projR = projetar(dados, hoje);
  const projS = projetar(sim, hoje);

  return {
    economia,
    economiaAno: economia * 12,
    mes,
    livreAntes: oR.livre,
    livreDepois: oS.livre,
    metaAntes,
    metaDepois,
    tempoAntes,
    tempoDepois,
    temReserva: Boolean(reserva),
    fimProjecao: projR.fim,
    saldoFimAntes: projR.dias[projR.dias.length - 1].saldo,
    saldoFimDepois: projS.dias[projS.dias.length - 1].saldo,
  };
}

/**
 * Comparação de parcelamentos.
 * @param opcoes lista de { parcelas, valorParcela }
 * @param livreMes orçamento livre mensal (para medir o peso da parcela)
 */
export function compararParcelamentos(valor, opcoes, livreMes) {
  const linhas = opcoes
    .filter((o) => o.parcelas > 0 && o.valorParcela > 0)
    .map((o) => {
      const total = o.valorParcela * o.parcelas;
      const juros = total - valor;
      return {
        ...o,
        total,
        juros,
        jurosPct: valor ? (juros / valor) * 100 : 0,
        pesoOrcamento: livreMes > 0 ? (o.valorParcela / livreMes) * 100 : null,
      };
    });
  const menorJuros = Math.min(...linhas.map((l) => l.juros));
  const menorParcela = Math.min(...linhas.map((l) => l.valorParcela));
  return linhas.map((l) => ({ ...l, menorJuros: l.juros === menorJuros, menorParcela: l.valorParcela === menorParcela }));
}

/**
 * Meta personalizada: "quero X até tal mês".
 * @param meta { valor, jaTenho, mesAlvo "AAAA-MM", pctCdi }
 */
export function simularMeta(dados, hoje, meta) {
  const mesAtual = chaveMes(hoje);
  // Meses de aporte: do mês que vem até o mês alvo (inclusive)
  const meses = Math.max(0, listaMeses(mesAtual, meta.mesAlvo).length - 1);
  const taxa = taxaMensal({ rendimento: { modo: meta.pctCdi > 0 ? 'cdi' : 'nenhum', taxa: meta.pctCdi } }, dados.config.cdiAnual);
  const aporte = aporteNecessario(meta.valor, meta.jaTenho, taxa, meses);
  const aporteSemRendimento = aporteNecessario(meta.valor, meta.jaTenho, 0, meses);
  const orc = orcamentoMes(dados, somarMeses(mesAtual, 1));
  const totalAportado = aporte * meses;
  return {
    meses,
    aporte,
    aporteSemRendimento,
    rendimento: Math.max(0, meta.valor - meta.jaTenho - totalAportado),
    pctRenda: orc.renda ? (aporte / orc.renda) * 100 : null,
    metaGuardar: orc.meta,
    livre: orc.livre,
    cabeNaMetaDeGuardar: aporte <= orc.meta,
    cabeNoLivre: aporte <= orc.meta + Math.max(0, orc.livre),
    jaAtingida: meta.jaTenho >= meta.valor,
    diasAteAlvo: diferencaDias(hoje, fimDoMes(meta.mesAlvo)),
  };
}
