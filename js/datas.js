/**
 * datas.js — Funções de data.
 *
 * Por que trabalhar com texto "AAAA-MM-DD" (formato ISO)?
 * - É fácil de salvar em JSON e de comparar: "2026-10-30" < "2026-11-05" funciona
 *   como comparação de texto comum.
 * - Fazendo as contas em UTC, evitamos bugs de fuso horário/horário de verão
 *   (ex.: um dia "sumir" porque o relógio mudou).
 */

/** Converte "AAAA-MM-DD" em objeto Date (meia-noite UTC). */
export function criarData(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Converte Date (UTC) de volta para "AAAA-MM-DD". */
export function paraISO(data) {
  return data.toISOString().slice(0, 10);
}

/** Monta "AAAA-MM-DD" a partir de números (mes de 1 a 12). */
export function montarISO(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Soma (ou subtrai) dias de uma data ISO. */
export function somarDias(iso, dias) {
  const d = criarData(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraISO(d);
}

/** Quantos dias entre duas datas (b - a). */
export function diferencaDias(isoA, isoB) {
  return Math.round((criarData(isoB) - criarData(isoA)) / 86400000);
}

/**
 * Quantidade de dias de um mês (mes de 1 a 12).
 * Truque: o "dia 0" do mês seguinte é o último dia deste mês.
 * Assim fevereiro/ano bissexto é tratado automaticamente.
 */
export function diasNoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Dia útil = segunda a sexta. */
export function ehDiaUtil(iso) {
  const diaSemana = criarData(iso).getUTCDay(); // 0 = domingo, 6 = sábado
  return diaSemana !== 0 && diaSemana !== 6;
}

/** Último dia útil do mês: começa no último dia e volta até achar um dia útil. */
export function ultimoDiaUtil(ano, mes) {
  for (let dia = diasNoMes(ano, mes); dia >= 1; dia--) {
    const iso = montarISO(ano, mes, dia);
    if (ehDiaUtil(iso)) return iso;
  }
  return montarISO(ano, mes, diasNoMes(ano, mes));
}

/** Data de hoje no fuso do aparelho, em ISO. */
export function hojeISO() {
  const d = new Date();
  return montarISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** "2026-10-30" -> "30/10/2026" */
export function formatarData(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** "2026-10-30" -> "30/10" */
export function formatarDataCurta(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

const NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "2026-11" -> "novembro/2026" */
export function nomeMes(chaveMes) {
  const [a, m] = chaveMes.split('-').map(Number);
  return `${NOMES_MESES[m - 1]}/${a}`;
}

/** "2026-11" -> "novembro" */
export function nomeMesCurto(chaveMes) {
  return NOMES_MESES[Number(chaveMes.split('-')[1]) - 1];
}

/** "2026-10-30" -> "sex" */
export function diaDaSemana(iso) {
  return DIAS_SEMANA[criarData(iso).getUTCDay()];
}

/** "2026-10-30" -> "2026-10" */
export function chaveMes(iso) {
  return iso.slice(0, 7);
}

/** Soma meses a uma chave "AAAA-MM". */
export function somarMeses(chave, n) {
  const [a, m] = chave.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Lista de meses entre duas chaves, inclusive: ["2026-10", "2026-11", ...] */
export function listaMeses(inicio, fim) {
  const meses = [];
  for (let m = inicio; m <= fim; m = somarMeses(m, 1)) meses.push(m);
  return meses;
}

/** Primeiro e último dia de uma chave "AAAA-MM", em ISO. */
export function inicioDoMes(chave) {
  return `${chave}-01`;
}
export function fimDoMes(chave) {
  const [a, m] = chave.split('-').map(Number);
  return montarISO(a, m, diasNoMes(a, m));
}
