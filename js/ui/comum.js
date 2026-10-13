/**
 * ui/comum.js — Peças reutilizadas por todas as telas.
 */
import { formatarBRL, formatarComSinal } from '../dinheiro.js';
import { formatarData, formatarDataCurta, criarData } from '../datas.js';
import { CATEGORIAS } from '../calculos.js';
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
 * Valor em R$ com classe de cor: negativo em vermelho, positivo em verde.
 * A classe "valor" também é usada pelo botão de olho para esconder os números.
 */
export function valorHTML(centavos, { sinal = false, neutro = false } = {}) {
  const classe = neutro ? '' : centavos < 0 ? 'negativo' : centavos > 0 ? 'positivo' : '';
  const texto = sinal ? formatarComSinal(centavos) : formatarBRL(centavos);
  return `<span class="valor ${classe}">${texto}</span>`;
}

/** Valor sem cor (ex.: totais neutros), mas ainda escondível. */
export function valorNeutro(centavos) {
  return `<span class="valor">${formatarBRL(centavos)}</span>`;
}

/** Formatadores entregues ao motor de cálculo (para textos de alerta). */
export const fmt = { valor: formatarBRL, data: formatarData };

const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** "2026-10-30" -> "Sexta, 30/10" (ou "Hoje" / "Amanhã") */
export function rotuloDia(iso, hoje) {
  const diff = Math.round((criarData(iso) - criarData(hoje)) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  return `${DIAS_LONGOS[criarData(iso).getUTCDay()]}, ${formatarDataCurta(iso)}`;
}

/**
 * Lista de lançamentos agrupada por dia (estilo "extrato" de banco).
 * @param grupos lista de { data, saldo, itens: [...] }
 */
export function listaExtrato(grupos, hoje, { mostrarSaldo = true } = {}) {
  if (!grupos.length) return '<p class="vazio">Nenhum lançamento no período.</p>';
  return grupos.map((g) => `
    <div class="extrato-dia">
      <div class="extrato-cabecalho">
        <span>${rotuloDia(g.data, hoje)}</span>
        ${mostrarSaldo ? `<span class="extrato-saldo">saldo ${valorHTML(g.saldo)}</span>` : ''}
      </div>
      <ul class="extrato">
        ${g.itens.map((it) => itemExtrato(it)).join('')}
      </ul>
    </div>`).join('');
}

/** Uma linha do extrato: ícone da categoria, nome, categoria e valor. */
export function itemExtrato(it) {
  const ehInfo = it.tipo === 'info';
  const categoria = ehInfo ? 'desconto' : it.categoria;
  const nomeCategoria = ehInfo ? 'Automático do banco' : (CATEGORIAS[it.categoria]?.nome || 'Outro');
  const valor = ehInfo
    ? `<span class="valor info">${formatarBRL(it.valor)}</span>`
    : valorHTML(it.tipo === 'entrada' ? it.valor : -it.valor, { sinal: true });
  return `
    <li class="extrato-item ${ehInfo ? 'item-info' : ''}">
      ${avatarCategoria(categoria)}
      <span class="extrato-texto">
        <strong>${esc(it.nome)}</strong>
        <small>${nomeCategoria}${it.cenario ? ' · <span class="selo">cenário</span>' : ''}</small>
      </span>
      ${valor}
    </li>`;
}

/** Cabeçalho de seção dentro de um cartão: título + botão opcional à direita. */
export function cabecalho(titulo, botao = '') {
  return `<div class="cartao-cabecalho"><h2>${titulo}</h2>${botao}</div>`;
}

/** Botão pequeno com ícone (ex.: "Editar"). */
export function botaoAcao(acao, texto, nomeIcone = 'editar', extra = '') {
  return `<button class="btn-texto" data-acao="${acao}" ${extra}>${icone(nomeIcone)}${texto}</button>`;
}

/** Mensagem rápida no rodapé ("Salvo!", "Importado!"...). */
export function avisar(texto) {
  const el = document.getElementById('toast');
  el.textContent = texto;
  el.classList.add('visivel');
  clearTimeout(avisar.timer);
  avisar.timer = setTimeout(() => el.classList.remove('visivel'), 2500);
}

/**
 * Abre uma janela (modal) com um formulário.
 * @param titulo   título da janela
 * @param corpo    HTML dos campos
 * @param aoSalvar função(form) — retorne false para manter aberta (ex.: erro)
 * @param aoMontar função(form) opcional — para ligar eventos nos campos
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
  // Tocar fora da janela (no fundo escuro) também fecha
  dialog.onclick = (e) => { if (e.target === dialog) dialog.close(); };
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

/** Pede confirmação simples. */
export function confirmar(texto) {
  return window.confirm(texto);
}
