/**
 * app.js — Ponto de entrada. Controla o "estado" do app e a navegação entre abas.
 *
 * Fluxo:  dados (localStorage) -> projetar() -> tela atual desenha o HTML.
 * Sempre que algo muda, salvamos e redesenhamos tudo. Para um app deste
 * tamanho isso é rápido e muito mais simples do que atualizar pedacinhos.
 */
import { carregar, salvar, dadosExemplo, dadosVazios, lerArquivoJSON } from './dados.js';
import { projetar } from './calculos.js';
import { hojeISO } from './datas.js';
import { telaPainel } from './ui/painel.js';
import { telaFluxo } from './ui/fluxo.js';
import { telaCadastros, ligarCadastros } from './ui/cadastros.js';
import { avisar } from './ui/comum.js';

const estado = {
  dados: carregar(),
  aba: location.hash.replace('#', '') || 'painel',
};

const TELAS = {
  painel: { titulo: 'Painel', desenhar: telaPainel },
  fluxo: { titulo: 'Fluxo de caixa', desenhar: telaFluxo },
  dados: { titulo: 'Dados', desenhar: telaCadastros, ligar: ligarCadastros },
};

/** Objeto entregue às telas: dados atuais + funções para alterá-los. */
function contexto() {
  return {
    dados: estado.dados,
    hoje: hojeISO(),
    projecao: projetar(estado.dados),
    // Copia profunda -> aplica mudança -> salva -> redesenha
    alterar(fn) {
      const copia = structuredClone(estado.dados);
      fn(copia);
      copia.exemplo = false; // editou? então não são mais "dados de exemplo"
      substituir(copia);
    },
    substituir,
  };
}

function substituir(novos) {
  estado.dados = novos;
  salvar(novos);
  desenhar();
}

function desenhar() {
  const conteudo = document.getElementById('conteudo');
  const nav = document.getElementById('nav');

  if (!estado.dados) {
    nav.hidden = true;
    conteudo.replaceChildren(telaBoasVindas());
    return;
  }

  nav.hidden = false;
  if (!TELAS[estado.aba]) estado.aba = 'painel';
  const tela = TELAS[estado.aba];
  document.getElementById('titulo').textContent = tela.titulo;
  nav.querySelectorAll('button').forEach((b) =>
    b.setAttribute('aria-current', b.dataset.aba === estado.aba ? 'page' : 'false'));

  // Um elemento novo a cada desenho evita acumular "ouvintes" de clique repetidos
  const ctx = contexto();
  const div = document.createElement('div');
  div.className = 'tela';
  div.innerHTML = (estado.dados.exemplo && estado.aba !== 'dados'
    ? '<p class="alerta aviso">📋 Dados de exemplo (fictícios). Vá em <strong>Dados</strong> para importar os seus.</p>'
    : '') + tela.desenhar(ctx);
  tela.ligar?.(div, ctx);
  conteudo.replaceChildren(div);
}

/** Primeira abertura: o app começa sem dados. */
function telaBoasVindas() {
  const div = document.createElement('div');
  div.className = 'tela boas-vindas';
  div.innerHTML = `
    <section class="cartao destaque">
      <h2>Bem-vindo! 👋</h2>
      <p>Este app projeta seu saldo dia a dia e mostra quando a conta aperta.
      Seus dados ficam <strong>só neste aparelho</strong>.</p>
    </section>
    <label class="btn btn-primario btn-bloco">⬆ Importar meus dados (JSON)
      <input type="file" accept="application/json,.json" hidden></label>
    <button class="btn btn-bloco" data-inicio="exemplo">Ver com dados de exemplo</button>
    <button class="btn btn-bloco" data-inicio="vazio">Começar do zero</button>`;

  div.querySelector('[data-inicio=exemplo]').onclick = () => substituir(dadosExemplo());
  div.querySelector('[data-inicio=vazio]').onclick = () => { estado.aba = 'dados'; substituir(dadosVazios()); };
  div.querySelector('input[type=file]').onchange = async (e) => {
    try {
      substituir(await lerArquivoJSON(e.target.files[0]));
      avisar('Dados importados!');
    } catch (erro) {
      alert('Não consegui importar: ' + erro.message);
    }
  };
  return div;
}

// Navegação inferior
document.getElementById('nav').addEventListener('click', (e) => {
  const botao = e.target.closest('button[data-aba]');
  if (!botao) return;
  estado.aba = botao.dataset.aba;
  history.replaceState(null, '', '#' + estado.aba);
  desenhar();
  window.scrollTo(0, 0);
});

// Ao voltar para o app num outro dia, "hoje" muda: redesenha
document.addEventListener('visibilitychange', () => { if (!document.hidden) desenhar(); });

desenhar();

// Service worker = o que faz o app funcionar offline e ser instalável
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker não registrado:', e));
  });
}
