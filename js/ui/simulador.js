/**
 * ui/simulador.js — Tela "Simulador": 4 ferramentas de "e se...?".
 *
 *   Comprar  : impacto de uma compra (à vista ou parcelada) mês a mês
 *   Cortar   : quanto sobra reduzindo/cortando saídas fixas
 *   Parcelar : compara opções de parcelamento (juros e peso no orçamento)
 *   Meta     : quanto guardar por mês para um objetivo
 *
 * Diferente das outras telas, aqui o resultado é recalculado a cada tecla
 * digitada, sem redesenhar a tela inteira (assim o campo não perde o foco).
 * Nada é salvo: os valores digitados ficam só na memória enquanto o app
 * está aberto.
 */
import { simularCompra, simularCorte, compararParcelamentos, simularMeta, parcelaPrice } from '../simulacoes.js';
import { orcamentoMes } from '../calculos.js';
import { formatarBRL, paraCentavos, paraNumero, centavosParaTexto } from '../dinheiro.js';
import { hojeISO, chaveMes, somarMeses, nomeMes, nomeMesCurto, formatarData } from '../datas.js';
import { esc, valorHTML, valorNeutro, cabecalho, listaAvisos } from './comum.js';
import { icone } from './icones.js';

const ABAS = {
  comprar: { nome: 'Comprar', icone: 'sacola' },
  cortar: { nome: 'Cortar', icone: 'saida' },
  parcelar: { nome: 'Parcelar', icone: 'camadas' },
  meta: { nome: 'Meta', icone: 'cofre' },
};

// Estado do simulador (só na memória): aba atual e o que foi digitado em cada uma
const memoria = { aba: 'comprar', campos: {} };

const mesCurto = (chave) => `${nomeMesCurto(chave).slice(0, 3)}/${chave.slice(2, 4)}`;

// ================================================================== Tela

export function telaSimulador(ctx) {
  return `
    <p class="alerta info">${icone('info')}<span>Simulações não alteram seus dados. Teste à vontade.</span></p>
    <div class="abas-sim" role="tablist">
      ${Object.entries(ABAS).map(([id, a]) => `
        <button role="tab" data-sim-aba="${id}" aria-selected="${id === memoria.aba}">${icone(a.icone)}${a.nome}</button>`).join('')}
    </div>
    <form class="cartao form-sim" data-form="${memoria.aba}" novalidate>
      ${FORMULARIOS[memoria.aba](ctx)}
    </form>
    <div class="resultado-sim" aria-live="polite"></div>
    <p class="nota">${icone('escudo')}Resultados são <strong>estimativas</strong> com base no que você cadastrou.</p>
  `;
}

/** Conecta abas e recalcula o resultado a cada alteração. */
export function ligarSimulador(raiz, ctx) {
  const form = raiz.querySelector('.form-sim');
  const saida = raiz.querySelector('.resultado-sim');

  // Restaura o que foi digitado antes nesta aba
  const salvos = memoria.campos[memoria.aba] || {};
  for (const [nome, valor] of Object.entries(salvos)) {
    const el = form.elements[nome];
    if (!el) continue;
    if (el instanceof RadioNodeList) el.value = valor;
    else if (el.type === 'checkbox') el.checked = valor;
    else el.value = valor;
  }

  const atualizar = () => {
    memoria.campos[memoria.aba] = Object.fromEntries([...form.elements]
      .filter((el) => el.name && (el.type !== 'radio' || el.checked))
      .map((el) => [el.name, el.type === 'checkbox' ? el.checked : el.value]));
    try {
      saida.innerHTML = RESULTADOS[memoria.aba](form, ctx);
    } catch (erro) {
      saida.innerHTML = `<p class="alerta perigo">${icone('perigo')}<span>${esc(erro.message)}</span></p>`;
    }
    AJUSTES[memoria.aba]?.(form, ctx);
  };
  form.addEventListener('input', atualizar);
  form.addEventListener('change', atualizar);
  form.addEventListener('submit', (e) => e.preventDefault());

  raiz.addEventListener('click', (e) => {
    const aba = e.target.closest('[data-sim-aba]');
    if (aba) { memoria.aba = aba.dataset.simAba; ctx.redesenhar(); return; }
    const zerar = e.target.closest('[data-zerar]');
    if (zerar) { form.elements[`corte_${zerar.dataset.zerar}`].value = '0'; atualizar(); return; }
    if (e.target.closest('[data-limpar]')) { delete memoria.campos[memoria.aba]; ctx.redesenhar(); }
  });

  atualizar();
}

const botaoLimpar = '<button type="button" class="btn-texto" data-limpar>Limpar</button>';

// ================================================================== 1) Comprar

const FORMULARIOS = {
  comprar: (ctx) => `
    ${cabecalho('E se eu comprar...?', botaoLimpar)}
    <label>O quê?<input name="descricao" placeholder="Ex.: Guitarra" autocomplete="off"></label>
    <label>Valor à vista (R$)<input name="valor" inputmode="decimal" placeholder="0,00" autocomplete="off"></label>
    <fieldset class="segmentado">
      <legend>Como pagaria?</legend>
      <label><input type="radio" name="forma" value="conta" checked><span>À vista (Pix/débito)</span></label>
      ${ctx.dados.cartoes.length ? '<label><input type="radio" name="forma" value="cartao"><span>À vista no cartão</span></label>' : ''}
      <label><input type="radio" name="forma" value="parcelado"><span>Parcelado</span></label>
    </fieldset>
    <div class="duas-colunas" data-parcelado hidden>
      <label>Parcelas<input type="number" name="parcelas" min="2" max="24" value="10"></label>
      <label>Valor da parcela<input name="valorParcela" inputmode="decimal" autocomplete="off">
        <small>Vazio = sem juros</small></label>
    </div>
    <label>Data da compra (ou 1ª parcela)<input type="date" name="data" value="${hojeISO()}"></label>`,

  cortar: (ctx) => {
    const fixas = ctx.dados.eventos.filter((e) => e.ativo && e.tipo === 'saida' && e.recorrencia !== 'unica');
    if (!fixas.length) return `${cabecalho('E se eu cortar...?')}<p class="vazio">Cadastre saídas fixas em Mais para simular cortes.</p>`;
    return `
      ${cabecalho('E se eu cortar...?', botaoLimpar)}
      <p class="dica">Digite o novo valor de cada saída fixa (ou toque em "cortar" para zerar).</p>
      <ul class="lista-cortes">
        ${fixas.map((e) => `
          <li>
            <span class="extrato-texto"><strong>${esc(e.nome)}</strong><small>hoje ${formatarBRL(e.valor)}</small></span>
            <input name="corte_${e.id}" inputmode="decimal" value="${centavosParaTexto(e.valor)}" aria-label="Novo valor de ${esc(e.nome)}">
            <button type="button" class="btn-texto" data-zerar="${e.id}">cortar</button>
          </li>`).join('')}
      </ul>`;
  },

  parcelar: () => `
    ${cabecalho('Comparar parcelamentos', botaoLimpar)}
    <label>Valor à vista (R$)<input name="valor" inputmode="decimal" placeholder="0,00" autocomplete="off"></label>
    <label>Juros ao mês (%) — opcional<input name="taxa" inputmode="decimal" placeholder="Ex.: 2,99" autocomplete="off">
      <small>Se souber a taxa, o app calcula as parcelas. Se o banco/loja já mostrou o valor de cada parcela, digite direto abaixo.</small></label>
    <div class="opcoes-parcela">
      ${[3, 6, 9].map((n, i) => `
        <div class="duas-colunas">
          <label>Opção ${i + 1}: parcelas<input type="number" name="n${i}" min="1" max="48" value="${n}"></label>
          <label>Valor da parcela<input name="p${i}" inputmode="decimal" autocomplete="off"></label>
        </div>`).join('')}
    </div>`,

  meta: () => `
    ${cabecalho('Quanto guardar para uma meta?', botaoLimpar)}
    <label>Objetivo<input name="objetivo" placeholder="Ex.: Guitarra nova" autocomplete="off"></label>
    <div class="duas-colunas">
      <label>Valor da meta (R$)<input name="valor" inputmode="decimal" placeholder="0,00" autocomplete="off"></label>
      <label>Já tenho (R$)<input name="jaTenho" inputmode="decimal" placeholder="0,00" autocomplete="off"></label>
    </div>
    <div class="duas-colunas">
      <label>Até quando?<input type="month" name="mesAlvo" value="${somarMeses(chaveMes(hojeISO()), 12)}"></label>
      <label>Rendimento (% do CDI)<input name="pctCdi" inputmode="decimal" value="100">
        <small>0 = deixar parado</small></label>
    </div>`,
};

// ================================================================== Resultados

const RESULTADOS = {
  comprar(form, ctx) {
    const valor = paraCentavos(form.elements.valor.value);
    if (!valor || valor <= 0) return '';
    const forma = form.elements.forma.value;
    const parcelado = forma === 'parcelado';
    const n = parcelado ? Math.min(24, Math.max(2, parseInt(form.elements.parcelas.value, 10) || 2)) : 1;
    const digitada = paraCentavos(form.elements.valorParcela.value);
    const valorParcela = parcelado ? (digitada > 0 ? digitada : Math.ceil(valor / n)) : valor;
    const data = form.elements.data.value || hojeISO();
    const r = simularCompra(ctx.dados, ctx.hoje, { valor, data, parcelas: n, valorParcela, pagamento: forma });
    const nome = form.elements.descricao.value.trim() || 'a compra';

    const avisos = [];
    if (r.estouraOrcamento.length) avisos.push({ nivel: 'perigo', texto: `Passa do orçamento livre em: ${r.estouraOrcamento.map(mesCurto).join(', ')}.` });
    if (r.novoNegativo) avisos.push({ nivel: 'perigo', texto: `A conta ficaria negativa a partir de ${formatarData(r.novoNegativo)}.` });
    if (r.aumentaNegativo) avisos.push({ nivel: 'aviso', texto: 'A conta já fica negativa nesse período; essa compra aumenta o valor negativo.' });
    if (!avisos.some((a) => a.nivel !== 'info')) avisos.unshift({ nivel: 'ok', texto: `${nome[0].toUpperCase() + nome.slice(1)} cabe no orçamento${parcelado ? ' em todos os meses' : ''} e a conta não fica negativa por causa dela.` });
    if (forma === 'cartao') avisos.push({ nivel: 'info', texto: 'No cartão: conta no orçamento do mês, mas o dinheiro só sai da conta na fatura. Lembre de somar na fatura.' });

    return `
      <section class="cartao">
        ${cabecalho('Resultado')}
        <div class="grade-2">
          <div class="bloco"><small>${parcelado ? `${n}x de` : 'À vista'}</small>${valorNeutro(r.parcela)}</div>
          <div class="bloco"><small>Total pago</small>${valorNeutro(r.total)}${r.juros ? `<small class="txt-perigo">+${formatarBRL(r.juros)} de juros</small>` : ''}</div>
        </div>
        <div class="mt">${listaAvisos(avisos)}</div>
      </section>
      ${tabelaMeses(r.linhas)}`;
  },

  cortar(form, ctx) {
    const novos = {};
    for (const el of form.elements) {
      if (!el.name?.startsWith('corte_')) continue;
      const v = paraCentavos(el.value);
      if (v === null || v < 0) throw new Error('Algum valor está inválido.');
      novos[el.name.slice(6)] = v;
    }
    if (!Object.keys(novos).length) return '';
    const r = simularCorte(ctx.dados, ctx.hoje, novos);
    if (r.economia === 0) return '<p class="vazio centro">Altere algum valor acima para ver o efeito.</p>';
    const tempo = (m) => (m === null ? 'nunca, nesse ritmo' : m === 0 ? 'já completa' : `${m} ${m === 1 ? 'mês' : 'meses'}`);

    return `
      <section class="cartao">
        ${cabecalho('Resultado')}
        <div class="grade-2">
          <div class="bloco"><small>${r.economia > 0 ? 'Economia por mês' : 'Gasto a mais por mês'}</small>${valorHTML(r.economia)}</div>
          <div class="bloco"><small>Em 1 ano</small>${valorHTML(r.economiaAno)}</div>
        </div>
        <ul class="lista-simples mt">
          ${linhaAntesDepois(`Livre para gastar em ${nomeMesCurto(r.mes)}`, r.livreAntes, r.livreDepois)}
          ${linhaAntesDepois(`Saldo da conta em ${formatarData(r.fimProjecao)}`, r.saldoFimAntes, r.saldoFimDepois)}
        </ul>
      </section>
      <section class="cartao">
        ${cabecalho('Reserva de emergência')}
        <ul class="lista-simples">
          ${linhaAntesDepois('Valor recomendado', r.metaAntes, r.metaDepois, true)}
          <li><span>Tempo para completar</span><span class="antes-depois"><s>${tempo(r.tempoAntes)}</s><strong>${tempo(r.tempoDepois)}</strong></span></li>
        </ul>
        <p class="dica">Tempo considerando guardar todo mês a sua meta (${formatarBRL(orcamentoMes(ctx.dados, r.mes).meta)}) ${r.economia > 0 ? '+ o valor economizado' : ''}${r.temReserva ? '' : ', com rendimento de 100% do CDI (você ainda não criou a caixinha de emergência)'}.
          Gastos fixos menores também diminuem a reserva necessária.</p>
      </section>`;
  },

  parcelar(form, ctx) {
    const valor = paraCentavos(form.elements.valor.value);
    if (!valor || valor <= 0) return '';
    const taxa = (paraNumero(form.elements.taxa.value) || 0) / 100;
    const opcoes = [0, 1, 2].map((i) => {
      const n = parseInt(form.elements[`n${i}`].value, 10) || 0;
      const digitada = paraCentavos(form.elements[`p${i}`].value);
      return { parcelas: n, valorParcela: digitada > 0 ? digitada : parcelaPrice(valor, taxa, n) };
    });
    const livre = orcamentoMes(ctx.dados, somarMeses(chaveMes(ctx.hoje), 1)).livre;
    const linhas = compararParcelamentos(valor, opcoes, livre);
    if (!linhas.length) return '';

    return `
      <section class="cartao">
        ${cabecalho('Comparação')}
        <div class="tabela-parcelas">
          <div class="tp-cab"><span>Parcelas</span><span>Juros</span><span>Total pago</span></div>
          ${linhas.map((l) => `
            <div class="tp-linha ${l.menorJuros ? 'destaque-ok' : ''}">
              <span><strong>${l.parcelas}x ${valorNeutro(l.valorParcela)}</strong>
                ${l.pesoOrcamento !== null ? `<small>${Math.round(l.pesoOrcamento)}% do livre</small>` : ''}
                ${l.menorJuros ? '<small class="txt-ok">menos juros</small>' : ''}${l.menorParcela && !l.menorJuros ? '<small>menor parcela</small>' : ''}</span>
              <span>${l.juros > 0 ? `<span class="valor negativo">${formatarBRL(l.juros)}</span><small>${l.jurosPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</small>` : '<span class="valor positivo">sem juros</span>'}</span>
              <span>${valorNeutro(l.total)}</span>
            </div>`).join('')}
        </div>
        <p class="dica">"% do livre" = quanto a parcela come do seu orçamento livre de ${nomeMesCurto(somarMeses(chaveMes(ctx.hoje), 1))} (${formatarBRL(livre)}).
          Mais parcelas deixam a parcela menor, mas quase sempre o total pago fica maior.</p>
      </section>`;
  },

  meta(form, ctx) {
    const valor = paraCentavos(form.elements.valor.value);
    if (!valor || valor <= 0) return '';
    const jaTenho = Math.max(0, paraCentavos(form.elements.jaTenho.value) || 0);
    const mesAlvo = form.elements.mesAlvo.value;
    if (!/^\d{4}-\d{2}$/.test(mesAlvo)) throw new Error('Escolha até quando (mês/ano).');
    if (mesAlvo <= chaveMes(ctx.hoje)) throw new Error('Escolha um mês depois do atual.');
    const pctCdi = Math.max(0, paraNumero(form.elements.pctCdi.value) || 0);
    const r = simularMeta(ctx.dados, ctx.hoje, { valor, jaTenho, mesAlvo, pctCdi });
    const objetivo = form.elements.objetivo.value.trim() || 'sua meta';
    if (r.jaAtingida) return `<p class="alerta ok">${icone('ok')}<span>Você já tem o suficiente para ${esc(objetivo)}!</span></p>`;

    const avisos = [];
    if (r.cabeNaMetaDeGuardar) avisos.push({ nivel: 'ok', texto: `Cabe dentro da sua meta de guardar (${formatarBRL(r.metaGuardar)}/mês).` });
    else if (r.cabeNoLivre) avisos.push({ nivel: 'aviso', texto: `É mais que sua meta de guardar (${formatarBRL(r.metaGuardar)}/mês). Daria, mas sobraria menos para gastar no dia a dia.` });
    else avisos.push({ nivel: 'perigo', texto: 'Não cabe no orçamento atual. Tente um prazo maior ou um valor menor.' });

    return `
      <section class="cartao">
        ${cabecalho(`Para ${esc(objetivo)}`)}
        <p class="rotulo-grande">Guarde por mês</p>
        <p class="valor-medio">${valorNeutro(r.aporte)}</p>
        <p class="secundario">durante ${r.meses} ${r.meses === 1 ? 'mês' : 'meses'}, até ${nomeMes(mesAlvo)}${r.pctRenda !== null ? ` · ${Math.round(r.pctRenda)}% da renda` : ''}</p>
        <ul class="lista-simples mt">
          <li><span>Você deposita</span>${valorNeutro(r.aporte * r.meses)}</li>
          <li><span>Rendimento estimado</span>${valorHTML(r.rendimento)}</li>
          ${pctCdi > 0 ? `<li><span>Sem rendimento, seria por mês</span>${valorNeutro(r.aporteSemRendimento)}</li>` : ''}
        </ul>
        <div class="mt">${listaAvisos(avisos)}</div>
      </section>`;
  },
};

/** Ajustes visuais que dependem do formulário (mostrar/esconder, placeholders). */
const AJUSTES = {
  comprar(form) {
    const parcelado = form.elements.forma.value === 'parcelado';
    form.querySelector('[data-parcelado]').hidden = !parcelado;
    const valor = paraCentavos(form.elements.valor.value);
    const n = parseInt(form.elements.parcelas.value, 10) || 0;
    form.elements.valorParcela.placeholder = valor > 0 && n > 0 ? centavosParaTexto(Math.ceil(valor / n)) : '0,00';
  },
  parcelar(form) {
    // Mostra a parcela calculada pela taxa como sugestão (placeholder)
    const valor = paraCentavos(form.elements.valor.value);
    const taxa = (paraNumero(form.elements.taxa.value) || 0) / 100;
    [0, 1, 2].forEach((i) => {
      const n = parseInt(form.elements[`n${i}`].value, 10) || 0;
      form.elements[`p${i}`].placeholder = valor > 0 && n > 0 ? centavosParaTexto(parcelaPrice(valor, taxa, n)) : '0,00';
    });
  },
};

// ================================================================== Peças

function linhaAntesDepois(rotulo, antes, depois, neutro = false) {
  const fmt = (v) => (neutro ? valorNeutro(v) : valorHTML(v));
  if (antes === depois) return `<li><span>${rotulo}</span>${fmt(depois)}</li>`;
  return `<li><span>${rotulo}</span><span class="antes-depois"><s>${formatarBRL(antes)}</s><strong>${fmt(depois)}</strong></span></li>`;
}

/** Tabela mês a mês: sobra do orçamento e saldo no fim, antes → depois. */
function tabelaMeses(linhas) {
  return `
    <section class="cartao">
      ${cabecalho('Mês a mês')}
      <div class="tabela-meses">
        <div class="tm-cab"><span>Mês</span><span>Sobra do orçamento</span><span>Saldo no fim</span></div>
        ${linhas.map((l) => `
          <div class="tm-linha">
            <span class="tm-mes">${mesCurto(l.chave)}</span>
            <span>${valorHTML(l.sobraDepois)}${l.sobraAntes !== l.sobraDepois ? `<small>era ${formatarBRL(l.sobraAntes)}</small>` : ''}</span>
            <span>${l.saldoDepois === null ? '—' : valorHTML(l.saldoDepois)}${l.saldoAntes !== null && l.saldoAntes !== l.saldoDepois ? `<small>era ${formatarBRL(l.saldoAntes)}</small>` : ''}</span>
          </div>`).join('')}
      </div>
      <p class="dica">"Sobra do orçamento" = o que ainda daria para gastar no mês, já descontando a meta de guardar.</p>
    </section>`;
}
