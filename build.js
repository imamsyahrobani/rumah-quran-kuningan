// ============================================================
//  build.js — dijalankan otomatis oleh Netlify setiap kali ada
//  artikel baru disimpan lewat /admin (Netlify/Decap CMS).
//
//  Tugasnya sederhana: membaca semua file di content/posts/*.json
//  lalu menggabungkannya jadi satu file posts-data.js yang
//  dipakai blog.html untuk menampilkan daftar & isi artikel.
//
//  Tidak perlu dijalankan manual — Netlify yang menjalankannya
//  otomatis sesuai pengaturan di netlify.toml.
// ============================================================

const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, 'content', 'posts');
const outFile = path.join(__dirname, 'posts-data.js');

let files = [];
try {
  files = fs.readdirSync(postsDir).filter((f) => f.endsWith('.json'));
} catch (e) {
  files = [];
}

const posts = files.map((f) => {
  const raw = fs.readFileSync(path.join(postsDir, f), 'utf8');
  const data = JSON.parse(raw);
  const paragraphs = String(data.content || '')
    .split(/\r?\n\s*\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    slug: data.slug || f.replace(/\.json$/, ''),
    title: data.title || '(Tanpa judul)',
    date: data.date ? String(data.date).slice(0, 10) : '',
    category: data.category || 'Umum',
    excerpt: data.excerpt || '',
    content: paragraphs,
  };
});

const header =
  "// File ini DIBUAT OTOMATIS oleh build.js dari isi folder content/posts/.\n" +
  "// JANGAN diedit manual di sini — tulis atau ubah artikel lewat halaman /admin.\n" +
  "// Setiap kali artikel di-\"Publish\" lewat /admin, Netlify akan menjalankan\n" +
  "// build.js lagi dan file ini otomatis diperbarui.\n\n";

const body = "window.RQ_POSTS = " + JSON.stringify(posts, null, 2) + ";\n";

fs.writeFileSync(outFile, header + body, 'utf8');
console.log('[build.js] posts-data.js dibuat ulang dengan ' + posts.length + ' artikel.');
