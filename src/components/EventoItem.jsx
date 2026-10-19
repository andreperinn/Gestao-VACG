import { Check, Pencil, Trash2, Repeat, Undo2 } from 'lucide-react';
import { useModulo } from '../modulos';
import { STATUS, statusEvento, textoPrazo, fmtData, RECORRENCIAS } from '../utils';
import { useUI } from './ui';
import { navigate } from '../router';

// modulo: 'ambiental' (eventos das empresas) ou 'car' (eventos dos imóveis rurais)
export default function EventoItem({ ev, showEmpresa = true, compact = false, modulo = 'ambiental' }) {
  const mod = useModulo(modulo);
  const { toast, confirm } = useUI();

  const { abrirEvento } = mod;
  const tipo = mod.tipos[ev.tipo] || mod.tipos.outro;
  const Icon = tipo.icon;
  const st = statusEvento(ev);
  const emp = mod.entidadePorId[ev[mod.chaveEntidade]];
  const IconeEntidade = mod.iconeEntidade;
  const recorrente = ev.recorrencia && ev.recorrencia !== 'nenhuma';

  const concluir = (e) => {
    e.stopPropagation();
    const prox = mod.concluir(ev);
    toast(prox ? `Concluído! Próximo agendado para ${fmtData(prox)}` : 'Evento concluído');
  };

  const reabrir = (e) => {
    e.stopPropagation();
    mod.reabrir(ev.id);
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
      mod.excluir(ev.id);
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
                navigate(mod.rotaEntidade(emp.id));
              }}
            >
              <IconeEntidade size={13} />
              {mod.nomeEntidade(emp)}
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
