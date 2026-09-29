import { useMemo } from 'react';
import { Building2, ClipboardList, Clock, TriangleAlert, ChevronRight, Sparkles, CalendarDays, Plus, CircleCheck, Wallet } from 'lucide-react';
import { useStore } from '../store';
import { useModais } from '../components/modais';
import EventoItem from '../components/EventoItem';
import { Avatar, EmptyState, Badge } from '../components/ui';
import { TIPOS_EVENTO } from '../constants';
import { statusEvento, parseData, hoje, MESES_CURTOS, nomeEmpresa, statusEmpresa, STATUS, diasAte } from '../utils';
import { navigate } from '../router';
import { mesISO, statusMes, mesesAtrasados, fmtMoeda } from '../mensalidade';
import { MESES } from '../utils';

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default function Dashboard() {
  const { empresas, eventos, exemplo } = useStore();
  const { abrirEmpresa, abrirEvento } = useModais();

  const dados = useMemo(() => {
    const pendentes = eventos.filter((e) => e.status !== 'concluido');
    const comStatus = pendentes.map((e) => ({ ev: e, st: statusEvento(e) }));
    const vencidos = comStatus.filter((x) => x.st === 'vencido').map((x) => x.ev);
    const alerta = comStatus.filter((x) => x.st === 'alerta').map((x) => x.ev);
    const atencao = [...vencidos, ...alerta].sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
    const proximos = comStatus
      .filter((x) => x.st === 'ok')
      .map((x) => x.ev)
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
      .slice(0, 5);

    const condPendentes = empresas.reduce(
      (n, e) => n + (e.condicionantes || []).filter((c) => c.status !== 'cumprida').length,
      0
    );
    const condTotal = empresas.reduce((n, e) => n + (e.condicionantes || []).length, 0);

    // Vencimentos por mês (próximos 6 meses)
    const h = hoje();
    const meses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(h.getFullYear(), h.getMonth() + i, 1);
      return { ano: d.getFullYear(), mes: d.getMonth(), label: MESES_CURTOS[d.getMonth()], total: 0, porTipo: {} };
    });
    pendentes.forEach((e) => {
      const d = parseData(e.dataVencimento);
      const m = meses.find((x) => x.ano === d.getFullYear() && x.mes === d.getMonth());
      if (m) {
        m.total++;
        m.porTipo[e.tipo] = (m.porTipo[e.tipo] || 0) + 1;
      }
    });
    const max = Math.max(1, ...meses.map((m) => m.total));

    const porTipo = Object.keys(TIPOS_EVENTO).map((k) => ({ k, n: pendentes.filter((e) => e.tipo === k).length })).filter((x) => x.n);

    const empresasRanking = empresas
      .map((e) => {
        const evs = pendentes.filter((x) => x.empresaId === e.id);
        return {
          e,
          st: statusEmpresa(evs),
          vencidos: evs.filter((x) => statusEvento(x) === 'vencido').length,
          alerta: evs.filter((x) => statusEvento(x) === 'alerta').length,
          total: evs.length,
        };
      })
      .sort((a, b) => b.vencidos - a.vencidos || b.alerta - a.alerta)
      .slice(0, 6);

    const concluidosMes = eventos.filter((e) => e.status === 'concluido' && e.concluidoEm && diasAte(e.concluidoEm) >= -30).length;

    // Mensalidades do mês atual
    const ym = mesISO();
    const comMensal = empresas.filter((e) => e.mensalidade?.ativa);
    const mensal = {
      previsto: comMensal.reduce((s, e) => s + (Number(e.mensalidade.valor) || 0), 0),
      recebido: comMensal.filter((e) => statusMes(e.mensalidade, ym) === 'pago').reduce((s, e) => s + (Number(e.mensalidade.pagamentos[ym]?.valor) || 0), 0),
      pagos: comMensal.filter((e) => statusMes(e.mensalidade, ym) === 'pago').length,
      total: comMensal.length,
      atrasadas: comMensal.map((e) => ({ e, n: mesesAtrasados(e.mensalidade).length })).filter((x) => x.n > 0),
    };

    return { vencidos, alerta, atencao, proximos, condPendentes, condTotal, meses, max, porTipo, empresasRanking, pendentes, concluidosMes, mensal };
  }, [empresas, eventos]);

  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="muted cap">{dataHoje}</p>
          <h1>{saudacao()}! 👋</h1>
          <p className="muted">
            {dados.atencao.length
              ? `Você tem ${dados.atencao.length} ${dados.atencao.length === 1 ? 'item que precisa' : 'itens que precisam'} de atenção.`
              : 'Tudo em dia por aqui. Nenhum vencimento próximo.'}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => abrirEvento()}><CalendarDays size={16} /> Novo evento</button>
          <button className="btn btn-primary" onClick={() => abrirEmpresa()}><Plus size={16} /> Nova empresa</button>
        </div>
      </div>

      {exemplo && (
        <div className="banner">
          <Sparkles size={18} />
          <span>Estes são <b>dados de exemplo</b> para você conhecer o sistema. Quando quiser, limpe tudo em <a href="#/dados">Dados</a>.</span>
        </div>
      )}

      <div className="kpis">
        <Kpi icon={Building2} cor="#15803d" valor={empresas.length} label="Empresas" onClick={() => navigate('/empresas')} />
        <Kpi icon={ClipboardList} cor="#7c3aed" valor={dados.condPendentes} label="Condicionantes em aberto" extra={`de ${dados.condTotal}`} onClick={() => navigate('/empresas')} />
        <Kpi icon={Clock} cor="#d97706" valor={dados.alerta.length} label="Vencem em breve" onClick={() => navigate('/alertas/alerta')} destaque={dados.alerta.length > 0 ? 'warning' : ''} />
        <Kpi icon={TriangleAlert} cor="#dc2626" valor={dados.vencidos.length} label="Vencidos" onClick={() => navigate('/alertas/vencido')} destaque={dados.vencidos.length > 0 ? 'danger' : ''} />
      </div>

      <div className="dash-grid">
        <section className="card span-2">
          <div className="card-head">
            <h2><TriangleAlert size={18} /> Atenção agora</h2>
            <a href="#/alertas" className="link">Ver todos <ChevronRight size={16} /></a>
          </div>
          {dados.atencao.length === 0 ? (
            <EmptyState icon={CircleCheck} title="Nada pendente" text="Nenhum item vencido ou dentro do prazo de aviso." />
          ) : (
            <div className="evento-list">
              {dados.atencao.slice(0, 7).map((ev) => <EventoItem key={ev.id} ev={ev} />)}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2><CalendarDays size={18} /> Vencimentos por mês</h2>
          </div>
          <div className="bars">
            {dados.meses.map((m) => (
              <div key={`${m.ano}-${m.mes}`} className="bar-col" title={`${m.total} vencimento(s)`}>
                <span className="bar-val">{m.total || ''}</span>
                <div className="bar-track">
                  <div className="bar-stack" style={{ height: `${(m.total / dados.max) * 100}%` }}>
                    {Object.entries(m.porTipo).map(([t, n]) => (
                      <div key={t} style={{ flex: n, background: TIPOS_EVENTO[t]?.cor }} />
                    ))}
                  </div>
                </div>
                <span className="bar-label">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="legend">
            {dados.porTipo.map(({ k, n }) => (
              <span key={k} className="legend-item">
                <i style={{ background: TIPOS_EVENTO[k].cor }} />
                {TIPOS_EVENTO[k].curto} <b>{n}</b>
              </span>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2><Building2 size={18} /> Situação das empresas</h2>
            <a href="#/empresas" className="link">Todas <ChevronRight size={16} /></a>
          </div>
          {dados.empresasRanking.length === 0 ? (
            <EmptyState icon={Building2} title="Nenhuma empresa" action={<button className="btn btn-primary btn-sm" onClick={() => abrirEmpresa()}>Cadastrar empresa</button>} />
          ) : (
            <div className="mini-list">
              {dados.empresasRanking.map(({ e, st, vencidos, alerta, total }) => (
                <button key={e.id} className="mini-item" onClick={() => navigate(`/empresas/${e.id}`)}>
                  <Avatar nome={nomeEmpresa(e)} size={36} />
                  <div className="grow">
                    <strong>{nomeEmpresa(e)}</strong>
                    <span className="muted small">{total} evento(s) em aberto</span>
                  </div>
                  {vencidos > 0 ? <Badge cls="danger">{vencidos} vencido{vencidos > 1 ? 's' : ''}</Badge>
                    : alerta > 0 ? <Badge cls="warning">{alerta} em alerta</Badge>
                    : <Badge cls={STATUS[st].cls} dot>Em dia</Badge>}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2><Clock size={18} /> Próximos vencimentos</h2>
            <a href="#/agenda" className="link">Agenda <ChevronRight size={16} /></a>
          </div>
          {dados.proximos.length === 0 ? (
            <p className="muted small">Nenhum vencimento futuro fora do período de aviso.</p>
          ) : (
            <div className="evento-list">
              {dados.proximos.map((ev) => <EventoItem key={ev.id} ev={ev} compact />)}
            </div>
          )}
          <p className="muted small mt">
            <CircleCheck size={14} /> {dados.concluidosMes} evento(s) concluído(s) nos últimos 30 dias
          </p>
        </section>

        <section className="card">
          <div className="card-head">
            <h2><Wallet size={18} /> Mensalidades · {MESES[new Date().getMonth()].toLowerCase()}</h2>
          </div>
          {dados.mensal.total === 0 ? (
            <EmptyState icon={Wallet} title="Nenhuma mensalidade ativa" text="Configure na aba Mensalidade do cadastro de cada empresa." />
          ) : (
            <>
              <div className="mensal-dash">
                <div>
                  <span className="muted small">Recebido</span>
                  <b className="txt-success">{fmtMoeda(dados.mensal.recebido)}</b>
                </div>
                <div>
                  <span className="muted small">Previsto</span>
                  <b>{fmtMoeda(dados.mensal.previsto)}</b>
                </div>
              </div>
              <div className="progress"><div style={{ width: `${dados.mensal.previsto ? Math.min(100, (dados.mensal.recebido / dados.mensal.previsto) * 100) : 0}%` }} /></div>
              <p className="muted small mt-sm">{dados.mensal.pagos} de {dados.mensal.total} empresas pagaram este mês</p>
              {dados.mensal.atrasadas.length > 0 && (
                <div className="mini-list mt">
                  {dados.mensal.atrasadas.map(({ e, n }) => (
                    <button key={e.id} className="mini-item" onClick={() => navigate(`/empresas/${e.id}`)}>
                      <Avatar nome={nomeEmpresa(e)} size={32} />
                      <div className="grow"><strong>{nomeEmpresa(e)}</strong></div>
                      <Badge cls="danger">{n} em atraso</Badge>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, cor, valor, label, extra, onClick, destaque }) {
  return (
    <button className={`kpi${destaque ? ` kpi-${destaque}` : ''}`} onClick={onClick}>
      <div className="kpi-icon" style={{ '--c': cor }}><Icon size={22} /></div>
      <div>
        <div className="kpi-valor">{valor}{extra && <small> {extra}</small>}</div>
        <div className="kpi-label">{label}</div>
      </div>
    </button>
  );
}
