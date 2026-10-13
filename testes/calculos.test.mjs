/**
 * Testes automatizados dos cálculos (sem bibliotecas: usa o test runner do Node 18+).
 *
 * Como rodar, na pasta do projeto:
 *     node --test testes/calculos.test.mjs
 *
 * Todos os dados aqui são fictícios.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { paraCentavos, formatarBRL } from '../js/dinheiro.js';
import { ultimoDiaUtil, diasNoMes, somarMeses } from '../js/datas.js';
import { normalizar } from '../js/dados.js';
import { projetar, orcamentoMes, taxaMensal, listarDividas, gerarLancamentos } from '../js/calculos.js';
import { parcelaPrice, aporteNecessario, compararParcelamentos, simularCompra } from '../js/simulacoes.js';

const HOJE = '2026-10-13';

/** Cenário base fictício usado em vários testes. */
function cenario() {
  return normalizar({
    conta: { saldoInicial: 50000, dataSaldo: HOJE },
    eventos: [
      { id: 'sal', nome: 'Salário', tipo: 'entrada', categoria: 'Trabalho', valor: 300000, recorrencia: 'ultimoDiaUtil', inicio: '2026-10' },
      { id: 'alu', nome: 'Aluguel', tipo: 'saida', categoria: 'Despesa fixa', valor: 120000, recorrencia: 'mensal', dia: 5, inicio: '2026-11' },
      { id: 'par', nome: 'Celular', tipo: 'saida', categoria: 'Parcela', valor: 20000, recorrencia: 'mensal', dia: 10, inicio: '2026-09', fim: '2027-02' },
    ],
    cartoes: [{ id: 'c1', nome: 'Cartão', faturas: [{ vencimento: '2026-11-08', valor: 40000 }] }],
    config: { metaGuardarPct: 10, mesesAFrente: 6 },
  });
}

test('dinheiro: lê valores no formato brasileiro e evita erro de ponto flutuante', () => {
  assert.equal(paraCentavos('1.234,56'), 123456);
  assert.equal(paraCentavos('R$ 0,10'), 10);
  assert.equal(paraCentavos('-2500'), -250000);
  assert.equal(paraCentavos('abc'), null);
  assert.equal(paraCentavos('0,1') + paraCentavos('0,2'), 30); // em reais: 0.1 + 0.2 = 0.30000000000000004
  assert.equal(formatarBRL(123456).replace(/\s/g, ' '), 'R$ 1.234,56');
});

test('datas: meses de tamanhos diferentes e último dia útil', () => {
  assert.equal(diasNoMes(2028, 2), 29); // bissexto
  assert.equal(diasNoMes(2027, 2), 28);
  assert.equal(ultimoDiaUtil(2026, 10), '2026-10-30'); // 31/10/2026 é sábado
  assert.equal(ultimoDiaUtil(2027, 1), '2027-01-29'); // 30 e 31 caem no fim de semana
  assert.equal(somarMeses('2026-12', 1), '2027-01');
});

test('recorrência: dia 31 vira o último dia em meses menores', () => {
  const d = normalizar({ conta: { saldoInicial: 0, dataSaldo: '2027-01-01' },
    eventos: [{ nome: 'X', tipo: 'saida', valor: 100, recorrencia: 'mensal', dia: 31, inicio: '2027-01' }] });
  const datas = gerarLancamentos(d, '2027-01-01', '2027-04-30').map((l) => l.data);
  assert.deepEqual(datas, ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
});

test('projeção: saldo dia a dia soma entradas e saídas nas datas certas', () => {
  const p = projetar(cenario(), HOJE);
  const dia = (iso) => p.dias.find((x) => x.data === iso).saldo;
  assert.equal(dia('2026-10-29'), 50000);                  // nada mudou ainda
  assert.equal(dia('2026-10-30'), 50000 + 300000);         // salário
  assert.equal(dia('2026-11-05'), 350000 - 120000);        // aluguel
  assert.equal(dia('2026-11-08'), 230000 - 40000);         // fatura
  assert.equal(dia('2026-11-10'), 190000 - 20000);         // parcela
});

test('orçamento: livre = renda − fixas − meta de guardar', () => {
  const o = orcamentoMes(cenario(), '2026-11');
  assert.equal(o.renda, 300000);
  assert.equal(o.fixas, 140000);  // aluguel + parcela
  assert.equal(o.meta, 30000);    // 10% da renda
  assert.equal(o.livre, 130000);
});

test('investimentos: 100% do CDI de 12% a.a. ≈ 0,9489% a.m. (juros compostos)', () => {
  const t = taxaMensal({ rendimento: { modo: 'cdi', taxa: 100 } }, 12);
  assert.ok(Math.abs(t - 0.009489) < 0.000001);
  assert.equal(taxaMensal({ rendimento: { modo: 'nenhum', taxa: 0 } }, 12), 0);
});

test('dívidas: conta parcelas restantes e a data em que tudo termina', () => {
  const r = listarDividas(cenario(), HOJE);
  const parcela = r.itens.find((i) => i.id === 'par');
  assert.equal(parcela.pagas, 2);       // set e out já passaram
  assert.equal(parcela.faltam, 4);      // nov, dez, jan, fev
  assert.equal(parcela.restante, 80000);
  assert.equal(r.total, 80000 + 40000);
  assert.equal(r.livreEm, '2027-02-10');
});

test('simulador: Tabela Price e parcelamentos', () => {
  assert.equal(parcelaPrice(100000, 0.03, 12), 10046); // R$ 1.000 a 3% a.m. em 12x
  assert.equal(parcelaPrice(90000, 0, 3), 30000);      // sem juros
  const c = compararParcelamentos(90000, [{ parcelas: 3, valorParcela: 33000 }, { parcelas: 6, valorParcela: 17500 }], 0);
  assert.deepEqual(c.map((l) => l.juros), [9000, 15000]);
  assert.equal(c[0].menorJuros, true);
});

test('simulador: aporte mensal para atingir uma meta', () => {
  assert.equal(aporteNecessario(1200000, 0, 0, 12), 100000);  // R$ 12.000 em 12 meses, sem rendimento
  assert.ok(aporteNecessario(1200000, 0, 0.01, 12) < 100000); // com rendimento, precisa guardar menos
});

test('simulador: não altera os dados originais', () => {
  const d = cenario();
  const antes = JSON.stringify(d);
  simularCompra(d, HOJE, { valor: 150000, data: '2026-11-15', parcelas: 10, valorParcela: 15000, pagamento: 'parcelado' });
  assert.equal(JSON.stringify(d), antes);
});
