// Chamado uma vez por dia pelo agendador da Vercel (vercel.json → crons).
// Faz uma consulta simples no Supabase para o projeto do plano gratuito
// não ser pausado por inatividade.
export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL;
  const chave = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) {
    return res.status(500).json({ ok: false, erro: 'Variáveis do Supabase não configuradas' });
  }
  try {
    const r = await fetch(`${url}/rest/v1/empresas?select=id&limit=1`, { headers: { apikey: chave } });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, em: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ ok: false, erro: e.message });
  }
}
