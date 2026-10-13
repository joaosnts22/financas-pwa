/**
 * ui/cadastros.js — Aba "Mais": conta, entradas, saídas fixas, cartões,
 * orçamento e metas, lembretes e backup. Também o menu do botão "+".
 *
 * Padrão: telaMais() devolve o HTML e ligarMais() conecta os botões.
 * Toda alteração passa por ctx.alterar(fn), que copia os dados, aplica a
 * mudança, salva no aparelho e redesenha a tela.
 */
import { CATEGORIAS_SAIDA } from '../calculos.js';
import { centavosParaTexto, paraCentavos, paraNumero, numeroParaTexto } from '../dinheiro.js';
import { formatarData, nomeMes, hojeISO } from '../datas.js';
import { novoId, exportarJSON, lerArquivoJSON, dadosExemplo, dadosVazios, desfazerAjuste } from '../dados.js';
import {
  esc, abrirModal, avisar, confirmar, fecharModal, valorNeutro, valorHTML, cabecalho, botaoAcao,
  campoValor, lerValor,
} from './comum.js';
import { icone, avatarCategoria, avatarInicial, avatarIcone } from './icones.js';
import { modalCompra } from './compras.js';
import { modalMovimento } from './investimentos.js';
import {
  ativarNotificacoes, notificacaoTeste, exportarCalendario, permissaoAtual, sincronizarLembretes,
} from '../notificacoes.js';

const RECORRENCIAS = {
  unica: 'Uma vez (data fixa)',
  mensal: 'Todo mês (dia fixo)',
  ultimoDiaUtil: 'Todo mês (último dia útil)',
};

// ================================================================== Tela "Mais"

export function telaMais({ dados }) {
  const { conta, config } = dados;
  const entradas = dados.eventos.filter((e) => e.tipo === 'entrada');
  const saidas = dados.eventos.filter((e) => e.tipo === 'saida');
  const permissao = permissaoAtual();

  return `
    ${dados.exemplo ? `<p class="alerta aviso">${icone('info')}<span>Você está vendo <strong>dados de exemplo</strong>. Importe seu JSON em <em>Backup</em>, no fim desta tela.</span></p>` : ''}

    <button class="cartao atalho" data-ir="dividas">
      ${avatarIcone('cartao', '#f43f5e')}
      <span class="extrato-texto"><strong>Dívidas</strong><small>Quanto falta, quando termina e "Paguei" das faturas</small></span>
      ${icone('direita')}
    </button>

    <button class="cartao atalho" data-ir="simular">
      ${avatarIcone('fluxo', '#a855f7')}
      <span class="extrato-texto"><strong>Simulador</strong><small>E se eu comprar, cortar, parcelar ou juntar para uma meta?</small></span>
      ${icone('direita')}
    </button>

    <section class="cartao">
      ${cabecalho('Conta', botaoAcao('atualizar-saldo', 'Atualizar', 'atualizar'))}
      <div class="linha-valores">
        <span><small>Saldo informado</small>${valorHTML(conta.saldoInicial)}</span>
        <span class="direita"><small>Em</small>${formatarData(conta.dataSaldo)}</span>
      </div>
      <p class="dica">Confira o saldo no app do banco de vez em quando e atualize aqui. A projeção recomeça a partir dele.</p>
    </section>

    ${secaoEventos('Entradas', entradas, 'entrada')}
    ${secaoEventos('Saídas fixas', saidas, 'saida')}

    <section class="cartao">
      ${cabecalho('Cartões de crédito', botaoAcao('novo-cartao', 'Adicionar', 'mais'))}
      ${dados.cartoes.length ? dados.cartoes.map(blocoCartao).join('') : '<p class="vazio">Nenhum cartão.</p>'}
    </section>

    <section class="cartao">
      ${cabecalho('Orçamento e metas', botaoAcao('editar-config', 'Editar'))}
      <ul class="lista-simples">
        <li><span>Meta de guardar por mês</span><span>${numeroParaTexto(config.metaGuardarPct)}% da renda</span></li>
        <li><span>CDI usado nos cálculos</span><span>${numeroParaTexto(config.cdiAnual)}% ao ano</span></li>
        <li><span>Projetar o saldo por</span><span>${config.mesesAFrente} meses</span></li>
      </ul>
    </section>

    <section class="cartao">
      ${cabecalho('Lembretes de contas')}
      <label class="check"><input type="checkbox" data-acao="lembretes" ${config.lembretes && permissao === 'granted' ? 'checked' : ''}>
        Notificar contas a pagar</label>
      <label class="linha-campo">Avisar com antecedência de
        <select data-acao="dias-antes">${[0, 1, 2, 3, 5, 7].map((n) => `<option value="${n}" ${n === config.diasAntes ? 'selected' : ''}>${n === 0 ? 'só no dia' : `${n} dia(s)`}</option>`).join('')}</select>
      </label>
      <p class="dica">${permissao === 'denied' ? '⚠️ As notificações estão bloqueadas no navegador. Libere nas configurações do celular. ' : ''}
        O aviso aparece quando você abre o app (e, no Android, às vezes em segundo plano). Para lembrete garantido, adicione as contas ao calendário do celular:</p>
      <button class="btn btn-bloco" data-acao="calendario">${icone('calendario')}Adicionar lembretes ao calendário</button>
    </section>

    <section class="cartao">
      ${cabecalho('Backup')}
      <p class="dica">${icone('escudo')}Seus dados ficam <strong>só neste aparelho</strong>. Exporte um backup com frequência e guarde fora do GitHub.</p>
      <div class="botoes">
        <button class="btn btn-primario" data-acao="exportar">${icone('baixar')}Exportar</button>
        <label class="btn">${icone('subir')}Importar<input type="file" accept="application/json,.json" data-acao="importar" hidden></label>
      </div>
      <div class="botoes">
        <button class="btn" data-acao="exemplo">Carregar exemplo</button>
        <button class="btn btn-perigo" data-acao="zerar">${icone('lixeira')}Apagar tudo</button>
      </div>
    </section>
  `;
}

function secaoEventos(titulo, lista, tipo) {
  return `
    <section class="cartao">
      ${cabecalho(titulo, botaoAcao('novo-evento', 'Adicionar', 'mais', `data-tipo="${tipo}"`))}
      ${lista.length ? `<ul class="extrato">
        ${lista.map((e) => `
          <li class="${e.ativo ? '' : 'inativo'}">
            <button class="extrato-item item-clicavel" data-acao="editar-evento" data-id="${e.id}">
              ${avatarCategoria(e.categoria, tipo)}
              <span class="extrato-texto">
                <strong>${esc(e.nome)}</strong>
                <small>${esc(e.categoria)} · ${descreverRecorrencia(e)}${e.ativo ? '' : ' · <span class="selo cinza">desligado</span>'}</small>
              </span>
              ${valorHTML(tipo === 'entrada' ? e.valor : -e.valor)}
            </button>
          </li>`).join('')}
      </ul>` : '<p class="vazio">Nada cadastrado.</p>'}
    </section>`;
}

function descreverRecorrencia(e) {
  const periodo = `desde ${nomeMes(e.inicio)}${e.fim ? ` até ${nomeMes(e.fim)}` : ''}`;
  if (e.recorrencia === 'unica') return `em ${formatarData(e.data)}`;
  if (e.recorrencia === 'mensal') return `todo dia ${e.dia}, ${periodo}`;
  return `último dia útil, ${periodo}`;
}

function blocoCartao(c) {
  const abertas = c.faturas.filter((f) => !f.paga);
  const p = c.parcelamento;
  return `
    <div class="sub-cartao">
      <div class="cartao-cabecalho">
        <div class="titulo-com-avatar">${avatarInicial(c.nome)}<span><h3>${esc(c.nome)}</h3>
          <small class="secundario">${abertas.length} fatura(s) em aberto</small></span></div>
        ${botaoAcao('editar-cartao', 'Editar', 'editar', `data-id="${c.id}"`)}
      </div>
      <ul class="lista-faturas">
        ${c.faturas.map((f) => `
          <li class="${f.paga ? 'paga' : ''}">
            <span>${formatarData(f.vencimento)}</span>
            <span class="chip ${f.paga ? 'ok' : 'neutro'}">${f.paga ? 'paga' : 'aberta'}</span>
            ${f.paga ? valorNeutro(f.valor) : valorHTML(-f.valor)}
          </li>`).join('') || '<li class="vazio">Nenhuma fatura cadastrada</li>'}
      </ul>
      ${p ? `
        <div class="parcelamento">
          <div class="grade-3">
            <span><small>Parcelas pagas</small>${p.pagas} de ${p.parcelas}</span>
            <span><small>Valor da parcela</small>${valorNeutro(p.valor)}</span>
            <span><small>Juros totais</small>${valorNeutro(p.jurosTotais)}</span>
          </div>
          <p class="dica">As parcelas já estão dentro das faturas acima.</p>
        </div>` : ''}
    </div>`;
}

// ================================================================== Cliques

export function ligarMais(raiz, ctx) {
  raiz.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-acao]');
    if (!alvo || alvo.tagName === 'INPUT' || alvo.tagName === 'SELECT') return;
    const acoes = {
      'atualizar-saldo': () => modalAtualizarSaldo(ctx),
      'novo-evento': () => modalEvento(ctx, null, alvo.dataset.tipo),
      'editar-evento': () => modalEvento(ctx, ctx.dados.eventos.find((x) => x.id === alvo.dataset.id)),
      'novo-cartao': () => modalCartao(ctx, null),
      'editar-cartao': () => modalCartao(ctx, ctx.dados.cartoes.find((x) => x.id === alvo.dataset.id)),
      'editar-config': () => modalConfig(ctx),
      calendario: () => {
        const n = exportarCalendario(ctx.dados);
        avisar(n ? `${n} lembrete(s) exportado(s). Abra o arquivo para adicionar ao calendário.` : 'Nenhuma conta futura para exportar.');
      },
      exportar: () => { exportarJSON(ctx.dados); avisar('Backup exportado.'); },
      exemplo: () => {
        if (confirmar('Substituir os dados atuais pelos dados de EXEMPLO? (exporte um backup antes)')) {
          ctx.substituir(dadosExemplo()); avisar('Exemplo carregado.');
        }
      },
      zerar: () => {
        if (confirmar('Apagar TODOS os dados deste aparelho? Isso não tem volta.')) {
          ctx.substituir(dadosVazios()); avisar('Dados apagados.');
        }
      },
    };
    acoes[alvo.dataset.acao]?.();
  });

  raiz.addEventListener('change', async (e) => {
    const acao = e.target.dataset.acao;
    if (acao === 'dias-antes') {
      ctx.alterar((d) => { d.config.diasAntes = Number(e.target.value); });
      return;
    }
    if (acao === 'lembretes') {
      const ligar = e.target.checked;
      try {
        if (ligar) await ativarNotificacoes();
        ctx.alterar((d) => { d.config.lembretes = ligar; });
        if (ligar) { await notificacaoTeste(); await sincronizarLembretes({ ...ctx.dados, config: { ...ctx.dados.config, lembretes: true } }); }
        avisar(ligar ? 'Lembretes ativados.' : 'Lembretes desligados.');
      } catch (erro) {
        e.target.checked = false;
        alert(erro.message);
      }
      return;
    }
    if (acao !== 'importar' || !e.target.files[0]) return;
    try {
      const dados = await lerArquivoJSON(e.target.files[0]);
      if (confirmar('Importar este arquivo vai SUBSTITUIR os dados atuais. Continuar?')) {
        ctx.substituir(dados);
        avisar('Dados importados!');
      }
    } catch (erro) {
      alert('Não consegui importar: ' + erro.message);
    }
    e.target.value = '';
  });
}

/** Menu do botão "+" central. */
export function abrirMenuRapido(ctx) {
  const opcoes = [
    ['compra', 'sacola', '#f59e0b', 'Registrar compra', 'O app avisa se cabe no orçamento'],
    ['guardar', 'cofre', '#22c55e', 'Guardar dinheiro', 'Colocar na caixinha ou investimento'],
    ['entrada', 'setaCima', '#14b8a6', 'Nova entrada', 'Salário, venda, ajuda...'],
    ['saida', 'setaBaixo', '#f43f5e', 'Nova saída fixa', 'Aluguel, contas, parcelas...'],
    ['simular', 'fluxo', '#a855f7', 'Simular cenário', 'E se eu comprar, cortar, parcelar...?'],
    ['saldo', 'atualizar', '#6ea8ff', 'Atualizar saldo da conta', 'Conferiu no app do banco? Ajuste aqui.'],
  ];
  abrirModal({
    titulo: 'O que você quer fazer?',
    semRodape: true,
    corpo: `<div class="menu-rapido">${opcoes.map(([id, ic, cor, titulo, sub]) => `
      <button type="button" data-rapido="${id}">${avatarIcone(ic, cor)}<span><strong>${titulo}</strong><small>${sub}</small></span></button>`).join('')}</div>`,
    aoMontar: (f) => {
      f.querySelector('.menu-rapido').addEventListener('click', (e) => {
        const b = e.target.closest('[data-rapido]');
        if (!b) return;
        fecharModal();
        const acoes = {
          compra: () => modalCompra(ctx),
          guardar: () => modalMovimento(ctx, 'aporte'),
          entrada: () => modalEvento(ctx, null, 'entrada'),
          saida: () => modalEvento(ctx, null, 'saida'),
          saldo: () => modalAtualizarSaldo(ctx),
          simular: () => ctx.irPara('simular'),
        };
        acoes[b.dataset.rapido]();
      });
    },
  });
}

// ================================================================== Formulários

export function modalAtualizarSaldo(ctx) {
  abrirModal({
    titulo: 'Saldo da conta hoje',
    corpo: `
      <p class="dica">Digite o saldo que aparece AGORA no app do banco (com sinal de menos se estiver negativo).
      Lançamentos com data até hoje passam a ser considerados já incluídos nesse saldo.</p>
      ${campoValor('saldo', 'Saldo atual (R$)', ctx.dados.conta.saldoInicial)}`,
    aoSalvar: (f) => {
      const saldo = lerValor(f, 'saldo', 'Saldo', { permitirNegativo: true });
      ctx.alterar((d) => {
        d.conta.saldoInicial = saldo;
        d.conta.dataSaldo = hojeISO();
        d.conta.atualizadoEm = Date.now();
      });
      avisar('Saldo atualizado.');
    },
  });
}

/**
 * Formulário de entrada/saída.
 * @param inicial valores iniciais opcionais para um item novo (ex.: { categoria: 'Parcela' })
 */
export function modalEvento(ctx, evento, tipoNovo, inicial = {}) {
  const tipo = evento ? evento.tipo : tipoNovo;
  const ev = evento || {
    nome: '', tipo, categoria: tipo === 'entrada' ? '' : 'Despesa fixa', valor: 0,
    recorrencia: tipo === 'entrada' ? 'unica' : 'mensal', data: hojeISO(), dia: 5, inicio: hojeISO().slice(0, 7), fim: '', ativo: true,
    ...inicial,
  };
  const ehEntrada = tipo === 'entrada';
  // Entradas: categoria livre (com sugestões do que você já usou). Saídas: lista.
  const usadas = [...new Set(ctx.dados.eventos.filter((e) => e.tipo === 'entrada').map((e) => e.categoria))];
  const campoCategoria = ehEntrada
    ? `<label>Categoria<input name="categoria" list="cat-entradas" value="${esc(ev.categoria)}" placeholder="Ex.: Trabalho, Venda, Freela" autocomplete="off">
        <datalist id="cat-entradas">${usadas.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>`
    : `<label>Categoria<select name="categoria">${[...new Set([...CATEGORIAS_SAIDA, ev.categoria])].map((c) =>
        `<option ${c === ev.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>`;

  abrirModal({
    titulo: evento ? `Editar ${ehEntrada ? 'entrada' : 'saída'}` : `Nova ${ehEntrada ? 'entrada' : 'saída fixa'}`,
    corpo: `
      <label>Nome<input name="nome" value="${esc(ev.nome)}" placeholder="${ehEntrada ? 'Ex.: Salário' : 'Ex.: Aluguel'}"></label>
      ${campoCategoria}
      ${campoValor('valor', 'Valor (R$)', ev.valor)}
      <label>Repetição<select name="recorrencia">
        ${Object.entries(RECORRENCIAS).map(([k, t]) => `<option value="${k}" ${k === ev.recorrencia ? 'selected' : ''}>${t}</option>`).join('')}
      </select></label>
      <label data-mostrar="unica">Data<input type="date" name="data" value="${ev.data}"></label>
      <label data-mostrar="mensal">Dia do mês<input type="number" name="dia" min="1" max="31" value="${ev.dia}">
        <small>Dia 31 em mês de 30 dias vira dia 30 automaticamente.</small></label>
      <div class="duas-colunas" data-mostrar="mensal ultimoDiaUtil">
        <label>A partir de<input type="month" name="inicio" value="${ev.inicio}" placeholder="AAAA-MM"></label>
        <label>Até (opcional)<input type="month" name="fim" value="${ev.fim}" placeholder="AAAA-MM"></label>
      </div>
      <label class="check"><input type="checkbox" name="ativo" ${ev.ativo ? 'checked' : ''}> Ativo (entra nos cálculos)</label>
      ${evento ? `<button type="button" class="btn btn-perigo btn-bloco" data-excluir>${icone('lixeira')}Excluir</button>` : ''}`,
    aoMontar: (f) => {
      const atualizarCampos = () => {
        const r = f.elements.recorrencia.value;
        f.querySelectorAll('[data-mostrar]').forEach((el) => { el.hidden = !el.dataset.mostrar.split(' ').includes(r); });
      };
      f.elements.recorrencia.addEventListener('change', atualizarCampos);
      atualizarCampos();
      f.querySelector('[data-excluir]')?.addEventListener('click', () => {
        if (!confirmar(`Excluir "${ev.nome}"?`)) return;
        ctx.alterar((d) => { d.eventos = d.eventos.filter((x) => x.id !== ev.id); });
        fecharModal();
        avisar('Excluído.');
      });
    },
    aoSalvar: (f) => {
      const nome = f.elements.nome.value.trim();
      if (!nome) throw new Error('Dê um nome.');
      const categoria = f.elements.categoria.value.trim();
      if (!categoria) throw new Error('Escreva uma categoria.');
      const valor = lerValor(f, 'valor', 'Valor');
      const recorrencia = f.elements.recorrencia.value;
      const inicio = f.elements.inicio.value;
      const fim = f.elements.fim.value;
      if (recorrencia === 'unica' && !f.elements.data.value) throw new Error('Informe a data.');
      if (recorrencia !== 'unica' && !/^\d{4}-\d{2}$/.test(inicio)) throw new Error('Informe o mês inicial (AAAA-MM).');
      if (fim && !/^\d{4}-\d{2}$/.test(fim)) throw new Error('Mês final inválido (use AAAA-MM).');
      if (fim && fim < inicio) throw new Error('O mês final precisa ser depois do mês inicial.');
      const novo = {
        id: ev.id || novoId(), nome, tipo, categoria, valor, recorrencia,
        data: f.elements.data.value || ev.data,
        dia: Math.min(31, Math.max(1, parseInt(f.elements.dia.value, 10) || 1)),
        inicio: inicio || ev.inicio, fim, ativo: f.elements.ativo.checked,
      };
      ctx.alterar((d) => {
        const i = d.eventos.findIndex((x) => x.id === novo.id);
        if (i >= 0) d.eventos[i] = novo; else d.eventos.push(novo);
      });
      avisar('Salvo.');
    },
  });
}

function linhaFatura(f = { id: novoId(), vencimento: '', valor: 0, paga: false }) {
  return `
    <div class="linha-fatura" data-id="${f.id}">
      <input type="date" name="venc" value="${f.vencimento}" aria-label="Data de pagamento">
      <input name="valorFat" inputmode="decimal" value="${centavosParaTexto(f.valor)}" aria-label="Valor">
      <label class="check mini"><input type="checkbox" name="paga" ${f.paga ? 'checked' : ''}> paga</label>
      <button type="button" class="btn-icone" data-remover aria-label="Remover fatura">✕</button>
    </div>`;
}

export function modalCartao(ctx, cartao) {
  const c = cartao || { id: novoId(), nome: '', faturas: [], parcelamento: null };
  const p = c.parcelamento || { parcelas: 0, valor: 0, pagas: 0, jurosTotais: 0 };
  abrirModal({
    titulo: cartao ? `Editar ${c.nome}` : 'Novo cartão',
    corpo: `
      <label>Nome do cartão<input name="nome" value="${esc(c.nome)}" placeholder="Ex.: Nubank"></label>
      <h3>Faturas (data em que você vai pagar)</h3>
      <p class="dica">Para registrar um pagamento, prefira o botão "Paguei" na tela Dívidas: ele também atualiza o saldo da conta.</p>
      <div class="faturas">${c.faturas.map(linhaFatura).join('')}</div>
      <button type="button" class="btn btn-pequeno" data-add-fatura>+ Fatura</button>
      <h3>Parcelamento de fatura (informativo)</h3>
      <p class="dica">As parcelas já estão dentro dos valores das faturas acima; aqui é só para acompanhar.</p>
      <div class="duas-colunas">
        <label>Nº de parcelas<input type="number" name="parcelas" min="0" value="${p.parcelas}"></label>
        <label>Já pagas<input type="number" name="pagas" min="0" value="${p.pagas}"></label>
      </div>
      <div class="duas-colunas">
        ${campoValor('valorParcela', 'Valor da parcela', p.valor)}
        ${campoValor('juros', 'Juros totais', p.jurosTotais)}
      </div>
      ${cartao ? `<button type="button" class="btn btn-perigo btn-bloco" data-excluir>${icone('lixeira')}Excluir cartão</button>` : ''}`,
    aoMontar: (f) => {
      const caixa = f.querySelector('.faturas');
      f.querySelector('[data-add-fatura]').addEventListener('click', () => caixa.insertAdjacentHTML('beforeend', linhaFatura()));
      caixa.addEventListener('click', (e) => { if (e.target.closest('[data-remover]')) e.target.closest('.linha-fatura').remove(); });
      f.querySelector('[data-excluir]')?.addEventListener('click', () => {
        if (!confirmar(`Excluir o cartão "${c.nome}" e todas as faturas?`)) return;
        ctx.alterar((d) => { d.cartoes = d.cartoes.filter((x) => x.id !== c.id); });
        fecharModal();
        avisar('Cartão excluído.');
      });
    },
    aoSalvar: (f) => {
      const nome = f.elements.nome.value.trim();
      if (!nome) throw new Error('Dê um nome ao cartão.');
      const faturas = [...f.querySelectorAll('.linha-fatura')].map((linha) => {
        const venc = linha.querySelector('[name=venc]').value;
        const valor = paraCentavos(linha.querySelector('[name=valorFat]').value);
        if (!venc) throw new Error('Toda fatura precisa de data.');
        if (valor === null || valor < 0) throw new Error(`Valor inválido na fatura de ${formatarData(venc)}.`);
        const paga = linha.querySelector('[name=paga]').checked;
        // Se continua paga, mantém a data do pagamento registrada pelo botão "Paguei"
        const antiga = c.faturas.find((x) => x.id === linha.dataset.id);
        const manter = paga && antiga?.paga;
        return {
          id: linha.dataset.id, vencimento: venc, valor, paga,
          pagaEm: manter ? antiga.pagaEm : null,
          criadoEm: manter ? antiga.criadoEm : 0,
          abateuSaldo: manter ? antiga.abateuSaldo : false,
          contouParcela: manter ? antiga.contouParcela : false,
        };
      }).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
      const parcelas = parseInt(f.elements.parcelas.value, 10) || 0;
      const novo = {
        id: c.id, nome, faturas,
        parcelamento: parcelas > 0 ? {
          parcelas,
          pagas: Math.min(parcelas, parseInt(f.elements.pagas.value, 10) || 0),
          valor: lerValor(f, 'valorParcela', 'Valor da parcela'),
          jurosTotais: lerValor(f, 'juros', 'Juros totais'),
        } : null,
      };
      ctx.alterar((d) => {
        // Fatura que estava paga pelo "Paguei" e foi desmarcada (ou removida): devolve o valor ao saldo
        for (const antiga of c.faturas) {
          const agora = faturas.find((x) => x.id === antiga.id);
          if (antiga.paga && antiga.pagaEm && !agora?.paga) {
            desfazerAjuste(d, antiga, -antiga.valor);
            if (antiga.contouParcela && novo.parcelamento) novo.parcelamento.pagas = Math.max(0, novo.parcelamento.pagas - 1);
          }
        }
        const i = d.cartoes.findIndex((x) => x.id === c.id);
        if (i >= 0) d.cartoes[i] = novo; else d.cartoes.push(novo);
      });
      avisar('Cartão salvo.');
    },
  });
}

function modalConfig(ctx) {
  const { config } = ctx.dados;
  abrirModal({
    titulo: 'Orçamento e metas',
    corpo: `
      <label>Meta de guardar por mês (% da renda)<input name="meta" inputmode="decimal" value="${numeroParaTexto(config.metaGuardarPct)}">
        <small>Referência comum: no mínimo 10%, ideal 15% ou mais. Esse valor sai do seu orçamento livre.</small></label>
      <label>CDI anual (%)<input name="cdi" inputmode="decimal" value="${numeroParaTexto(config.cdiAnual)}">
        <small>Usado para estimar o rendimento das caixinhas "% do CDI". Atualize quando a Selic mudar.</small></label>
      <label>Projetar o saldo por quantos meses?<input type="number" name="meses" min="1" max="24" value="${config.mesesAFrente}"></label>`,
    aoSalvar: (f) => {
      const meta = paraNumero(f.elements.meta.value);
      const cdi = paraNumero(f.elements.cdi.value);
      if (meta === null || meta < 0 || meta > 90) throw new Error('Meta inválida (0 a 90%).');
      if (cdi === null || cdi < 0) throw new Error('CDI inválido.');
      ctx.alterar((d) => {
        d.config.metaGuardarPct = meta;
        d.config.cdiAnual = cdi;
        d.config.mesesAFrente = Math.min(24, Math.max(1, parseInt(f.elements.meses.value, 10) || 6));
      });
      avisar('Salvo.');
    },
  });
}
