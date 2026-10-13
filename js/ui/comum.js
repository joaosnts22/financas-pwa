/**
 * ui/comum.js — Peças reutilizadas por todas as telas.
 */
import { formatarBRL, formatarComSinal } from '../dinheiro.js';
import { formatarData } from '../datas.js';

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

/** Valor em R$ com classe de cor: negativo em vermelho, positivo em verde. */
export function valorHTML(centavos, { sinal = false, neutro = false } = {}) {
  const classe = neutro ? '' : centavos < 0 ? 'negativo' : centavos > 0 ? 'positivo' : '';
  const texto = sinal ? formatarComSinal(centavos) : formatarBRL(centavos);
  return `<span class="valor ${classe}">${texto}</span>`;
}

/** Formatadores entregues ao motor de cálculo (para textos de alerta). */
export const fmt = { valor: formatarBRL, data: formatarData };

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
 */
export function abrirModal({ titulo, corpo, aoSalvar, aoMontar, textoSalvar = 'Salvar' }) {
  const dialog = document.getElementById('modal');
  dialog.innerHTML = `
    <form method="dialog" class="modal-form" novalidate>
      <header class="modal-topo">
        <h2>${esc(titulo)}</h2>
        <button type="button" class="btn-icone" data-fechar aria-label="Fechar">✕</button>
      </header>
      <div class="modal-corpo">${corpo}</div>
      <p class="erro" hidden></p>
      <footer class="modal-rodape">
        <button type="button" class="btn" data-fechar>Cancelar</button>
        <button type="submit" class="btn btn-primario">${esc(textoSalvar)}</button>
      </footer>
    </form>`;
  const form = dialog.querySelector('form');
  form.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => dialog.close()));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const erro = form.querySelector('.erro');
    try {
      if (aoSalvar(form) !== false) dialog.close();
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
