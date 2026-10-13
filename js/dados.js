/**
 * dados.js — Formato dos dados, salvamento no aparelho e backup.
 *
 * Todos os dados ficam no localStorage do navegador (só no SEU aparelho).
 * Nada é enviado para servidor nenhum.
 *
 * FORMATO (versão 2) — valores em CENTAVOS, datas em "AAAA-MM-DD":
 * {
 *   versao: 2,
 *   conta:   { saldoInicial, dataSaldo, atualizadoEm },   // saldo real numa data
 *   eventos: [ { id, nome, tipo: 'entrada'|'saida', categoria (texto), valor,
 *                recorrencia: 'unica'|'mensal'|'ultimoDiaUtil', data, dia,
 *                inicio, fim, ativo } ],
 *   cartoes: [ { id, nome, faturas: [{ id, vencimento, valor, paga }],
 *                parcelamento: { parcelas, valor, pagas, jurosTotais } } ],
 *   compras: [ { id, descricao, valor, data, categoria, pagamento: 'conta' | id do cartão,
 *                criadoEm, abateuSaldo } ],
 *   investimentos: [ { id, nome, instituicao, tipo: 'emergencia'|'caixinha'|'variavel',
 *                      saldo, dataSaldo, rendimento: { modo: 'cdi'|'mes'|'ano'|'nenhum', taxa },
 *                      mesesReserva } ],
 *   movimentos: [ { id, investimentoId, tipo: 'aporte'|'resgate', valor, data, criadoEm, abateuSaldo } ],
 *   config:  { mesesAFrente, metaGuardarPct, cdiAnual, lembretes, diasAntes },
 *   exemplo: true/false
 * }
 */
import { hojeISO, chaveMes, somarMeses, montarISO } from './datas.js';

const CHAVE_STORAGE = 'financas-pwa:dados';
export const VERSAO = 2;

/** Gera um id curto e único. */
export function novoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Leitura e gravação ----------

export function carregar() {
  try {
    const texto = localStorage.getItem(CHAVE_STORAGE);
    return texto ? normalizar(JSON.parse(texto)) : null;
  } catch (erro) {
    console.error('Erro ao carregar dados:', erro);
    return null;
  }
}

export function salvar(dados) {
  localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
}

// ---------- Validação e migração ----------

const inteiro = (v, padrao = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : padrao;
};
const numero = (v, padrao = 0) => (Number.isFinite(Number(v)) ? Number(v) : padrao);
const ehISO = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const ehMes = (v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);
const texto = (v, padrao) => (String(v ?? '').trim() || padrao);

/** Na versão 1 as categorias eram códigos; agora são textos livres. */
const CATEGORIAS_V1 = {
  salario: 'Salário', ajuda: 'Ajuda de custo', venda: 'Venda', extra: 'Horas extras',
  outro_entrada: 'Outra entrada', fixa: 'Despesa fixa', parcela: 'Parcela',
  gasto: 'Gastos gerais', outro: 'Outra saída',
};

/**
 * Garante que os dados têm todos os campos esperados (preenche o que faltar)
 * e converte arquivos da versão 1. Usado ao carregar e ao IMPORTAR um JSON.
 */
export function normalizar(bruto) {
  if (!bruto || typeof bruto !== 'object' || !bruto.conta) {
    throw new Error('Arquivo não parece ser um backup deste app.');
  }
  const hoje = hojeISO();
  const conta = bruto.conta || {};
  const config = bruto.config || {};
  const dataSaldo = ehISO(conta.dataSaldo) ? conta.dataSaldo : hoje;

  return {
    versao: VERSAO,
    exemplo: Boolean(bruto.exemplo),
    conta: {
      saldoInicial: inteiro(conta.saldoInicial),
      dataSaldo,
      atualizadoEm: inteiro(conta.atualizadoEm, 0),
    },
    eventos: (Array.isArray(bruto.eventos) ? bruto.eventos : [])
      .map((e) => ({
        id: e.id || novoId(),
        nome: texto(e.nome, 'Sem nome'),
        tipo: e.tipo === 'entrada' ? 'entrada' : 'saida',
        categoria: CATEGORIAS_V1[e.categoria] || texto(e.categoria, 'Outros'),
        valor: Math.abs(inteiro(e.valor)),
        recorrencia: ['unica', 'mensal', 'ultimoDiaUtil'].includes(e.recorrencia) ? e.recorrencia : 'unica',
        data: ehISO(e.data) ? e.data : dataSaldo,
        dia: Math.min(31, Math.max(1, inteiro(e.dia, 1))),
        inicio: ehMes(e.inicio) ? e.inicio : chaveMes(dataSaldo),
        fim: ehMes(e.fim) ? e.fim : '',
        ativo: e.ativo !== false,
      })),
    cartoes: (Array.isArray(bruto.cartoes) ? bruto.cartoes : []).map((c) => ({
      id: c.id || novoId(),
      nome: texto(c.nome, 'Cartão'),
      faturas: (Array.isArray(c.faturas) ? c.faturas : [])
        .filter((f) => ehISO(f.vencimento))
        .map((f) => ({ id: f.id || novoId(), vencimento: f.vencimento, valor: Math.abs(inteiro(f.valor)), paga: Boolean(f.paga) }))
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
      parcelamento: c.parcelamento && inteiro(c.parcelamento.parcelas) > 0 ? {
        parcelas: inteiro(c.parcelamento.parcelas),
        valor: Math.abs(inteiro(c.parcelamento.valor)),
        pagas: Math.max(0, inteiro(c.parcelamento.pagas)),
        jurosTotais: Math.abs(inteiro(c.parcelamento.jurosTotais)),
      } : null,
    })),
    compras: (Array.isArray(bruto.compras) ? bruto.compras : [])
      .filter((c) => ehISO(c.data))
      .map((c) => ({
        id: c.id || novoId(),
        descricao: texto(c.descricao, 'Compra'),
        valor: Math.abs(inteiro(c.valor)),
        data: c.data,
        categoria: texto(c.categoria, 'Outros'),
        pagamento: texto(c.pagamento, 'conta'),
        criadoEm: inteiro(c.criadoEm, 0),
        abateuSaldo: Boolean(c.abateuSaldo),
      })),
    investimentos: (Array.isArray(bruto.investimentos) ? bruto.investimentos : []).map((i) => ({
      id: i.id || novoId(),
      nome: texto(i.nome, 'Caixinha'),
      instituicao: String(i.instituicao ?? '').trim(),
      tipo: ['emergencia', 'caixinha', 'variavel'].includes(i.tipo) ? i.tipo : 'caixinha',
      saldo: Math.max(0, inteiro(i.saldo)),
      dataSaldo: ehISO(i.dataSaldo) ? i.dataSaldo : hoje,
      rendimento: {
        modo: ['cdi', 'mes', 'ano', 'nenhum'].includes(i.rendimento?.modo) ? i.rendimento.modo : 'cdi',
        taxa: Math.max(0, numero(i.rendimento?.taxa, 100)),
      },
      mesesReserva: Math.min(24, Math.max(1, inteiro(i.mesesReserva, 6))),
    })),
    movimentos: (Array.isArray(bruto.movimentos) ? bruto.movimentos : [])
      .filter((m) => ehISO(m.data))
      .map((m) => ({
        id: m.id || novoId(),
        investimentoId: String(m.investimentoId || ''),
        tipo: m.tipo === 'resgate' ? 'resgate' : 'aporte',
        valor: Math.abs(inteiro(m.valor)),
        data: m.data,
        criadoEm: inteiro(m.criadoEm, 0),
        abateuSaldo: Boolean(m.abateuSaldo),
      })),
    config: {
      mesesAFrente: Math.min(24, Math.max(1, inteiro(config.mesesAFrente, 6))),
      metaGuardarPct: Math.min(90, Math.max(0, numero(config.metaGuardarPct, 15))),
      cdiAnual: Math.max(0, numero(config.cdiAnual, 13.65)),
      lembretes: Boolean(config.lembretes),
      diasAntes: Math.min(7, Math.max(0, inteiro(config.diasAntes, 1))),
    },
  };
}

// ---------- Dados iniciais ----------

/** Começar do zero: conta zerada e nada cadastrado. */
export function dadosVazios() {
  return normalizar({ conta: { saldoInicial: 0, dataSaldo: hojeISO(), atualizadoEm: Date.now() } });
}

/** Dados de EXEMPLO, 100% fictícios. Datas relativas a hoje. */
export function dadosExemplo() {
  const hoje = hojeISO();
  const mes = chaveMes(hoje);
  const dia = (m, d) => { const [a, mm] = somarMeses(mes, m).split('-').map(Number); return montarISO(a, mm, d); };

  return normalizar({
    exemplo: true,
    conta: { saldoInicial: 85000, dataSaldo: hoje, atualizadoEm: Date.now() },
    eventos: [
      { nome: 'Salário (exemplo)', tipo: 'entrada', categoria: 'Trabalho', valor: 320000, recorrencia: 'ultimoDiaUtil', inicio: mes },
      { nome: 'Aluguel (exemplo)', tipo: 'saida', categoria: 'Despesa fixa', valor: 120000, recorrencia: 'mensal', dia: 5, inicio: mes },
      { nome: 'Luz e internet (exemplo)', tipo: 'saida', categoria: 'Despesa fixa', valor: 25000, recorrencia: 'mensal', dia: 10, inicio: mes },
    ],
    cartoes: [{ nome: 'Cartão Exemplo', faturas: [0, 1, 2].map((i) => ({ vencimento: dia(i + 1, 8), valor: 45000 })) }],
    compras: [
      { descricao: 'Mercado (exemplo)', valor: 18000, data: hoje, categoria: 'Mercado', pagamento: 'conta' },
    ],
    investimentos: [
      { nome: 'Reserva de emergência', instituicao: 'Banco Exemplo', tipo: 'emergencia', saldo: 150000, dataSaldo: hoje, rendimento: { modo: 'cdi', taxa: 100 }, mesesReserva: 6 },
    ],
    config: { mesesAFrente: 6, metaGuardarPct: 15, cdiAnual: 13.65 },
  });
}

// ---------- Backup (exportar / importar JSON) ----------

/** Baixa um arquivo com o conteúdo informado. */
export function baixarArquivo(conteudo, nome, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportarJSON(dados) {
  baixarArquivo(JSON.stringify(dados, null, 2), `financas-backup-${hojeISO()}.json`, 'application/json');
}

/** Lê um arquivo escolhido pelo usuário e devolve os dados validados. */
export async function lerArquivoJSON(arquivo) {
  const conteudo = await arquivo.text();
  let bruto;
  try {
    bruto = JSON.parse(conteudo);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  return normalizar(bruto);
}

// ---------- Movimentos que mexem no saldo da conta ----------

/**
 * Compras pela conta e aportes/resgates mexem no dinheiro da conta.
 * - Se a data é DEPOIS da data do saldo informado, a projeção cuida disso
 *   (vira um lançamento normal).
 * - Se a data é ATÉ a data do saldo, o saldo informado ainda não "sabe" dessa
 *   movimentação, então ajustamos o próprio saldo agora.
 * Retorna true se ajustou o saldo (guardamos isso para desfazer ao excluir).
 */
export function ajustarSaldoSeNecessario(dados, data, delta) {
  if (data > dados.conta.dataSaldo) return false;
  dados.conta.saldoInicial += delta;
  return true;
}

/**
 * Desfaz o ajuste ao excluir um item — mas só se o saldo não foi
 * atualizado depois do registro (se foi, o saldo do banco já está certo).
 */
export function desfazerAjuste(dados, item, delta) {
  if (item.abateuSaldo && item.criadoEm > dados.conta.atualizadoEm) {
    dados.conta.saldoInicial -= delta;
  }
}
