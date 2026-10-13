/**
 * grafico.js — Gráficos desenhados em SVG "na mão", sem biblioteca.
 *
 * SVG é um formato de desenho vetorial que o navegador entende nativamente.
 * Montamos o texto do SVG com coordenadas calculadas.
 * O viewBox faz o desenho se adaptar sozinho à largura da tela.
 */
import { formatarDataCurta, chaveMes } from './datas.js';

const LARGURA = 640;
const ALTURA = 240;
const MARGEM = { topo: 16, direita: 10, baixo: 34, esquerda: 74 };

/** Formata valores curtos para o eixo: 150000 centavos -> "1,5 mil" */
function rotuloEixo(centavos) {
  const reais = centavos / 100;
  if (Math.abs(reais) >= 1000) return `${(reais / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return reais.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

/**
 * Gráfico de linha do saldo dia a dia.
 * @param dias        lista de { data, saldo } (saída de projetar())
 * @param hoje        data ISO de hoje (linha vertical)
 * @param mesDestaque chave "AAAA-MM" do mês a destacar (faixa de fundo), opcional
 */
export function svgSaldo(dias, hoje, mesDestaque = null) {
  if (dias.length < 2) return '<p class="vazio">Sem dados suficientes para o gráfico.</p>';

  const saldos = dias.map((d) => d.saldo);
  let min = Math.min(...saldos, 0);
  let max = Math.max(...saldos, 0);
  const folga = (max - min) * 0.08 || 10000;
  min -= folga;
  max += folga;

  const areaL = LARGURA - MARGEM.esquerda - MARGEM.direita;
  const areaA = ALTURA - MARGEM.topo - MARGEM.baixo;
  const x = (i) => MARGEM.esquerda + (i / (dias.length - 1)) * areaL;
  const y = (v) => MARGEM.topo + ((max - v) / (max - min)) * areaA;
  const partes = [];

  // Faixa de fundo no mês selecionado
  if (mesDestaque) {
    const idx = dias.map((d, i) => (chaveMes(d.data) === mesDestaque ? i : -1)).filter((i) => i >= 0);
    if (idx.length) {
      const x1 = x(idx[0]);
      const x2 = x(Math.min(idx[idx.length - 1] + 1, dias.length - 1));
      partes.push(`<rect class="g-destaque" x="${x1}" y="${MARGEM.topo}" width="${Math.max(2, x2 - x1)}" height="${areaA}" rx="6"/>`);
    }
  }

  // Grade horizontal (5 linhas) com rótulos
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4;
    partes.push(`<line class="g-grade" x1="${MARGEM.esquerda}" x2="${LARGURA - MARGEM.direita}" y1="${y(v)}" y2="${y(v)}"/>`);
    partes.push(`<text class="g-rotulo" x="${MARGEM.esquerda - 8}" y="${y(v) + 6}" text-anchor="end">${rotuloEixo(v)}</text>`);
  }

  // Início de cada mês no eixo X (no máximo ~7 rótulos para não embolar)
  const inicios = dias.map((d, i) => (i > 0 && chaveMes(d.data) !== chaveMes(dias[i - 1].data) ? i : -1)).filter((i) => i >= 0);
  const passo = Math.ceil(inicios.length / 7) || 1;
  inicios.forEach((i, n) => {
    if (n % passo === 0) partes.push(`<text class="g-rotulo" x="${x(i)}" y="${ALTURA - 8}" text-anchor="middle">${formatarDataCurta(dias[i].data)}</text>`);
  });

  // Linha do zero
  partes.push(`<line class="g-zero" x1="${MARGEM.esquerda}" x2="${LARGURA - MARGEM.direita}" y1="${y(0)}" y2="${y(0)}"/>`);

  // Linha "hoje"
  const iHoje = dias.findIndex((d) => d.data === hoje);
  if (iHoje >= 0) {
    partes.push(`<line class="g-hoje" x1="${x(iHoje)}" x2="${x(iHoje)}" y1="${MARGEM.topo}" y2="${ALTURA - MARGEM.baixo}"/>`);
  }

  // Linha do saldo em "degraus" (o saldo muda de uma vez, não aos poucos)
  let caminho = `M${x(0)},${y(saldos[0])}`;
  for (let i = 1; i < dias.length; i++) caminho += ` H${x(i)} V${y(saldos[i])}`;

  // Área: verde acima do zero, vermelha abaixo (recortes com clipPath)
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

/**
 * Gráfico de rosca (donut).
 * Truque do "stroke-dasharray": um círculo com contorno grosso em que só um
 * pedaço do contorno é pintado. Com raio 15,915 a circunferência dá 100,
 * então cada fatia usa direto a sua porcentagem.
 * @param fatias lista de { valor (centavos), cor }
 */
export function svgRosca(fatias) {
  const R = 15.915;
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  if (!total) {
    return `<svg class="rosca" viewBox="0 0 42 42"><circle cx="21" cy="21" r="${R}" fill="none" class="rosca-vazia" stroke-width="5.5"/></svg>`;
  }
  const espaco = fatias.length > 1 ? 0.8 : 0;
  let acumulado = 0;
  const arcos = fatias.map((f) => {
    const pct = (f.valor / total) * 100;
    const arco = `<circle cx="21" cy="21" r="${R}" fill="none" stroke="${f.cor}" stroke-width="5.5"
      stroke-dasharray="${Math.max(0.01, pct - espaco)} ${100 - pct + espaco}"
      stroke-dashoffset="${25 - acumulado}"/>`; // 25 = começa no topo (12h)
    acumulado += pct;
    return arco;
  });
  return `<svg class="rosca" viewBox="0 0 42 42" role="img" aria-label="Gastos por categoria">${arcos.join('')}</svg>`;
}
