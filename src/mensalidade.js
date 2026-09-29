import { diasAte } from './utils';

export const FORMAS_PAGAMENTO = ['Boleto', 'PIX', 'Transferência', 'Cartão', 'Dinheiro'];

const pad = (n) => String(n).padStart(2, '0');
export const mesISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function mensalidadeVazia() {
  return { ativa: false, valor: '', diaVencimento: 10, formaPagamento: 'Boleto', inicio: mesISO(), observacoes: '', pagamentos: {} };
}

export function fmtMoeda(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Data de vencimento da mensalidade no mês (o dia é ajustado em meses mais curtos)
export function vencimentoDoMes(ym, dia) {
  const [y, m] = ym.split('-').map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return `${ym}-${pad(Math.min(Number(dia) || 1, ultimo))}`;
}

export const STATUS_MES = {
  pago: { label: 'Pago', cls: 'success' },
  aberto: { label: 'A vencer', cls: 'info' },
  atrasado: { label: 'Atrasado', cls: 'danger' },
  futuro: { label: 'Futuro', cls: 'muted' },
  antes: { label: '—', cls: 'muted' },
  inativo: { label: 'Inativo', cls: 'muted' },
};

export function statusMes(m, ym) {
  if (m?.pagamentos?.[ym]?.pago) return 'pago';
  if (!m?.ativa) return 'inativo';
  if (m.inicio && ym < m.inicio) return 'antes';
  if (ym > mesISO()) return 'futuro';
  return diasAte(vencimentoDoMes(ym, m.diaVencimento)) < 0 ? 'atrasado' : 'aberto';
}

// Meses em atraso desde o início do contrato até o mês atual
export function mesesAtrasados(m) {
  if (!m?.ativa) return [];
  const atual = mesISO();
  const [y0, m0] = (m.inicio || atual).split('-').map(Number);
  const lista = [];
  for (let d = new Date(y0, m0 - 1, 1); mesISO(d) <= atual; d.setMonth(d.getMonth() + 1)) {
    const ym = mesISO(d);
    if (statusMes(m, ym) === 'atrasado') lista.push(ym);
  }
  return lista;
}
