import { useState } from 'react';
import { Plus, Trash2, ListPlus, ClipboardList, CalendarClock } from 'lucide-react';
import { TIPOS_PENDENCIA, STATUS_PENDENCIA } from '../car';
import { RECORRENCIAS, uid } from '../utils';
import { Field, EmptyState } from './ui';

export function novaPendencia(extra = {}) {
  return {
    id: uid(),
    numero: '',
    tipo: 'notificacao',
    origem: '',
    descricao: '',
    prazo: '',
    periodicidade: 'nenhuma',
    status: 'pendente',
    gerarEvento: true,
    ...extra,
  };
}

// Pendências do CAR (notificações da análise, retificações, PRA…), no mesmo modelo das condicionantes
export default function PendenciasEditor({ value, onChange, eventosVinculados = new Set() }) {
  const [colar, setColar] = useState(false);
  const [texto, setTexto] = useState('');
  const [origemPadrao, setOrigemPadrao] = useState('');

  const atualizar = (id, campo, v) => onChange(value.map((p) => (p.id === id ? { ...p, [campo]: v } : p)));
  const remover = (id) => onChange(value.filter((p) => p.id !== id));
  const adicionar = () => {
    const ultima = value[value.length - 1];
    onChange([...value, novaPendencia({ numero: String(value.length + 1).padStart(2, '0'), origem: ultima?.origem || '' })]);
  };

  // Cola várias pendências de uma vez (uma por linha), como vêm na notificação do órgão
  const importarTexto = () => {
    const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
    const novas = linhas.map((l, i) => {
      const m = l.match(/^(\d+[\w.]*)\s*[-–.:)]\s*(.+)$/);
      return novaPendencia({
        numero: m ? m[1] : String(value.length + i + 1).padStart(2, '0'),
        descricao: m ? m[2] : l,
        origem: origemPadrao,
      });
    });
    onChange([...value, ...novas]);
    setTexto('');
    setColar(false);
  };

  return (
    <div className="cond-editor">
      <div className="cond-toolbar">
        <p className="muted small grow">
          Cadastre as pendências do CAR: exigências da análise, retificações, compromissos do PRA… As que tiverem prazo podem gerar um <b>evento de controle</b>.
        </p>
        <button type="button" className="btn btn-sm" onClick={() => setColar((v) => !v)}>
          <ListPlus size={16} /> Colar lista
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={adicionar}>
          <Plus size={16} /> Adicionar
        </button>
      </div>

      {colar && (
        <div className="card cond-colar">
          <Field label="Origem (opcional)">
            <input value={origemPadrao} onChange={(e) => setOrigemPadrao(e.target.value)} placeholder="Ex.: Notificação SICAR de 10/09/2026" />
          </Field>
          <Field label="Cole as pendências, uma por linha" hint='Ex.: "01 - Retificar o polígono da APP do córrego"'>
            <textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'01 - Apresentar matrícula atualizada\n02 - Retificar o polígono da Reserva Legal\n03 - Ajustar a área de APP do córrego'} />
          </Field>
          <div className="row-end">
            <button type="button" className="btn btn-sm" onClick={() => setColar(false)}>Cancelar</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={importarTexto} disabled={!texto.trim()}>
              Importar {texto.split('\n').filter((l) => l.trim()).length || ''} pendência(s)
            </button>
          </div>
        </div>
      )}

      {value.length === 0 && !colar && (
        <EmptyState icon={ClipboardList} title="Nenhuma pendência" text="Adicione as exigências da análise do CAR ou os compromissos do imóvel." />
      )}

      <div className="cond-list">
        {value.map((p) => (
          <div key={p.id} className="cond-card">
            <div className="cond-card-head">
              <input className="cond-num" value={p.numero} onChange={(e) => atualizar(p.id, 'numero', e.target.value)} placeholder="Nº" aria-label="Número" />
              <select className="grow pend-tipo" value={p.tipo} onChange={(e) => atualizar(p.id, 'tipo', e.target.value)} aria-label="Tipo">
                {Object.entries(TIPOS_PENDENCIA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <button type="button" className="icon-btn danger" onClick={() => remover(p.id)} title="Remover pendência">
                <Trash2 size={16} />
              </button>
            </div>
            <textarea rows={2} value={p.descricao} onChange={(e) => atualizar(p.id, 'descricao', e.target.value)} placeholder="O que precisa ser feito" aria-label="Descrição" />
            <input value={p.origem} onChange={(e) => atualizar(p.id, 'origem', e.target.value)} placeholder="Origem: notificação, ofício, termo de compromisso…" aria-label="Origem" />
            <div className="grid-3">
              <Field label="Prazo">
                <input type="date" value={p.prazo} onChange={(e) => atualizar(p.id, 'prazo', e.target.value)} />
              </Field>
              <Field label="Periodicidade">
                <select value={p.periodicidade} onChange={(e) => atualizar(p.id, 'periodicidade', e.target.value)}>
                  {Object.entries(RECORRENCIAS).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
                </select>
              </Field>
              <Field label="Situação">
                <select value={p.status} onChange={(e) => atualizar(p.id, 'status', e.target.value)}>
                  {Object.entries(STATUS_PENDENCIA).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </select>
              </Field>
            </div>
            {p.prazo && (
              eventosVinculados.has(p.id) ? (
                <p className="cond-linked small"><CalendarClock size={14} /> Já possui evento de controle vinculado</p>
              ) : (
                <label className="check small">
                  <input type="checkbox" checked={!!p.gerarEvento} onChange={(e) => atualizar(p.id, 'gerarEvento', e.target.checked)} />
                  Criar evento de controle com aviso de vencimento
                </label>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
