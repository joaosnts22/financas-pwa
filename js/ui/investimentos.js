/**
 * ui/investimentos.js — Aba "Investir": caixinhas, reserva de emergência,
 * meta de guardar dinheiro todo mês, aportes e resgates.
 */
import {
  taxaMensal, projetarInvestimento, metaReserva, mesesParaMeta, orcamentoMes, gastosFixosMensais,
} from '../calculos.js';
import { formatarBRL, paraNumero, numeroParaTexto } from '../dinheiro.js';
import { hojeISO, chaveMes, nomeMesCurto, formatarData } from '../datas.js';
import { novoId, ajustarSaldoSeNecessario, desfazerAjuste } from '../dados.js';
import {
  esc, valorNeutro, cabecalho, botaoAcao, barra, abrirModal, avisar, confirmar, fecharModal,
  campoValor, lerValor,
} from './comum.js';
import { icone, avatarIcone } from './icones.js';

const TIPOS = {
  emergencia: { nome: 'Reserva de emergência', icone: 'escudoCheck', cor: '#22c55e' },
  caixinha: { nome: 'Caixinha / renda fixa', icone: 'cofre', cor: '#7c5cff' },
  variavel: { nome: 'Renda variável', icone: 'investir', cor: '#f59e0b' },
};

/** "100% do CDI" / "1,2% a.m." / "12% a.a." */
function descreverRendimento(inv) {
  const { modo, taxa } = inv.rendimento;
  if (modo === 'cdi') return `${numeroParaTexto(taxa)}% do CDI`;
  if (modo === 'mes') return `${numeroParaTexto(taxa)}% ao mês`;
  if (modo === 'ano') return `${numeroParaTexto(taxa)}% ao ano`;
  return 'Sem rendimento fixo';
}

const pctTexto = (fracao) => `${(fracao * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

// ================================================================== Tela

export function telaInvestimentos({ dados, hoje }) {
  const { config } = dados;
  const total = dados.investimentos.reduce((s, i) => s + i.saldo, 0);
  const rendeMes = dados.investimentos.reduce((s, i) => s + Math.round(i.saldo * taxaMensal(i, config.cdiAnual)), 0);
  const orc = orcamentoMes(dados, chaveMes(hoje));
  const pctMeta = orc.meta > 0 ? (orc.guardado / orc.meta) * 100 : 0;

  // Reservas de emergência primeiro, depois o resto
  const ordem = { emergencia: 0, caixinha: 1, variavel: 2 };
  const lista = [...dados.investimentos].sort((a, b) => ordem[a.tipo] - ordem[b.tipo]);

  return `
    <section class="hero hero-verde">
      <p class="hero-rotulo">Total investido</p>
      <p class="hero-valor">${valorNeutro(total)}</p>
      <p class="hero-sub">Rendimento estimado: ${valorNeutro(rendeMes)} por mês</p>
    </section>

    <section class="cartao">
      ${cabecalho(`Meta de guardar · ${nomeMesCurto(chaveMes(hoje))}`, `<span class="chip ${pctMeta >= 100 ? 'ok' : 'neutro'}">${numeroParaTexto(config.metaGuardarPct)}% da renda</span>`)}
      ${orc.renda > 0 ? `
        <div class="linha-valores">
          <span><small>Guardado no mês</small>${valorNeutro(Math.max(0, orc.guardado))}</span>
          <span class="direita"><small>Meta</small>${valorNeutro(orc.meta)}</span>
        </div>
        ${barra(pctMeta, pctMeta >= 100 ? 'ok' : 'destaque')}
        <p class="secundario">${orc.guardado >= orc.meta ? 'Meta do mês batida!' : `Faltam ${formatarBRL(orc.meta - Math.max(0, orc.guardado))} para a meta deste mês.`}</p>`
        : '<p class="vazio">Cadastre suas entradas mensais (em Mais) para calcular a meta.</p>'}
    </section>

    ${lista.map((inv) => cartaoInvestimento(dados, inv, hoje, orc.meta)).join('')}

    <button class="btn btn-bloco btn-tracejado" data-acao="novo-investimento">${icone('mais')}Nova caixinha ou investimento</button>

    <p class="nota">${icone('escudo')} Rendimentos são <strong>estimativas</strong> antes de impostos, com o CDI de ${numeroParaTexto(config.cdiAnual)}% a.a. (editável em Mais → Orçamento e metas).</p>
  `;
}

function cartaoInvestimento(dados, inv, hoje, metaMensal) {
  const tipo = TIPOS[inv.tipo];
  const taxa = taxaMensal(inv, dados.config.cdiAnual);
  const rende = Math.round(inv.saldo * taxa);
  const em12 = projetarInvestimento(inv.saldo, taxa, 12);

  let blocoReserva = '';
  if (inv.tipo === 'emergencia') {
    const r = metaReserva(dados, inv, hoje);
    const meses = mesesParaMeta(inv.saldo, r.meta, metaMensal, taxa);
    blocoReserva = r.base > 0 ? `
      <div class="reserva">
        <p class="reserva-titulo">${icone('escudoCheck')}Recomendado: <strong>${valorNeutro(r.meta)}</strong></p>
        <p class="dica">${inv.mesesReserva} meses × ${formatarBRL(r.base)} de gastos fixos por mês. Para quem é CLT, 6 meses é a referência comum.</p>
        ${barra(r.pct, r.pct >= 100 ? 'ok' : 'destaque')}
        <div class="linha-valores mt">
          <span><small>Concluído</small>${r.pct}%</span>
          <span class="direita"><small>Falta</small>${valorNeutro(r.falta)}</span>
        </div>
        ${r.falta > 0 && meses ? `<p class="secundario">Guardando ${formatarBRL(metaMensal)}/mês (sua meta) aqui, você chega lá em ~${meses} ${meses === 1 ? 'mês' : 'meses'}.</p>` : ''}
        ${r.falta === 0 ? '<p class="secundario">Reserva completa. Agora dá para pensar em outros investimentos.</p>' : ''}
      </div>` : '<p class="dica">Cadastre suas saídas fixas mensais (em Mais) para o app recomendar o valor da reserva.</p>';
  }

  return `
    <section class="cartao">
      <div class="cartao-cabecalho">
        <div class="titulo-com-avatar">${avatarIcone(tipo.icone, tipo.cor)}<span><h2>${esc(inv.nome)}</h2>
          <small class="secundario">${esc(inv.instituicao || tipo.nome)} · ${descreverRendimento(inv)}</small></span></div>
        ${botaoAcao('editar-investimento', '', 'editar', `data-id="${inv.id}" aria-label="Editar"`)}
      </div>
      <p class="valor-medio">${valorNeutro(inv.saldo)}</p>
      <p class="secundario">Atualizado em ${formatarData(inv.dataSaldo)}${taxa > 0 ? ` · rende ~${formatarBRL(rende)}/mês (${pctTexto(taxa)} a.m.)` : ''}</p>
      ${taxa > 0 && inv.saldo > 0 ? `<p class="secundario">Em 12 meses, sem novos aportes: ~${formatarBRL(em12)}</p>` : ''}
      ${blocoReserva}
      <div class="botoes">
        <button class="btn btn-primario" data-acao="guardar" data-id="${inv.id}">${icone('setaCima')}Guardar</button>
        <button class="btn" data-acao="resgatar" data-id="${inv.id}">${icone('setaBaixo')}Resgatar</button>
      </div>
      ${historico(dados, inv)}
    </section>`;
}

/** Últimos aportes/resgates da caixinha (tocar para excluir). */
function historico(dados, inv) {
  const movs = dados.movimentos.filter((m) => m.investimentoId === inv.id).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5);
  if (!movs.length) return '';
  return `
    <details class="historico">
      <summary>Últimas movimentações</summary>
      <ul class="lista-simples">
        ${movs.map((m) => `
          <li><span>${formatarData(m.data)} · ${m.tipo === 'aporte' ? 'Guardado' : 'Resgate'}</span>
            <span>${valorNeutro(m.valor)} <button class="btn-icone mini" data-acao="excluir-movimento" data-id="${m.id}" aria-label="Excluir">✕</button></span></li>`).join('')}
      </ul>
    </details>`;
}

// ================================================================== Cliques

export function ligarInvestimentos(raiz, ctx) {
  raiz.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-acao]');
    if (!alvo) return;
    const inv = ctx.dados.investimentos.find((i) => i.id === alvo.dataset.id);
    const acoes = {
      'novo-investimento': () => modalInvestimento(ctx, null),
      'editar-investimento': () => modalInvestimento(ctx, inv),
      guardar: () => modalMovimento(ctx, 'aporte', inv?.id),
      resgatar: () => modalMovimento(ctx, 'resgate', inv?.id),
      'excluir-movimento': () => excluirMovimento(ctx, alvo.dataset.id),
    };
    acoes[alvo.dataset.acao]?.();
  });
}

// ================================================================== Formulários

export function modalInvestimento(ctx, existente) {
  const inv = existente || {
    nome: '', instituicao: '', tipo: ctx.dados.investimentos.some((i) => i.tipo === 'emergencia') ? 'caixinha' : 'emergencia',
    saldo: 0, dataSaldo: hojeISO(), rendimento: { modo: 'cdi', taxa: 100 }, mesesReserva: 6,
  };
  const base = gastosFixosMensais(ctx.dados, ctx.hoje);

  abrirModal({
    titulo: existente ? `Editar ${inv.nome}` : 'Nova caixinha ou investimento',
    corpo: `
      <label>Tipo<select name="tipo">
        ${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}" ${k === inv.tipo ? 'selected' : ''}>${t.nome}</option>`).join('')}
      </select></label>
      <label>Nome<input name="nome" value="${esc(inv.nome)}" placeholder="Ex.: Caixinha de emergência"></label>
      <label>Banco / corretora (opcional)<input name="instituicao" value="${esc(inv.instituicao)}" placeholder="Ex.: Nubank"></label>
      ${campoValor('saldo', 'Saldo atual (R$)', inv.saldo, 'Confira no app do banco. Você pode atualizar quando quiser.')}
      <div class="duas-colunas">
        <label>Rendimento<select name="modo">
          <option value="cdi" ${inv.rendimento.modo === 'cdi' ? 'selected' : ''}>% do CDI</option>
          <option value="ano" ${inv.rendimento.modo === 'ano' ? 'selected' : ''}>% ao ano</option>
          <option value="mes" ${inv.rendimento.modo === 'mes' ? 'selected' : ''}>% ao mês</option>
          <option value="nenhum" ${inv.rendimento.modo === 'nenhum' ? 'selected' : ''}>Variável / não sei</option>
        </select></label>
        <label data-taxa>Taxa (%)<input name="taxa" inputmode="decimal" value="${numeroParaTexto(inv.rendimento.taxa)}"></label>
      </div>
      <label data-reserva>Meses de reserva<input type="number" name="mesesReserva" min="1" max="24" value="${inv.mesesReserva}">
        <small>Seus gastos fixos hoje: ${formatarBRL(base)}/mês. Com 6 meses, a meta fica em ${formatarBRL(base * 6)}.</small></label>
      ${existente ? `<button type="button" class="btn btn-perigo btn-bloco" data-excluir>${icone('lixeira')}Excluir</button>` : ''}`,
    aoMontar: (f) => {
      const mostrar = () => {
        f.querySelector('[data-reserva]').hidden = f.elements.tipo.value !== 'emergencia';
        f.querySelector('[data-taxa]').hidden = f.elements.modo.value === 'nenhum';
      };
      f.elements.tipo.addEventListener('change', mostrar);
      f.elements.modo.addEventListener('change', mostrar);
      mostrar();
      f.querySelector('[data-excluir]')?.addEventListener('click', () => {
        if (!confirmar(`Excluir "${inv.nome}" e o histórico de movimentações?`)) return;
        ctx.alterar((d) => {
          d.investimentos = d.investimentos.filter((i) => i.id !== inv.id);
          d.movimentos = d.movimentos.filter((m) => m.investimentoId !== inv.id);
        });
        fecharModal();
        avisar('Excluído.');
      });
    },
    aoSalvar: (f) => {
      const nome = f.elements.nome.value.trim();
      if (!nome) throw new Error('Dê um nome.');
      const modo = f.elements.modo.value;
      const taxa = modo === 'nenhum' ? 0 : paraNumero(f.elements.taxa.value);
      if (taxa === null || taxa < 0) throw new Error('Taxa inválida.');
      const saldo = lerValor(f, 'saldo', 'Saldo');
      const novo = {
        id: inv.id || novoId(), nome, instituicao: f.elements.instituicao.value.trim(), tipo: f.elements.tipo.value,
        saldo, dataSaldo: saldo !== inv.saldo || !existente ? hojeISO() : inv.dataSaldo,
        rendimento: { modo, taxa }, mesesReserva: Math.min(24, Math.max(1, parseInt(f.elements.mesesReserva.value, 10) || 6)),
      };
      ctx.alterar((d) => {
        const i = d.investimentos.findIndex((x) => x.id === novo.id);
        if (i >= 0) d.investimentos[i] = novo; else d.investimentos.push(novo);
      });
      avisar('Salvo.');
    },
  });
}

/** Guardar (aporte) ou resgatar dinheiro. Mexe no saldo da conta e da caixinha. */
export function modalMovimento(ctx, tipo, idInvestimento = null) {
  const invs = ctx.dados.investimentos;
  if (!invs.length) {
    avisar('Crie uma caixinha primeiro (aba Investir).');
    modalInvestimento(ctx, null);
    return;
  }
  const aporte = tipo === 'aporte';
  abrirModal({
    titulo: aporte ? 'Guardar dinheiro' : 'Resgatar dinheiro',
    textoSalvar: aporte ? 'Guardar' : 'Resgatar',
    corpo: `
      <label>${aporte ? 'Para onde?' : 'De onde?'}<select name="inv">
        ${invs.map((i) => `<option value="${i.id}" ${i.id === idInvestimento ? 'selected' : ''}>${esc(i.nome)} (${formatarBRL(i.saldo)})</option>`).join('')}
      </select></label>
      ${campoValor('valor', 'Valor (R$)', 0)}
      <label>Data<input type="date" name="data" value="${hojeISO()}" max="${hojeISO()}"></label>
      <p class="dica">${aporte ? 'O valor sai da sua conta e entra na caixinha.' : 'O valor sai da caixinha e volta para a sua conta.'}</p>`,
    aoSalvar: (f) => {
      const valor = lerValor(f, 'valor', 'Valor', { permitirZero: false });
      const data = f.elements.data.value;
      if (!data || data > hojeISO()) throw new Error('Use a data de hoje ou de um dia que já passou.');
      const inv = invs.find((i) => i.id === f.elements.inv.value);
      if (!aporte && valor > inv.saldo) throw new Error(`A caixinha tem só ${formatarBRL(inv.saldo)}.`);
      ctx.alterar((d) => {
        const alvo = d.investimentos.find((i) => i.id === inv.id);
        alvo.saldo += aporte ? valor : -valor;
        const mov = { id: novoId(), investimentoId: inv.id, tipo, valor, data, criadoEm: Date.now(), abateuSaldo: false };
        mov.abateuSaldo = ajustarSaldoSeNecessario(d, data, aporte ? -valor : valor);
        d.movimentos.push(mov);
      });
      avisar(aporte ? 'Dinheiro guardado.' : 'Resgate registrado.');
    },
  });
}

function excluirMovimento(ctx, id) {
  const mov = ctx.dados.movimentos.find((m) => m.id === id);
  if (!mov || !confirmar('Excluir esta movimentação? O saldo da caixinha volta ao que era.')) return;
  ctx.alterar((d) => {
    const inv = d.investimentos.find((i) => i.id === mov.investimentoId);
    if (inv) inv.saldo = Math.max(0, inv.saldo + (mov.tipo === 'aporte' ? -mov.valor : mov.valor));
    desfazerAjuste(d, mov, mov.tipo === 'aporte' ? -mov.valor : mov.valor);
    d.movimentos = d.movimentos.filter((m) => m.id !== id);
  });
  avisar('Movimentação excluída.');
}
