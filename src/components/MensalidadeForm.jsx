import { Wallet, CalendarClock } from 'lucide-react';
import { Field } from './ui';
import { FORMAS_PAGAMENTO, fmtMoeda, vencimentoDoMes, mesISO } from '../mensalidade';
import { fmtData, addMeses, hojeISO } from '../utils';

export default function MensalidadeForm({ value, onChange }) {
  const m = value;
  const set = (k, v) => onChange({ ...m, [k]: v });

  // Próximo vencimento a partir de hoje
  const hojeYM = mesISO();
  let proximo = vencimentoDoMes(hojeYM, m.diaVencimento);
  if (proximo < hojeISO()) proximo = vencimentoDoMes(addMeses(`${hojeYM}-01`, 1).slice(0, 7), m.diaVencimento);

  return (
    <div className="mensal-form">
      <label className={`switch-card${m.ativa ? ' on' : ''}`}>
        <div className="kpi-icon" style={{ '--c': '#15803d' }}><Wallet size={22} /></div>
        <div className="grow">
          <strong>Cobrar mensalidade desta empresa</strong>
          <span className="muted small">{m.ativa ? 'Ativa — acompanhe os pagamentos na aba Mensalidade da empresa' : 'Desativada'}</span>
        </div>
        <input type="checkbox" className="switch" checked={m.ativa} onChange={(e) => set('ativa', e.target.checked)} />
      </label>

      <div className={`grid-2${m.ativa ? '' : ' desativado'}`}>
        <Field label="Valor mensal">
          <div className="input-prefix">
            <span>R$</span>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={m.valor} onChange={(e) => set('valor', e.target.value)} placeholder="0,00" />
          </div>
        </Field>
        <Field label="Dia do vencimento">
          <input type="number" min="1" max="31" value={m.diaVencimento} onChange={(e) => set('diaVencimento', Math.min(31, Math.max(1, Number(e.target.value) || 1)))} />
        </Field>
        <Field label="Forma de pagamento" span={2}>
          <div className="seg">
            {FORMAS_PAGAMENTO.map((f) => (
              <button type="button" key={f} className={m.formaPagamento === f ? 'active' : ''} onClick={() => set('formaPagamento', f)}>{f}</button>
            ))}
          </div>
        </Field>
        <Field label="Cobrança a partir de" hint="Meses antes disso não contam como atrasados">
          <input type="month" value={m.inicio} onChange={(e) => set('inicio', e.target.value)} />
        </Field>
        <Field label="Observações" span={2}>
          <textarea rows={2} value={m.observacoes} onChange={(e) => set('observacoes', e.target.value)} placeholder="Reajuste anual, dados bancários, contato do financeiro…" />
        </Field>
      </div>

      {m.ativa && Number(m.valor) > 0 && (
        <div className="banner banner-info">
          <CalendarClock size={18} />
          <span>{fmtMoeda(m.valor)} por mês via {m.formaPagamento} · próximo vencimento em <b>{fmtData(proximo)}</b></span>
        </div>
      )}
    </div>
  );
}
