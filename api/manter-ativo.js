// Chamado uma vez por dia pelo agendador da Vercel (vercel.json → crons) e,
// como reserva, por um agendamento do GitHub (.github/workflows/manter-ativo.yml).
// Grava um sinal no banco (função manter_ativo do schema.sql) para o projeto
// do plano gratuito do Supabase não ser pausado por inatividade.
export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL;
  const chave = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) {
    return res.status(500).json({ ok: false, erro: 'Variáveis do Supabase não configuradas' });
  }
  const origem = req.headers['user-agent']?.includes('vercel-cron') ? 'vercel' : String(req.query?.origem || 'manual').slice(0, 40);
  try {
    const r = await fetch(`${url}/rest/v1/rpc/manter_ativo`, {
      method: 'POST',
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_origem: origem }),
    });
    const corpo = await r.text();
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, origem, sinal: r.ok ? JSON.parse(corpo) : corpo.slice(0, 200) });
  } catch (e) {
    return res.status(502).json({ ok: false, origem, erro: e.message });
  }
}
