/**
 * dinheiro.js — Valores em CENTAVOS (números inteiros).
 *
 * Por quê? No JavaScript (e no Python também!), 0.1 + 0.2 = 0.30000000000000004.
 * Somando muitos valores com vírgula, esses erros se acumulam.
 * Guardando tudo em centavos inteiros (R$ 12,34 -> 1234), a soma é sempre exata.
 * Só dividimos por 100 na hora de MOSTRAR o valor na tela.
 */

const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 123456 -> "R$ 1.234,56" */
export function formatarBRL(centavos) {
  return formatador.format(centavos / 100);
}

/** 123456 -> "+R$ 1.234,56" / "−R$ 1.234,56" (útil para lançamentos) */
export function formatarComSinal(centavos) {
  const sinal = centavos > 0 ? '+' : centavos < 0 ? '−' : '';
  return sinal + formatador.format(Math.abs(centavos) / 100);
}

/** 123456 -> "1234,56" (para preencher campos de formulário) */
export function centavosParaTexto(centavos) {
  const negativo = centavos < 0;
  const abs = Math.abs(centavos);
  const texto = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
  return negativo ? '-' + texto : texto;
}

/**
 * Lê o que o usuário digitou e devolve centavos (ou null se inválido).
 * Aceita: "1.234,56", "1234,56", "1234.56", "1234", "R$ 1.234,56", "-500".
 */
export function paraCentavos(texto) {
  let s = String(texto ?? '').trim().replace(/R\$|\s/g, '');
  if (s === '') return null;
  if (s.includes(',')) {
    // Formato brasileiro: ponto é separador de milhar, vírgula é decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    // "1.234.567" sem vírgula: pontos são milhar
    s = s.replace(/\./g, '');
  }
  const numero = Number(s);
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100);
}

/** Lê uma porcentagem digitada ("13,65" ou "13.65") e devolve número (13.65) ou null. */
export function paraNumero(texto) {
  const s = String(texto ?? '').trim().replace('%', '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 13.65 -> "13,65" */
export function numeroParaTexto(n) {
  return String(n).replace('.', ',');
}
