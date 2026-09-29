import { Check, Pencil, Trash2, Repeat, Undo2, Building2 } from 'lucide-react';
import { TIPOS_EVENTO } from '../constants';
import { STATUS, statusEvento, textoPrazo, fmtData, nomeEmpresa, RECORRENCIAS } from '../utils';
import { useStore } from '../store';
import { useUI } from './ui';
import { useModais } from './modais';
import { navigate } from '../router';

export default function EventoItem({ ev, showEmpresa = true, compact = false }) {
  const { empresaPorId, concluirEvento, reabrirEvento, excluirEvento } = useStore();
  const { toast, confirm } = useUI();
  const { abrirEvento } = useModais();

  const tipo = TIPOS_EVENTO[ev.tipo] || TIPOS_EVENTO.outro;
  const Icon = tipo.icon;
  const st = statusEvento(ev);
  const emp = empresaPorId[ev.empresaId];
  const recorrente = ev.recorrencia && ev.recorrencia !== 'nenhuma';

  const concluir = (e) => {
    e.stopPropagation();
    const prox = concluirEvento(ev);
    toast(prox ? `Concluído! Próximo agendado para ${fmtData(prox)}` : 'Evento concluído');
  };

  const reabrir = (e) => {
    e.stopPropagation();
    reabrirEvento(ev.id);
    toast('Evento reaberto', 'info');
  };

  const excluir = async (e) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Excluir evento?',
      message: `"${ev.titulo}" será removido permanentemente.`,
      confirmLabel: 'Excluir',
    });
    if (ok) {
      excluirEvento(ev.id);
      toast('Evento excluído', 'info');
    }
  };

  return (
    <div className={`evento st-${st}${compact ? ' compact' : ''}`} onClick={() => abrirEvento(ev)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && abrirEvento(ev)}>
      <div className="evento-icon" style={{ '--c': tipo.cor }} title={tipo.label}>
        <Icon size={18} />
      </div>
      <div className="evento-main">
        <div className="evento-title">{ev.titulo}</div>
        <div className="evento-meta">
          {showEmpresa && emp && (
            <button
              type="button"
              className="link-inline"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/empresas/${emp.id}`);
              }}
            >
              <Building2 size={13} />
              {nomeEmpresa(emp)}
            </button>
          )}
          <span>{tipo.curto}</span>
          {ev.documento && <span>{ev.documento}</span>}
          {recorrente && (
            <span className="meta-rec" title={`Repete: ${RECORRENCIAS[ev.recorrencia]?.label}`}>
              <Repeat size={12} />
              {RECORRENCIAS[ev.recorrencia]?.label}
            </span>
          )}
        </div>
      </div>
      <div className="evento-date">
        <span className={`badge badge-${STATUS[st].cls}`}>{textoPrazo(ev)}</span>
        <small className="muted">
          {st === 'concluido' ? `em ${fmtData(ev.concluidoEm)}` : fmtData(ev.dataVencimento)}
        </small>
      </div>
      <div className="evento-actions">
        {st === 'concluido' ? (
          <button className="icon-btn" title="Reabrir" onClick={reabrir}>
            <Undo2 size={17} />
          </button>
        ) : (
          <button className="icon-btn btn-check" title="Marcar como concluído" onClick={concluir}>
            <Check size={18} />
          </button>
        )}
        {!compact && (
          <>
            <button className="icon-btn hide-mobile" title="Editar" onClick={(e) => { e.stopPropagation(); abrirEvento(ev); }}>
              <Pencil size={16} />
            </button>
            <button className="icon-btn danger hide-mobile" title="Excluir" onClick={excluir}>
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
