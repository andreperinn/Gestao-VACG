import { ShieldCheck, FlaskConical, ClipboardCheck, FileText, Receipt, Bell, IdCard, Landmark, Map as MapIcon, Image as ImageIcon, File as FileIcon } from 'lucide-react';

export const CATEGORIAS_DOC = {
  licenca: { label: 'Licença', icon: ShieldCheck, cor: '#16a34a' },
  contrato: { label: 'Contrato social', icon: FileText, cor: '#2563eb' },
  cnpj: { label: 'Cartão CNPJ', icon: IdCard, cor: '#0e7490' },
  alvara: { label: 'Alvará', icon: Landmark, cor: '#7c3aed' },
  laudo: { label: 'Laudo / Análise', icon: FlaskConical, cor: '#0891b2' },
  projeto: { label: 'Projeto / Planta', icon: MapIcon, cor: '#c2410c' },
  foto: { label: 'Foto', icon: ImageIcon, cor: '#be185d' },
  outro: { label: 'Outro', icon: FileIcon, cor: '#64748b' },
};

// Tenta adivinhar a categoria do documento pelo nome do arquivo
export function categoriaPorNome(nome, tipo) {
  const n = (nome || '').toLowerCase();
  if (/licen|\blo\b|\bli\b|\blp\b|\blas\b/.test(n)) return 'licenca';
  if (/contrato|social/.test(n)) return 'contrato';
  if (/cnpj/.test(n)) return 'cnpj';
  if (/alvar/.test(n)) return 'alvara';
  if (/laudo|analise|análise|relat/.test(n)) return 'laudo';
  if (/planta|projeto|croqui|\.dwg$/.test(n)) return 'projeto';
  if ((tipo || '').startsWith('image/')) return 'foto';
  return 'outro';
}

export const SERVICOS_SUGESTOES = [
  'Licenciamento ambiental',
  'Renovação de licença',
  'Análises laboratoriais',
  'Monitoramento de efluentes',
  'Monitoramento de água subterrânea',
  'Monitoramento de emissões atmosféricas',
  'PGRS – Plano de Gerenciamento de Resíduos',
  'Outorga de uso de água',
  'Cadastro Técnico Federal (IBAMA)',
  'Acompanhamento de condicionantes',
  'Consultoria ambiental',
];

export const STATUS_SERVICO = {
  ativo: { label: 'Ativo', cls: 'success' },
  pausado: { label: 'Pausado', cls: 'warning' },
  encerrado: { label: 'Encerrado', cls: 'muted' },
};

export const TIPOS_EVENTO = {
  licenca: { label: 'Licença ambiental', curto: 'Licença', icon: ShieldCheck, cor: '#16a34a' },
  analise: { label: 'Análise / Monitoramento', curto: 'Análise', icon: FlaskConical, cor: '#0891b2' },
  condicionante: { label: 'Condicionante', curto: 'Condicionante', icon: ClipboardCheck, cor: '#7c3aed' },
  relatorio: { label: 'Relatório / Entrega', curto: 'Relatório', icon: FileText, cor: '#2563eb' },
  taxa: { label: 'Taxa / Pagamento', curto: 'Taxa', icon: Receipt, cor: '#d97706' },
  outro: { label: 'Outro aviso', curto: 'Outro', icon: Bell, cor: '#64748b' },
};

export const STATUS_COND = {
  pendente: { label: 'Pendente', cls: 'warning' },
  andamento: { label: 'Em andamento', cls: 'info' },
  cumprida: { label: 'Cumprida', cls: 'success' },
};

export const PORTES = ['Micro', 'Pequeno', 'Médio', 'Grande', 'Excepcional'];

export const POTENCIAL = ['Baixo', 'Médio', 'Alto'];

export const ORGAOS = [
  'IBAMA',
  'CETESB (SP)',
  'FEAM / SEMAD (MG)',
  'INEA (RJ)',
  'IAT (PR)',
  'IMA (SC)',
  'FEPAM (RS)',
  'INEMA (BA)',
  'SEMAS (PA)',
  'Secretaria Municipal de Meio Ambiente',
];

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export const ANTECEDENCIAS = [7, 15, 30, 60, 90, 120];
