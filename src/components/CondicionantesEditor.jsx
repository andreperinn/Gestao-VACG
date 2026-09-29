import { useState } from 'react';
import { Plus, Trash2, ListPlus, ClipboardCheck, CalendarClock } from 'lucide-react';
import { STATUS_COND } from '../constants';
import { RECORRENCIAS, uid } from '../utils';
import { Field, EmptyState } from './ui';

export function novaCondicionante(extra = {}) {
  return {
    id: uid(),
    numero: '',
    descricao: '',
    licencaRef: '',
    prazo: '',
    periodicidade: 'nenhuma',
    status: 'pendente',
    gerarEvento: true,
    ...extra,
  };
}

export default function CondicionantesEditor({ value, onChange, eventosVinculados = new Set() }) {
  const [colar, setColar] = useState(false);
  const [texto, setTexto] = useState('');
  const [licencaPadrao, setLicencaPadrao] = useState('');

  const atualizar = (id, campo, v) => onChange(value.map((c) => (c.id === id ? { ...c, [campo]: v } : c)));
  const remover = (id) => onChange(value.filter((c) => c.id !== id));
  const adicionar = () => {
    const ultima = value[value.length - 1];
    onChange([...value, novaCondicionante({ numero: String(value.length + 1).padStart(2, '0'), licencaRef: ultima?.licencaRef || '' })]);
  };

  // Cola várias condicionantes de uma vez (uma por linha), como vêm no certificado da licença
  const importarTexto = () => {
    const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
    const novas = linhas.map((l, i) => {
      const m = l.match(/^(\d+[\w.]*)\s*[-–.:)]\s*(.+)$/);
      return novaCondicionante({
        numero: m ? m[1] : String(value.length + i + 1).padStart(2, '0'),
        descricao: m ? m[2] : l,
        licencaRef: licencaPadrao,
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
          Cadastre as condicionantes da licença. As que tiverem prazo podem gerar um <b>evento de controle</b> automaticamente.
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
          <Field label="Licença de referência (opcional)">
            <input value={licencaPadrao} onChange={(e) => setLicencaPadrao(e.target.value)} placeholder="Ex.: LO nº 0123/2024" />
          </Field>
          <Field label="Cole as condicionantes, uma por linha" hint='Ex.: "01 - Apresentar relatório anual de resíduos"'>
            <textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'01 - Monitorar efluentes semestralmente\n02 - Apresentar inventário de resíduos\n03 - Manter cortina arbórea'} />
          </Field>
          <div className="row-end">
            <button type="button" className="btn btn-sm" onClick={() => setColar(false)}>Cancelar</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={importarTexto} disabled={!texto.trim()}>
              Importar {texto.split('\n').filter((l) => l.trim()).length || ''} condicionante(s)
            </button>
          </div>
        </div>
      )}

      {value.length === 0 && !colar && (
        <EmptyState icon={ClipboardCheck} title="Nenhuma condicionante" text="Adicione as condicionantes da licença ambiental desta empresa." />
      )}

      <div className="cond-list">
        {value.map((c) => (
          <div key={c.id} className="cond-card">
            <div className="cond-card-head">
              <input className="cond-num" value={c.numero} onChange={(e) => atualizar(c.id, 'numero', e.target.value)} placeholder="Nº" aria-label="Número" />
              <input className="grow" value={c.licencaRef} onChange={(e) => atualizar(c.id, 'licencaRef', e.target.value)} placeholder="Licença vinculada (ex.: LO nº 0123/2024)" aria-label="Licença vinculada" />
              <button type="button" className="icon-btn danger" onClick={() => remover(c.id)} title="Remover condicionante">
                <Trash2 size={16} />
              </button>
            </div>
            <textarea rows={2} value={c.descricao} onChange={(e) => atualizar(c.id, 'descricao', e.target.value)} placeholder="Descrição da condicionante" aria-label="Descrição" />
            <div className="grid-3">
              <Field label="Prazo">
                <input type="date" value={c.prazo} onChange={(e) => atualizar(c.id, 'prazo', e.target.value)} />
              </Field>
              <Field label="Periodicidade">
                <select value={c.periodicidade} onChange={(e) => atualizar(c.id, 'periodicidade', e.target.value)}>
                  {Object.entries(RECORRENCIAS).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
                </select>
              </Field>
              <Field label="Situação">
                <select value={c.status} onChange={(e) => atualizar(c.id, 'status', e.target.value)}>
                  {Object.entries(STATUS_COND).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </select>
              </Field>
            </div>
            {c.prazo && (
              eventosVinculados.has(c.id) ? (
                <p className="cond-linked small"><CalendarClock size={14} /> Já possui evento de controle vinculado</p>
              ) : (
                <label className="check small">
                  <input type="checkbox" checked={!!c.gerarEvento} onChange={(e) => atualizar(c.id, 'gerarEvento', e.target.checked)} />
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
