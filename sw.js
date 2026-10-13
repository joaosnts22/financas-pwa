/**
 * sw.js — Service worker: guarda os arquivos do app em cache para funcionar OFFLINE.
 *
 * IMPORTANTE: sempre que você alterar qualquer arquivo do app, aumente a
 * VERSAO abaixo (v2 -> v3...). Assim o celular baixa os arquivos novos.
 * Todos os caminhos são RELATIVOS ("./") por causa do subcaminho do GitHub Pages.
 * (Este arquivo não guarda seus dados financeiros: eles ficam no localStorage.)
 */
const VERSAO = 'financas-v2';
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
  './js/ui/comum.js',
  './js/ui/icones.js',
  './js/ui/painel.js',
  './js/ui/fluxo.js',
  './js/ui/cadastros.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

// Instalação: baixa e guarda tudo
self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS)));
  self.skipWaiting(); // ativa a versão nova sem esperar fechar o app
});

// Ativação: apaga caches de versões antigas
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
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
