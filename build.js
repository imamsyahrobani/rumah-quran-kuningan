// ============================================================
//  build.js — dijalankan otomatis oleh Netlify setiap kali ada
//  artikel atau halaman disimpan lewat /admin (Decap/Netlify CMS).
//
//  Tugasnya:
//  1. content/posts/*.json -> posts-data.js (untuk halaman blog)
//  2. content/pages/*.json -> <slug>/index.html
//     (alamat: namasitus.com/<slug>/ , isinya kode HTML dari Bapak)
//
//  Tidak perlu dijalankan manual.
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// ---------- util ----------
function readJsonFolder(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return [];
  }
  const stray = files.filter((f) => /\.(md|markdown|yml|yaml)$/i.test(f));
  if (stray.length) {
    console.warn('[build.js] PERINGATAN: ada file non-JSON di ' + path.relative(ROOT, dir) + ' (diabaikan): ' + stray.join(', '));
  }
  return files.filter((f) => f.endsWith('.json')).map((f) => {
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

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
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
//  2. HALAMAN KODE HTML: <slug>/index.html
// ============================================================
const RESERVED = ['admin', 'assets', 'content', 'blog', 'index', 'netlify', 'node_modules', 'git'];

// Pembungkus untuk potongan kode (tanpa <html>): header & footer Rumah Qur'an
function wrapFragment(page, html) {
  const title = page.title || "Rumah Qur'an Kuningan";
  const description = page.description || '';
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Rumah Qur'an Kuningan</title>
${description ? '<meta name="description" content="' + esc(description) + '">' : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
${description ? '<meta property="og:description" content="' + esc(description) + '">' : ''}
<link rel="icon" href="/assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Karla:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root { --ink:#1E2340; --ink-2:#2D3562; --parchment:#F1EDE0; --parchment-2:#E8E1CD; --gold:#A97B2F; --gold-deep:#8C6323; --maroon:#7A2E2B; --text:#26241d; --text-soft:#55523f; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin:0; background:var(--parchment); color:var(--text); font-family:'Karla',sans-serif; font-size:17px; line-height:1.65; -webkit-font-smoothing:antialiased; }
img { max-width:100%; }
.rq-header { position:sticky; top:0; z-index:1000; background:var(--ink); border-bottom:1px solid rgba(255,255,255,0.08); }
.rq-nav { display:flex; align-items:center; justify-content:space-between; padding:12px 28px; max-width:1160px; margin:0 auto; }
.rq-brand { display:flex; align-items:center; text-decoration:none; }
.rq-brand img { width:40px; height:40px; object-fit:contain; margin-right:12px; }
.rq-brand-text { color:#fff; font-family:'Fraunces',serif; font-size:1.05rem; font-weight:500; line-height:1.1; }
.rq-brand-text small { display:block; font-family:'Karla',sans-serif; font-size:0.68rem; color:#cfd0e6; font-weight:400; }
.rq-links { display:flex; align-items:center; }
.rq-links a { margin-left:24px; color:#d9dbee; text-decoration:none; font-size:0.92rem; font-weight:500; }
.rq-links a:hover { color:#fff; }
@media (max-width:700px) { .rq-links a.rq-hide { display:none; } }
.rq-footer { background:var(--ink); color:#b8bad6; padding:26px 0; font-size:0.85rem; }
.rq-footer-in { display:flex; justify-content:space-between; flex-wrap:wrap; max-width:1160px; margin:0 auto; padding:0 28px; }
.rq-footer a { color:#b8bad6; }
</style>
</head>
<body>
<header class="rq-header">
  <div class="rq-nav">
    <a class="rq-brand" href="/">
      <img src="/assets/logo.png" alt="Logo Rumah Qur'an Kuningan">
      <span class="rq-brand-text">Rumah Qur'an Kuningan<small>Inspiring For Anything</small></span>
    </a>
    <nav class="rq-links">
      <a class="rq-hide" href="/#program">Program</a>
      <a class="rq-hide" href="/blog.html">Blog</a>
      <a href="/">Beranda</a>
    </nav>
  </div>
</header>

<main>
${html}
</main>

<footer class="rq-footer">
  <div class="rq-footer-in">
    <span>&copy; Rumah Qur'an Kuningan — Inspiring For Anything</span>
    <a href="/">Kembali ke Beranda</a>
  </div>
</footer>
</body>
</html>
`;
}

let pageCount = 0;
readJsonFolder(path.join(ROOT, 'content', 'pages')).forEach(({ file, data }) => {
  if (data.published === false) return; // draf: tidak dibuatkan halaman
  const html = String(data.html || '');
  if (!html.trim()) {
    console.warn('[build.js] Halaman "' + (data.title || file) + '" kosong, dilewati.');
    return;
  }
  let slug = slugify(data.slug || file.replace(/\.json$/, ''));
  if (!slug) return;
  if (RESERVED.indexOf(slug) !== -1) {
    console.warn('[build.js] Slug "' + slug + '" dilarang, dipakai: halaman-' + slug);
    slug = 'halaman-' + slug;
  }
  const isFullDocument = /<\s*(!doctype|html)\b/i.test(html);
  const output = isFullDocument ? html : wrapFragment(data, html);
  const dir = path.join(ROOT, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), output, 'utf8');
  pageCount++;
  console.log('[build.js] halaman: /' + slug + '/ (' + (isFullDocument ? 'kode lengkap' : 'dibungkus header & footer') + ')');
});
console.log('[build.js] selesai. ' + pageCount + ' halaman dibuat.');
