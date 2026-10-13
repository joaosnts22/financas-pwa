/**
 * dados.js — Formato dos dados, salvamento no aparelho e backup.
 *
 * Todos os dados ficam no localStorage do navegador (só no SEU aparelho).
 * Nada é enviado para servidor nenhum.
 *
 * FORMATO (todos os valores em CENTAVOS e datas em "AAAA-MM-DD"):
 * {
 *   versao: 1,
 *   conta:   { saldoInicial, dataSaldo },          // saldo real da conta numa data
 *   cheque:  { limite, iof, diasSemJuros, negativoDesde, taxaJurosMes },
 *   eventos: [ { id, nome, tipo, categoria, valor, recorrencia, data, dia,
 *                inicio, fim, ativo, cenario } ],
 *   cartoes: [ { id, nome, faturas: [{ id, vencimento, valor, paga }],
 *                parcelamento: { parcelas, valor, pagas, jurosTotais } } ],
 *   config:  { mesFinal, feriados: [], alertaChequePct },
 *   exemplo: true/false                            // true = dados fictícios
 * }
 */
import { hojeISO, chaveMes, somarMeses, montarISO } from './datas.js';

const CHAVE_STORAGE = 'financas-pwa:dados';
export const VERSAO = 1;

/** Gera um id curto e único (para identificar cada evento/fatura). */
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

export function apagarTudo() {
  localStorage.removeItem(CHAVE_STORAGE);
}

// ---------- Validação ----------

const inteiro = (v, padrao = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : padrao;
};
const ehISO = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const ehMes = (v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);

/**
 * Garante que os dados têm todos os campos esperados (preenche o que faltar).
 * Usado ao carregar e ao IMPORTAR um JSON — assim um arquivo antigo ou
 * incompleto não quebra o app. Lança erro se o arquivo não fizer sentido.
 */
export function normalizar(bruto) {
  if (!bruto || typeof bruto !== 'object' || !bruto.conta) {
    throw new Error('Arquivo não parece ser um backup deste app.');
  }
  const hoje = hojeISO();
  const conta = bruto.conta || {};
  const cheque = bruto.cheque || {};
  const config = bruto.config || {};
  const dataSaldo = ehISO(conta.dataSaldo) ? conta.dataSaldo : hoje;

  return {
    versao: VERSAO,
    exemplo: Boolean(bruto.exemplo),
    conta: {
      saldoInicial: inteiro(conta.saldoInicial),
      dataSaldo,
    },
    cheque: {
      limite: Math.max(0, inteiro(cheque.limite)),
      iof: Math.max(0, inteiro(cheque.iof)),
      diasSemJuros: Math.max(0, inteiro(cheque.diasSemJuros, 30)),
      negativoDesde: ehISO(cheque.negativoDesde) ? cheque.negativoDesde : null,
      taxaJurosMes: Math.max(0, Number(cheque.taxaJurosMes) || 0), // em %, ex.: 8.5
    },
    eventos: (Array.isArray(bruto.eventos) ? bruto.eventos : []).map((e) => ({
      id: e.id || novoId(),
      nome: String(e.nome || 'Sem nome'),
      tipo: e.tipo === 'entrada' ? 'entrada' : 'saida',
      categoria: String(e.categoria || 'outro'),
      valor: Math.abs(inteiro(e.valor)),
      recorrencia: ['unica', 'mensal', 'ultimoDiaUtil'].includes(e.recorrencia) ? e.recorrencia : 'unica',
      data: ehISO(e.data) ? e.data : dataSaldo,
      dia: Math.min(31, Math.max(1, inteiro(e.dia, 1))),
      inicio: ehMes(e.inicio) ? e.inicio : chaveMes(dataSaldo),
      fim: ehMes(e.fim) ? e.fim : '',
      ativo: e.ativo !== false,
      cenario: Boolean(e.cenario),
    })),
    cartoes: (Array.isArray(bruto.cartoes) ? bruto.cartoes : []).map((c) => ({
      id: c.id || novoId(),
      nome: String(c.nome || 'Cartão'),
      faturas: (Array.isArray(c.faturas) ? c.faturas : [])
        .filter((f) => ehISO(f.vencimento))
        .map((f) => ({
          id: f.id || novoId(),
          vencimento: f.vencimento,
          valor: Math.abs(inteiro(f.valor)),
          paga: Boolean(f.paga),
        }))
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
      parcelamento: c.parcelamento ? {
        parcelas: Math.max(0, inteiro(c.parcelamento.parcelas)),
        valor: Math.abs(inteiro(c.parcelamento.valor)),
        pagas: Math.max(0, inteiro(c.parcelamento.pagas)),
        jurosTotais: Math.abs(inteiro(c.parcelamento.jurosTotais)),
      } : null,
    })),
    config: {
      mesFinal: ehMes(config.mesFinal) ? config.mesFinal : somarMeses(chaveMes(dataSaldo), 4),
      feriados: (Array.isArray(config.feriados) ? config.feriados : []).filter(ehISO).sort(),
      alertaChequePct: Math.min(100, Math.max(1, inteiro(config.alertaChequePct, 80))),
    },
  };
}

// ---------- Dados iniciais ----------

/** Começar do zero: conta zerada e nenhum evento. */
export function dadosVazios() {
  return normalizar({ conta: { saldoInicial: 0, dataSaldo: hojeISO() } });
}

/**
 * Dados de EXEMPLO, 100% fictícios, para conhecer o app.
 * As datas são relativas a hoje, para o exemplo nunca "envelhecer".
 */
export function dadosExemplo() {
  const hoje = hojeISO();
  const mes = chaveMes(hoje);
  const [a, m] = somarMeses(mes, 1).split('-').map(Number);
  const proximoMes = (dia) => montarISO(a, m, dia);

  return normalizar({
    exemplo: true,
    conta: { saldoInicial: 35000, dataSaldo: hoje },
    cheque: { limite: 150000, iof: 1500, diasSemJuros: 30, negativoDesde: null, taxaJurosMes: 0 },
    eventos: [
      { nome: 'Salário (exemplo)', tipo: 'entrada', categoria: 'salario', valor: 280000, recorrencia: 'ultimoDiaUtil', inicio: mes },
      { nome: 'Freela (exemplo)', tipo: 'entrada', categoria: 'extra', valor: 50000, recorrencia: 'unica', data: proximoMes(15), cenario: true, ativo: false },
      { nome: 'Aluguel (exemplo)', tipo: 'saida', categoria: 'fixa', valor: 120000, recorrencia: 'mensal', dia: 5, inicio: somarMeses(mes, 1) },
      { nome: 'Contas de casa (exemplo)', tipo: 'saida', categoria: 'fixa', valor: 25000, recorrencia: 'mensal', dia: 10, inicio: somarMeses(mes, 1) },
      { nome: 'Gastos gerais (exemplo)', tipo: 'saida', categoria: 'gasto', valor: 30000, recorrencia: 'mensal', dia: 15, inicio: somarMeses(mes, 1) },
    ],
    cartoes: [{
      nome: 'Cartão Exemplo',
      faturas: [0, 1, 2, 3].map((i) => {
        const [fa, fm] = somarMeses(mes, i + 1).split('-').map(Number);
        return { vencimento: montarISO(fa, fm, 8), valor: i === 0 ? 140000 : 70000 };
      }),
      parcelamento: { parcelas: 3, valor: 20000, pagas: 0, jurosTotais: 9000 },
    }],
    config: { mesFinal: somarMeses(mes, 4), feriados: [], alertaChequePct: 80 },
  });
}

// ---------- Backup (exportar / importar JSON) ----------

/** Baixa um arquivo .json com todos os dados. */
export function exportarJSON(dados) {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `financas-backup-${hojeISO()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lê um arquivo escolhido pelo usuário e devolve os dados validados. */
export async function lerArquivoJSON(arquivo) {
  const texto = await arquivo.text();
  let bruto;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  return normalizar(bruto);
}
