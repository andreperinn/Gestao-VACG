import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarPlus, CalendarDays } from 'lucide-react';
import { useModulo } from '../modulos';
import EventoItem from '../components/EventoItem';
import { EmptyState } from '../components/ui';
import { MESES, toISO, hojeISO, fmtData, statusEvento } from '../utils';

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// modulo: 'ambiental' (empresas) ou 'car' (imóveis rurais)
export default function Agenda({ modulo = 'ambiental' }) {
  const mod = useModulo(modulo);
  const { eventos, entidades, abrirEvento, chaveEntidade: chave } = mod;
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [sel, setSel] = useState(hojeISO());
  const [empresaId, setEmpresaId] = useState('');
  const [tipo, setTipo] = useState('');
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false);

  const filtrados = useMemo(
    () =>
      eventos.filter(
        (e) =>
          (!empresaId || e[chave] === empresaId) &&
          (!tipo || e.tipo === tipo) &&
          (mostrarConcluidos || e.status !== 'concluido')
      ),
    [eventos, empresaId, tipo, mostrarConcluidos]
  );

  const porDia = useMemo(() => {
    const m = {};
    filtrados.forEach((e) => (m[e.dataVencimento] ||= []).push(e));
    return m;
  }, [filtrados]);

  const dias = useMemo(() => {
    const inicio = new Date(cursor);
    inicio.setDate(1 - cursor.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });
  }, [cursor]);

  const mudarMes = (n) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const irHoje = () => {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setSel(hojeISO());
  };

  const hj = hojeISO();
  const doDia = porDia[sel] || [];
  const doMes = filtrados
    .filter((e) => e.dataVencimento.startsWith(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`))
    .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{modulo === 'car' ? 'Agenda do CAR' : 'Agenda'}</h1>
          <p className="muted">{modulo === 'car' ? 'Prazos dos imóveis rurais: retificações, notificações, PRA e recomposição' : 'Calendário de vencimentos e eventos de controle'}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => abrirEvento({ dataVencimento: sel, [chave]: empresaId })}>
            <CalendarPlus size={16} /> Novo evento
          </button>
        </div>
      </div>

      <div className="toolbar wrap">
        <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className="select-inline">
          <option value="">{modulo === 'car' ? 'Todos os imóveis' : 'Todas as empresas'}</option>
          {entidades.map((e) => <option key={e.id} value={e.id}>{mod.nomeEntidade(e)}</option>)}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="select-inline">
          <option value="">Todos os tipos</option>
          {Object.entries(mod.tipos).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
        <label className="check small">
          <input type="checkbox" checked={mostrarConcluidos} onChange={(e) => setMostrarConcluidos(e.target.checked)} />
          Mostrar concluídos
        </label>
      </div>

      <div className="agenda-layout">
        <section className="card cal">
          <div className="cal-head">
            <button className="icon-btn" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><ChevronLeft size={20} /></button>
            <h2>{MESES[cursor.getMonth()]} <span className="muted">{cursor.getFullYear()}</span></h2>
            <button className="icon-btn" onClick={() => mudarMes(1)} aria-label="Próximo mês"><ChevronRight size={20} /></button>
            <button className="btn btn-sm" onClick={irHoje}>Hoje</button>
          </div>
          <div className="cal-grid cal-week">
            {SEMANA.map((s) => <div key={s}>{s}</div>)}
          </div>
          <div className="cal-grid">
            {dias.map((d) => {
              const iso = toISO(d);
              const evs = porDia[iso] || [];
              const fora = d.getMonth() !== cursor.getMonth();
              return (
                <button
                  key={iso}
                  className={`cal-day${fora ? ' fora' : ''}${iso === hj ? ' hoje' : ''}${iso === sel ? ' sel' : ''}`}
                  onClick={() => setSel(iso)}
                  onDoubleClick={() => abrirEvento({ dataVencimento: iso, [chave]: empresaId })}
                >
                  <span className="cal-num">{d.getDate()}</span>
                  <div className="cal-evs">
                    {evs.slice(0, 3).map((e) => (
                      <span key={e.id} className={`cal-ev st-${statusEvento(e)}`} style={{ '--c': mod.tipos[e.tipo]?.cor }}>
                        <span className="cal-ev-txt">{e.titulo}</span>
                      </span>
                    ))}
                    {evs.length > 3 && <span className="cal-more">+{evs.length - 3}</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="muted small cal-tip">Toque em um dia para ver os eventos · duplo clique para criar um novo</p>
        </section>

        <section className="card">
          <div className="card-head">
            <h2><CalendarDays size={18} /> {fmtData(sel, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          </div>
          {doDia.length === 0 ? (
            <EmptyState icon={CalendarPlus} title="Nenhum evento neste dia"
              action={<button className="btn btn-sm" onClick={() => abrirEvento({ dataVencimento: sel, [chave]: empresaId })}>Criar evento neste dia</button>} />
          ) : (
            <div className="evento-list">
              {doDia.map((ev) => <EventoItem key={ev.id} ev={ev} compact modulo={modulo} />)}
            </div>
          )}

          <div className="card-head mt">
            <h2>Todos em {MESES[cursor.getMonth()].toLowerCase()} <span className="muted">({doMes.length})</span></h2>
          </div>
          {doMes.length === 0 ? (
            <p className="muted small">Nenhum vencimento neste mês.</p>
          ) : (
            <div className="evento-list">
              {doMes.map((ev) => <EventoItem key={ev.id} ev={ev} compact modulo={modulo} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
