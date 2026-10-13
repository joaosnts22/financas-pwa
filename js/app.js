/**
 * app.js — Ponto de entrada. Controla o "estado" do app e a navegação entre abas.
 *
 * Fluxo:  dados (localStorage) -> projetar() -> tela atual desenha o HTML.
 * Sempre que algo muda, salvamos e redesenhamos tudo. Para um app deste
 * tamanho isso é rápido e muito mais simples do que atualizar pedacinhos.
 */
import { carregar, salvar, dadosExemplo, dadosVazios, lerArquivoJSON } from './dados.js';
import { projetar, mesesDisponiveis } from './calculos.js';
import { hojeISO, chaveMes } from './datas.js';
import { sincronizarLembretes } from './notificacoes.js';
import { telaPainel } from './ui/painel.js';
import { telaFluxo, ligarFluxo } from './ui/fluxo.js';
import { telaInvestimentos, ligarInvestimentos } from './ui/investimentos.js';
import { telaMais, ligarMais, abrirMenuRapido, modalAtualizarSaldo } from './ui/cadastros.js';
import { modalCompra } from './ui/compras.js';
import { avisar } from './ui/comum.js';
import { icone } from './ui/icones.js';

const CHAVE_OCULTAR = 'financas-pwa:ocultar';

const TELAS = {
  inicio: { titulo: 'Início', desenhar: telaPainel },
  fluxo: { titulo: 'Fluxo do mês', desenhar: telaFluxo, ligar: ligarFluxo },
  investir: { titulo: 'Investimentos', desenhar: telaInvestimentos, ligar: ligarInvestimentos },
  mais: { titulo: 'Mais', desenhar: telaMais, ligar: ligarMais },
};
// Nomes de abas de versões anteriores continuam funcionando
const APELIDOS = { painel: 'inicio', dados: 'mais', dividas: 'mais' };

const estado = {
  dados: carregar(),
  aba: APELIDOS[location.hash.slice(1)] || location.hash.slice(1) || 'inicio',
  mesFluxo: null, // mês exibido na aba Fluxo ("AAAA-MM")
  ocultar: localStorage.getItem(CHAVE_OCULTAR) === '1',
};

/** Objeto entregue às telas: dados atuais + funções para alterá-los. */
function contexto() {
  const hoje = hojeISO();
  const projecao = projetar(estado.dados, hoje);
  const meses = mesesDisponiveis(estado.dados, hoje);
  if (!meses.includes(estado.mesFluxo)) {
    estado.mesFluxo = meses.includes(chaveMes(hoje)) ? chaveMes(hoje) : meses[meses.length - 1];
  }
  return {
    dados: estado.dados,
    hoje,
    projecao,
    meses,
    mesFluxo: estado.mesFluxo,
    mudarMes(chave) { estado.mesFluxo = chave; desenhar(); },
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
  sincronizarLembretes(novos).catch(() => {});
}

function irPara(aba) {
  estado.aba = APELIDOS[aba] || aba;
  history.replaceState(null, '', '#' + estado.aba);
  desenhar();
  window.scrollTo(0, 0);
}

function desenhar() {
  const conteudo = document.getElementById('conteudo');
  const nav = document.getElementById('nav');
  document.body.classList.toggle('ocultar', estado.ocultar);
  document.getElementById('btn-olho').innerHTML = icone(estado.ocultar ? 'olhoFechado' : 'olho');

  if (!estado.dados) {
    nav.hidden = true;
    document.getElementById('titulo').textContent = 'Minhas Finanças';
    conteudo.replaceChildren(telaBoasVindas());
    return;
  }

  nav.hidden = false;
  if (!TELAS[estado.aba]) estado.aba = 'inicio';
  const tela = TELAS[estado.aba];
  document.getElementById('titulo').textContent = tela.titulo;
  nav.querySelectorAll('[data-aba]').forEach((b) =>
    b.setAttribute('aria-current', b.dataset.aba === estado.aba ? 'page' : 'false'));

  // Um elemento novo a cada desenho evita acumular "ouvintes" de clique repetidos
  const ctx = contexto();
  const div = document.createElement('div');
  div.className = 'tela';
  div.innerHTML = (estado.dados.exemplo && estado.aba === 'inicio'
    ? `<p class="alerta aviso">${icone('info')}<span>Dados de exemplo (fictícios). Importe os seus em <strong>Mais → Backup</strong>.</span></p>`
    : '') + tela.desenhar(ctx);
  tela.ligar?.(div, ctx);

  // Cliques que funcionam em qualquer aba
  div.addEventListener('click', (e) => {
    const link = e.target.closest('[data-ir]');
    if (link) { irPara(link.dataset.ir); return; }
    const compra = e.target.closest('[data-editar-compra]');
    if (compra) { modalCompra(ctx, ctx.dados.compras.find((c) => c.id === compra.dataset.editarCompra)); return; }
    if (e.target.closest('[data-acao-global="atualizar-saldo"]')) modalAtualizarSaldo(ctx);
  });
  conteudo.replaceChildren(div);
}

/** Primeira abertura: o app começa sem dados. */
function telaBoasVindas() {
  const div = document.createElement('div');
  div.className = 'tela boas-vindas';
  div.innerHTML = `
    <section class="hero">
      <p class="hero-rotulo">Bem-vindo</p>
      <p class="hero-valor" style="font-size:1.6rem">Seu dinheiro, com consciência.</p>
      <p class="hero-sub">Registre o que entra e o que sai, veja quanto pode gastar e acompanhe o que você guarda.
      Os dados ficam <strong>só neste aparelho</strong>.</p>
    </section>
    <label class="btn btn-primario btn-bloco">${icone('subir')}Importar meus dados (JSON)
      <input type="file" accept="application/json,.json" hidden></label>
    <button class="btn btn-bloco" data-inicio="exemplo">Ver com dados de exemplo</button>
    <button class="btn btn-bloco" data-inicio="vazio">Começar do zero</button>`;

  div.querySelector('[data-inicio=exemplo]').onclick = () => substituir(dadosExemplo());
  div.querySelector('[data-inicio=vazio]').onclick = () => { estado.aba = 'mais'; substituir(dadosVazios()); };
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

// Navegação inferior + botão "+" central
document.getElementById('nav').addEventListener('click', (e) => {
  if (e.target.closest('#btn-mais')) { abrirMenuRapido(contexto()); return; }
  const botao = e.target.closest('[data-aba]');
  if (botao) irPara(botao.dataset.aba);
});

// Olho: esconde/mostra os valores (útil para abrir o app em público)
document.getElementById('btn-olho').addEventListener('click', () => {
  estado.ocultar = !estado.ocultar;
  localStorage.setItem(CHAVE_OCULTAR, estado.ocultar ? '1' : '0');
  desenhar();
});

// Ícones da barra inferior
document.querySelectorAll('[data-icone]').forEach((el) => { el.innerHTML = icone(el.dataset.icone); });

// Ao voltar para o app (ou num outro dia), redesenha e confere os lembretes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  desenhar();
  if (estado.dados) sincronizarLembretes(estado.dados).catch(() => {});
});

desenhar();

// Service worker = o que faz o app funcionar offline, ser instalável e mostrar lembretes
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(() => { if (estado.dados) sincronizarLembretes(estado.dados).catch(() => {}); })
      .catch((e) => console.warn('Service worker não registrado:', e));
  });
}
