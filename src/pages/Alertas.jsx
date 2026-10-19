import { useMemo, useState } from 'react';
import { BellRing, CircleCheck, TriangleAlert, Clock, CalendarClock } from 'lucide-react';
import { useModulo } from '../modulos';
import EventoItem from '../components/EventoItem';
import { Chips, EmptyState } from '../components/ui';
import { statusEvento, diasAte } from '../utils';

// modulo: 'ambiental' (empresas) ou 'car' (imóveis rurais)
export default function Alertas({ filtroInicial, modulo = 'ambiental' }) {
  const mod = useModulo(modulo);
  const { eventos, entidades, chaveEntidade: chave } = mod;
  const [filtro, setFiltro] = useState(filtroInicial || 'atencao');
  const [empresaId, setEmpresaId] = useState('');
  const [tipo, setTipo] = useState('');

  const base = useMemo(
    () => eventos.filter((e) => (!empresaId || e[chave] === empresaId) && (!tipo || e.tipo === tipo)),
    [eventos, empresaId, tipo, chave]
  );

  const grupos = useMemo(() => {
    const ord = (a, b) => a.dataVencimento.localeCompare(b.dataVencimento);
    const abertos = base.filter((e) => e.status !== 'concluido');
    return {
      vencido: abertos.filter((e) => statusEvento(e) === 'vencido').sort(ord),
      alerta: abertos.filter((e) => statusEvento(e) === 'alerta').sort(ord),
      proximos: abertos.filter((e) => statusEvento(e) === 'ok' && diasAte(e.dataVencimento) <= 180).sort(ord),
      concluido: base.filter((e) => e.status === 'concluido').sort((a, b) => (b.concluidoEm || '').localeCompare(a.concluidoEm || '')),
    };
  }, [base]);

  const secoes =
    filtro === 'atencao'
      ? [
          { id: 'vencido', titulo: 'Vencidos', icon: TriangleAlert, cls: 'danger' },
          { id: 'alerta', titulo: 'Dentro do prazo de aviso', icon: Clock, cls: 'warning' },
        ]
      : [{ id: filtro, titulo: null }];

  const total = secoes.reduce((n, s) => n + grupos[s.id].length, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{modulo === 'car' ? 'Alertas do CAR' : 'Alertas'}</h1>
          <p className="muted">Vencimentos que precisam de ação</p>
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
      </div>

      <Chips
        value={filtro}
        onChange={setFiltro}
        options={[
          { id: 'atencao', label: 'Precisa de atenção', icon: BellRing, count: grupos.vencido.length + grupos.alerta.length },
          { id: 'vencido', label: 'Vencidos', count: grupos.vencido.length, cls: 'danger' },
          { id: 'alerta', label: 'Vencem em breve', count: grupos.alerta.length, cls: 'warning' },
          { id: 'proximos', label: 'Próximos 6 meses', icon: CalendarClock, count: grupos.proximos.length },
          { id: 'concluido', label: 'Concluídos', icon: CircleCheck, count: grupos.concluido.length },
        ]}
      />

      {total === 0 ? (
        <EmptyState icon={CircleCheck} title="Nenhum item aqui" text={filtro === 'atencao' ? 'Parabéns, está tudo em dia!' : 'Nada para mostrar com estes filtros.'} />
      ) : (
        secoes.map((s) =>
          grupos[s.id].length ? (
            <section key={s.id} className="alert-section">
              {s.titulo && (
                <h2 className={`section-title txt-${s.cls}`}>
                  <s.icon size={18} /> {s.titulo} <span className="muted">({grupos[s.id].length})</span>
                </h2>
              )}
              <div className="card evento-list">
                {grupos[s.id].map((ev) => <EventoItem key={ev.id} ev={ev} modulo={modulo} />)}
              </div>
            </section>
          ) : null
        )
      )}
    </div>
  );
}
