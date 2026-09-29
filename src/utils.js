// Datas são guardadas como 'YYYY-MM-DD' e interpretadas no fuso local.

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function hoje() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseData(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const hojeISO = () => toISO(new Date());

export function addDias(s, n) {
  const d = parseData(s) || hoje();
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addMeses(s, n) {
  const d = parseData(s);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return toISO(d);
}

export function diasAte(s) {
  return Math.round((parseData(s) - hoje()) / 86400000);
}

export function fmtData(s, opts) {
  if (!s) return '—';
  return parseData(s).toLocaleDateString('pt-BR', opts);
}

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const RECORRENCIAS = {
  nenhuma: { label: 'Não se repete', meses: 0 },
  mensal: { label: 'Mensal', meses: 1 },
  bimestral: { label: 'Bimestral', meses: 2 },
  trimestral: { label: 'Trimestral', meses: 3 },
  semestral: { label: 'Semestral', meses: 6 },
  anual: { label: 'Anual', meses: 12 },
  bienal: { label: 'A cada 2 anos', meses: 24 },
  quadrienal: { label: 'A cada 4 anos', meses: 48 },
};

export function proximaData(s, recorrencia) {
  const m = RECORRENCIAS[recorrencia]?.meses;
  return m ? addMeses(s, m) : s;
}

// Status de um evento de controle
export const STATUS = {
  vencido: { label: 'Vencido', cls: 'danger' },
  alerta: { label: 'Vence em breve', cls: 'warning' },
  ok: { label: 'Em dia', cls: 'success' },
  concluido: { label: 'Concluído', cls: 'muted' },
};

export function statusEvento(ev) {
  if (ev.status === 'concluido') return 'concluido';
  const d = diasAte(ev.dataVencimento);
  if (d < 0) return 'vencido';
  if (d <= (ev.antecedenciaDias ?? 30)) return 'alerta';
  return 'ok';
}

export function textoPrazo(ev) {
  if (ev.status === 'concluido') return 'Concluído';
  const d = diasAte(ev.dataVencimento);
  if (d < -1) return `Vencido há ${-d} dias`;
  if (d === -1) return 'Venceu ontem';
  if (d === 0) return 'Vence hoje';
  if (d === 1) return 'Vence amanhã';
  if (d < 60) return `Em ${d} dias`;
  const meses = Math.round(d / 30);
  return `Em ~${meses} meses`;
}

// Pior status entre os eventos (para indicar a situação da empresa)
export function statusEmpresa(eventos) {
  const sts = eventos.map(statusEvento);
  if (sts.includes('vencido')) return 'vencido';
  if (sts.includes('alerta')) return 'alerta';
  return 'ok';
}

// Máscaras
const digitos = (v) => (v || '').replace(/\D/g, '');

export function mascaraCNPJ(v) {
  const d = digitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function mascaraTelefone(v) {
  const d = digitos(v).slice(0, 11);
  if (d.length <= 10)
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

export function mascaraCEP(v) {
  return digitos(v).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
}

export const soDigitos = digitos;

export function nomeEmpresa(e) {
  return e?.nomeFantasia || e?.razaoSocial || 'Empresa sem nome';
}

export function iniciais(nome) {
  return (nome || '?')
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-Z]/.test(p))
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';
}

const PALETA = ['#15803d', '#0e7490', '#7c3aed', '#c2410c', '#be185d', '#1d4ed8', '#4d7c0f', '#b45309'];
export function corDe(texto) {
  let h = 0;
  for (const c of texto || '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

export function normalizar(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
