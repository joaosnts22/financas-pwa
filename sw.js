/**
 * sw.js — Service worker.
 * 1. Guarda os arquivos do app em cache para funcionar OFFLINE.
 * 2. Mostra lembretes de contas em segundo plano (Android/Chrome, quando o
 *    navegador acordar o app com a "sincronização periódica").
 *
 * IMPORTANTE: sempre que você alterar qualquer arquivo do app, aumente a
 * VERSAO abaixo (v3 -> v4...). Assim o celular baixa os arquivos novos.
 * Todos os caminhos são RELATIVOS ("./") por causa do subcaminho do GitHub Pages.
 * (Seus dados financeiros NÃO ficam aqui: eles ficam no localStorage.)
 */
const VERSAO = 'financas-v3';
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/datas.js',
  './js/dinheiro.js',
  './js/dados.js',
  './js/calculos.js',
  './js/grafico.js',
  './js/notificacoes.js',
  './js/ui/comum.js',
  './js/ui/icones.js',
  './js/ui/painel.js',
  './js/ui/fluxo.js',
  './js/ui/compras.js',
  './js/ui/investimentos.js',
  './js/ui/cadastros.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];
const CACHE_LEMBRETES = 'financas-lembretes'; // criado pelo app (js/notificacoes.js)

// Instalação: baixa e guarda tudo
self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS)));
  self.skipWaiting(); // ativa a versão nova sem esperar fechar o app
});

// Ativação: apaga caches de versões antigas (mas não o de lembretes)
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO && n !== CACHE_LEMBRETES).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Requisições: responde do cache primeiro; se não tiver, busca na rede
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  evento.respondWith(
    caches.match(evento.request, { ignoreSearch: true }).then((emCache) =>
      emCache || fetch(evento.request).catch(() => caches.match('./index.html'))),
  );
});

// ---------- Lembretes em segundo plano ----------

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const diasEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

async function verificarLembretes() {
  const cache = await caches.open(CACHE_LEMBRETES);
  const r = await cache.match('./__lembretes.json');
  if (!r) return;
  const { ativo, diasAntes, lembretes } = await r.json();
  if (!ativo) return;
  const rn = await cache.match('./__notificados.json');
  const avisados = new Set(rn ? await rn.json() : []);
  const hoje = hojeISO();
  for (const l of lembretes) {
    const d = diasEntre(hoje, l.data);
    if (d < 0 || d > diasAntes) continue;
    const chave = `${l.chave}:${d}`; // mesmo formato usado em js/notificacoes.js
    if (avisados.has(chave)) continue;
    await self.registration.showNotification(`${l.titulo} vence ${d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`}`, {
      body: l.corpo, icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: chave,
    });
    avisados.add(chave);
  }
  await cache.put('./__notificados.json', new Response(JSON.stringify([...avisados].slice(-200))));
}

self.addEventListener('periodicsync', (evento) => {
  if (evento.tag === 'lembretes') evento.waitUntil(verificarLembretes());
});

// Tocar na notificação abre (ou foca) o app
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((janelas) =>
      (janelas[0] ? janelas[0].focus() : self.clients.openWindow('./'))),
  );
});
