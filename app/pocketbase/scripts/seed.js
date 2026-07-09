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

const SAMPLE_BOOKS = [
  { title: 'O Pequeno Príncipe', author: 'Antoine de Saint-Exupéry', genre: 'Clássicos', price: 4500, stock: 25, cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80', description: 'Uma fábula atemporal sobre amizade, amor e o sentido da vida.' },
  { title: '1984', author: 'George Orwell', genre: 'Ficção', price: 5200, stock: 18, cover: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&q=80', description: 'Distopia clássica sobre vigilância, poder e liberdade individual.' },
  { title: 'Orgulho e Preconceito', author: 'Jane Austen', genre: 'Romance', price: 4800, stock: 12, cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80', description: 'Romance eterno sobre amor, classe social e preconceitos.' },
  { title: 'Dom Casmurro', author: 'Machado de Assis', genre: 'Clássicos', price: 4200, stock: 15, cover: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80', description: 'Obra-prima da literatura brasileira sobre ciúme e memória.' },
  { title: 'A Bíblia para Crianças', author: 'Vários Autores', genre: 'Infantil', price: 3800, stock: 30, cover: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80', description: 'Histórias bíblicas adaptadas para leitores jovens.' },
  { title: 'Caminho a Cristo', author: 'Ellen G. White', genre: 'Religião', price: 3200, stock: 40, featured: true, cover: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?w=400&q=80', description: 'Guia clássico sobre fé, conversão e vida cristã.' },
  { title: 'O Grande Conflito', author: 'Ellen G. White', genre: 'Religião', price: 7500, stock: 20, featured: true, cover: 'https://images.unsplash.com/photo-1456513088650-9b9390942247?w=400&q=80', description: 'A história do conflito entre o bem e o mal ao longo dos séculos.' },
  { title: 'Patriarcas e Profetas', author: 'Ellen G. White', genre: 'Religião', price: 6800, stock: 18, cover: 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=400&q=80', description: 'Do Génesis ao reinado de Davi — a narrativa bíblica expandida.' },
  { title: 'Educação', author: 'Ellen G. White', genre: 'Religião', price: 4500, stock: 22, cover: 'https://images.unsplash.com/photo-1524995997942-a1fc3e46a42d?w=400&q=80', description: 'Princípios de educação cristã para pais e educadores.' },
  { title: 'Jardim de Infância', author: 'Ellen G. White', genre: 'Infantil', price: 2800, stock: 35, cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80', description: 'Histórias e lições para os mais pequenos.' },
  { title: 'O Segredo da Felicidade', author: 'Ellen G. White', genre: 'Religião', price: 2900, stock: 28, cover: 'https://images.unsplash.com/photo-1544716278-e513176f20b5?w=400&q=80', description: 'Reflexões sobre alegria, paz e propósito na vida cristã.' },
  { title: 'História da Igreja Cristã', author: 'Ellen G. White', genre: 'Religião', price: 6200, stock: 14, cover: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80', description: 'Da era apostólica ao século XIX — a marcha da igreja.' },
  { title: 'Alma Vencendo o Mundo', author: 'Ellen G. White', genre: 'Religião', price: 3400, stock: 24, cover: 'https://images.unsplash.com/photo-1516979187456-0a1dd7228f2d?w=400&q=80', description: 'Como viver a fé em meio aos desafios do mundo moderno.' },
  { title: 'Steve Jobs', author: 'Walter Isaacson', genre: 'Biografia', price: 6500, stock: 8, cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&q=80', description: 'A biografia definitiva do cofundador da Apple.' },
  { title: 'Harry Potter e a Pedra Filosofal', author: 'J.K. Rowling', genre: 'Infantil', price: 5500, stock: 22, cover: 'https://images.unsplash.com/photo-1618667067346-c0b2f4e2b4d6?w=400&q=80', description: 'O início da saga mágica que conquistou gerações.' },
  { title: 'A Cura da Alma', author: 'Pastor João Silva', genre: 'Religião', price: 3100, stock: 19, cover: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80', description: 'Encontro com Deus nos momentos de dor e restauração.' },
  { title: 'Manual do Jovem Cristão', author: 'Livraria Adventista', genre: 'Infantil', price: 2600, stock: 45, featured: true, cover: 'https://images.unsplash.com/photo-1524995997942-a1fc3e46a42d?w=400&q=80', description: 'Guia prático para jovens que desejam crescer na fé.' },
  { title: 'Profetas e Reis', author: 'Ellen G. White', genre: 'Religião', price: 7000, stock: 12, cover: 'https://images.unsplash.com/photo-1456513088650-9b9390942247?w=400&q=80', description: 'De Salomão ao exílio — a história dos reis de Israel.' },
  { title: 'Atos dos Apóstolos', author: 'Ellen G. White', genre: 'Religião', price: 5800, stock: 16, cover: 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=400&q=80', description: 'A história da igreja primitiva e a expansão do evangelho.' },
  { title: 'Desejado de Todas as Gerações', author: 'Ellen G. White', genre: 'Religião', price: 6200, stock: 20, featured: true, cover: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?w=400&q=80', description: 'A vida de Jesus Cristo narrada com profundidade espiritual.' },
  { title: 'Mensagens Escolhidas', author: 'Ellen G. White', genre: 'Religião', price: 4800, stock: 14, cover: 'https://images.unsplash.com/photo-1544716278-e513176f20b5?w=400&q=80', description: 'Compilação de mensagens inspiradoras para o dia a dia.' },
  { title: 'O Poder da Oração', author: 'Ellen G. White', genre: 'Devocional', price: 2700, stock: 32, cover: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80', description: 'Como desenvolver uma vida de oração transformadora.' },
  { title: 'Ministério da Cura', author: 'Ellen G. White', genre: 'Saúde', price: 5200, stock: 11, cover: 'https://images.unsplash.com/photo-1524995997942-a1fc3e46a42d?w=400&q=80', description: 'Princípios de saúde física, mental e espiritual.' },
  { title: 'Conselhos sobre Alimentação', author: 'Ellen G. White', genre: 'Saúde', price: 3500, stock: 18, cover: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&q=80', description: 'Orientações práticas sobre nutrição e bem-estar.' },
  { title: 'A História de José', author: 'Ellen G. White', genre: 'Infantil', price: 2400, stock: 40, cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80', description: 'A história bíblica de José adaptada para crianças.' },
  { title: 'A História de Moisés', author: 'Ellen G. White', genre: 'Infantil', price: 2400, stock: 38, cover: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80', description: 'As aventuras de Moisés contadas para os mais pequenos.' },
  { title: 'O Apocalipse Revelado', author: 'Ellen G. White', genre: 'Religião', price: 4900, stock: 15, cover: 'https://images.unsplash.com/photo-1456513088650-9b9390942247?w=400&q=80', description: 'Comentário sobre o livro do Apocalipse.' },
  { title: 'Evangelismo', author: 'Ellen G. White', genre: 'Religião', price: 4100, stock: 17, cover: 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=400&q=80', description: 'Métodos e princípios para a obra evangelística.' },
  { title: 'Fundamentos da Fé Cristã', author: 'Livraria Adventista', genre: 'Educação', price: 3300, stock: 25, cover: 'https://images.unsplash.com/photo-1524995997942-a1fc3e46a42d?w=400&q=80', description: 'Estudo introdutório sobre doutrinas adventistas.' },
  { title: 'Família Feliz', author: 'Ellen G. White', genre: 'Família', price: 3600, stock: 21, cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80', description: 'Princípios para construir um lar cristão harmonioso.' },
  { title: 'Aventuras de Daniel', author: 'Livraria Adventista', genre: 'Juvenil', price: 2900, stock: 30, featured: true, cover: 'https://images.unsplash.com/photo-1618667067346-c0b2f4e2b4d6?w=400&q=80', description: 'Histórias bíblicas de coragem e fé para jovens.' },
  { title: 'Guia de Estudo Bíblico', author: 'Livraria Adventista', genre: 'Educação', price: 2200, stock: 50, cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80', description: 'Material de apoio para estudos bíblicos em grupo.' },
  { title: 'História de Angola', author: 'Maria Santos', genre: 'História', price: 5500, stock: 10, cover: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80', description: 'Panorama histórico de Angola do século XV ao presente.' },
  { title: 'Sabedoria para o Dia a Dia', author: 'Pastor João Silva', genre: 'Devocional', price: 2500, stock: 35, cover: 'https://images.unsplash.com/photo-1544716278-e513176f20b5?w=400&q=80', description: '365 devocionais para meditação diária.' },
  { title: 'Música e Adoração', author: 'Livraria Adventista', genre: 'Religião', price: 2800, stock: 22, cover: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&q=80', description: 'Hinário e guia de adoração para igrejas.' },
];

const HERO_SLIDES = [
  { title: 'Cada livro, uma nova viagem', subtitle: 'Literatura cristã adventista para toda a família.', image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1920&q=80', cta_text: 'Explorar o Catálogo', cta_link: '/shop', sort_order: 1, active: true },
  { title: 'Obras de Ellen G. White', subtitle: 'Clássicos da literatura adventista com os melhores preços.', image: 'https://images.unsplash.com/photo-1456513088650-9b9390942247?w=1920&q=80', cta_text: 'Ver Coleção', cta_link: '/shop?search=Ellen', sort_order: 2, active: true },
  { title: 'Livros para Crianças e Jovens', subtitle: 'Histórias que formam carácter e fortalecem a fé.', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=80', cta_text: 'Descobrir', cta_link: '/shop?category=Infantil', sort_order: 3, active: true },
  { title: 'Bem-vindo à Livraria Adventista', subtitle: 'A sua loja online de publicações que edificam e transformam.', image: 'https://images.unsplash.com/photo-1524995997942-a1fc3e46a42d?w=1920&q=80', cta_text: 'Sobre Nós', cta_link: '/about', sort_order: 4, active: true },
];

async function pbFetch(endpoint, options = {}) {
  const res = await fetch(`${PB_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `${res.status} ${endpoint}`);
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
  const existing = await pbFetch('/api/collections/stock_books/records?perPage=200');
  const existingTitles = new Set(existing.items.map((b) => b.title.toLowerCase()));
  let added = 0;
  let backfilled = 0;
  let seq = existing.items.length + 1;

  for (const book of SAMPLE_BOOKS) {
    if (existingTitles.has(book.title.toLowerCase())) continue;
    const code = `LA-${String(seq).padStart(4, '0')}`;
    await pbFetch('/api/collections/stock_books/records', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...book,
        book_code: code,
        sku: code,
        publisher: book.publisher || 'Livraria Adventista',
        language: 'Português',
        year: book.year || 2024,
      }),
    });
    console.log(`  + ${book.title} (${code})`);
    added++;
    seq++;
  }

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

  const total = existing.items.length + added;
  console.log(added > 0 ? `${added} livros adicionados.` : 'Catálogo já está completo.');
  if (backfilled > 0) console.log(`${backfilled} livros receberam código.`);
  console.log(`Total no catálogo: ${total} livros.`);
}

async function seedSlides(headers) {
  try {
    const existing = await pbFetch('/api/collections/hero_slides/records?perPage=50');
    const existingTitles = new Set(existing.items.map((s) => s.title.toLowerCase()));
    let added = 0;
    for (const slide of HERO_SLIDES) {
      if (existingTitles.has(slide.title.toLowerCase())) continue;
      await pbFetch('/api/collections/hero_slides/records', { method: 'POST', headers, body: JSON.stringify(slide) });
      console.log(`  + slide: ${slide.title}`);
      added++;
    }
    console.log(added > 0 ? `${added} slides adicionados.` : 'Slides já configurados.');
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
