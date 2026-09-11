/**
 * import.js
 * -----------------------------------------------------------------
 * Importa o catálogo (CSV) + capas (imagens) para uma coleção do
 * PocketBase, de uma só vez, casando cada linha do CSV com a sua
 * imagem através da coluna "imagem_arquivo".
 *
 * Requisitos:
 *   node >= 18
 *   npm install pocketbase csv-parse dotenv
 *
 * Estrutura esperada:
 *   ./import.js
 *   ./.env
 *   ./catalogo_livraria_pocketbase_FINAL.csv
 *   ./capas_final_named/LIV-001.jpg, LIV-002.jpg, ... COL-002.jpg
 *
 * Ficheiro .env (cria este ficheiro ao lado do script):
 *   PB_URL=https://o-teu-pocketbase.exemplo.com
 *   PB_ADMIN_EMAIL=admin@exemplo.com
 *   PB_ADMIN_PASSWORD=a_tua_password
 *   PB_COLLECTION=livros
 *
 * Correr:
 *   node import.js
 * -----------------------------------------------------------------
 */

import "dotenv/config";
import PocketBase from "pocketbase";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";

// ---------- Configuração ----------
const PB_URL = process.env.PB_URL;
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;
const PB_COLLECTION = process.env.PB_COLLECTION || "livros";

const CSV_PATH = path.join(process.cwd(), "catalogo_livraria_pocketbase_FINAL.csv");
const IMAGES_DIR = path.join(process.cwd(), "capas_final_named");

if (!PB_URL || !PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
  console.error(
    "Erro: falta configurar PB_URL, PB_ADMIN_EMAIL ou PB_ADMIN_PASSWORD no ficheiro .env"
  );
  process.exit(1);
}

// ---------- Utilitários ----------

/** Converte "" -> null e strings numéricas -> number, mantendo o resto como string */
function cleanValue(value) {
  if (value === undefined || value === null || value.trim() === "") return null;
  return value.trim();
}

function toNumberOrNull(value) {
  const v = cleanValue(value);
  if (v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// ---------- Script principal ----------

async function main() {
  console.log(`→ A ligar a ${PB_URL} ...`);
  const pb = new PocketBase(PB_URL);

  // Autenticação como admin (PocketBase >= 0.23 usa a coleção "_superusers")
  await pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD).catch(async (err) => {
    // fallback para versões mais recentes do PocketBase (>=0.23)
    console.log("A tentar autenticação alternativa (_superusers)...");
    await pb.collection("_superusers").authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  });
  console.log("✓ Autenticado como admin.");

  // Ler e parsear o CSV
  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });
  console.log(`✓ ${rows.length} registos lidos do CSV.`);

  let criados = 0;
  let atualizados = 0;
  let erros = 0;

  for (const row of rows) {
    const codigo = row.codigo?.trim();
    if (!codigo) {
      console.warn("⚠ Linha sem 'codigo', a saltar:", row);
      continue;
    }

    // Monta o objeto de dados para o PocketBase
    const data = {
      codigo,
      titulo: cleanValue(row.titulo),
      autor: cleanValue(row.autor),
      preco_kz: toNumberOrNull(row.preco_kz),
      estoque: toNumberOrNull(row.estoque),
      categoria: cleanValue(row.categoria),
      pc_kz: toNumberOrNull(row.pc_kz),
      paginas: toNumberOrNull(row.paginas),
      tamanho: cleanValue(row.tamanho),
      qtd_por_caixa: cleanValue(row.qtd_por_caixa),
      descricao: cleanValue(row.descricao),
    };

    // Caminho da imagem correspondente
    const imagePath = path.join(IMAGES_DIR, row.imagem_arquivo?.trim() || "");
    const hasImage = row.imagem_arquivo && fs.existsSync(imagePath);

    try {
      // Verifica se já existe um registo com este código (permite re-correr o script sem duplicar)
      let existing = null;
      try {
        existing = await pb
          .collection(PB_COLLECTION)
          .getFirstListItem(`codigo="${codigo}"`);
      } catch (_) {
        existing = null; // não encontrado, vai criar
      }

      // Monta FormData para permitir envio de ficheiro + campos juntos
      const formData = new FormData();
      for (const [key, value] of Object.entries(data)) {
        if (value !== null) formData.append(key, value);
      }
      if (hasImage) {
        const fileBuffer = fs.readFileSync(imagePath);
        const blob = new Blob([fileBuffer], { type: "image/jpeg" });
        formData.append("imagem", blob, path.basename(imagePath));
      } else if (row.imagem_arquivo) {
        console.warn(`  ⚠ Imagem não encontrada para ${codigo}: ${imagePath}`);
      }

      if (existing) {
        await pb.collection(PB_COLLECTION).update(existing.id, formData);
        atualizados++;
        console.log(`✓ Atualizado: ${codigo} - ${data.titulo}`);
      } else {
        await pb.collection(PB_COLLECTION).create(formData);
        criados++;
        console.log(`✓ Criado: ${codigo} - ${data.titulo}`);
      }
    } catch (err) {
      erros++;
      console.error(`✗ Erro em ${codigo}:`, err?.response?.message || err.message);
    }
  }

  console.log("\n---------------------------------------");
  console.log(`Concluído. Criados: ${criados} | Atualizados: ${atualizados} | Erros: ${erros}`);
  console.log("---------------------------------------");
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
