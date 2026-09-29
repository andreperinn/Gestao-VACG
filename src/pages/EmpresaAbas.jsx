import { useState } from 'react';
import { Briefcase, Pencil, Plus, Wallet, ChevronLeft, ChevronRight, CircleCheck, TriangleAlert, CalendarClock, Banknote, StickyNote } from 'lucide-react';
import { useStore } from '../store';
import { useModais } from '../components/modais';
import { EmptyState, useUI } from '../components/ui';
import Documentos from '../components/Documentos';
import { STATUS_SERVICO } from '../constants';
import { mensalidadeVazia, statusMes, mesesAtrasados, fmtMoeda, STATUS_MES, vencimentoDoMes } from '../mensalidade';
import { excluirArquivo } from '../arquivos';
import { fmtData, hojeISO, MESES, MESES_CURTOS } from '../utils';

// ---------- Serviços ----------
export function ServicosTab({ e }) {
  const { atualizarEmpresa } = useStore();
  const { abrirEmpresa } = useModais();
  const servicos = e.servicos || [];
  const ciclo = { ativo: 'pausado', pausado: 'encerrado', encerrado: 'ativo' };

  const mudarStatus = (s) =>
    atualizarEmpresa(e.id, (emp) => ({
      ...emp,
      servicos: emp.servicos.map((x) => (x.id === s.id ? { ...x, status: ciclo[x.status] || 'ativo' } : x)),
    }));

  if (!servicos.length) {
    return (
      <EmptyState icon={Briefcase} title="Nenhum serviço cadastrado"
        text="Registre o que a VACG faz para esta empresa: licenciamento, análises, monitoramentos…"
        action={<button className="btn btn-primary" onClick={() => abrirEmpresa(e, 'servicos')}><Plus size={16} /> Adicionar serviços</button>} />
    );
  }

  return (
    <div>
      <div className="row-between wrap gap">
        <p className="muted small">{servicos.filter((s) => s.status === 'ativo').length} serviço(s) ativo(s) · toque na situação para alterar</p>
        <button className="btn btn-primary" onClick={() => abrirEmpresa(e, 'servicos')}><Pencil size={16} /> Editar serviços</button>
      </div>
      <div className="servico-grid">
        {servicos.map((s) => (
          <div key={s.id} className={`servico-card ss-${s.status}`}>
            <div className="servico-head">
              <div className="kpi-icon" style={{ '--c': '#15803d' }}><Briefcase size={20} /></div>
              <strong className="grow">{s.nome || 'Serviço sem nome'}</strong>
              <button className={`badge badge-${STATUS_SERVICO[s.status]?.cls || 'muted'} badge-btn`} onClick={() => mudarStatus(s)} title="Mudar situação">
                {STATUS_SERVICO[s.status]?.label || s.status}
              </button>
            </div>
            {s.descricao && <p className="servico-desc">{s.descricao}</p>}
            {s.inicio && <span className="muted small"><CalendarClock size={13} /> Desde {fmtData(s.inicio)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Mensalidade ----------
export function MensalidadeTab({ e }) {
  const { atualizarEmpresa } = useStore();
  const { abrirEmpresa } = useModais();
  const { toast, confirm } = useUI();
  const [ano, setAno] = useState(new Date().getFullYear());
  const m = { ...mensalidadeVazia(), ...e.mensalidade };

  if (!e.mensalidade?.ativa && !Object.keys(m.pagamentos || {}).length) {
    return (
      <EmptyState icon={Wallet} title="Mensalidade não configurada"
        text="Defina o valor, o dia de vencimento e a forma de pagamento para acompanhar os recebimentos."
        action={<button className="btn btn-primary" onClick={() => abrirEmpresa(e, 'mensalidade')}><Wallet size={16} /> Configurar mensalidade</button>} />
    );
  }

  const atrasados = mesesAtrasados(m);
  const valor = Number(m.valor) || 0;
  const pagamentosAno = Object.entries(m.pagamentos || {}).filter(([ym, p]) => p.pago && ym.startsWith(String(ano)));
  const recebidoAno = pagamentosAno.reduce((s, [, p]) => s + (Number(p.valor) || 0), 0);

  const alternar = async (ym) => {
    const [y, mm] = ym.split('-').map(Number);
    const nomeMes = `${MESES[mm - 1]}/${y}`;
    if (m.pagamentos?.[ym]?.pago) {
      const ok = await confirm({ title: 'Desmarcar pagamento?', message: `${nomeMes} voltará a ficar como não pago.`, confirmLabel: 'Desmarcar' });
      if (!ok) return;
      atualizarEmpresa(e.id, (emp) => {
        const pagamentos = { ...emp.mensalidade.pagamentos };
        delete pagamentos[ym];
        return { ...emp, mensalidade: { ...emp.mensalidade, pagamentos } };
      });
      toast(`${nomeMes} desmarcado`, 'info');
    } else {
      atualizarEmpresa(e.id, (emp) => ({
        ...emp,
        mensalidade: {
          ...mensalidadeVazia(),
          ...emp.mensalidade,
          pagamentos: { ...(emp.mensalidade?.pagamentos || {}), [ym]: { pago: true, dataPagamento: hojeISO(), valor } },
        },
      }));
      toast(`${nomeMes} marcado como pago`);
    }
  };

  return (
    <div className="mensal">
      <div className="mensal-resumo">
        <div className="stat"><Banknote size={18} /><b>{fmtMoeda(valor)}</b><span>por mês · {m.formaPagamento}</span></div>
        <div className="stat"><CalendarClock size={18} /><b>Dia {m.diaVencimento}</b><span>vencimento{m.ativa ? '' : ' (inativa)'}</span></div>
        <div className={`stat${atrasados.length ? ' stat-danger' : ''}`}>
          <TriangleAlert size={18} />
          <b>{atrasados.length}</b>
          <span>{atrasados.length ? `em atraso · ${fmtMoeda(atrasados.length * valor)}` : 'meses em atraso'}</span>
        </div>
        <div className="stat"><CircleCheck size={18} /><b>{fmtMoeda(recebidoAno)}</b><span>recebido em {ano}</span></div>
      </div>

      <div className="card">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => setAno((a) => a - 1)} aria-label="Ano anterior"><ChevronLeft size={20} /></button>
          <h2>{ano}</h2>
          <button className="icon-btn" onClick={() => setAno((a) => a + 1)} aria-label="Próximo ano"><ChevronRight size={20} /></button>
          <button className="btn btn-sm" onClick={() => abrirEmpresa(e, 'mensalidade')}><Pencil size={14} /> <span className="hide-mobile">Editar</span></button>
        </div>
        <div className="meses-grid">
          {MESES_CURTOS.map((nome, i) => {
            const ym = `${ano}-${String(i + 1).padStart(2, '0')}`;
            const st = statusMes(m, ym);
            const pg = m.pagamentos?.[ym];
            return (
              <button key={ym} className={`mes-tile ms-${st}`} onClick={() => alternar(ym)}
                title={st === 'pago' ? 'Clique para desmarcar' : 'Clique para marcar como pago'}>
                <span className="mes-nome">{nome}</span>
                <span className="mes-status">
                  {st === 'pago' ? <CircleCheck size={16} /> : st === 'atrasado' ? <TriangleAlert size={16} /> : null}
                  {STATUS_MES[st].label}
                </span>
                <span className="mes-info">
                  {st === 'pago' ? `em ${fmtData(pg.dataPagamento)}` : ['aberto', 'atrasado'].includes(st) ? `vence ${fmtData(vencimentoDoMes(ym, m.diaVencimento), { day: '2-digit', month: '2-digit' })}` : ''}
                </span>
              </button>
            );
          })}
        </div>
        <p className="muted small cal-tip">Toque em um mês para marcar como pago. Toque de novo para desfazer.</p>
      </div>

      {m.observacoes && <div className="note"><StickyNote size={16} /> {m.observacoes}</div>}
    </div>
  );
}

// ---------- Documentos ----------
export function DocumentosTab({ e }) {
  const { atualizarEmpresa } = useStore();
  const { abrirEvento } = useModais();
  const { toast, confirm } = useUI();

  return (
    <Documentos
      anexos={e.anexos || []}
      onAdicionar={(novos) => atualizarEmpresa(e.id, (emp) => ({ ...emp, anexos: [...(emp.anexos || []), ...novos] }))}
      onAtualizar={(id, patch) =>
        atualizarEmpresa(e.id, (emp) => ({ ...emp, anexos: emp.anexos.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
      }
      onRemover={async (anexo) => {
        const ok = await confirm({ title: 'Remover documento?', message: `"${anexo.nome}" será apagado permanentemente.`, confirmLabel: 'Remover' });
        if (!ok) return;
        excluirArquivo(anexo.id);
        atualizarEmpresa(e.id, (emp) => ({ ...emp, anexos: emp.anexos.filter((a) => a.id !== anexo.id) }));
        toast('Documento removido', 'info');
      }}
      onCriarAviso={(a) =>
        abrirEvento({
          empresaId: e.id,
          tipo: a.categoria === 'licenca' ? 'licenca' : a.categoria === 'laudo' ? 'analise' : 'outro',
          titulo: `Vencimento: ${a.descricao || a.nome}`,
          documento: a.descricao,
          dataVencimento: a.validade,
          antecedenciaDias: a.categoria === 'licenca' ? 120 : 30,
        })
      }
    />
  );
}

