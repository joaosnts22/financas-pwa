/**
 * ui/icones.js — Ícones em SVG (estilo "linha") e cores das categorias.
 *
 * Por que SVG e não emoji? Emoji muda de aparência em cada celular.
 * SVG fica idêntico em todo lugar, usa a cor do texto (stroke="currentColor")
 * e não depende de internet nem de biblioteca.
 */

// Cada ícone é só o "miolo" do SVG (caminhos), numa grade de 24x24.
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
  ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  baixar: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  subir: '<path d="M12 15V4M7 9l5-5 5 5M4 20h16"/>',
  lixeira: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  atualizar: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  escudo: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3z"/>',
  sino: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  sacola: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  cofre: '<path d="M5 11a7 6 0 0 1 13-2h2v4l-2 1v3h-3v-2h-5v2H7v-3a6 6 0 0 1-2-3z"/><circle cx="15" cy="11" r=".6"/><path d="M10 6.5h4"/>',
  investir: '<path d="M3 20h18"/><path d="M6 16v-4M11 16V8M16 16v-6M21 5l-4 4-3-2-4 4"/>',
  escudoCheck: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  casa: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/>',
  entrada: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  saida: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  pata: '<circle cx="7" cy="10" r="1.6"/><circle cx="17" cy="10" r="1.6"/><circle cx="10" cy="6" r="1.6"/><circle cx="14" cy="6" r="1.6"/><path d="M12 12c-3 0-5 3.5-5 5.5 0 1.5 1.5 2 2.5 1.5S11 18 12 18s1.5.5 2.5 1 2.5 0 2.5-1.5c0-2-2-5.5-5-5.5z"/>',
  carrinho: '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2l2.4 11h11L21 7H6.2"/>',
  garfo: '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 0-3 2.5-3 6h3v12"/>',
  carro: '<path d="M5 16V11l2-5h10l2 5v5H5z"/><path d="M5 11h14"/><circle cx="8" cy="16" r="1.6"/><circle cx="16" cy="16" r="1.6"/>',
  saude: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  lazer: '<circle cx="12" cy="12" r="9"/><path d="M10 9l5 3-5 3V9z"/>',
  maleta: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12h18"/>',
  etiqueta: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  camadas: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  outro: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
};

/** Devolve o HTML de um ícone. Ex.: icone('olho') */
export function icone(nome, classe = '') {
  return `<svg class="ico ${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CAMINHOS[nome] || CAMINHOS.outro}</svg>`;
}

/**
 * Como as categorias agora são texto livre, escolhemos o ícone por
 * palavras-chave. Se nenhuma bater, usa um ícone genérico do tipo.
 */
const PALAVRAS = [
  [/fatura|cart[aã]o/i, 'cartao'],
  [/investimento|guardad|resgate|caixinha/i, 'cofre'],
  [/mercado|supermercado/i, 'carrinho'],
  [/aliment|comida|restaurante|lanche|ifood/i, 'garfo'],
  [/pet|ra[cç][aã]o|cachorro|gato|veterin/i, 'pata'],
  [/transporte|uber|combust|gasolina|carro|[ôo]nibus/i, 'carro'],
  [/sa[uú]de|farm[aá]cia|rem[eé]dio|m[eé]dic/i, 'saude'],
  [/lazer|jogo|cinema|show|m[uú]sica|guitarra/i, 'lazer'],
  [/sal[aá]rio|trabalho|emprego/i, 'maleta'],
  [/venda/i, 'etiqueta'],
  [/aluguel|casa|moradia|luz|internet|[aá]gua|g[aá]s|despesa fixa/i, 'casa'],
  [/parcela|apartamento|financiamento/i, 'camadas'],
  [/ajuda|presente/i, 'saude'],
  [/compra|roupa|gastos gerais/i, 'sacola'],
];

/** Cor estável a partir de um texto (a mesma categoria sempre tem a mesma cor). */
const PALETA = ['#8b5cf6', '#f43f5e', '#3b82f6', '#f59e0b', '#14b8a6', '#ec4899', '#22c55e', '#06b6d4', '#a855f7', '#f97316', '#84cc16', '#64748b'];
export function corDoTexto(texto) {
  let h = 0;
  for (const ch of String(texto).toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

/** Cores fixas para categorias "do sistema", para ficarem sempre iguais. */
const CORES_FIXAS = { 'Fatura de cartão': '#f43f5e', Investimento: '#22c55e' };
export function corCategoria(categoria) {
  return CORES_FIXAS[categoria] || corDoTexto(categoria);
}

/** Círculo colorido com o ícone da categoria. */
export function avatarCategoria(categoria, tipo = 'saida') {
  const nomeIcone = PALAVRAS.find(([re]) => re.test(categoria))?.[1] || (tipo === 'entrada' ? 'entrada' : 'saida');
  return `<span class="avatar" style="--cor:${corCategoria(categoria)}">${icone(nomeIcone)}</span>`;
}

/** Círculo com ícone escolhido e cor fixa (menus, investimentos). */
export function avatarIcone(nomeIcone, cor) {
  return `<span class="avatar" style="--cor:${cor}">${icone(nomeIcone)}</span>`;
}

/** Avatar com a inicial do nome (cartões). */
export function avatarInicial(nome) {
  const inicial = (nome.trim()[0] || '?').toUpperCase().replace(/[<>&"']/g, '');
  return `<span class="avatar avatar-solido" style="--cor:${corDoTexto(nome)}">${inicial}</span>`;
}
