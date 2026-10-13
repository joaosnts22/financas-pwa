/**
 * ui/cadastros.js — Tela "Dados": conta e cheque especial, entradas/saídas,
 * cartões, configurações e backup. Tudo que alimenta a projeção é editado aqui.
 *
 * Padrão usado: a função tela...() devolve o HTML, e ligar...() conecta os
 * botões. Toda alteração passa por ctx.alterar(fn), que copia os dados,
 * aplica a mudança, salva no aparelho e redesenha a tela.
 */
import { CATEGORIAS } from '../calculos.js';
import { formatarBRL, centavosParaTexto, paraCentavos } from '../dinheiro.js';
import { formatarData, nomeMes, lerDataBR, hojeISO } from '../datas.js';
import { novoId, exportarJSON, lerArquivoJSON, dadosExemplo, dadosVazios } from '../dados.js';
import { esc, abrirModal, avisar, confirmar } from './comum.js';

const RECORRENCIAS = {
  unica: 'Uma vez (data fixa)',
  mensal: 'Todo mês (dia fixo)',
  ultimoDiaUtil: 'Todo mês (último dia útil)',
};

// ------------------------------------------------------------------ HTML

export function telaCadastros({ dados }) {
  const { conta, cheque, config } = dados;
  const entradas = dados.eventos.filter((e) => e.tipo === 'entrada');
  const saidas = dados.eventos.filter((e) => e.tipo === 'saida');

  return `
    ${dados.exemplo ? `<p class="alerta aviso">Você está vendo <strong>dados de exemplo</strong>. Importe seu JSON em <em>Backup</em> ou edite tudo abaixo.</p>` : ''}

    <section class="cartao">
      <div class="linha-titulo"><h2>Conta e cheque especial</h2>
        <button class="btn btn-pequeno" data-acao="editar-conta">Editar</button></div>
      <ul class="lista-simples">
        <li><span>Saldo da conta em ${formatarData(conta.dataSaldo)}</span>${formatarBRL(conta.saldoInicial)}</li>
        <li><span>Limite do cheque especial</span>${formatarBRL(cheque.limite)}</li>
        <li><span>IOF estimado por cobrança</span>${formatarBRL(cheque.iof)}</li>
        <li><span>Prazo sem juros</span>${cheque.diasSemJuros} dias</li>
        <li><span>No negativo desde</span>${formatarData(cheque.negativoDesde)}</li>
        <li><span>Juros após o prazo</span>${cheque.taxaJurosMes ? `${String(cheque.taxaJurosMes).replace('.', ',')}% ao mês` : 'não cadastrado'}</li>
      </ul>
      <button class="btn btn-bloco" data-acao="atualizar-saldo">Atualizar saldo de hoje</button>
      <p class="dica">Dica: de tempos em tempos, confira o saldo real no app do banco e atualize aqui. A projeção recomeça a partir dele.</p>
    </section>

    ${secaoEventos('Entradas', entradas, 'entrada')}
    ${secaoEventos('Saídas', saidas, 'saida')}

    <section class="cartao">
      <div class="linha-titulo"><h2>Cartões de crédito</h2>
        <button class="btn btn-pequeno" data-acao="novo-cartao">+ Cartão</button></div>
      ${dados.cartoes.length ? dados.cartoes.map((c) => `
        <div class="sub-cartao">
          <div class="linha-titulo"><h3>${esc(c.nome)}</h3>
            <button class="btn btn-pequeno" data-acao="editar-cartao" data-id="${c.id}">Editar</button></div>
          <ul class="lista-simples">
            ${c.faturas.map((f) => `
              <li class="${f.paga ? 'riscado' : ''}"><span>Pagar em ${formatarData(f.vencimento)}${f.paga ? ' · paga' : ''}</span>${formatarBRL(f.valor)}</li>`).join('') || '<li class="secundario">Nenhuma fatura cadastrada</li>'}
          </ul>
          ${c.parcelamento && c.parcelamento.parcelas ? `
            <p class="secundario">Parcelamento: ${c.parcelamento.pagas}/${c.parcelamento.parcelas} pagas ·
            ${formatarBRL(c.parcelamento.valor)} cada · juros ${formatarBRL(c.parcelamento.jurosTotais)}
            <br><small>(as parcelas já vêm dentro das faturas acima)</small></p>` : ''}
        </div>`).join('') : '<p class="vazio">Nenhum cartão.</p>'}
    </section>

    <section class="cartao">
      <div class="linha-titulo"><h2>Configurações</h2>
        <button class="btn btn-pequeno" data-acao="editar-config">Editar</button></div>
      <ul class="lista-simples">
        <li><span>Projetar até</span>${nomeMes(config.mesFinal)}</li>
        <li><span>Alerta de uso do cheque</span>${config.alertaChequePct}%</li>
        <li><span>Feriados cadastrados</span>${config.feriados.length}</li>
      </ul>
    </section>

    <section class="cartao">
      <h2>Backup</h2>
      <p class="dica">Seus dados ficam <strong>só neste aparelho</strong>. Exporte um backup com frequência e guarde fora do GitHub.</p>
      <div class="botoes">
        <button class="btn btn-primario" data-acao="exportar">⬇ Exportar JSON</button>
        <label class="btn">⬆ Importar JSON<input type="file" accept="application/json,.json" data-acao="importar" hidden></label>
      </div>
      <div class="botoes">
        <button class="btn" data-acao="exemplo">Carregar exemplo</button>
        <button class="btn btn-perigo" data-acao="zerar">Apagar tudo</button>
      </div>
    </section>
  `;
}

function secaoEventos(titulo, lista, tipo) {
  return `
    <section class="cartao">
      <div class="linha-titulo"><h2>${titulo}</h2>
        <button class="btn btn-pequeno" data-acao="novo-evento" data-tipo="${tipo}">+ Adicionar</button></div>
      ${lista.length ? `<ul class="lista-eventos">
        ${lista.map((e) => `
          <li class="${e.ativo ? '' : 'inativo'}">
            <button class="item-clicavel" data-acao="editar-evento" data-id="${e.id}">
              <span>
                <strong>${esc(e.nome)}</strong>${e.cenario ? ' <span class="selo">cenário</span>' : ''}${e.ativo ? '' : ' <span class="selo cinza">desligado</span>'}
                <small>${descreverRecorrencia(e)}</small>
              </span>
              <span class="valor ${tipo === 'entrada' ? 'positivo' : 'negativo'}">${formatarBRL(e.valor)}</span>
            </button>
          </li>`).join('')}
      </ul>` : '<p class="vazio">Nada cadastrado.</p>'}
    </section>`;
}

function descreverRecorrencia(e) {
  const periodo = `de ${nomeMes(e.inicio)}${e.fim ? ` até ${nomeMes(e.fim)}` : ' em diante'}`;
  if (e.recorrencia === 'unica') return `Em ${formatarData(e.data)}`;
  if (e.recorrencia === 'mensal') return `Todo dia ${e.dia}, ${periodo}`;
  return `Último dia útil, ${periodo}`;
}

// ------------------------------------------------------------------ Eventos (cliques)

export function ligarCadastros(raiz, ctx) {
  raiz.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-acao]');
    if (!alvo || alvo.tagName === 'INPUT') return;
    const acoes = {
      'editar-conta': () => modalConta(ctx),
      'atualizar-saldo': () => modalAtualizarSaldo(ctx),
      'novo-evento': () => modalEvento(ctx, null, alvo.dataset.tipo),
      'editar-evento': () => modalEvento(ctx, ctx.dados.eventos.find((x) => x.id === alvo.dataset.id)),
      'novo-cartao': () => modalCartao(ctx, null),
      'editar-cartao': () => modalCartao(ctx, ctx.dados.cartoes.find((x) => x.id === alvo.dataset.id)),
      'editar-config': () => modalConfig(ctx),
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
    if (e.target.dataset.acao !== 'importar' || !e.target.files[0]) return;
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

// ------------------------------------------------------------------ Modais

/** Lê um campo de valor em R$ e devolve centavos (ou lança erro). */
function lerValor(form, nome, rotulo, { permitirNegativo = false } = {}) {
  const c = paraCentavos(form.elements[nome].value);
  if (c === null) throw new Error(`Valor inválido em "${rotulo}".`);
  if (!permitirNegativo && c < 0) throw new Error(`"${rotulo}" não pode ser negativo.`);
  return c;
}

const campoValor = (nome, rotulo, centavos, dica = '') => `
  <label>${rotulo}
    <input name="${nome}" inputmode="decimal" autocomplete="off" value="${centavosParaTexto(centavos)}" placeholder="0,00">
    ${dica ? `<small>${dica}</small>` : ''}
  </label>`;

function modalConta(ctx) {
  const { conta, cheque } = ctx.dados;
  abrirModal({
    titulo: 'Conta e cheque especial',
    corpo: `
      ${campoValor('saldo', 'Saldo da conta (R$)', conta.saldoInicial, 'Negativo = usando o cheque especial. Ex.: -1875,00')}
      <label>Data desse saldo<input type="date" name="dataSaldo" value="${conta.dataSaldo}" required></label>
      ${campoValor('limite', 'Limite do cheque especial (R$)', cheque.limite)}
      ${campoValor('iof', 'IOF estimado a cada desconto (R$)', cheque.iof)}
      <label>Prazo sem juros (dias)<input type="number" name="diasSemJuros" min="0" value="${cheque.diasSemJuros}"></label>
      <label>No negativo desde<input type="date" name="negativoDesde" value="${cheque.negativoDesde || ''}">
        <small>Dia em que a conta ficou negativa. Usado para contar o prazo sem juros.</small></label>
      <label>Juros após o prazo (% ao mês)<input name="taxa" inputmode="decimal" value="${String(cheque.taxaJurosMes).replace('.', ',')}">
        <small>Deixe 0 se não souber; o app só vai avisar quando o prazo acabar.</small></label>`,
    aoSalvar: (f) => {
      const saldo = lerValor(f, 'saldo', 'Saldo', { permitirNegativo: true });
      const limite = lerValor(f, 'limite', 'Limite');
      const iof = lerValor(f, 'iof', 'IOF');
      const taxa = Number(f.elements.taxa.value.replace(',', '.')) || 0;
      if (!f.elements.dataSaldo.value) throw new Error('Informe a data do saldo.');
      ctx.alterar((d) => {
        d.conta.saldoInicial = saldo;
        d.conta.dataSaldo = f.elements.dataSaldo.value;
        d.cheque.limite = limite;
        d.cheque.iof = iof;
        d.cheque.diasSemJuros = Math.max(0, parseInt(f.elements.diasSemJuros.value, 10) || 0);
        d.cheque.negativoDesde = f.elements.negativoDesde.value || null;
        d.cheque.taxaJurosMes = Math.max(0, taxa);
      });
      avisar('Salvo.');
    },
  });
}

function modalAtualizarSaldo(ctx) {
  abrirModal({
    titulo: 'Saldo de hoje',
    corpo: `
      <p class="dica">Digite o saldo que aparece AGORA no app do banco (negativo se estiver no cheque especial).
      Lançamentos com data até hoje serão considerados já incluídos nesse saldo.</p>
      ${campoValor('saldo', 'Saldo atual (R$)', ctx.dados.conta.saldoInicial)}`,
    aoSalvar: (f) => {
      const saldo = lerValor(f, 'saldo', 'Saldo', { permitirNegativo: true });
      const hoje = hojeISO();
      ctx.alterar((d) => {
        // Se a conta acabou de ficar negativa, começa a contar o prazo hoje
        if (saldo < 0 && d.conta.saldoInicial >= 0) d.cheque.negativoDesde = hoje;
        if (saldo >= 0) d.cheque.negativoDesde = null;
        d.conta.saldoInicial = saldo;
        d.conta.dataSaldo = hoje;
      });
      avisar('Saldo atualizado.');
    },
  });
}

function modalEvento(ctx, evento, tipoNovo) {
  const ev = evento || {
    nome: '', tipo: tipoNovo, categoria: tipoNovo === 'entrada' ? 'salario' : 'fixa', valor: 0,
    recorrencia: 'unica', data: hojeISO(), dia: 5, inicio: hojeISO().slice(0, 7), fim: '', ativo: true, cenario: false,
  };
  const opcoesCategoria = Object.entries(CATEGORIAS)
    .filter(([cat, c]) => c.tipo === ev.tipo && cat !== 'fatura' && cat !== 'encargo')
    .map(([cat, c]) => `<option value="${cat}" ${cat === ev.categoria ? 'selected' : ''}>${c.nome}</option>`).join('');

  abrirModal({
    titulo: evento ? `Editar ${ev.tipo === 'entrada' ? 'entrada' : 'saída'}` : `Nova ${ev.tipo === 'entrada' ? 'entrada' : 'saída'}`,
    corpo: `
      <label>Nome<input name="nome" value="${esc(ev.nome)}" required placeholder="Ex.: Aluguel"></label>
      <label>Categoria<select name="categoria">${opcoesCategoria}</select></label>
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
      <label class="check"><input type="checkbox" name="ativo" ${ev.ativo ? 'checked' : ''}> Ligado (entra na projeção)</label>
      <label class="check"><input type="checkbox" name="cenario" ${ev.cenario ? 'checked' : ''}> É um cenário incerto (ex.: horas extras)</label>
      ${evento ? '<button type="button" class="btn btn-perigo btn-bloco" data-excluir>Excluir</button>' : ''}`,
    aoMontar: (f) => {
      // Mostra só os campos que fazem sentido para o tipo de repetição
      const atualizarCampos = () => {
        const r = f.elements.recorrencia.value;
        f.querySelectorAll('[data-mostrar]').forEach((el) => { el.hidden = !el.dataset.mostrar.split(' ').includes(r); });
      };
      f.elements.recorrencia.addEventListener('change', atualizarCampos);
      atualizarCampos();
      f.querySelector('[data-excluir]')?.addEventListener('click', () => {
        if (!confirmar(`Excluir "${ev.nome}"?`)) return;
        ctx.alterar((d) => { d.eventos = d.eventos.filter((x) => x.id !== ev.id); });
        document.getElementById('modal').close();
        avisar('Excluído.');
      });
    },
    aoSalvar: (f) => {
      const nome = f.elements.nome.value.trim();
      if (!nome) throw new Error('Dê um nome.');
      const valor = lerValor(f, 'valor', 'Valor');
      const recorrencia = f.elements.recorrencia.value;
      const inicio = f.elements.inicio.value;
      const fim = f.elements.fim.value;
      if (recorrencia === 'unica' && !f.elements.data.value) throw new Error('Informe a data.');
      if (recorrencia !== 'unica' && !/^\d{4}-\d{2}$/.test(inicio)) throw new Error('Informe o mês inicial (AAAA-MM).');
      if (fim && !/^\d{4}-\d{2}$/.test(fim)) throw new Error('Mês final inválido (use AAAA-MM).');

      const novo = {
        id: ev.id || novoId(), nome, tipo: ev.tipo, categoria: f.elements.categoria.value, valor, recorrencia,
        data: f.elements.data.value || ev.data,
        dia: Math.min(31, Math.max(1, parseInt(f.elements.dia.value, 10) || 1)),
        inicio: inicio || ev.inicio, fim,
        ativo: f.elements.ativo.checked, cenario: f.elements.cenario.checked,
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

function modalCartao(ctx, cartao) {
  const c = cartao || { id: novoId(), nome: '', faturas: [], parcelamento: null };
  const p = c.parcelamento || { parcelas: 0, valor: 0, pagas: 0, jurosTotais: 0 };
  abrirModal({
    titulo: cartao ? `Editar ${c.nome}` : 'Novo cartão',
    corpo: `
      <label>Nome do cartão<input name="nome" value="${esc(c.nome)}" placeholder="Ex.: Nubank"></label>
      <h3>Faturas (data em que você vai pagar)</h3>
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
      ${cartao ? '<button type="button" class="btn btn-perigo btn-bloco" data-excluir>Excluir cartão</button>' : ''}`,
    aoMontar: (f) => {
      const caixa = f.querySelector('.faturas');
      f.querySelector('[data-add-fatura]').addEventListener('click', () => caixa.insertAdjacentHTML('beforeend', linhaFatura()));
      caixa.addEventListener('click', (e) => { if (e.target.closest('[data-remover]')) e.target.closest('.linha-fatura').remove(); });
      f.querySelector('[data-excluir]')?.addEventListener('click', () => {
        if (!confirmar(`Excluir o cartão "${c.nome}" e todas as faturas?`)) return;
        ctx.alterar((d) => { d.cartoes = d.cartoes.filter((x) => x.id !== c.id); });
        document.getElementById('modal').close();
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
        return { id: linha.dataset.id, vencimento: venc, valor, paga: linha.querySelector('[name=paga]').checked };
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
    titulo: 'Configurações',
    corpo: `
      <label>Projetar até o mês<input type="month" name="mesFinal" value="${config.mesFinal}" placeholder="AAAA-MM"></label>
      <label>Avisar quando o cheque passar de (%)<input type="number" name="alerta" min="1" max="100" value="${config.alertaChequePct}"></label>
      <label>Feriados (um por linha, dd/mm/aaaa)
        <textarea name="feriados" rows="6" placeholder="20/11/2026">${config.feriados.map(formatarData).join('\n')}</textarea>
        <small>Usados para calcular o "último dia útil" do salário.</small></label>`,
    aoSalvar: (f) => {
      const mesFinal = f.elements.mesFinal.value;
      if (!/^\d{4}-\d{2}$/.test(mesFinal)) throw new Error('Mês final inválido (use AAAA-MM).');
      if (mesFinal < ctx.dados.conta.dataSaldo.slice(0, 7)) throw new Error('O mês final precisa ser depois da data do saldo.');
      const feriados = [];
      for (const linha of f.elements.feriados.value.split('\n').map((l) => l.trim()).filter(Boolean)) {
        const iso = lerDataBR(linha);
        if (!iso) throw new Error(`Data de feriado inválida: "${linha}"`);
        feriados.push(iso);
      }
      ctx.alterar((d) => {
        d.config.mesFinal = mesFinal;
        d.config.alertaChequePct = Math.min(100, Math.max(1, parseInt(f.elements.alerta.value, 10) || 80));
        d.config.feriados = [...new Set(feriados)].sort();
      });
      avisar('Configurações salvas.');
    },
  });
}
