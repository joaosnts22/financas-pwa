/**
 * calculos.js — O "motor" da projeção. Não mexe na tela, só faz contas.
 *
 * Ideia central: simular a conta corrente DIA A DIA.
 *  - Saldo positivo  = dinheiro na conta.
 *  - Saldo negativo  = você está usando o cheque especial.
 *  - Quando entra o salário e a conta está negativa, o banco "desconta" o
 *    cheque especial automaticamente. Numa conta única isso acontece sozinho:
 *    o salário entra e cobre o negativo. Nós apenas MOSTRAMOS esse desconto
 *    e cobramos o IOF estimado (e juros, se houver taxa cadastrada).
 *
 * Tudo em centavos (inteiros). Ver dinheiro.js.
 */
import {
  somarDias, diferencaDias, diasNoMes, montarISO, ultimoDiaUtil,
  listaMeses, chaveMes, fimDoMes,
} from './datas.js';

export const CATEGORIAS = {
  salario: { nome: 'Salário', tipo: 'entrada' },
  ajuda: { nome: 'Ajuda de custo', tipo: 'entrada' },
  venda: { nome: 'Venda', tipo: 'entrada' },
  extra: { nome: 'Horas extras / extra', tipo: 'entrada' },
  outro_entrada: { nome: 'Outra entrada', tipo: 'entrada' },
  fixa: { nome: 'Despesa fixa', tipo: 'saida' },
  fatura: { nome: 'Fatura de cartão', tipo: 'saida' },
  parcela: { nome: 'Parcela', tipo: 'saida' },
  gasto: { nome: 'Gastos gerais', tipo: 'saida' },
  encargo: { nome: 'IOF / juros', tipo: 'saida' },
  outro: { nome: 'Outra saída', tipo: 'saida' },
};

/**
 * Transforma os eventos cadastrados (que podem ser recorrentes) em uma lista
 * de lançamentos concretos, cada um com uma data, dentro do período [inicio, fim].
 */
export function gerarLancamentos(dados, inicio, fim) {
  const lista = [];
  const feriados = dados.config.feriados;
  const meses = listaMeses(chaveMes(inicio), chaveMes(fim));

  for (const ev of dados.eventos) {
    if (!ev.ativo) continue;
    const base = { nome: ev.nome, tipo: ev.tipo, categoria: ev.categoria, valor: ev.valor, origem: ev.id, cenario: ev.cenario };

    if (ev.recorrencia === 'unica') {
      if (ev.data >= inicio && ev.data <= fim) lista.push({ ...base, data: ev.data });
      continue;
    }
    for (const mes of meses) {
      if (mes < ev.inicio) continue;
      if (ev.fim && mes > ev.fim) continue;
      const [a, m] = mes.split('-').map(Number);
      const data = ev.recorrencia === 'mensal'
        ? montarISO(a, m, Math.min(ev.dia, diasNoMes(a, m))) // dia 31 em mês de 30 dias -> dia 30
        : ultimoDiaUtil(a, m, feriados);
      if (data >= inicio && data <= fim) lista.push({ ...base, data });
    }
  }

  // Faturas de cartão ainda não pagas viram saídas na data de pagamento
  for (const cartao of dados.cartoes) {
    for (const f of cartao.faturas) {
      if (f.paga || f.vencimento < inicio || f.vencimento > fim) continue;
      lista.push({
        nome: `Fatura ${cartao.nome}`, tipo: 'saida', categoria: 'fatura',
        valor: f.valor, data: f.vencimento, origem: f.id,
      });
    }
  }

  // Ordena por data; no mesmo dia, entradas primeiro (o salário cai antes das contas)
  return lista.sort((x, y) =>
    x.data.localeCompare(y.data) || (x.tipo === 'entrada' ? -1 : 1) - (y.tipo === 'entrada' ? -1 : 1));
}

/**
 * Projeta o saldo dia a dia, do dia do saldo informado até o fim do mês final.
 * O saldo informado é considerado "fechado" naquele dia: a simulação começa
 * no dia SEGUINTE (o que estava marcado para o próprio dia já está no saldo).
 */
export function projetar(dados) {
  const { conta, cheque } = dados;
  const inicio = conta.dataSaldo;
  const fim = fimDoMes(dados.config.mesFinal);
  const lancamentos = gerarLancamentos(dados, somarDias(inicio, 1), fim);

  // Agrupa lançamentos por data para acesso rápido
  const porData = new Map();
  for (const l of lancamentos) {
    if (!porData.has(l.data)) porData.set(l.data, []);
    porData.get(l.data).push(l);
  }

  let saldo = conta.saldoInicial;
  let negativoDesde = saldo < 0 ? (cheque.negativoDesde || inicio) : null;
  let jurosAcumulados = 0;
  const dias = [{
    data: inicio, saldo, itens: [], inicial: true,
    negativoDesde, diasNegativo: negativoDesde ? diferencaDias(negativoDesde, inicio) : 0,
  }];

  for (let data = somarDias(inicio, 1); data <= fim; data = somarDias(data, 1)) {
    const itens = [];

    for (const l of porData.get(data) || []) {
      if (l.tipo === 'entrada') {
        const devedorAntes = saldo < 0 ? -saldo : 0;
        saldo += l.valor;
        itens.push(l);

        // Regra do banco: salário entrou com conta negativa => desconto automático
        if (l.categoria === 'salario' && devedorAntes > 0) {
          itens.push({
            nome: 'Desconto automático do cheque especial', tipo: 'info', categoria: 'info',
            valor: Math.min(devedorAntes, l.valor), data,
          });
          const encargos = cheque.iof + jurosAcumulados;
          if (encargos > 0) {
            saldo -= encargos;
            itens.push({
              nome: jurosAcumulados > 0 ? 'IOF + juros do cheque especial (estimado)' : 'IOF do cheque especial (estimado)',
              tipo: 'saida', categoria: 'encargo', valor: encargos, data, automatico: true,
            });
          }
          jurosAcumulados = 0;
        }
      } else {
        saldo -= l.valor;
        itens.push(l);
      }
    }

    // Controle do prazo sem juros
    let diasNegativo = 0;
    if (saldo < 0) {
      if (!negativoDesde) negativoDesde = data;
      diasNegativo = diferencaDias(negativoDesde, data);
      // Juros (só se você cadastrar a taxa): proporcional por dia após o prazo
      if (diasNegativo > cheque.diasSemJuros && cheque.taxaJurosMes > 0) {
        jurosAcumulados += Math.round((-saldo * cheque.taxaJurosMes) / 100 / 30);
      }
    } else {
      negativoDesde = null; // quitou: o prazo sem juros recomeça na próxima vez
    }

    dias.push({ data, saldo, itens, negativoDesde, diasNegativo });
  }

  return { inicio, fim, dias, meses: resumirMeses(dias, dados), lancamentos };
}

/** Agrupa a simulação diária em um resumo por mês. */
function resumirMeses(dias, dados) {
  const limite = dados.cheque.limite;
  const meses = [];
  let saldoAnterior = dias[0].saldo;

  for (const chave of listaMeses(chaveMes(dias[0].data), dados.config.mesFinal)) {
    const doMes = dias.filter((d) => chaveMes(d.data) === chave);
    if (!doMes.length) continue;

    const resumo = {
      chave,
      saldoInicio: doMes[0].inicial ? doMes[0].saldo : saldoAnterior,
      saldoFim: doMes[doMes.length - 1].saldo,
      entradas: 0,
      saidas: 0,
      porCategoria: {},
      descontoCheque: 0,
      minimo: doMes[0], // dia de menor saldo
      diasNegativos: 0,
      estouraLimite: false,
      dias: doMes,
    };

    for (const d of doMes) {
      if (d.saldo < resumo.minimo.saldo) resumo.minimo = d;
      if (d.saldo < 0) resumo.diasNegativos++;
      if (d.saldo < -limite) resumo.estouraLimite = true;
      for (const it of d.itens) {
        if (it.tipo === 'info') { resumo.descontoCheque += it.valor; continue; }
        if (it.tipo === 'entrada') resumo.entradas += it.valor;
        else resumo.saidas += it.valor;
        resumo.porCategoria[it.categoria] = (resumo.porCategoria[it.categoria] || 0) + it.valor;
      }
    }
    meses.push(resumo);
    saldoAnterior = resumo.saldoFim;
  }
  return meses;
}

/** Retorna o dia da projeção correspondente a "hoje" (ou o mais próximo). */
export function diaAtual(projecao, hoje) {
  const { dias } = projecao;
  if (hoje <= dias[0].data) return dias[0];
  return dias.find((d) => d.data === hoje) || dias[dias.length - 1];
}

/** Próximos lançamentos a partir de hoje (exclusive). */
export function proximosEventos(projecao, hoje, quantidade = 8) {
  const lista = [];
  for (const d of projecao.dias) {
    if (d.data <= hoje) continue;
    for (const it of d.itens) lista.push({ ...it, saldoDepois: d.saldo });
    if (lista.length >= quantidade) break;
  }
  return lista.slice(0, quantidade);
}

/** Dívidas: cheque especial em uso hoje + faturas em aberto de cada cartão. */
export function resumoDividas(dados, projecao, hoje) {
  const atual = diaAtual(projecao, hoje);
  const cheque = Math.max(0, -atual.saldo);
  const cartoes = dados.cartoes.map((c) => {
    const abertas = c.faturas.filter((f) => !f.paga && f.vencimento > atual.data);
    const p = c.parcelamento;
    return {
      nome: c.nome,
      emAberto: abertas.reduce((s, f) => s + f.valor, 0),
      quantidadeFaturas: abertas.length,
      parcelasRestantes: p ? Math.max(0, p.parcelas - p.pagas) : 0,
      valorParcela: p ? p.valor : 0,
    };
  });
  return { cheque, cartoes, total: cheque + cartoes.reduce((s, c) => s + c.emAberto, 0) };
}

/**
 * Alertas: lista de { nivel: 'perigo' | 'aviso' | 'info', texto }.
 * Recebe funções de formatação para não depender da interface.
 */
export function gerarAlertas(dados, projecao, hoje, fmt) {
  const alertas = [];
  const { cheque, config } = dados;
  const atual = diaAtual(projecao, hoje);
  const futuros = projecao.dias.filter((d) => d.data > atual.data);

  // 1) Uso atual do cheque especial
  if (atual.saldo < 0 && cheque.limite > 0) {
    const pct = Math.round((-atual.saldo / cheque.limite) * 100);
    if (pct >= 100) alertas.push({ nivel: 'perigo', texto: `Cheque especial no limite (${pct}% usado).` });
    else if (pct >= config.alertaChequePct) alertas.push({ nivel: 'aviso', texto: `Cheque especial em ${pct}% do limite.` });
  }

  // 2) Prazo sem juros (situação atual)
  if (atual.saldo < 0 && atual.negativoDesde) {
    const restantes = cheque.diasSemJuros - atual.diasNegativo;
    const fimPrazo = somarDias(atual.negativoDesde, cheque.diasSemJuros);
    if (restantes < 0) alertas.push({ nivel: 'perigo', texto: `Prazo sem juros do cheque especial acabou em ${fmt.data(fimPrazo)}.` });
    else if (restantes <= 7) alertas.push({ nivel: 'aviso', texto: `Prazo sem juros acaba em ${restantes} dia(s) (${fmt.data(fimPrazo)}).` });
  }

  // 3) Prazo sem juros estourando no futuro
  const estouroPrazo = futuros.find((d) => d.saldo < 0 && d.diasNegativo === cheque.diasSemJuros + 1);
  if (estouroPrazo) {
    alertas.push({ nivel: 'aviso', texto: `Pela projeção, o prazo sem juros estoura em ${fmt.data(estouroPrazo.data)}.` });
  }

  // 4) Saldo projetado abaixo do limite (estoura o cheque especial)
  const estouro = futuros.find((d) => d.saldo < -cheque.limite);
  if (estouro) {
    alertas.push({ nivel: 'perigo', texto: `Saldo projetado passa do limite em ${fmt.data(estouro.data)}: ${fmt.valor(estouro.saldo)}.` });
  }

  // 5) Períodos futuros no negativo (o problema de "timing")
  let periodo = null;
  const periodos = [];
  for (const d of futuros) {
    if (d.saldo < 0) {
      if (!periodo) periodo = { inicio: d.data, fim: d.data, minimo: d };
      periodo.fim = d.data;
      if (d.saldo < periodo.minimo.saldo) periodo.minimo = d;
    } else if (periodo) {
      periodos.push(periodo);
      periodo = null;
    }
  }
  if (periodo) periodos.push(periodo);
  for (const p of periodos.slice(0, 3)) {
    // Não repete o período que já começou hoje (coberto pelo alerta 1)
    if (atual.saldo < 0 && p.inicio === futuros[0]?.data) {
      alertas.push({ nivel: 'info', texto: `Conta negativa até ${fmt.data(p.fim)} (pior momento: ${fmt.valor(p.minimo.saldo)} em ${fmt.data(p.minimo.data)}).` });
    } else {
      alertas.push({ nivel: 'aviso', texto: `Saldo fica negativo de ${fmt.data(p.inicio)} a ${fmt.data(p.fim)} (pior: ${fmt.valor(p.minimo.saldo)} em ${fmt.data(p.minimo.data)}).` });
    }
  }

  return alertas;
}
