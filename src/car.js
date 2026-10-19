import {
  FilePen, MessageSquareWarning, Handshake, Sprout, SearchCheck, Receipt, Bell, FileCheck, FileText, Landmark,
  IdCard, Map as MapIcon, Layers, Image as ImageIcon, File as FileIcon, Scale,
} from 'lucide-react';

// ---------- Cadastro Ambiental Rural (Lei 12.651/2012 · SICAR) ----------

export const SITUACOES_CAR = {
  ativo: { label: 'Ativo', cls: 'success' },
  pendente: { label: 'Pendente', cls: 'warning' },
  suspenso: { label: 'Suspenso', cls: 'danger' },
  cancelado: { label: 'Cancelado', cls: 'muted' },
};

export const CONDICOES_CAR = {
  aguardando: { label: 'Aguardando análise', curto: 'Aguardando análise', cls: 'muted', cor: '#64748b' },
  em_analise: { label: 'Em análise', curto: 'Em análise', cls: 'info', cor: '#2563eb' },
  pendencias: { label: 'Analisado com pendências, aguardando retificação', curto: 'Com pendências', cls: 'warning', cor: '#d97706' },
  regularizacao: { label: 'Analisado, aguardando regularização ambiental (PRA)', curto: 'Aguardando regularização (PRA)', cls: 'info', cor: '#7c3aed' },
  conforme: { label: 'Analisado, em conformidade com a Lei 12.651/2012', curto: 'Em conformidade', cls: 'success', cor: '#15803d' },
};

export const SITUACOES_RL = {
  proposta: 'Proposta (não analisada)',
  aprovada: 'Aprovada pelo órgão',
  averbada: 'Averbada na matrícula',
  compensada: 'Compensada (fora do imóvel)',
  inexistente: 'Sem Reserva Legal declarada',
};

// Percentual mínimo de Reserva Legal (art. 12 da Lei 12.651/2012)
export const BIOMAS_RL = {
  demais: { label: 'Demais regiões do país', pct: 20 },
  amazonia_floresta: { label: 'Amazônia Legal – área de floresta', pct: 80 },
  amazonia_cerrado: { label: 'Amazônia Legal – área de cerrado', pct: 35 },
  amazonia_campos: { label: 'Amazônia Legal – campos gerais', pct: 20 },
};

export const TIPOS_PROPRIETARIO = { proprietario: 'Proprietário', possuidor: 'Possuidor', representante: 'Representante legal' };

export const TIPOS_PENDENCIA = {
  notificacao: 'Notificação do órgão',
  documental: 'Documentação',
  retificacao: 'Retificação do cadastro',
  app: 'APP – recomposição',
  rl: 'Reserva Legal',
  pra: 'PRA / Termo de compromisso',
  outro: 'Outro',
};

export const STATUS_PENDENCIA = {
  pendente: { label: 'Pendente', cls: 'warning' },
  andamento: { label: 'Em andamento', cls: 'info' },
  resolvida: { label: 'Resolvida', cls: 'success' },
};

export const TIPOS_EVENTO_CAR = {
  retificacao: { label: 'Retificação do CAR', curto: 'Retificação', icon: FilePen, cor: '#2563eb' },
  notificacao: { label: 'Resposta a notificação', curto: 'Notificação', icon: MessageSquareWarning, cor: '#dc2626' },
  pra: { label: 'PRA / Termo de compromisso', curto: 'PRA', icon: Handshake, cor: '#7c3aed' },
  recomposicao: { label: 'Recomposição / PRADA', curto: 'Recomposição', icon: Sprout, cor: '#16a34a' },
  vistoria: { label: 'Vistoria', curto: 'Vistoria', icon: SearchCheck, cor: '#0891b2' },
  itr: { label: 'ITR / CCIR', curto: 'ITR/CCIR', icon: Receipt, cor: '#d97706' },
  outro: { label: 'Outro aviso', curto: 'Outro', icon: Bell, cor: '#64748b' },
};

export const SUGESTOES_EVENTO_CAR = {
  retificacao: ['Retificar o CAR', 'Atualizar o CAR após alteração no imóvel'],
  notificacao: ['Responder notificação do órgão ambiental', 'Prazo para atender pendências da análise'],
  pra: ['Assinar termo de compromisso do PRA', 'Relatório de acompanhamento do PRA', 'Prazo final do termo de compromisso'],
  recomposicao: ['Relatório de recomposição de APP', 'Relatório do PRADA', 'Plantio de mudas na Reserva Legal'],
  vistoria: ['Vistoria técnica no imóvel'],
  itr: ['Declaração do ITR', 'Atualização do CCIR'],
  outro: ['Renovação de outorga do imóvel'],
};

export const CATEGORIAS_DOC_CAR = {
  recibo: { label: 'Recibo do CAR', icon: FileCheck, cor: '#16a34a' },
  demonstrativo: { label: 'Demonstrativo do CAR', icon: FileText, cor: '#2563eb' },
  matricula: { label: 'Matrícula / Escritura', icon: Landmark, cor: '#7c3aed' },
  ccir: { label: 'CCIR', icon: IdCard, cor: '#0e7490' },
  itr: { label: 'ITR', icon: Receipt, cor: '#d97706' },
  geo: { label: 'Shapefile / KML', icon: Layers, cor: '#c2410c' },
  mapa: { label: 'Mapa / Croqui', icon: MapIcon, cor: '#be185d' },
  termo: { label: 'Termo de compromisso', icon: Scale, cor: '#4d7c0f' },
  foto: { label: 'Foto', icon: ImageIcon, cor: '#db2777' },
  outro: { label: 'Outro', icon: FileIcon, cor: '#64748b' },
};

export function categoriaDocCar(nome, tipo) {
  const n = (nome || '').toLowerCase();
  if (/recibo/.test(n)) return 'recibo';
  if (/demonstrativo/.test(n)) return 'demonstrativo';
  if (/matr[ií]cula|escritura/.test(n)) return 'matricula';
  if (/ccir/.test(n)) return 'ccir';
  if (/\bitr\b|darf/.test(n)) return 'itr';
  if (/\.(shp|kml|kmz|zip|geojson|dbf|shx|prj)$/.test(n)) return 'geo';
  if (/mapa|croqui|planta/.test(n)) return 'mapa';
  if (/termo|compromisso|pra\b/.test(n)) return 'termo';
  if ((tipo || '').startsWith('image/')) return 'foto';
  return 'outro';
}

// Código do CAR: UF-código IBGE do município-32 caracteres em 8 grupos de 4
export function mascaraCodigoCar(v) {
  const s = (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const uf = s.slice(0, 2);
  const ibge = s.slice(2, 9);
  const hash = s.slice(9, 41).match(/.{1,4}/g)?.join('.') || '';
  return [uf, ibge, hash].filter(Boolean).join('-');
}

export const codigoCarValido = (v) => /^[A-Z]{2}-\d{7}-[0-9A-F]{4}(\.[0-9A-F]{4}){7}$/.test(v || '');

export const nomeImovel = (im) => im?.nome || 'Imóvel sem nome';

export const fmtHa = (v) =>
  v === '' || v === null || v === undefined || Number.isNaN(Number(v))
    ? '—'
    : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ha`;

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

// Reserva Legal exigida, declarada e déficit estimado
export function calculoRL(im) {
  const a = im?.areas || {};
  const total = num(a.total);
  const pct = BIOMAS_RL[a.bioma || 'demais']?.pct ?? 20;
  const exigida = total != null ? (total * pct) / 100 : null;
  const declarada = num(a.rl);
  const deficit = exigida != null && declarada != null ? Math.max(0, exigida - declarada) : null;
  const pctDeclarado = total && declarada != null ? (declarada / total) * 100 : null;
  return { total, pct, exigida, declarada, deficit, pctDeclarado };
}
