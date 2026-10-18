// ============================================================
//  build.js — dijalankan otomatis oleh Netlify setiap kali ada
//  artikel atau event disimpan lewat /admin (Decap/Netlify CMS).
//
//  Tugasnya:
//  1. Membaca content/posts/*.json  -> membuat posts-data.js (untuk blog)
//  2. Membaca content/events/*.json -> membuat halaman event
//     di event/<slug>/index.html  (alamat: namasitus.com/event/<slug>)
//
//  Tidak perlu dijalankan manual.
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const WA_NUMBER = '6283869262287'; // WhatsApp Admin RQ
const SITE = (process.env.URL || '').replace(/\/$/, ''); // diisi otomatis oleh Netlify

// ---------- util ----------
function readJsonFolder(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch (e) {
    return [];
  }
  return files.map((f) => {
    try {
      return { file: f, data: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) };
    } catch (e) {
      console.warn('[build.js] Lewati file rusak: ' + f);
      return null;
    }
  }).filter(Boolean);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function safeUrl(u) {
  u = String(u || '').trim();
  if (/^assets\//i.test(u)) u = '/' + u;
  return /^(https?:\/\/|\/|#)/i.test(u) ? u : '';
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function formatDateLong(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
}

// ---------- mini renderer markdown -> HTML (sama seperti di blog.html) ----------
function renderInline(s) {
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (m, alt, src) => {
    const u = safeUrl(src.replace(/&amp;/g, '&'));
    return u ? '<img class="inline-img" src="' + u + '" alt="' + alt + '" loading="lazy">' : '';
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (m, text, href) => {
    const u = safeUrl(href.replace(/&amp;/g, '&'));
    return u ? '<a href="' + u + '" target="_blank" rel="noopener">' + text + '</a>' : text;
  });
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return s;
}

function renderMarkdown(text) {
  const blocks = String(text || '').split(/\r?\n\s*\r?\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((b) => {
    const img = b.match(/^!\[([^\]]*)\]\(([^)\s]+)[^)]*\)$/);
    if (img) {
      const u = safeUrl(img[2]);
      if (!u) return '';
      return '<figure><img src="' + u + '" alt="' + esc(img[1]) + '" loading="lazy">' +
        (img[1] ? '<figcaption>' + esc(img[1]) + '</figcaption>' : '') + '</figure>';
    }
    const h = b.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      const tag = h[1].length <= 2 ? 'h2' : 'h3';
      return '<' + tag + '>' + renderInline(h[2]) + '</' + tag + '>';
    }
    const lines = b.split(/\r?\n/);
    const isUl = lines.every((l) => /^\s*[-*]\s+/.test(l));
    const isOl = lines.every((l) => /^\s*\d+\.\s+/.test(l));
    if (isUl || isOl) {
      const items = lines.map((l) => '<li>' + renderInline(l.replace(/^\s*([-*]|\d+\.)\s+/, '')) + '</li>').join('');
      return isUl ? '<ul>' + items + '</ul>' : '<ol>' + items + '</ol>';
    }
    if (/^>\s?/.test(b)) {
      return '<blockquote>' + renderInline(lines.map((l) => l.replace(/^>\s?/, '')).join('\n')).replace(/\n/g, '<br>') + '</blockquote>';
    }
    return '<p>' + renderInline(b).replace(/\n/g, '<br>') + '</p>';
  }).join('\n');
}

// ============================================================
//  1. BLOG: posts-data.js
// ============================================================
const posts = readJsonFolder(path.join(ROOT, 'content', 'posts')).map(({ file, data }) => ({
  slug: data.slug || file.replace(/\.json$/, ''),
  title: data.title || '(Tanpa judul)',
  date: data.date ? String(data.date).slice(0, 10) : '',
  category: data.category || 'Umum',
  excerpt: data.excerpt || '',
  image: data.image || '',
  content: String(data.content || '').split(/\r?\n\s*\r?\n/).map((s) => s.trim()).filter(Boolean),
}));

const header =
  '// File ini DIBUAT OTOMATIS oleh build.js dari isi folder content/posts/.\n' +
  '// JANGAN diedit manual di sini — tulis atau ubah artikel lewat halaman /admin.\n\n';
fs.writeFileSync(path.join(ROOT, 'posts-data.js'), header + 'window.RQ_POSTS = ' + JSON.stringify(posts, null, 2) + ';\n', 'utf8');
console.log('[build.js] posts-data.js: ' + posts.length + ' artikel.');

// ============================================================
//  2. EVENT: event/<slug>/index.html
// ============================================================
function eventPage(ev) {
  const title = ev.title || "Event Rumah Qur'an Kuningan";
  const tagline = ev.tagline || '';
  const dateLong = formatDateLong(ev.date);
  const poster = safeUrl(ev.image);
  const fee = ev.fee || '';
  const maps = safeUrl(ev.maps_url);
  const registerUrl = safeUrl(ev.register_url);
  const waText = ev.wa_message || ("Assalamu'alaikum, saya ingin mendaftar / bertanya tentang " + title + '.');
  const ctaHref = registerUrl || ('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(waText));
  const ctaLabel = ev.cta_label || 'Daftar Sekarang';
  const description = ev.summary || tagline || ('Informasi dan pendaftaran ' + title + " di Rumah Qur'an Kuningan.");
  const ogImage = poster ? (poster.startsWith('/') ? SITE + poster : poster) : '';
  const bodyHtml = renderMarkdown(ev.body);

  const meta = [];
  if (dateLong) meta.push(['Tanggal', esc(dateLong)]);
  if (ev.time) meta.push(['Waktu', esc(ev.time)]);
  if (ev.location) {
    meta.push(['Lokasi', esc(ev.location) + (maps ? ' <a href="' + maps + '" target="_blank" rel="noopener">Lihat peta</a>' : '')]);
  }
  if (fee) meta.push(['Biaya', esc(fee)]);
  const metaHtml = meta.map((m) => '<div class="meta-item"><span class="meta-k">' + m[0] + '</span><span class="meta-v">' + m[1] + '</span></div>').join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Rumah Qur'an Kuningan</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${ogImage ? '<meta property="og:image" content="' + esc(ogImage) + '">' : ''}
<link rel="icon" href="/assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Karla:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root { --ink:#1E2340; --ink-2:#2D3562; --parchment:#F1EDE0; --parchment-2:#E8E1CD; --gold:#A97B2F; --gold-deep:#8C6323; --maroon:#7A2E2B; --text:#26241d; --text-soft:#55523f; --line:rgba(30,35,64,0.14); --radius:6px; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin:0; background:var(--parchment); color:var(--text); font-family:'Karla',sans-serif; font-size:17px; line-height:1.65; -webkit-font-smoothing:antialiased; }
h1,h2,h3 { font-family:'Fraunces',serif; font-weight:500; color:var(--ink); margin:0; }
p { max-width:68ch; }
a { color:inherit; }
img { max-width:100%; display:block; }
.wrap { max-width:1000px; margin:0 auto; padding:0 28px; }
.eyebrow { font-family:'Fraunces',serif; font-style:italic; font-weight:500; color:var(--gold); font-size:1.05rem; margin-bottom:10px; display:inline-block; }

header { position:sticky; top:0; z-index:50; background:var(--ink); border-bottom:1px solid rgba(255,255,255,0.08); }
.nav-inner { display:flex; align-items:center; justify-content:space-between; padding:12px 28px; max-width:1160px; margin:0 auto; }
.brand { display:flex; align-items:center; gap:12px; text-decoration:none; }
.brand img { width:40px; height:40px; object-fit:contain; }
.brand-text { color:#fff; font-family:'Fraunces',serif; font-size:1.05rem; font-weight:500; line-height:1.1; }
.brand-text small { display:block; font-family:'Karla',sans-serif; font-size:0.68rem; color:#cfd0e6; font-weight:400; }
.nav-links { display:flex; align-items:center; }
.nav-links a { margin-left:24px; color:#d9dbee; text-decoration:none; font-size:0.92rem; font-weight:500; }
.nav-links a:hover { color:#fff; }
@media (max-width:700px) { .nav-links a.hide-m { display:none; } }

.btn { display:inline-block; padding:14px 28px; border-radius:var(--radius); text-decoration:none; font-weight:700; font-size:1rem; }
.btn-gold { background:var(--gold); color:#1a1400; }
.btn-gold:hover { background:#bf8f3d; }

.ev-hero { background:var(--ink); color:#fff; padding:56px 0 0; }
.ev-hero-grid { display:flex; gap:48px; align-items:flex-end; }
.ev-hero-copy { flex:1 1 55%; padding-bottom:48px; }
.ev-hero h1 { color:#fff; font-size:clamp(2rem,4.4vw,3rem); line-height:1.15; margin-bottom:16px; }
.ev-tagline { color:#d9dbee; font-size:1.1rem; margin:0 0 26px; }
.ev-meta { display:flex; flex-wrap:wrap; margin:0 0 16px; }
.meta-item { display:flex; flex-direction:column; min-width:140px; margin:0 32px 16px 0; }
.meta-k { font-size:0.78rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--gold); font-weight:700; }
.meta-v { color:#fff; font-size:1rem; }
.meta-v a { color:#e5c98f; margin-left:6px; font-size:0.9rem; }
.ev-poster { flex:0 0 38%; align-self:flex-end; }
.ev-poster .frame { border:10px solid var(--gold); border-bottom:none; border-radius:8px 8px 0 0; overflow:hidden; box-shadow:0 30px 60px -25px rgba(0,0,0,0.55); background:var(--ink-2); }
.ev-poster img { width:100%; height:auto; display:block; }
@media (max-width:820px) {
  .ev-hero-grid { flex-direction:column; align-items:stretch; gap:0; }
  .ev-hero-copy { padding-bottom:36px; }
  .ev-poster { flex:none; width:100%; max-width:420px; margin:0 auto; }
}

.past-note { display:none; background:var(--parchment-2); border-left:4px solid var(--maroon); padding:14px 18px; margin:0 0 28px; border-radius:4px; color:var(--ink); }
.past .past-note { display:block; }
.past .cta-area { display:none; }

section.body { padding:56px 0 40px; }
.article-wrap { max-width:720px; margin:0 auto; padding:0 28px; }
.article-body p { max-width:100%; margin:0 0 20px; }
.article-body strong { color:var(--ink); }
.article-body figure { margin:30px 0; }
.article-body figure img, .article-body img.inline-img { width:100%; border-radius:8px; }
.article-body figcaption { font-size:0.85rem; color:var(--text-soft); text-align:center; margin-top:8px; }
.article-body h2 { font-size:1.5rem; margin:36px 0 14px; }
.article-body h3 { font-size:1.2rem; margin:28px 0 12px; }
.article-body ul, .article-body ol { margin:0 0 20px; padding-left:24px; }
.article-body li { margin-bottom:8px; }
.article-body blockquote { margin:24px 0; padding:4px 0 4px 20px; border-left:3px solid var(--gold); font-family:'Fraunces',serif; font-style:italic; color:var(--ink); }
.article-body a { color:var(--maroon); }

.cta-box { margin:20px 0 70px; padding:32px; background:var(--ink); color:#fff; border-radius:10px; text-align:center; }
.cta-box h2 { color:#fff; font-size:1.5rem; margin-bottom:10px; }
.cta-box p { color:#d0d2ea; margin:0 auto 22px; }

footer { background:var(--ink); color:#b8bad6; padding:26px 0; font-size:0.85rem; }
.footer-inner { display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; max-width:1160px; margin:0 auto; padding:0 28px; }
footer a { color:#b8bad6; }

.sticky-cta { display:none; }
@media (max-width:700px) {
  .sticky-cta { display:block; position:fixed; left:0; right:0; bottom:0; z-index:60; padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px)); background:rgba(30,35,64,0.96); border-top:1px solid rgba(255,255,255,0.1); }
  .sticky-cta .btn { display:block; text-align:center; }
  .past .sticky-cta { display:none; }
  body { padding-bottom:76px; }
}
</style>
</head>
<body data-date="${esc(String(ev.date || '').slice(0, 10))}">

<header>
  <div class="nav-inner">
    <a class="brand" href="/">
      <img src="/assets/logo.png" alt="Logo Rumah Qur'an Kuningan">
      <span class="brand-text">Rumah Qur'an Kuningan<small>Inspiring For Anything</small></span>
    </a>
    <nav class="nav-links">
      <a class="hide-m" href="/#program">Program</a>
      <a class="hide-m" href="/blog.html">Blog</a>
      <a href="/">Beranda</a>
    </nav>
  </div>
</header>

<section class="ev-hero">
  <div class="wrap">
    <div class="ev-hero-grid">
      <div class="ev-hero-copy">
        <span class="eyebrow">Event Rumah Qur'an Kuningan</span>
        <h1>${esc(title)}</h1>
        ${tagline ? '<p class="ev-tagline">' + esc(tagline) + '</p>' : ''}
        <div class="ev-meta">${metaHtml}</div>
        <div class="cta-area"><a class="btn btn-gold" href="${esc(ctaHref)}" target="_blank" rel="noopener">${esc(ctaLabel)}</a></div>
      </div>
      ${poster ? '<div class="ev-poster"><div class="frame"><img src="' + poster + '" alt="Poster ' + esc(title) + '"></div></div>' : ''}
    </div>
  </div>
</section>

<section class="body">
  <div class="article-wrap">
    <div class="past-note">Acara ini sudah berlangsung. Pantau informasi event berikutnya lewat admin kami di WhatsApp atau Instagram.</div>
    <div class="article-body">
${bodyHtml}
    </div>
    <div class="cta-box cta-area">
      <h2>Ikuti ${esc(title)}</h2>
      <p>Ada pertanyaan atau ingin langsung mendaftar? Admin kami siap membantu.</p>
      <a class="btn btn-gold" href="${esc(ctaHref)}" target="_blank" rel="noopener">${esc(ctaLabel)}</a>
    </div>
  </div>
</section>

<footer>
  <div class="footer-inner">
    <span>&copy; Rumah Qur'an Kuningan — Inspiring For Anything</span>
    <a href="/">Kembali ke Beranda</a>
  </div>
</footer>

<div class="sticky-cta"><a class="btn btn-gold" href="${esc(ctaHref)}" target="_blank" rel="noopener">${esc(ctaLabel)}</a></div>

<script>
(function () {
  var d = document.body.getAttribute('data-date');
  if (!d) return;
  var t = new Date();
  var today = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
  if (d < today) document.documentElement.classList.add('past');
})();
</script>
</body>
</html>
`;
}

// bersihkan hasil build event sebelumnya lalu buat ulang
const eventOutDir = path.join(ROOT, 'event');
fs.rmSync(eventOutDir, { recursive: true, force: true });

let eventCount = 0;
readJsonFolder(path.join(ROOT, 'content', 'events')).forEach(({ file, data }) => {
  if (data.published === false) return; // draf: tidak dibuatkan halaman
  const slug = slugify(data.slug || file.replace(/\.json$/, ''));
  if (!slug) return;
  const dir = path.join(eventOutDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), eventPage(data), 'utf8');
  eventCount++;
  console.log('[build.js] halaman event: /event/' + slug + '/');
});
console.log('[build.js] selesai. ' + eventCount + ' halaman event dibuat.');
