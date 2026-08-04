// ShowTracker TMDB proxy — keeps the TMDB API key server-side.
// Deployed as a Cloudflare Worker. The client calls this worker and the
// api_key is injected here, so it never ships in the app bundle.
// (Service-worker / classic format for raw API upload.)
var TMDB_API_KEY = '9e4395bb379b7ae27a8bf50a732892c8';
var TMDB_BASE = 'https://api.themoviedb.org/3';

// Origins allowed to read responses (CORS). 'null' covers file:// testing.
var ALLOWED = [
  'https://lfkhoboko.github.io',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'null'
];

function cors(origin) {
  var allow = origin && ALLOWED.indexOf(origin) !== -1 ? origin : ALLOWED[0];
  return { 'Access-Control-Allow-Origin': allow, 'Vary': 'Origin' };
}

function handleRequest(request) {
  var url = new URL(request.url);
  var origin = request.headers.get('Origin');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: cors(origin) });
  }

  var path = url.pathname.replace(/^\//, '');
  if (!/^[0-9a-z/_.\-]+$/.test(path)) {
    return new Response('Bad request', { status: 400, headers: cors(origin) });
  }

  var params = new URLSearchParams(url.searchParams);
  params.set('api_key', TMDB_API_KEY);
  var target = TMDB_BASE + '/' + path + '?' + params.toString();

  return fetch(target, { headers: { Accept: 'application/json' } }).then(function(res) {
    return res.text();
  }).then(function(body) {
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': cors(origin)['Access-Control-Allow-Origin'],
        'Vary': 'Origin'
      }
    });
  }).catch(function() {
    return new Response('Upstream error', { status: 502, headers: cors(origin) });
  });
}

addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request));
});
