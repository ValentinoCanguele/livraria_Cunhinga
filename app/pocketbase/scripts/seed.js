#!/usr/bin/env node
/**
 * Configuração inicial: superuser, utilizador admin e catálogo de livros.
 * Uso: node scripts/seed.js [--books-only]
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const pbBinary = path.join(rootDir, 'pb', process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');
const pbDataDir = path.join(rootDir, 'pb_data');
const PB_URL = 'http://127.0.0.1:8090';
const booksOnly = process.argv.includes('--books-only');

const SUPER_EMAIL = 'admin@livraria.local';
const SUPER_PASS = 'Admin123456!';
const APP_EMAIL = 'admin@livraria.ao';
const APP_PASS = 'admin123456';

const HERO_SLIDES = [
  { title: 'Catálogo Oficial da Livraria', subtitle: 'Mais de 100 títulos adventistas para toda a família.', image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1920&q=80', cta_text: 'Ver Catálogo Geral', cta_link: '/shop?category=Cat%C3%A1logo%20Geral', sort_order: 1, active: true },
  { title: 'Obras de Ellen G. White', subtitle: 'Clássicos da literatura adventista com os melhores preços.', image: 'https://images.unsplash.com/photo-1456513088650-9b9390942247?w=1920&q=80', cta_text: 'Pesquisar Ellen G. White', cta_link: '/shop?search=Ellen', sort_order: 2, active: true },
  { title: 'Colportagem', subtitle: 'Títulos para evangelização e saúde com condições especiais.', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=80', cta_text: 'Ver Colportagem', cta_link: '/shop?category=Colportagem', sort_order: 3, active: true },
  { title: 'Bem-vindo à Livraria Adventista', subtitle: 'A sua loja online de publicações que edificam e transformam.', image: 'https://images.unsplash.com/photo-1524995997942-a1fc3e46a42d?w=1920&q=80', cta_text: 'Sobre Nós', cta_link: '/about', sort_order: 4, active: true },
];

async function pbFetch(endpoint, options = {}) {
  const res = await fetch(`${PB_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${data.message || res.statusText} (${res.status} ${endpoint}): ${JSON.stringify(data)}`);
  return data;
}

async function getAuthHeaders() {
  const auth = await pbFetch('/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: SUPER_EMAIL, password: SUPER_PASS }),
  });
  return { Authorization: auth.token, 'Content-Type': 'application/json' };
}

async function seedBooks(headers) {
  const existing = await pbFetch('/api/collections/stock_books/records?perPage=500');
  const total = existing.totalItems ?? existing.items?.length ?? 0;

  if (total === 0) {
    console.log('  Catálogo vazio. Execute: npm run import:catalog');
    return;
  }

  console.log(`  Catálogo com ${total} livros (dados reais).`);
  let backfilled = 0;
  let seq = total + 1;

  for (const item of existing.items) {
    if (!item.book_code) {
      const code = `LA-${String(seq).padStart(4, '0')}`;
      await pbFetch(`/api/collections/stock_books/records/${item.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ book_code: code, sku: code }),
      });
      console.log(`  ↻ código: ${item.title} → ${code}`);
      backfilled++;
      seq++;
    }
  }

  if (backfilled > 0) console.log(`${backfilled} livros receberam código.`);
}

async function seedSlides(headers) {
  try {
    const existing = await pbFetch('/api/collections/hero_slides/records?perPage=50&sort=sort_order');
    const byOrder = new Map((existing.items || []).map((s) => [s.sort_order, s]));
    const byTitle = new Set((existing.items || []).map((s) => s.title.toLowerCase()));
    let added = 0;
    let updated = 0;

    for (const slide of HERO_SLIDES) {
      const match = byOrder.get(slide.sort_order);
      if (match) {
        await pbFetch(`/api/collections/hero_slides/records/${match.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            title: slide.title,
            subtitle: slide.subtitle,
            image: slide.image,
            cta_text: slide.cta_text,
            cta_link: slide.cta_link,
            active: slide.active,
          }),
        });
        console.log(`  ↻ slide: ${slide.title}`);
        updated++;
        continue;
      }
      if (byTitle.has(slide.title.toLowerCase())) continue;
      await pbFetch('/api/collections/hero_slides/records', { method: 'POST', headers, body: JSON.stringify(slide) });
      console.log(`  + slide: ${slide.title}`);
      added++;
    }
    console.log(added || updated ? `${added} adicionados, ${updated} actualizados.` : 'Slides já configurados.');
  } catch (e) {
    console.log('Slides: coleção ainda não disponível. Reinicie o PocketBase para aplicar migrations.');
  }
}

async function seedPlatform(headers) {
  try {
    const settings = await pbFetch('/api/collections/site_settings/records?perPage=1');
    if (settings.totalItems === 0) {
      await pbFetch('/api/collections/site_settings/records', {
        method: 'POST', headers,
        body: JSON.stringify({
          site_name: 'Livraria Adventista',
          tagline: 'Literatura que edifica e transforma',
          primary_color: '#0ea5c9',
          contact_email: 'contacto@livrariaadventista.ao',
          contact_phone: '+244 923 000 000',
          contact_address: 'Luanda, Angola',
          pwa_enabled: true,
          pwa_short_name: 'LA',
          pwa_theme_color: '#0c4a6e',
          shipping_free_threshold: 20000,
          shipping_cost: 1500,
          ui_glass_enabled: true,
          ui_glass_opacity: 0.72,
          shop_bg_mode: 'gradient',
          shop_bg_overlay: 0.55,
        }),
      });
      console.log('  + site_settings');
    }

    const payments = [
      { name: 'Pagamento na Entrega', code: 'entrega', type: 'offline', enabled: true, sort_order: 1, instructions: 'Pague em dinheiro ou Multicaixa na entrega.' },
      { name: 'Transferência Bancária', code: 'transferencia', type: 'transfer', enabled: true, sort_order: 2, account_info: 'IBAN: AO06 0000 0000 0000 0000 0000 0', instructions: 'Envie comprovativo para contacto@livrariaadventista.ao' },
      { name: 'Multicaixa Express', code: 'multicaixa', type: 'p2p', enabled: true, sort_order: 3, account_info: '923 000 000', instructions: 'Transfira para o número indicado e insira a referência no checkout.' },
      { name: 'Unitel Money', code: 'unitel_money', type: 'p2p', enabled: false, sort_order: 4, account_info: '923 000 000', instructions: 'Envie para o número Unitel Money.' },
    ];
    const existingPay = await pbFetch('/api/collections/payment_methods/records?perPage=50');
    const existingCodes = new Set(existingPay.items.map((p) => p.code));
    for (const p of payments) {
      if (existingCodes.has(p.code)) continue;
      await pbFetch('/api/collections/payment_methods/records', { method: 'POST', headers, body: JSON.stringify(p) });
      console.log(`  + pagamento: ${p.name}`);
    }

    const collections = [
      { title: 'Essenciais da Fé', slug: 'essenciais-fe', marketing_tagline: 'Os livros que todo cristão deve ler', sort_order: 1, active: true, featured: true },
      { title: 'Família e Educação', slug: 'familia-educacao', marketing_tagline: 'Fortaleça o lar com valores cristãos', sort_order: 2, active: true, featured: true },
      { title: 'Devocionais Diários', slug: 'devocionais', marketing_tagline: 'Comece cada dia com inspiração', sort_order: 3, active: true, featured: false },
    ];
    try {
      const existingCols = await pbFetch('/api/collections/book_collections/records?perPage=50');
      const existingSlugs = new Set(existingCols.items.map((c) => c.slug));
      for (const c of collections) {
        if (existingSlugs.has(c.slug)) continue;
        await pbFetch('/api/collections/book_collections/records', { method: 'POST', headers, body: JSON.stringify(c) });
        console.log(`  + coleção: ${c.title}`);
      }
    } catch {
      console.log('  Coleções: migration 1730000005 necessária');
    }

    const stores = [
      { name: 'Livraria Adventista — Talatona', province: 'Luanda', address: 'Talatona, Belas', phone: '+244 923 000 001', latitude: -8.9094, longitude: 13.1840, hours: 'Seg–Sex 9h–18h', sort_order: 1, active: true },
      { name: 'Livraria Adventista — Benguela', province: 'Benguela', address: 'Centro da Cidade', phone: '+244 923 000 002', latitude: -12.5763, longitude: 13.4055, hours: 'Seg–Sáb 9h–17h', sort_order: 2, active: true },
    ];
    try {
      const existingStores = await pbFetch('/api/collections/physical_stores/records?perPage=50');
      const existingNames = new Set(existingStores.items.map((s) => s.name));
      for (const s of stores) {
        if (existingNames.has(s.name)) continue;
        const data = { ...s, maps_url: `https://www.google.com/maps?q=${s.latitude},${s.longitude}` };
        await pbFetch('/api/collections/physical_stores/records', { method: 'POST', headers, body: JSON.stringify(data) });
        console.log(`  + loja: ${s.name}`);
      }
    } catch {
      console.log('  Lojas: migration 1730000005 necessária');
    }
  } catch (e) {
    console.log('Platform: reinicie o PocketBase para aplicar migrations.');
  }
}

async function main() {
  if (!booksOnly) {
    console.log('A criar superuser do PocketBase...');
    execSync(
      `"${pbBinary}" superuser upsert "${SUPER_EMAIL}" "${SUPER_PASS}" --dir="${pbDataDir}"`,
      { stdio: 'inherit' }
    );
  }

  console.log('A autenticar...');
  const headers = await getAuthHeaders();

  if (!booksOnly) {
    const existingUsers = await pbFetch(`/api/collections/users/records?filter=(email="${APP_EMAIL}")`, { headers });
    if (existingUsers.totalItems === 0) {
      console.log('A criar utilizador admin...');
      await pbFetch('/api/collections/users/records', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: APP_EMAIL,
          password: APP_PASS,
          passwordConfirm: APP_PASS,
          name: 'Administrador',
          role: 'admin',
          emailVisibility: true,
        }),
      });
    }
  }

  console.log('A sincronizar catálogo...');
  await seedBooks(headers);
  console.log('A sincronizar slides...');
  await seedSlides(headers);
  if (!booksOnly) {
    console.log('A sincronizar plataforma...');
    await seedPlatform(headers);
  }

  console.log('\n✓ Concluído!\n');
  console.log('Frontend:   http://localhost:3000');
  console.log('Login app:  admin@livraria.ao / admin123456');
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
