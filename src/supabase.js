import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sem as variáveis no .env, o sistema funciona em modo local (dados no navegador).
export const supabase = url && chave ? createClient(url, chave) : null;
