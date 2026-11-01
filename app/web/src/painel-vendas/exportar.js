/**
 * Exportações do Painel de Vendas: Excel (.xlsx), CSV, JSON, PDF (impressão), imagem PNG e vídeo.
 * Sem bibliotecas externas: o .xlsx é um ZIP sem compressão escrito aqui; a imagem e o vídeo são
 * desenhados num <canvas> a partir dos números do painel (o vídeo grava o canvas com MediaRecorder).
 *
 * `data` vem de exportData() em painel.js:
 *   { loja, ano, comp, critTxt, meta, fonte, geradoEm, logo,
 *     rows: [{ mes, v1, v2, est, estado, dif, cresc, obs, acum1, acum2 }], R: { ...totais do build() } }
 */

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ---------- Formatação (sempre com cêntimos: o que se exporta tem de bater com os totais) ----------
const fmt2 = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const kz2 = (n) => (n == null || !isFinite(n)) ? '—' : (n < 0 ? '−' : '') + fmt2.format(Math.abs(n)).replace(/ | /g, ' ') + ' Kz';
export const pct1 = (p) => (p == null || !isFinite(p)) ? '—' : (p >= 0 ? '+' : '−') + Math.abs(p * 100).toFixed(1).replace('.', ',') + '%';
const mi = (n) => (Math.abs(n) / 1e6).toFixed(1).replace('.', ',') + ' M';

// ---------- CSV ----------
export function toCsv(rows) {
  const cell = (c) => {
    if (c == null) return '';
    const s = typeof c === 'number' ? String(c).replace('.', ',') : String(c);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

// ---------- XLSX (ZIP sem compressão) ----------
const enc = new TextEncoder();
let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function zipStore(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nomes em UTF-8
    local.setUint16(12, 0x21, true); // 1980-01-01
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, data);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(14, 0x21, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

const xmlEsc = (s) => String(s)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const colName = (i) => { let s = ''; let n = i + 1; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

// Estilos: 0 normal · 1 Kz · 2 percentagem · 3 negrito · 4 Kz negrito
function sheetXml({ rows, money = [], pct = [], widths = [], boldRows = [] }) {
  const cols = widths.length
    ? '<cols>' + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>'
    : '';
  const body = rows.map((r, ri) => {
    const bold = ri === 0 || boldRows.includes(ri);
    const cells = r.map((v, ci) => {
      const ref = colName(ci) + (ri + 1);
      if (v == null || v === '') return '';
      if (typeof v === 'number' && isFinite(v)) {
        let s = 0;
        if (money.includes(ci)) s = bold ? 4 : 1;
        else if (pct.includes(ci)) s = 2;
        else if (bold) s = 3;
        return `<c r="${ref}"${s ? ` s="${s}"` : ''}><v>${v}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"${bold ? ' s="3"' : ''}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    }).join('');
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `${cols}<sheetData>${body}</sheetData></worksheet>`;
}

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;Kz&quot;"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="5">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>'
  + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

/** sheets = [{ name, rows, money:[índices de coluna], pct:[...], widths:[...], boldRows:[...] }] */
export function buildXlsx(sheets) {
  const safe = (n, i) => (String(n || `Folha ${i + 1}`).replace(/[[\]:*?/\\]/g, ' ').slice(0, 31));
  const files = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
      + '</Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '</Relationships>' },
    { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
      + sheets.map((s, i) => `<sheet name="${xmlEsc(safe(s.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
      + '</sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
      + '</Relationships>' },
    { name: 'xl/styles.xml', data: STYLES },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
  ];
  return zipStore(files);
}

// ---------- Desenho no canvas (imagem e vídeo) ----------
const COL = { bg: '#0F1B2D', card: '#16263D', fg: '#F4F6FA', mut: '#9AA8BC', comp: '#9A9EA5', main: '#E0679A', pos: '#2F9E6E', neg: '#D64545', teal: '#12898C', line: 'rgba(255,255,255,.12)' };
const FONT = (w, px) => `${w} ${px}px Manrope, "Segoe UI", Arial, sans-serif`;
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function header(ctx, d, W, logo, title) {
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, ctx.canvas.height);
  if (logo) { const h = 54; ctx.drawImage(logo, 48, 32, (logo.width / logo.height) * h, h); }
  ctx.fillStyle = COL.mut; ctx.font = FONT(600, 18); ctx.textAlign = 'right';
  ctx.fillText(`${d.loja} · ${d.ano}${d.comp ? ' vs ' + d.comp : ''}`, W - 48, 64);
  ctx.textAlign = 'left'; ctx.fillStyle = COL.fg; ctx.font = FONT(800, 38);
  ctx.fillText(title, 48, 140);
}

function kpiCard(ctx, x, y, w, h, label, value, delta, deltaColor) {
  ctx.fillStyle = COL.card; roundRect(ctx, x, y, w, h, 16); ctx.fill();
  ctx.fillStyle = COL.mut; ctx.font = FONT(600, 17); ctx.fillText(label, x + 22, y + 38);
  ctx.fillStyle = COL.fg; ctx.font = FONT(800, w > 300 ? 34 : 28); ctx.fillText(value, x + 22, y + 88);
  if (delta) { ctx.fillStyle = deltaColor || COL.mut; ctx.font = FONT(700, 17); ctx.fillText(delta, x + 22, y + 122); }
}

function barChart(ctx, d, x, y, w, h, progress) {
  const rows = d.rows;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.v1 || 0, r.v2 ?? r.est ?? 0)));
  const step = w / 12;
  const bw = step * 0.34;
  ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const gy = y + h - (h * g) / 4;
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
    ctx.fillStyle = COL.mut; ctx.font = FONT(500, 13); ctx.textAlign = 'right';
    ctx.fillText(mi((max * g) / 4), x - 8, gy + 4);
  }
  ctx.textAlign = 'center';
  rows.forEach((r, i) => {
    const local = ease(progress * 12 - i * 0.6);
    const cx = x + step * i + step / 2;
    if (d.comp && r.v1 != null) {
      const bh = (r.v1 / max) * h * local;
      ctx.fillStyle = COL.comp; ctx.fillRect(cx - bw - 2, y + h - bh, bw, bh);
    }
    const val = r.v2 ?? r.est;
    if (val != null) {
      const bh = (val / max) * h * local;
      ctx.globalAlpha = r.v2 == null ? 0.35 : r.estado === 'Em curso' ? 0.6 : 1;
      ctx.fillStyle = COL.main; ctx.fillRect(cx + 2, y + h - bh, bw, bh);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = COL.mut; ctx.font = FONT(600, 14); ctx.fillText(MESES_CURTOS[i], cx, y + h + 22);
  });
  ctx.textAlign = 'left';
  // Legenda
  const ly = y - 16;
  ctx.font = FONT(600, 15);
  let lx = x;
  if (d.comp) { ctx.fillStyle = COL.comp; ctx.fillRect(lx, ly - 11, 14, 14); ctx.fillStyle = COL.mut; ctx.fillText(String(d.comp), lx + 20, ly); lx += 90; }
  ctx.fillStyle = COL.main; ctx.fillRect(lx, ly - 11, 14, 14); ctx.fillStyle = COL.mut; ctx.fillText(String(d.ano), lx + 20, ly); lx += 90;
  ctx.globalAlpha = 0.35; ctx.fillStyle = COL.main; ctx.fillRect(lx, ly - 11, 14, 14); ctx.globalAlpha = 1;
  ctx.fillStyle = COL.mut; ctx.fillText('estimativa', lx + 20, ly);
}

function lineChart(ctx, d, x, y, w, h, progress) {
  const rows = d.rows;
  const proj = d.R.projeccao || 0;
  const max = Math.max(1, d.R.total1 || 0, proj, ...rows.map((r) => r.acum2 || 0));
  const px = (i) => x + (w * i) / 11;
  const py = (v) => y + h - (v / max) * h;
  ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const gy = y + h - (h * g) / 4;
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
    ctx.fillStyle = COL.mut; ctx.font = FONT(500, 13); ctx.textAlign = 'right'; ctx.fillText(mi((max * g) / 4), x - 8, gy + 4);
  }
  ctx.textAlign = 'center';
  rows.forEach((r, i) => { ctx.fillStyle = COL.mut; ctx.font = FONT(600, 14); ctx.fillText(MESES_CURTOS[i], px(i), y + h + 22); });
  ctx.textAlign = 'left';
  const upto = progress * 11;
  const draw = (vals, color, dash) => {
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.setLineDash(dash || []);
    ctx.beginPath();
    let started = false;
    vals.forEach((v, i) => {
      if (v == null || i > upto + 1) return;
      const t = Math.min(1, Math.max(0, upto - i + 1));
      const prev = i > 0 ? vals[i - 1] : null;
      const xx = prev != null && t < 1 ? px(i - 1) + (px(i) - px(i - 1)) * t : px(i);
      const yy = prev != null && t < 1 ? py(prev) + (py(v) - py(prev)) * t : py(v);
      if (!started) { ctx.moveTo(xx, yy); started = true; } else ctx.lineTo(xx, yy);
    });
    ctx.stroke(); ctx.setLineDash([]);
  };
  if (d.comp) draw(rows.map((r) => r.acum1), COL.comp);
  draw(rows.map((r) => r.acum2), COL.main);
  if (proj && progress >= 1) {
    ctx.strokeStyle = COL.teal; ctx.setLineDash([8, 8]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, py(proj)); ctx.lineTo(x + w, py(proj)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = COL.teal; ctx.font = FONT(700, 15); ctx.textAlign = 'right';
    ctx.fillText('Projecção ' + kz2(proj), x + w, py(proj) - 8); ctx.textAlign = 'left';
  }
}

function kpis(d) {
  const R = d.R;
  const color = (v) => (v == null ? COL.mut : v >= 0 ? COL.pos : COL.neg);
  return [
    ['Vendas ' + d.ano + (R.ultimo ? ' · até ' + R.ultimo.mes : ''), kz2(R.ytd2), R.cresc_ytd != null ? pct1(R.cresc_ytd) + ' vs ' + d.comp + ' (mesmos meses)' : '', color(R.cresc_ytd), R.ytd2],
    ['Média mensal (meses fechados)', kz2(R.media2), R.cresc_media != null ? pct1(R.cresc_media) + ' vs ' + d.comp : '', color(R.cresc_media), R.media2],
    ['Melhor mês', R.melhor ? kz2(R.melhor.v2) : '—', R.melhor ? R.melhor.mes : '', COL.mut, R.melhor ? R.melhor.v2 : null],
    ['Projecção anual', kz2(R.projeccao), R.cresc_proj != null ? pct1(R.cresc_proj) + ' vs total ' + d.comp : d.critTxt, color(R.cresc_proj), R.projeccao],
  ];
}

/** Imagem-resumo (1600×1000): título, quatro indicadores, gráfico mensal e rodapé. */
export async function renderSummaryPng(d) {
  const W = 1600, H = 1000;
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d');
  const logo = await loadImage(d.logo);
  header(ctx, d, W, logo, 'Painel de Vendas');
  const cw = (W - 96 - 3 * 20) / 4;
  kpis(d).forEach(([l, v, delta, c], i) => kpiCard(ctx, 48 + i * (cw + 20), 180, cw, 140, l, v, delta, c));
  barChart(ctx, d, 120, 420, W - 168, 440, 1);
  ctx.fillStyle = COL.mut; ctx.font = FONT(500, 15);
  ctx.fillText(`Critério da projecção: ${d.critTxt}${d.fonte ? ' · Fonte: ' + d.fonte : ''} · Gerado em ${d.geradoEm}`, 48, H - 36);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** Vídeo animado (1280×720, ~28 s) gravado do canvas. onProgress(segundos, total). */
export async function renderVideo(d, onProgress) {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error('Este navegador não consegue gravar vídeo. Use o Chrome, o Edge ou o Firefox actualizados.');
  }
  const mime = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error('Este navegador não tem nenhum formato de vídeo disponível para gravar.');
  const W = 1280, H = 720, FPS = 30;
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d');
  const logo = await loadImage(d.logo);
  const R = d.R;
  const top = d.rows.filter((r) => r.v2 != null && r.estado === 'Fechado').sort((a, b) => b.v2 - a.v2).slice(0, 3);
  const scenes = [
    { dur: 3.5, draw: (t) => {
      header(ctx, d, W, logo, '');
      ctx.globalAlpha = ease(t * 2);
      ctx.fillStyle = COL.fg; ctx.font = FONT(800, 64); ctx.textAlign = 'center';
      ctx.fillText('Painel de Vendas', W / 2, 330);
      ctx.fillStyle = COL.main; ctx.font = FONT(700, 34); ctx.fillText(d.loja, W / 2, 390);
      ctx.fillStyle = COL.mut; ctx.font = FONT(600, 26); ctx.fillText(`${d.ano}${d.comp ? ' comparado com ' + d.comp : ''}`, W / 2, 440);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    } },
    { dur: 5, draw: (t) => {
      header(ctx, d, W, logo, 'Resumo do ano');
      const cw = (W - 96 - 20) / 2;
      kpis(d).forEach(([l, , delta, c, raw], i) => {
        const k = ease(t * 1.6 - i * 0.15);
        const v = raw == null ? '—' : kz2(Math.round(raw * k * 100) / 100);
        kpiCard(ctx, 48 + (i % 2) * (cw + 20), 180 + Math.floor(i / 2) * 170, cw, 150, l, v, k >= 1 ? delta : '', c);
      });
    } },
    { dur: 7, draw: (t) => {
      header(ctx, d, W, logo, 'Vendas por mês');
      barChart(ctx, d, 110, 230, W - 158, 380, ease(t * 1.2));
    } },
    { dur: 6, draw: (t) => {
      header(ctx, d, W, logo, 'Vendas acumuladas');
      lineChart(ctx, d, 110, 210, W - 158, 400, Math.min(1, t * 1.25));
    } },
    { dur: 4.5, draw: (t) => {
      header(ctx, d, W, logo, 'Melhores meses');
      top.forEach((r, i) => {
        const k = ease(t * 2 - i * 0.25);
        const y = 220 + i * 130;
        ctx.globalAlpha = k;
        ctx.fillStyle = COL.card; roundRect(ctx, 48, y, W - 96, 110, 16); ctx.fill();
        ctx.fillStyle = COL.main; ctx.font = FONT(800, 40); ctx.fillText(String(i + 1) + 'º', 80, y + 70);
        ctx.fillStyle = COL.fg; ctx.font = FONT(700, 30); ctx.fillText(r.mes, 170, y + 68);
        ctx.textAlign = 'right'; ctx.fillText(kz2(r.v2), W - 300, y + 68);
        ctx.fillStyle = r.cresc == null ? COL.mut : r.cresc >= 0 ? COL.pos : COL.neg; ctx.font = FONT(700, 24);
        ctx.fillText(r.cresc == null ? 's/ comparação' : pct1(r.cresc), W - 80, y + 68);
        ctx.textAlign = 'left'; ctx.globalAlpha = 1;
      });
      if (!top.length) { ctx.fillStyle = COL.mut; ctx.font = FONT(600, 26); ctx.fillText('Ainda não há meses fechados.', 48, 260); }
    } },
    { dur: 2.5, draw: (t) => {
      header(ctx, d, W, logo, '');
      ctx.globalAlpha = ease(t * 2);
      ctx.fillStyle = COL.fg; ctx.font = FONT(800, 44); ctx.textAlign = 'center';
      ctx.fillText(R.projeccao != null ? 'Projecção ' + d.ano + ': ' + kz2(R.projeccao) : 'Painel de Vendas ' + d.ano, W / 2, 340);
      ctx.fillStyle = COL.mut; ctx.font = FONT(500, 20);
      ctx.fillText(`${d.critTxt}${d.fonte ? ' · Fonte: ' + d.fonte : ''} · Gerado em ${d.geradoEm}`, W / 2, 390);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    } },
  ];
  const total = scenes.reduce((s, sc) => s + sc.dur, 0);
  const frame = (sec) => {
    let acc = 0;
    for (const sc of scenes) {
      if (sec < acc + sc.dur) { sc.draw((sec - acc) / sc.dur); return; }
      acc += sc.dur;
    }
    scenes[scenes.length - 1].draw(1);
  };
  frame(0);
  const stream = canvas.captureStream(FPS);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((resolve) => { rec.onstop = resolve; });
  rec.start(500);
  const t0 = performance.now();
  await new Promise((resolve) => {
    // setInterval continua (mais devagar) com o separador em segundo plano; requestAnimationFrame pararia.
    const id = setInterval(() => {
      const sec = (performance.now() - t0) / 1000;
      frame(Math.min(sec, total));
      onProgress?.(Math.min(sec, total), total);
      if (sec >= total + 0.3) { clearInterval(id); resolve(); }
    }, 1000 / FPS);
  });
  rec.stop();
  await done;
  stream.getTracks().forEach((tr) => tr.stop());
  const type = mime.split(';')[0];
  return { blob: new Blob(chunks, { type }), ext: type === 'video/mp4' ? 'mp4' : 'webm' };
}

// ---------- PDF (relatório para imprimir / guardar como PDF) ----------
const htmlEsc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

export async function printReport(d) {
  const win = window.open('', '_blank');
  if (!win) throw new Error('O navegador bloqueou a janela do relatório. Permita janelas pop-up para este site e tente de novo.');
  const png = await renderSummaryPng(d);
  const img = await new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.readAsDataURL(png); });
  const R = d.R;
  const rows = d.rows.map((r) => `<tr>
    <td>${htmlEsc(r.mes)}</td>
    <td class="n">${d.comp ? kz2(r.v1) : ''}</td>
    <td class="n">${r.v2 != null ? kz2(r.v2) : r.est != null ? '≈ ' + kz2(r.est) : '—'}</td>
    <td class="n">${r.dif != null ? kz2(r.dif) : '—'}</td>
    <td class="n">${pct1(r.cresc)}</td>
    <td>${htmlEsc(r.estado)}</td>
    <td>${htmlEsc(r.obs || '')}</td></tr>`).join('');
  win.document.write(`<!doctype html><html lang="pt"><head><meta charset="utf-8">
<title>Painel de Vendas — ${htmlEsc(d.loja)} ${d.ano}</title>
<style>
  body{font-family:Manrope,"Segoe UI",Arial,sans-serif;color:#111;margin:24px}
  h1{font-size:22px;margin:0 0 4px} p{margin:2px 0;color:#555;font-size:12px}
  img{width:100%;margin:14px 0;border-radius:8px}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
  th,td{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left;vertical-align:top}
  th{background:#f3f4f6} td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  tfoot td{font-weight:700;border-top:2px solid #999}
  @page{size:A4;margin:14mm}
</style></head><body>
<h1>Painel de Vendas — ${htmlEsc(d.loja)} · ${d.ano}${d.comp ? ' vs ' + d.comp : ''}</h1>
<p>Critério da projecção: ${htmlEsc(d.critTxt)}${d.fonte ? ' · Fonte: ' + htmlEsc(d.fonte) : ''} · Gerado em ${htmlEsc(d.geradoEm)}</p>
<img alt="Resumo" src="${img}">
<table><thead><tr><th>Mês</th><th class="n">${d.comp || ''}</th><th class="n">${d.ano}</th><th class="n">Diferença</th><th class="n">Crescimento</th><th>Estado</th><th>Observação</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot>
<tr><td>Período comparável${R.ultimo ? ' (até ' + htmlEsc(R.ultimo.mes) + ')' : ''}</td><td class="n">${kz2(R.ytd1)}</td><td class="n">${kz2(R.ytd2c)}</td><td class="n">${kz2(R.dif_ytd)}</td><td class="n">${pct1(R.cresc_ytd)}</td><td></td><td></td></tr>
<tr><td>Total registado ${d.ano}</td><td class="n">${kz2(R.total1)}</td><td class="n">${kz2(R.ytd2)}</td><td></td><td></td><td></td><td></td></tr>
<tr><td>Projecção anual</td><td></td><td class="n">${kz2(R.projeccao)}</td><td></td><td class="n">${pct1(R.cresc_proj)}</td><td></td><td>${d.meta ? 'Meta: ' + kz2(d.meta) : ''}</td></tr>
</tfoot></table>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`);
  win.document.close();
}
