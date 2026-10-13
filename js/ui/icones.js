/**
 * ui/icones.js — Ícones em SVG desenhados com traços simples (estilo "linha").
 *
 * Por que SVG e não emoji? Emoji muda de aparência em cada celular
 * (Android, iPhone, Windows). SVG fica idêntico em todo lugar, aceita a cor
 * do texto (stroke="currentColor") e não depende de internet nem de biblioteca.
 */

// Cada ícone é só o "miolo" do SVG (caminhos), em uma grade de 24x24.
const CAMINHOS = {
  inicio: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
  fluxo: '<path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  cartao: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
  menu: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  olho: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  olhoFechado: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  setaCima: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  setaBaixo: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  esquerda: '<path d="M15 5l-7 7 7 7"/>',
  direita: '<path d="M9 5l7 7-7 7"/>',
  alerta: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>',
  perigo: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  baixar: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  subir: '<path d="M12 15V4M7 9l5-5 5 5M4 20h16"/>',
  lixeira: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  engrenagem: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  banco: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  atualizar: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  escudo: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3z"/>',
  // Categorias
  salario: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12h18"/>',
  ajuda: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  venda: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  extra: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  outro_entrada: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  fixa: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/>',
  fatura: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/>',
  parcela: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  gasto: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  encargo: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.3"/><circle cx="17" cy="17" r="2.3"/>',
  outro: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  desconto: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
};

/** Devolve o HTML de um ícone. Ex.: icone('olho') */
export function icone(nome, classe = '') {
  return `<svg class="ico ${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CAMINHOS[nome] || CAMINHOS.outro}</svg>`;
}

/**
 * Cor de cada categoria (usada no círculo do ícone e no gráfico de rosca).
 * Ficam aqui, num lugar só, para manter o visual consistente.
 */
export const CORES_CATEGORIA = {
  salario: '#22c55e',
  ajuda: '#14b8a6',
  venda: '#3b82f6',
  extra: '#a3e635',
  outro_entrada: '#10b981',
  fixa: '#8b5cf6',
  fatura: '#f43f5e',
  parcela: '#ec4899',
  gasto: '#f59e0b',
  encargo: '#ef4444',
  outro: '#64748b',
  desconto: '#60a5fa',
};

/** Círculo colorido com o ícone da categoria (como nos apps de banco). */
export function avatarCategoria(categoria) {
  const cor = CORES_CATEGORIA[categoria] || CORES_CATEGORIA.outro;
  return `<span class="avatar" style="--cor:${cor}">${icone(categoria)}</span>`;
}

/**
 * Avatar com a inicial do nome (para cartões). A cor sai do próprio nome,
 * então "Nubank" sempre fica com a mesma cor, sem escrever marcas no código.
 */
export function avatarInicial(nome) {
  const paleta = ['#8b5cf6', '#ef4444', '#3b82f6', '#f59e0b', '#14b8a6', '#ec4899'];
  let soma = 0;
  for (const ch of nome) soma += ch.charCodeAt(0);
  const cor = paleta[soma % paleta.length];
  const inicial = (nome.trim()[0] || '?').toUpperCase();
  return `<span class="avatar avatar-solido" style="--cor:${cor}">${inicial.replace(/[<>&"']/g, '')}</span>`;
}
