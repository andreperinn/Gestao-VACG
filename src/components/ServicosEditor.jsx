import { Plus, Trash2, Briefcase } from 'lucide-react';
import { SERVICOS_SUGESTOES, STATUS_SERVICO } from '../constants';
import { uid } from '../utils';
import { Field, EmptyState } from './ui';

export const novoServico = (nome = '') => ({ id: uid(), nome, descricao: '', status: 'ativo', inicio: '' });

export default function ServicosEditor({ value, onChange }) {
  const atualizar = (id, campo, v) => onChange(value.map((s) => (s.id === id ? { ...s, [campo]: v } : s)));
  const remover = (id) => onChange(value.filter((s) => s.id !== id));
  const adicionar = (nome) => onChange([...value, novoServico(nome)]);
  const sugestoes = SERVICOS_SUGESTOES.filter((n) => !value.some((s) => s.nome.toLowerCase() === n.toLowerCase()));

  return (
    <div className="cond-editor">
      <div className="cond-toolbar">
        <p className="muted small grow">Descreva o que a VACG faz para esta empresa. Toque numa sugestão para adicionar rápido ou escreva do seu jeito.</p>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => adicionar('')}><Plus size={16} /> Novo serviço</button>
      </div>

      {sugestoes.length > 0 && (
        <div className="sugestoes">
          {sugestoes.map((n) => (
            <button type="button" key={n} className="chip chip-add" onClick={() => adicionar(n)}><Plus size={13} /> {n}</button>
          ))}
        </div>
      )}

      {value.length === 0 && <EmptyState icon={Briefcase} title="Nenhum serviço cadastrado" text="Ex.: licenciamento, análises de efluentes, PGRS, outorga…" />}

      <div className="cond-list">
        {value.map((s) => (
          <div key={s.id} className="cond-card">
            <div className="cond-card-head">
              <input className="grow servico-nome" value={s.nome} onChange={(e) => atualizar(s.id, 'nome', e.target.value)} placeholder="Nome do serviço" list="lista-servicos" aria-label="Nome do serviço" autoFocus={!s.nome} />
              <button type="button" className="icon-btn danger" onClick={() => remover(s.id)} title="Remover serviço"><Trash2 size={16} /></button>
            </div>
            <textarea rows={3} value={s.descricao} onChange={(e) => atualizar(s.id, 'descricao', e.target.value)} placeholder="O que é feito, frequência, laboratório, observações…" aria-label="Descrição" />
            <div className="grid-2">
              <Field label="Situação">
                <div className="seg">
                  {Object.entries(STATUS_SERVICO).map(([k, st]) => (
                    <button type="button" key={k} className={s.status === k ? 'active' : ''} onClick={() => atualizar(s.id, 'status', k)}>{st.label}</button>
                  ))}
                </div>
              </Field>
              <Field label="Desde">
                <input type="date" value={s.inicio} onChange={(e) => atualizar(s.id, 'inicio', e.target.value)} />
              </Field>
            </div>
          </div>
        ))}
      </div>
      <datalist id="lista-servicos">{SERVICOS_SUGESTOES.map((n) => <option key={n} value={n} />)}</datalist>
    </div>
  );
}
