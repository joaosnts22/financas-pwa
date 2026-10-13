/**
 * notificacoes.js — Lembretes de contas a pagar.
 *
 * Limitação importante de um app sem servidor (como este, no GitHub Pages):
 * o navegador não deixa um site "agendar" uma notificação para o futuro.
 * Por isso usamos duas estratégias:
 *
 * 1. NOTIFICAÇÃO DO SISTEMA: sempre que o app abre, ele verifica as contas
 *    que vencem hoje/amanhã e mostra uma notificação. No Android (Chrome, app
 *    instalado), também tentamos a "sincronização periódica", que acorda o
 *    service worker mais ou menos uma vez por dia — quando o Chrome permitir.
 *
 * 2. CALENDÁRIO (.ics): gera um arquivo com todas as contas e alarmes, que
 *    você importa no Google Agenda / Calendário do iPhone. Funciona sempre.
 *
 * O service worker não consegue ler o localStorage, então guardamos a lista
 * de lembretes no Cache Storage (que ele consegue ler).
 */
import { gerarLancamentos, contasAVencer } from './calculos.js';
import { formatarBRL } from './dinheiro.js';
import { somarDias, diferencaDias, formatarData, hojeISO, fimDoMes } from './datas.js';
import { baixarArquivo } from './dados.js';

const CACHE = 'financas-lembretes';
const URL_LEMBRETES = './__lembretes.json';
const URL_NOTIFICADOS = './__notificados.json';

export function notificacoesSuportadas() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function permissaoAtual() {
  return notificacoesSuportadas() ? Notification.permission : 'indisponivel';
}

/** Pede permissão e liga a verificação em segundo plano (quando existir). */
export async function ativarNotificacoes() {
  if (!notificacoesSuportadas()) throw new Error('Este navegador não suporta notificações. No iPhone, instale o app na tela inicial primeiro.');
  const resposta = await Notification.requestPermission();
  if (resposta !== 'granted') throw new Error('Permissão negada. Libere as notificações nas configurações do navegador.');
  const reg = await navigator.serviceWorker.ready;
  // Sincronização periódica: só Chrome/Android com o app instalado
  if ('periodicSync' in reg) {
    try { await reg.periodicSync.register('lembretes', { minInterval: 12 * 60 * 60 * 1000 }); } catch { /* sem suporte/permissão: segue só ao abrir */ }
  }
  return true;
}

async function lerJSON(cache, url, padrao) {
  const r = await cache.match(url);
  return r ? r.json() : padrao;
}

/**
 * Atualiza a lista de lembretes que o service worker lê e mostra as
 * notificações pendentes. Chamado sempre que o app abre ou os dados mudam.
 */
export async function sincronizarLembretes(dados) {
  if (!('caches' in window)) return;
  const hoje = hojeISO();
  const lembretes = gerarLancamentos(dados, hoje, somarDias(hoje, 60))
    .filter((l) => l.tipo === 'saida' && (l.fonte === 'evento' || l.fonte === 'fatura'))
    .map((l) => ({ chave: `${l.id}:${l.data}`, data: l.data, titulo: l.nome, corpo: formatarBRL(l.valor) }));
  const cache = await caches.open(CACHE);
  await cache.put(URL_LEMBRETES, new Response(JSON.stringify({
    ativo: dados.config.lembretes, diasAntes: dados.config.diasAntes, lembretes,
  })));
  if (dados.config.lembretes && permissaoAtual() === 'granted') await notificarPendentes(dados);
}

/** Mostra notificação das contas que vencem dentro do prazo e ainda não foram avisadas. */
async function notificarPendentes(dados) {
  const hoje = hojeISO();
  const cache = await caches.open(CACHE);
  const avisados = new Set(await lerJSON(cache, URL_NOTIFICADOS, []));
  const reg = await navigator.serviceWorker.ready;
  for (const c of contasAVencer(dados, hoje, dados.config.diasAntes)) {
    const chave = `${c.id}:${c.data}:${diferencaDias(hoje, c.data)}`;
    if (avisados.has(chave)) continue;
    const d = diferencaDias(hoje, c.data);
    await reg.showNotification(`${c.nome} vence ${d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`}`, {
      body: `${formatarBRL(c.valor)} · ${formatarData(c.data)}`,
      icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: chave,
    });
    avisados.add(chave);
  }
  // Guarda só os últimos 200 avisos para o arquivo não crescer para sempre
  await cache.put(URL_NOTIFICADOS, new Response(JSON.stringify([...avisados].slice(-200))));
}

/** Notificação de teste, para conferir se está funcionando. */
export async function notificacaoTeste() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Lembretes ativados', { body: 'Você vai ser avisado das contas a pagar.', icon: './icons/icon-192.png' });
}

// ---------- Calendário (.ics) ----------

/** Escapa texto no formato do calendário. */
const icsTexto = (t) => String(t).replace(/\u00A0/g, ' ').replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
const icsData = (iso) => iso.replace(/-/g, '');

/**
 * Gera um .ics com:
 *  - saídas fixas recorrentes (regra mensal, sem precisar repetir o arquivo)
 *  - saídas únicas e faturas futuras
 * Cada evento tem alarme às 9h do dia anterior e às 9h do próprio dia.
 */
export function exportarCalendario(dados) {
  const hoje = hojeISO();
  const agora = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const eventos = [];
  const alarmes = [
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Conta a pagar', 'TRIGGER:-PT15H', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Conta a pagar hoje', 'TRIGGER:PT9H', 'END:VALARM',
  ];
  const evento = (uid, dataIso, titulo, valor, regra = null) => {
    eventos.push('BEGIN:VEVENT', `UID:${uid}@financas-pwa`, `DTSTAMP:${agora}`,
      `DTSTART;VALUE=DATE:${icsData(dataIso)}`, `DTEND;VALUE=DATE:${icsData(somarDias(dataIso, 1))}`,
      `SUMMARY:${icsTexto(`${titulo} — ${formatarBRL(valor)}`)}`,
      ...(regra ? [`RRULE:${regra}`] : []), 'TRANSP:TRANSPARENT', ...alarmes, 'END:VEVENT');
  };

  for (const ev of dados.eventos) {
    if (!ev.ativo || ev.tipo !== 'saida') continue;
    if (ev.recorrencia === 'unica') {
      if (ev.data >= hoje) evento(ev.id, ev.data, ev.nome, ev.valor);
      continue;
    }
    // Primeira ocorrência a partir de hoje
    const primeira = gerarLancamentos({ ...dados, eventos: [ev], cartoes: [], compras: [], movimentos: [] }, hoje, somarDias(hoje, 62))[0];
    if (!primeira) continue;
    const ate = ev.fim ? `;UNTIL=${icsData(fimDoMes(ev.fim))}` : '';
    // Dias 29 a 31 não existem em todo mês: no calendário viram "último dia do mês" (-1)
    const regra = ev.recorrencia === 'mensal'
      ? `FREQ=MONTHLY;BYMONTHDAY=${ev.dia <= 28 ? ev.dia : -1}${ate}`
      : `FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1${ate}`;
    evento(ev.id, primeira.data, ev.nome, ev.valor, regra);
  }
  for (const c of dados.cartoes) {
    for (const f of c.faturas) if (!f.paga && f.vencimento >= hoje) evento(f.id, f.vencimento, `Fatura ${c.nome}`, f.valor);
  }

  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Minhas Financas//PT-BR', 'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Contas a pagar', ...eventos, 'END:VCALENDAR'].join('\r\n');
  baixarArquivo(ics, 'contas-a-pagar.ics', 'text/calendar');
  return eventos.filter((l) => l === 'BEGIN:VEVENT').length;
}
