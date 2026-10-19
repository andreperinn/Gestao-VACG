import { useMemo } from 'react';
import { Trees, ClipboardList, Clock, TriangleAlert, ChevronRight, Plus, CalendarDays, CircleCheck, Sprout, Handshake, Ruler } from 'lucide-react';
import { useStore } from '../store';
import { useModais } from '../components/modais';
import EventoItem from '../components/EventoItem';
import { Avatar, Badge, EmptyState } from '../components/ui';
import { CONDICOES_CAR, nomeImovel, fmtHa, calculoRL } from '../car';
import { statusEvento, statusEmpresa } from '../utils';
import { navigate } from '../router';

export default function CarPainel() {
  const { imoveis, carEventos } = useStore();
  const { abrirImovel, abrirCarEvento } = useModais();

  const d = useMemo(() => {
    const pendentes = carEventos.filter((e) => e.status !== 'concluido');
    const vencidos = pendentes.filter((e) => statusEvento(e) === 'vencido');
    const alerta = pendentes.filter((e) => statusEvento(e) === 'alerta');
    const atencao = [...vencidos, ...alerta].sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
    const proximos = pendentes
      .filter((e) => statusEvento(e) === 'ok')
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
      .slice(0, 5);
    const pendAbertas = imoveis.reduce((n, im) => n + (im.pendencias || []).filter((p) => p.status !== 'resolvida').length, 0);
    const areaTotal = imoveis.reduce((s, im) => s + (Number(im.areas?.total) || 0), 0);
    const porCondicao = Object.entries(CONDICOES_CAR).map(([k, c]) => ({ k, ...c, n: imoveis.filter((im) => im.condicao === k).length }));
    const maxCond = Math.max(1, ...porCondicao.map((c) => c.n));
    const passivoRl = imoveis.reduce((s, im) => s + (Number(im.areas?.deficitRl) || calculoRL(im).deficit || 0), 0);
    const passivoApp = imoveis.reduce((s, im) => s + (Number(im.areas?.appRecompor) || 0), 0);
    const comPra = imoveis.filter((im) => im.pra?.adesao).length;
    const ranking = imoveis
      .map((im) => {
        const evs = pendentes.filter((e) => e.imovelId === im.id);
        return {
          im,
          st: statusEmpresa(evs),
          vencidos: evs.filter((e) => statusEvento(e) === 'vencido').length,
          alerta: evs.filter((e) => statusEvento(e) === 'alerta').length,
          pend: (im.pendencias || []).filter((p) => p.status !== 'resolvida').length,
        };
      })
      .sort((a, b) => b.vencidos - a.vencidos || b.alerta - a.alerta || b.pend - a.pend)
      .slice(0, 6);
    return { vencidos, alerta, atencao, proximos, pendAbertas, areaTotal, porCondicao, maxCond, passivoRl, passivoApp, comPra, ranking };
  }, [imoveis, carEventos]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="muted cap">Cadastro Ambiental Rural</p>
          <h1>Painel do CAR</h1>
          <p className="muted">
            {d.atencao.length
              ? `${d.atencao.length} prazo(s) de imóveis rurais precisam de atenção.`
              : 'Nenhum prazo do CAR vencido ou dentro do período de aviso.'}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => abrirCarEvento()}><CalendarDays size={16} /> Novo evento</button>
          <button className="btn btn-primary" onClick={() => abrirImovel()}><Plus size={16} /> Novo imóvel</button>
        </div>
      </div>

      <div className="kpis">
        <Kpi icon={Trees} cor="#15803d" valor={imoveis.length} label="Imóveis rurais" extra={d.areaTotal ? fmtHa(d.areaTotal) : null} onClick={() => navigate('/car/imoveis')} />
        <Kpi icon={ClipboardList} cor="#7c3aed" valor={d.pendAbertas} label="Pendências em aberto" onClick={() => navigate('/car/imoveis')} />
        <Kpi icon={Clock} cor="#d97706" valor={d.alerta.length} label="Prazos vencendo" onClick={() => navigate('/car/alertas/alerta')} destaque={d.alerta.length ? 'warning' : ''} />
        <Kpi icon={TriangleAlert} cor="#dc2626" valor={d.vencidos.length} label="Prazos vencidos" onClick={() => navigate('/car/alertas/vencido')} destaque={d.vencidos.length ? 'danger' : ''} />
      </div>

      <div className="dash-grid">
        <section className="card span-2">
          <div className="card-head">
            <h2><TriangleAlert size={18} /> Atenção agora</h2>
            <a href="#/car/alertas" className="link">Ver todos <ChevronRight size={16} /></a>
          </div>
          {d.atencao.length === 0 ? (
            <EmptyState icon={CircleCheck} title="Nada pendente" text="Nenhum prazo do CAR vencido ou dentro do aviso." />
          ) : (
            <div className="evento-list">
              {d.atencao.slice(0, 7).map((ev) => <EventoItem key={ev.id} ev={ev} modulo="car" />)}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2><Trees size={18} /> Condição da análise</h2></div>
          <div className="barras-h">
            {d.porCondicao.map((c) => (
              <button key={c.k} className="barra-h" onClick={() => navigate('/car/imoveis')}>
                <span className="barra-rotulo">{c.curto}</span>
                <span className="barra-trilho"><span style={{ width: `${(c.n / d.maxCond) * 100}%`, background: c.cor }} /></span>
                <b>{c.n}</b>
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2><Trees size={18} /> Situação dos imóveis</h2>
            <a href="#/car/imoveis" className="link">Todos <ChevronRight size={16} /></a>
          </div>
          {d.ranking.length === 0 ? (
            <EmptyState icon={Trees} title="Nenhum imóvel" action={<button className="btn btn-primary btn-sm" onClick={() => abrirImovel()}>Cadastrar imóvel</button>} />
          ) : (
            <div className="mini-list">
              {d.ranking.map(({ im, vencidos, alerta, pend }) => (
                <button key={im.id} className="mini-item" onClick={() => navigate(`/car/imoveis/${im.id}`)}>
                  <Avatar nome={nomeImovel(im)} size={36} />
                  <div className="grow">
                    <strong>{nomeImovel(im)}</strong>
                    <span className="muted small">{im.municipio ? `${im.municipio}/${im.uf} · ` : ''}{pend} pendência(s)</span>
                  </div>
                  {vencidos > 0 ? <Badge cls="danger">{vencidos} vencido(s)</Badge>
                    : alerta > 0 ? <Badge cls="warning">{alerta} em alerta</Badge>
                    : <Badge cls="success" dot>Em dia</Badge>}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2><Clock size={18} /> Próximos prazos</h2>
            <a href="#/car/agenda" className="link">Agenda <ChevronRight size={16} /></a>
          </div>
          {d.proximos.length === 0 ? (
            <p className="muted small">Nenhum prazo futuro fora do período de aviso.</p>
          ) : (
            <div className="evento-list">
              {d.proximos.map((ev) => <EventoItem key={ev.id} ev={ev} compact modulo="car" />)}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2><Sprout size={18} /> Passivo ambiental</h2></div>
          <div className="mensal-dash">
            <div>
              <span className="muted small">Déficit de Reserva Legal</span>
              <b className={d.passivoRl > 0 ? 'txt-danger' : ''}>{fmtHa(d.passivoRl)}</b>
            </div>
            <div>
              <span className="muted small">APP a recompor</span>
              <b className={d.passivoApp > 0 ? 'txt-warning' : ''}>{fmtHa(d.passivoApp)}</b>
            </div>
          </div>
          <p className="muted small mt-sm"><Handshake size={14} /> {d.comPra} de {imoveis.length} imóvel(is) com adesão ao PRA</p>
          <p className="muted small mt-sm"><Ruler size={14} /> Déficit de RL usa o valor informado ou, se vazio, a estimativa pelo bioma.</p>
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
        <div className="kpi-valor">{valor}</div>
        <div className="kpi-label">{label}{extra && <> · {extra}</>}</div>
      </div>
    </button>
  );
}
