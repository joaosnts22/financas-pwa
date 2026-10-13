/**
 * ui/compras.js — Registrar, editar e excluir compras.
 *
 * Enquanto você digita o valor, o app avalia a compra e mostra avisos:
 * peso na renda, orçamento livre do mês e impacto no saldo da conta.
 */
import { avaliarCompra, SUGESTOES_COMPRA } from '../calculos.js';
import { paraCentavos } from '../dinheiro.js';
import { hojeISO } from '../datas.js';
import { novoId, ajustarSaldoSeNecessario, desfazerAjuste } from '../dados.js';
import { esc, abrirModal, avisar, confirmar, fecharModal, campoValor, lerValor, listaAvisos, fmt } from './comum.js';
import { icone } from './icones.js';

/** Categorias sugeridas: as que você já usou primeiro, depois as padrão. */
function sugestoes(dados) {
  const usadas = [...new Set(dados.compras.map((c) => c.categoria))];
  return [...new Set([...usadas, ...SUGESTOES_COMPRA])];
}

export function modalCompra(ctx, compraExistente = null) {
  const c = compraExistente || { descricao: '', valor: 0, data: hojeISO(), categoria: '', pagamento: 'conta' };
  const opcoesPagamento = [{ id: 'conta', nome: 'Conta (Pix/débito)' }, ...ctx.dados.cartoes.map((k) => ({ id: k.id, nome: /cart/i.test(k.nome) ? k.nome : `Cartão ${k.nome}` }))];

  abrirModal({
    titulo: compraExistente ? 'Editar compra' : 'Registrar compra',
    textoSalvar: compraExistente ? 'Salvar' : 'Registrar',
    corpo: `
      <label>O que você comprou?<input name="descricao" value="${esc(c.descricao)}" placeholder="Ex.: Guitarra" autocomplete="off"></label>
      ${campoValor('valor', 'Valor (R$)', c.valor)}
      <div class="avisos-compra" aria-live="polite"></div>
      <label>Categoria<input name="categoria" list="lista-categorias" value="${esc(c.categoria)}" placeholder="Ex.: Lazer" autocomplete="off">
        <datalist id="lista-categorias">${sugestoes(ctx.dados).map((s) => `<option value="${esc(s)}">`).join('')}</datalist></label>
      <fieldset class="segmentado">
        <legend>Como pagou?</legend>
        ${opcoesPagamento.map((o) => `
          <label><input type="radio" name="pagamento" value="${o.id}" ${o.id === c.pagamento ? 'checked' : ''}><span>${esc(o.nome)}</span></label>`).join('')}
      </fieldset>
      <label>Data<input type="date" name="data" value="${c.data}"></label>
      ${compraExistente ? `<button type="button" class="btn btn-perigo btn-bloco" data-excluir>${icone('lixeira')}Excluir compra</button>` : ''}`,

    aoMontar: (f) => {
      // Reavalia a compra a cada alteração no formulário
      const caixa = f.querySelector('.avisos-compra');
      const atualizar = () => {
        const rascunho = {
          valor: paraCentavos(f.elements.valor.value) || 0,
          data: f.elements.data.value || hojeISO(),
          pagamento: f.elements.pagamento.value || 'conta',
          descricao: 'rascunho', categoria: 'Outros',
        };
        caixa.innerHTML = listaAvisos(avaliarCompra(ctx.dados, ctx.hoje, rascunho, fmt, compraExistente?.id));
      };
      f.addEventListener('input', atualizar);
      f.addEventListener('change', atualizar);
      atualizar();
      if (!compraExistente) setTimeout(() => f.elements.descricao.focus(), 50);

      f.querySelector('[data-excluir]')?.addEventListener('click', () => {
        if (!confirmar(`Excluir a compra "${c.descricao}"?`)) return;
        ctx.alterar((d) => {
          if (c.pagamento === 'conta') desfazerAjuste(d, c, -c.valor);
          d.compras = d.compras.filter((x) => x.id !== c.id);
        });
        fecharModal();
        avisar('Compra excluída.');
      });
    },

    aoSalvar: (f) => {
      const descricao = f.elements.descricao.value.trim();
      if (!descricao) throw new Error('Diga o que você comprou.');
      const valor = lerValor(f, 'valor', 'Valor', { permitirZero: false });
      const data = f.elements.data.value;
      if (!data) throw new Error('Informe a data.');
      const nova = {
        id: c.id || novoId(), descricao, valor, data,
        categoria: f.elements.categoria.value.trim() || 'Outros',
        pagamento: f.elements.pagamento.value || 'conta',
        criadoEm: Date.now(), abateuSaldo: false,
      };
      ctx.alterar((d) => {
        // Editando: desfaz o efeito da versão antiga antes de aplicar a nova
        if (compraExistente) {
          if (c.pagamento === 'conta') desfazerAjuste(d, c, -c.valor);
          d.compras = d.compras.filter((x) => x.id !== c.id);
        }
        if (nova.pagamento === 'conta') nova.abateuSaldo = ajustarSaldoSeNecessario(d, nova.data, -nova.valor);
        d.compras.push(nova);
      });
      avisar(compraExistente ? 'Compra atualizada.' : 'Compra registrada.');
    },
  });
}
