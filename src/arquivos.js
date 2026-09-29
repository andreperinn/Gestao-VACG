import { supabase } from './supabase';

// Arquivos anexados (PDFs, fotos…).
// - Com Supabase configurado: bucket privado "documentos" no Supabase Storage.
// - Modo local: IndexedDB do navegador.
export const BUCKET = 'documentos';

// ---------- IndexedDB (modo local) ----------
const DB = 'vacg-arquivos';
const STORE = 'arquivos';
let conexao;

function abrir() {
  conexao ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return conexao;
}

async function operar(modo, fn) {
  const db = await abrir();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, modo);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Operação cancelada'));
  });
}

// Lê um arquivo guardado neste navegador (usado para enviar dados antigos para a nuvem)
export const obterArquivoLocal = (id) => operar('readonly', (s) => s.get(id)).catch(() => null);

// ---------- Nuvem ----------
// Guarda em memória os arquivos já baixados, para miniaturas e visualização não baixarem de novo
const cache = new Map();

async function limparBucket() {
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
    if (error || !data?.length) return;
    await supabase.storage.from(BUCKET).remove(data.map((f) => f.name));
    if (data.length < 1000) return;
  }
}

// ---------- API usada pelo app ----------
export async function salvarArquivo(id, blob) {
  if (!supabase) return operar('readwrite', (s) => s.put(blob, id));
  const { error } = await supabase.storage.from(BUCKET).upload(id, blob, { contentType: blob.type || undefined, upsert: true });
  if (error) throw new Error(error.message);
  cache.set(id, blob);
}

export async function obterArquivo(id) {
  if (!supabase) return operar('readonly', (s) => s.get(id));
  if (cache.has(id)) return cache.get(id);
  const { data, error } = await supabase.storage.from(BUCKET).download(id);
  if (error) return null;
  cache.set(id, data);
  return data;
}

export async function excluirArquivo(id) {
  cache.delete(id);
  if (!supabase) return operar('readwrite', (s) => s.delete(id)).catch(() => {});
  await supabase.storage.from(BUCKET).remove([id]).catch(() => {});
}

export async function limparArquivos() {
  cache.clear();
  if (!supabase) return operar('readwrite', (s) => s.clear()).catch(() => {});
  await limparBucket().catch(() => {});
}

// Pede ao navegador para não apagar os arquivos locais quando faltar espaço
export function pedirArmazenamentoPersistente() {
  if (supabase) return;
  try {
    navigator.storage?.persist?.();
  } catch {
    /* ignora */
  }
}

export function fmtTamanho(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
