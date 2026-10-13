/**
 * ui/comum.js — Peças reutilizadas por todas as telas.
 */
import { formatarBRL, formatarComSinal, centavosParaTexto, paraCentavos } from '../dinheiro.js';
import { formatarData, formatarDataCurta, criarData, nomeMesCurto } from '../datas.js';
import { icone, avatarCategoria } from './icones.js';

/**
 * Escapa texto digitado pelo usuário antes de colocar no HTML.
 * Sem isso, um nome como "<b>teste" viraria HTML de verdade (falha de segurança
 * conhecida como XSS). Regra de ouro: TODO texto do usuário passa por aqui.
 */
export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

/**
 * Valor em R$ com cor: negativo em vermelho, positivo em verde.
 * A classe "valor" também é usada pelo botão de olho para esconder os números.
 */
export function valorHTML(centavos, { sinal = false, neutro = false } = {}) {
  const classe = neutro ? '' : centavos < 0 ? 'negativo' : centavos > 0 ? 'positivo' : '';
  const t = sinal ? formatarComSinal(centavos) : formatarBRL(centavos);
  return `<span class="valor ${classe}">${t}</span>`;
}

/** Valor sem cor, mas ainda escondível pelo olho. */
export function valorNeutro(centavos) {
  return `<span class="valor">${formatarBRL(centavos)}</span>`;
}

/** Formatadores entregues ao motor de cálculo (para textos de alerta). */
export const fmt = { valor: formatarBRL, data: formatarData, mes: nomeMesCurto };

const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** "2026-10-30" -> "Sexta, 30/10" (ou "Hoje", "Amanhã", "Ontem") */
export function rotuloDia(iso, hoje) {
  const diff = Math.round((criarData(iso) - criarData(hoje)) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  return `${DIAS_LONGOS[criarData(iso).getUTCDay()]}, ${formatarDataCurta(iso)}`;
}

/** Agrupa lançamentos por dia: [{ data, itens: [...] }] */
export function agruparPorDia(lancamentos) {
  const grupos = [];
  for (const l of lancamentos) {
    let g = grupos[grupos.length - 1];
    if (!g || g.data !== l.data) grupos.push(g = { data: l.data, itens: [] });
    g.itens.push(l);
  }
  return grupos;
}

/**
 * Lista de lançamentos agrupada por dia (estilo "extrato" de banco).
 * @param saldoDoDia função(data) -> saldo ao fim do dia, ou null para não mostrar
 */
export function listaExtrato(grupos, hoje, saldoDoDia = () => null) {
  if (!grupos.length) return '<p class="vazio">Nenhum lançamento no período.</p>';
  return grupos.map((g) => {
    const saldo = saldoDoDia(g.data);
    return `
    <div class="extrato-dia">
      <div class="extrato-cabecalho">
        <span>${rotuloDia(g.data, hoje)}</span>
        ${saldo !== null ? `<span class="extrato-saldo">saldo ${valorHTML(saldo)}</span>` : ''}
      </div>
      <ul class="extrato">${g.itens.map(itemExtrato).join('')}</ul>
    </div>`;
  }).join('');
}

/** Uma linha do extrato. Compras são clicáveis (para editar/excluir). */
export function itemExtrato(l) {
  const sinal = l.tipo === 'entrada' ? l.valor : -l.valor;
  const detalhe = [esc(l.categoria), l.cartao ? `no cartão ${esc(l.cartao)}` : ''].filter(Boolean).join(' · ');
  // Compra no cartão: valor em cinza (não sai da conta agora)
  const valor = l.afetaConta ? valorHTML(sinal, { sinal: true }) : `<span class="valor apagado">${formatarComSinal(sinal)}</span>`;
  const conteudo = `
      ${avatarCategoria(l.categoria, l.tipo)}
      <span class="extrato-texto"><strong>${esc(l.nome)}</strong><small>${detalhe}</small></span>
      ${valor}`;
  if (l.fonte === 'compra') {
    return `<li><button class="extrato-item item-clicavel" data-editar-compra="${l.id}">${conteudo}</button></li>`;
  }
  return `<li class="extrato-item">${conteudo}</li>`;
}

/** Cabeçalho de seção dentro de um cartão: título + botão opcional à direita. */
export function cabecalho(titulo, botao = '') {
  return `<div class="cartao-cabecalho"><h2>${titulo}</h2>${botao}</div>`;
}

/** Botão pequeno com ícone (ex.: "Editar"). */
export function botaoAcao(acao, textoBotao, nomeIcone = 'editar', extra = '') {
  return `<button class="btn-texto" data-acao="${acao}" ${extra}>${icone(nomeIcone)}${textoBotao}</button>`;
}

/** Barra de progresso. nivel: 'ok' | 'aviso' | 'perigo' | 'destaque' */
export function barra(pct, nivel = 'destaque', fina = false) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return `<div class="barra ${fina ? 'fina' : ''}" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100">
    <div class="barra-preenchida ${nivel}" style="width:${p}%"></div></div>`;
}

const ICONE_NIVEL = { perigo: 'perigo', aviso: 'alerta', info: 'info', ok: 'ok' };

/** Lista de avisos coloridos (alertas do painel, avisos da compra). */
export function listaAvisos(avisos) {
  if (!avisos.length) return '';
  return `<ul class="alertas">${avisos.map((a) =>
    `<li class="alerta ${a.nivel}">${icone(ICONE_NIVEL[a.nivel])}<span>${esc(a.texto)}</span></li>`).join('')}</ul>`;
}

// ---------- Campos de formulário ----------

export const campoValor = (nome, rotulo, centavos, dica = '') => `
  <label>${rotulo}
    <input name="${nome}" inputmode="decimal" autocomplete="off" value="${centavos ? centavosParaTexto(centavos) : ''}" placeholder="0,00">
    ${dica ? `<small>${dica}</small>` : ''}
  </label>`;

/** Lê um campo de valor em R$ e devolve centavos (ou lança erro). */
export function lerValor(form, nome, rotulo, { permitirNegativo = false, permitirZero = true } = {}) {
  const c = paraCentavos(form.elements[nome].value);
  if (c === null) throw new Error(`Valor inválido em "${rotulo}".`);
  if (!permitirNegativo && c < 0) throw new Error(`"${rotulo}" não pode ser negativo.`);
  if (!permitirZero && c === 0) throw new Error(`Informe um valor em "${rotulo}".`);
  return c;
}

// ---------- Avisos, modal e confirmação ----------

/** Mensagem rápida no rodapé ("Salvo!", "Importado!"...). */
export function avisar(mensagem) {
  const el = document.getElementById('toast');
  el.textContent = mensagem;
  el.classList.add('visivel');
  clearTimeout(avisar.timer);
  avisar.timer = setTimeout(() => el.classList.remove('visivel'), 2500);
}

/**
 * Abre uma janela (modal) com um formulário.
 * @param aoSalvar  função(form) — lance erro para mostrar mensagem e manter aberta
 * @param aoMontar  função(form) opcional — para ligar eventos nos campos
 * @param semRodape true = sem botões Cancelar/Salvar (ex.: menu de ações)
 */
export function abrirModal({ titulo, corpo, aoSalvar, aoMontar, textoSalvar = 'Salvar', semRodape = false }) {
  const dialog = document.getElementById('modal');
  dialog.innerHTML = `
    <form method="dialog" class="modal-form" novalidate>
      <div class="modal-alca" aria-hidden="true"></div>
      <header class="modal-topo">
        <h2>${esc(titulo)}</h2>
        <button type="button" class="btn-icone" data-fechar aria-label="Fechar">✕</button>
      </header>
      <div class="modal-corpo">${corpo}</div>
      <p class="erro" hidden></p>
      ${semRodape ? '' : `
      <footer class="modal-rodape">
        <button type="button" class="btn" data-fechar>Cancelar</button>
        <button type="submit" class="btn btn-primario">${esc(textoSalvar)}</button>
      </footer>`}
    </form>`;
  const form = dialog.querySelector('form');
  form.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => dialog.close()));
  dialog.onclick = (e) => { if (e.target === dialog) dialog.close(); }; // tocar fora fecha
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const erro = form.querySelector('.erro');
    try {
      if (!aoSalvar || aoSalvar(form) !== false) dialog.close();
    } catch (err) {
      erro.textContent = err.message;
      erro.hidden = false;
    }
  });
  if (aoMontar) aoMontar(form);
  dialog.showModal();
}

export function fecharModal() {
  document.getElementById('modal').close();
}

export function confirmar(mensagem) {
  return window.confirm(mensagem);
}
