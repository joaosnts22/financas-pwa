/**
 * calculos.js — O "motor" do app. Não mexe na tela, só faz contas.
 *
 * Ideias centrais:
 * 1. LANÇAMENTOS: tudo que entra ou sai (salário, aluguel, fatura, compra,
 *    dinheiro guardado) vira uma lista de lançamentos com data e valor.
 * 2. PROJEÇÃO: a partir do saldo real informado, simulamos a conta DIA A DIA.
 *    Saldo negativo aparece em vermelho, e só.
 * 3. ORÇAMENTO: quanto sobra por mês para gastos do dia a dia depois das
 *    despesas fixas e da meta de guardar dinheiro.
 *
 * Tudo em centavos (inteiros). Ver dinheiro.js.
 */
import {
  somarDias, diasNoMes, montarISO, ultimoDiaUtil, listaMeses, chaveMes,
  inicioDoMes, fimDoMes, somarMeses, diferencaDias,
} from './datas.js';

/** Sugestões que aparecem ao digitar a categoria de uma compra. */
export const SUGESTOES_COMPRA = ['Mercado', 'Alimentação', 'Pets', 'Casa', 'Transporte', 'Saúde', 'Lazer', 'Assinaturas', 'Roupas', 'Presentes', 'Educação', 'Outros'];
/** Opções para saídas fixas. */
export const CATEGORIAS_SAIDA = ['Despesa fixa', 'Parcela', 'Gastos gerais', 'Outra saída'];

const ehRecorrente = (ev) => ev.recorrencia !== 'unica';

/** Nome curto de um cartão pelo id (para compras no cartão). */
export function nomeCartao(dados, id) {
  return dados.cartoes.find((c) => c.id === id)?.nome || 'Cartão';
}

/**
 * Transforma tudo o que foi cadastrado em lançamentos com data, no período [inicio, fim].
 * Cada lançamento: { data, nome, tipo: 'entrada'|'saida', categoria, valor,
 *                    fonte: 'evento'|'fatura'|'compra'|'movimento', afetaConta, recorrente, id }
 *  - afetaConta = false para compras no cartão (o dinheiro sai depois, na fatura).
 */
export function gerarLancamentos(dados, inicio, fim) {
  const lista = [];
  const meses = listaMeses(chaveMes(inicio), chaveMes(fim));
  const dentro = (data) => data >= inicio && data <= fim;

  // 1) Entradas e saídas cadastradas (únicas ou recorrentes)
  for (const ev of dados.eventos) {
    if (!ev.ativo) continue;
    const base = { nome: ev.nome, tipo: ev.tipo, categoria: ev.categoria, valor: ev.valor,
      fonte: 'evento', afetaConta: true, recorrente: ehRecorrente(ev), id: ev.id };
    if (!ehRecorrente(ev)) {
      if (dentro(ev.data)) lista.push({ ...base, data: ev.data });
      continue;
    }
    for (const mes of meses) {
      if (mes < ev.inicio || (ev.fim && mes > ev.fim)) continue;
      const [a, m] = mes.split('-').map(Number);
      const data = ev.recorrencia === 'mensal'
        ? montarISO(a, m, Math.min(ev.dia, diasNoMes(a, m))) // dia 31 em mês de 30 dias -> dia 30
        : ultimoDiaUtil(a, m);
      if (dentro(data)) lista.push({ ...base, data });
    }
  }

  // 2) Faturas de cartão ainda não pagas
  for (const cartao of dados.cartoes) {
    for (const f of cartao.faturas) {
      if (f.paga || !dentro(f.vencimento)) continue;
      lista.push({ nome: `Fatura ${cartao.nome}`, tipo: 'saida', categoria: 'Fatura de cartão', valor: f.valor,
        data: f.vencimento, fonte: 'fatura', afetaConta: true, id: f.id });
    }
  }

  // 3) Compras registradas
  for (const c of dados.compras) {
    if (!dentro(c.data)) continue;
    const noCartao = c.pagamento !== 'conta';
    lista.push({ nome: c.descricao, tipo: 'saida', categoria: c.categoria, valor: c.valor, data: c.data,
      fonte: 'compra', afetaConta: !noCartao, cartao: noCartao ? nomeCartao(dados, c.pagamento) : null, id: c.id });
  }

  // 4) Dinheiro guardado (aporte) ou resgatado de investimentos
  for (const mv of dados.movimentos) {
    if (!dentro(mv.data)) continue;
    const inv = dados.investimentos.find((i) => i.id === mv.investimentoId);
    const nome = inv ? inv.nome : 'Investimento';
    lista.push({ nome: mv.tipo === 'aporte' ? `Guardado em ${nome}` : `Resgate de ${nome}`,
      tipo: mv.tipo === 'aporte' ? 'saida' : 'entrada', categoria: 'Investimento', valor: mv.valor,
      data: mv.data, fonte: 'movimento', afetaConta: true, id: mv.id });
  }

  // Ordena por data; no mesmo dia, entradas primeiro
  return lista.sort((x, y) =>
    x.data.localeCompare(y.data) || (x.tipo === 'entrada' ? -1 : 1) - (y.tipo === 'entrada' ? -1 : 1));
}

/** Último mês que o app projeta: hoje + "meses à frente" das configurações. */
export function mesFinal(dados, hoje) {
  const alvo = somarMeses(chaveMes(hoje), dados.config.mesesAFrente);
  const minimo = chaveMes(dados.conta.dataSaldo);
  return alvo > minimo ? alvo : minimo;
}

/**
 * Projeta o saldo da conta dia a dia, do dia do saldo informado até o mês final.
 * O saldo informado é considerado "fechado" naquele dia: a simulação começa
 * no dia SEGUINTE (o que estava marcado para o próprio dia já está no saldo).
 */
export function projetar(dados, hoje) {
  const inicio = dados.conta.dataSaldo;
  const fim = fimDoMes(mesFinal(dados, hoje));
  const lancamentos = gerarLancamentos(dados, somarDias(inicio, 1), fim).filter((l) => l.afetaConta);

  const porData = new Map();
  for (const l of lancamentos) {
    if (!porData.has(l.data)) porData.set(l.data, []);
    porData.get(l.data).push(l);
  }

  let saldo = dados.conta.saldoInicial;
  const dias = [{ data: inicio, saldo, itens: [], inicial: true }];
  for (let data = somarDias(inicio, 1); data <= fim; data = somarDias(data, 1)) {
    const itens = porData.get(data) || [];
    for (const l of itens) saldo += l.tipo === 'entrada' ? l.valor : -l.valor;
    dias.push({ data, saldo, itens });
  }
  return { inicio, fim, dias };
}

/** Saldo projetado num dia (ou null se for antes da data do saldo informado). */
export function saldoNoDia(projecao, data) {
  if (data < projecao.inicio) return null;
  return (projecao.dias.find((d) => d.data === data) || projecao.dias[projecao.dias.length - 1]).saldo;
}

/** Todos os meses que o app consegue mostrar: do primeiro registro até o mês final. */
export function mesesDisponiveis(dados, hoje) {
  const datas = [dados.conta.dataSaldo, ...dados.compras.map((c) => c.data), ...dados.movimentos.map((m) => m.data)];
  const primeiro = chaveMes(datas.sort()[0]);
  return listaMeses(primeiro, mesFinal(dados, hoje));
}

/**
 * Resumo de um mês ("planilha" do mês).
 * - entradas/saidas: o que entra e sai da CONTA (sem contar dinheiro guardado)
 * - compras: tudo que você registrou como compra (conta + cartão)
 * - guardado: aportes − resgates
 * - consumo: gastos por categoria (despesas + compras). Faturas ficam de fora,
 *   porque as compras no cartão já são contadas quando você as registra.
 */
export function resumoMes(dados, projecao, chave) {
  const lancamentos = gerarLancamentos(dados, inicioDoMes(chave), fimDoMes(chave));
  const r = { chave, lancamentos, entradas: 0, saidas: 0, compras: 0, comprasCartao: 0, guardado: 0, consumo: {} };

  for (const l of lancamentos) {
    if (l.fonte === 'movimento') { r.guardado += l.tipo === 'saida' ? l.valor : -l.valor; continue; }
    if (l.fonte === 'compra') { r.compras += l.valor; if (!l.afetaConta) r.comprasCartao += l.valor; }
    if (l.afetaConta) {
      if (l.tipo === 'entrada') r.entradas += l.valor; else r.saidas += l.valor;
    }
    if (l.tipo === 'saida' && l.fonte !== 'fatura') r.consumo[l.categoria] = (r.consumo[l.categoria] || 0) + l.valor;
  }

  // Saldo no início/fim do mês, quando a projeção cobre esse período
  const ini = inicioDoMes(chave);
  const fim = fimDoMes(chave);
  r.saldoFim = fim >= projecao.inicio ? saldoNoDia(projecao, fim) : null;
  if (ini > projecao.inicio) r.saldoInicio = saldoNoDia(projecao, somarDias(ini, -1));
  else if (chaveMes(projecao.inicio) === chave) { r.saldoInicio = projecao.dias[0].saldo; r.saldoInicioData = projecao.inicio; }
  else r.saldoInicio = null;
  return r;
}

/**
 * Orçamento do mês:
 *   renda   = entradas que se repetem todo mês (salário, ajuda...)
 *   fixas   = saídas que se repetem todo mês (aluguel, contas...)
 *   meta    = % da renda que você quer guardar
 *   livre   = renda − fixas − meta   -> quanto dá para gastar no dia a dia
 *   gasto   = compras registradas no mês (conta + cartão)
 */
export function orcamentoMes(dados, chave) {
  const lancamentos = gerarLancamentos(dados, inicioDoMes(chave), fimDoMes(chave));
  let renda = 0;
  let fixas = 0;
  let gasto = 0;
  let guardado = 0;
  for (const l of lancamentos) {
    if (l.fonte === 'evento' && l.recorrente) {
      if (l.tipo === 'entrada') renda += l.valor; else fixas += l.valor;
    }
    if (l.fonte === 'compra') gasto += l.valor;
    if (l.fonte === 'movimento') guardado += l.tipo === 'saida' ? l.valor : -l.valor;
  }
  const meta = Math.round((renda * dados.config.metaGuardarPct) / 100);
  const livre = renda - fixas - meta;
  return { chave, renda, fixas, meta, livre, gasto, restante: livre - gasto, guardado };
}

/** Soma mensal das saídas fixas (recorrentes) ativas: base da reserva de emergência. */
export function gastosFixosMensais(dados, hoje) {
  const mesAtual = chaveMes(hoje);
  return dados.eventos
    .filter((e) => e.ativo && e.tipo === 'saida' && ehRecorrente(e) && (!e.fim || e.fim >= mesAtual))
    .reduce((s, e) => s + e.valor, 0);
}

/**
 * Avalia uma compra ANTES de salvar (avisos aparecem enquanto você digita).
 * Retorna lista de { nivel: 'ok'|'aviso'|'perigo'|'info', texto }.
 */
export function avaliarCompra(dados, hoje, compra, fmt, idIgnorar = null) {
  const msgs = [];
  if (!compra.valor || compra.valor <= 0) return msgs;
  const chave = chaveMes(compra.data);
  // Orçamento sem a própria compra (se estiver editando)
  const semEla = { ...dados, compras: dados.compras.filter((c) => c.id !== idIgnorar) };
  const orc = orcamentoMes(semEla, chave);
  const mes = fmt.mes(chave);

  // 1) Peso na renda
  if (orc.renda > 0) {
    const pct = Math.round((compra.valor / orc.renda) * 100);
    if (pct >= 10) msgs.push({ nivel: 'info', texto: `Essa compra equivale a ${pct}% da sua renda mensal.` });
  }

  // 2) Orçamento livre do mês
  if (orc.renda === 0) {
    msgs.push({ nivel: 'info', texto: `Cadastre suas entradas mensais para o app calcular seu orçamento.` });
  } else if (orc.livre <= 0) {
    msgs.push({ nivel: 'perigo', texto: `Em ${mes}, as despesas fixas e a meta de guardar já usam toda a renda. Não há orçamento livre.` });
  } else {
    const depois = orc.gasto + compra.valor;
    const pctUso = Math.round((depois / orc.livre) * 100);
    if (depois > orc.livre) {
      msgs.push({ nivel: 'perigo', texto: `Passa ${fmt.valor(depois - orc.livre)} do seu orçamento livre de ${mes} (${fmt.valor(orc.livre)}).` });
    } else if (pctUso >= 80) {
      msgs.push({ nivel: 'aviso', texto: `Vai usar ${pctUso}% do orçamento livre de ${mes}. Sobram ${fmt.valor(orc.livre - depois)}.` });
    } else {
      msgs.push({ nivel: 'ok', texto: `Cabe no orçamento de ${mes}: sobram ${fmt.valor(orc.livre - depois)}.` });
    }
  }

  // 3) Impacto no saldo da conta (só para compras pela conta)
  if (compra.pagamento === 'conta') {
    const antes = projetar(semEla, hoje);
    const com = projetar({ ...semEla, compras: [...semEla.compras, { ...compra, id: '__nova', afetaConta: true }] }, hoje);
    const negativoComCompra = com.dias.find((d) => d.data >= compra.data && d.saldo < 0);
    const negativoAntes = antes.dias.find((d) => d.data >= compra.data && d.saldo < 0);
    if (negativoComCompra && !negativoAntes) {
      msgs.push({ nivel: 'perigo', texto: `Com essa compra, sua conta fica negativa a partir de ${fmt.data(negativoComCompra.data)}.` });
    } else if (negativoComCompra) {
      msgs.push({ nivel: 'aviso', texto: `Sua conta já está projetada no negativo; essa compra aumenta o valor negativo.` });
    }
  } else {
    msgs.push({ nivel: 'info', texto: `No cartão: não sai da conta agora. Lembre de incluir na fatura de ${nomeCartao(dados, compra.pagamento)}.` });
  }
  return msgs;
}

// ---------- Investimentos ----------

/** Converte o rendimento informado em taxa MENSAL (fração: 0,01 = 1% a.m.). */
export function taxaMensal(inv, cdiAnual) {
  const { modo, taxa } = inv.rendimento;
  if (modo === 'mes') return taxa / 100;
  if (modo === 'ano') return Math.pow(1 + taxa / 100, 1 / 12) - 1;
  if (modo === 'cdi') return Math.pow(1 + ((cdiAnual / 100) * taxa) / 100, 1 / 12) - 1;
  return 0;
}

/** Valor estimado após N meses, sem novos aportes (juros compostos). */
export function projetarInvestimento(saldo, taxaMes, meses) {
  return Math.round(saldo * Math.pow(1 + taxaMes, meses));
}

/** Meta da reserva de emergência e quanto falta. */
export function metaReserva(dados, inv, hoje) {
  const base = gastosFixosMensais(dados, hoje);
  const meta = base * inv.mesesReserva;
  return { base, meta, falta: Math.max(0, meta - inv.saldo), pct: meta ? Math.min(100, Math.round((inv.saldo / meta) * 100)) : 0 };
}

/**
 * Em quantos meses a meta é atingida guardando `aporteMes` por mês,
 * com o rendimento da caixinha. Retorna null se nunca (aporte 0 e sem rendimento).
 */
export function mesesParaMeta(saldo, meta, aporteMes, taxaMes) {
  if (saldo >= meta) return 0;
  if (aporteMes <= 0 && taxaMes <= 0) return null;
  let s = saldo;
  for (let m = 1; m <= 600; m++) {
    s = s * (1 + taxaMes) + aporteMes;
    if (s >= meta) return m;
  }
  return null;
}

// ---------- Painel ----------

/** Próximos lançamentos a partir de amanhã (inclui compras no cartão futuras). */
export function proximosLancamentos(dados, projecao, hoje, quantidade = 8) {
  const fim = projecao.fim;
  const lista = gerarLancamentos(dados, somarDias(hoje, 1), fim).slice(0, quantidade);
  return lista.map((l) => ({ ...l, saldoDepois: saldoNoDia(projecao, l.data) }));
}

/** Saídas (contas e faturas) que vencem de hoje até daqui a `dias` dias. */
export function contasAVencer(dados, hoje, dias) {
  return gerarLancamentos(dados, hoje, somarDias(hoje, dias))
    .filter((l) => l.tipo === 'saida' && (l.fonte === 'evento' || l.fonte === 'fatura'));
}

/** Alertas do painel: lista de { nivel, texto }. */
export function gerarAlertas(dados, projecao, hoje, fmt) {
  const alertas = [];

  // 1) Contas vencendo hoje / nos próximos dias
  for (const c of contasAVencer(dados, hoje, Math.max(1, dados.config.diasAntes))) {
    const d = diferencaDias(hoje, c.data);
    const quando = d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias (${fmt.data(c.data)})`;
    alertas.push({ nivel: d === 0 ? 'perigo' : 'aviso', texto: `${c.nome} vence ${quando}: ${fmt.valor(c.valor)}.` });
  }

  // 2) Períodos com saldo projetado negativo (a partir de hoje)
  let periodo = null;
  const periodos = [];
  for (const d of projecao.dias) {
    if (d.data < hoje) continue;
    if (d.saldo < 0) {
      if (!periodo) periodo = { inicio: d.data, fim: d.data };
      periodo.fim = d.data;
    } else if (periodo) { periodos.push(periodo); periodo = null; }
  }
  if (periodo) periodos.push(periodo);
  for (const p of periodos.slice(0, 2)) {
    const positivo = somarDias(p.fim, 1);
    const fimProjecao = p.fim === projecao.fim;
    alertas.push({
      nivel: 'aviso',
      texto: p.inicio <= hoje
        ? (fimProjecao ? 'Saldo projetado negativo até o fim da projeção.' : `Saldo negativo agora. Pela projeção, volta ao positivo em ${fmt.data(positivo)}.`)
        : `Saldo projetado negativo de ${fmt.data(p.inicio)} a ${fmt.data(p.fim)}.`,
    });
  }

  // 3) Orçamento do mês estourado
  const orc = orcamentoMes(dados, chaveMes(hoje));
  if (orc.renda > 0 && orc.gasto > 0 && orc.gasto > orc.livre) {
    alertas.push({ nivel: 'perigo', texto: `Compras do mês passaram ${fmt.valor(orc.gasto - Math.max(0, orc.livre))} do orçamento livre.` });
  }
  return alertas;
}
