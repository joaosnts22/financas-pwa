/**
 * grafico.js — Gráfico de linha do saldo, desenhado em SVG "na mão".
 *
 * SVG é um formato de desenho vetorial que o navegador entende nativamente.
 * Montamos o texto do SVG com coordenadas calculadas, sem biblioteca nenhuma.
 * O viewBox faz o desenho se adaptar sozinho à largura da tela.
 */
import { formatarDataCurta, chaveMes } from './datas.js';

const LARGURA = 640;
const ALTURA = 260;
const MARGEM = { topo: 16, direita: 12, baixo: 28, esquerda: 56 };

/** Formata valores curtos para o eixo: 150000 centavos -> "1,5 mil" */
function rotuloEixo(centavos) {
  const reais = centavos / 100;
  if (Math.abs(reais) >= 1000) return `${(reais / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return reais.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

/**
 * @param dias   lista de { data, saldo } (saída de projetar())
 * @param limite limite do cheque especial em centavos (linha vermelha em -limite)
 * @param hoje   data ISO de hoje (linha vertical)
 */
export function svgSaldo(dias, limite, hoje) {
  if (dias.length < 2) return '<p class="vazio">Sem dados suficientes para o gráfico.</p>';

  const saldos = dias.map((d) => d.saldo);
  let min = Math.min(...saldos, 0, limite ? -limite : 0);
  let max = Math.max(...saldos, 0);
  const folga = (max - min) * 0.08 || 10000;
  min -= folga;
  max += folga;

  const areaL = LARGURA - MARGEM.esquerda - MARGEM.direita;
  const areaA = ALTURA - MARGEM.topo - MARGEM.baixo;
  const x = (i) => MARGEM.esquerda + (i / (dias.length - 1)) * areaL;
  const y = (v) => MARGEM.topo + ((max - v) / (max - min)) * areaA;

  const partes = [];

  // Linhas de grade horizontais (5 divisões)
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4;
    partes.push(`<line class="g-grade" x1="${MARGEM.esquerda}" x2="${LARGURA - MARGEM.direita}" y1="${y(v)}" y2="${y(v)}"/>`);
    partes.push(`<text class="g-rotulo" x="${MARGEM.esquerda - 6}" y="${y(v) + 4}" text-anchor="end">${rotuloEixo(v)}</text>`);
  }

  // Início de cada mês no eixo X
  dias.forEach((d, i) => {
    if (i > 0 && chaveMes(d.data) !== chaveMes(dias[i - 1].data)) {
      partes.push(`<line class="g-mes" x1="${x(i)}" x2="${x(i)}" y1="${MARGEM.topo}" y2="${ALTURA - MARGEM.baixo}"/>`);
      partes.push(`<text class="g-rotulo" x="${x(i)}" y="${ALTURA - 8}" text-anchor="middle">${formatarDataCurta(d.data)}</text>`);
    }
  });

  // Linha do zero e do limite do cheque especial
  partes.push(`<line class="g-zero" x1="${MARGEM.esquerda}" x2="${LARGURA - MARGEM.direita}" y1="${y(0)}" y2="${y(0)}"/>`);
  if (limite > 0) {
    partes.push(`<line class="g-limite" x1="${MARGEM.esquerda}" x2="${LARGURA - MARGEM.direita}" y1="${y(-limite)}" y2="${y(-limite)}"/>`);
    partes.push(`<text class="g-rotulo g-rotulo-limite" x="${LARGURA - MARGEM.direita}" y="${y(-limite) - 4}" text-anchor="end">limite do cheque</text>`);
  }

  // Linha "hoje"
  const iHoje = dias.findIndex((d) => d.data === hoje);
  if (iHoje >= 0) {
    partes.push(`<line class="g-hoje" x1="${x(iHoje)}" x2="${x(iHoje)}" y1="${MARGEM.topo}" y2="${ALTURA - MARGEM.baixo}"/>`);
  }

  // Linha do saldo em "degraus" (o saldo muda de uma vez, não aos poucos)
  let caminho = `M${x(0)},${y(saldos[0])}`;
  for (let i = 1; i < dias.length; i++) caminho += ` H${x(i)} V${y(saldos[i])}`;

  // Área preenchida: parte acima do zero (verde) e abaixo (vermelha), via clipPath
  const area = `${caminho} V${y(0)} H${x(0)} Z`;
  partes.push(`
    <defs>
      <clipPath id="acimaZero"><rect x="0" y="0" width="${LARGURA}" height="${y(0)}"/></clipPath>
      <clipPath id="abaixoZero"><rect x="0" y="${y(0)}" width="${LARGURA}" height="${ALTURA}"/></clipPath>
    </defs>
    <path class="g-area-pos" d="${area}" clip-path="url(#acimaZero)"/>
    <path class="g-area-neg" d="${area}" clip-path="url(#abaixoZero)"/>
    <path class="g-linha" d="${caminho}"/>`);

  return `<svg class="grafico" viewBox="0 0 ${LARGURA} ${ALTURA}" role="img"
    aria-label="Gráfico do saldo projetado dia a dia">${partes.join('')}</svg>`;
}
