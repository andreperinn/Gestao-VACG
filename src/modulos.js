import { Building2, Trees } from 'lucide-react';
import { useStore } from './store';
import { useModais } from './components/modais';
import { TIPOS_EVENTO } from './constants';
import { TIPOS_EVENTO_CAR, SUGESTOES_EVENTO_CAR, nomeImovel } from './car';
import { nomeEmpresa } from './utils';

// O sistema tem dois módulos com a mesma mecânica de eventos, agenda e alertas:
// - "ambiental": empresas, condicionantes e licenças
// - "car": imóveis rurais do Cadastro Ambiental Rural e suas pendências
export const SUGESTOES_EVENTO = {
  licenca: ['Renovação da Licença de Operação', 'Vencimento da Licença de Instalação', 'Vencimento da LAS'],
  analise: ['Análise de efluentes', 'Análise de água subterrânea', 'Monitoramento de emissões atmosféricas', 'Análise de ruído'],
  condicionante: ['Cumprimento de condicionante'],
  relatorio: ['RAPP – Cadastro Técnico Federal', 'Inventário de resíduos sólidos', 'Relatório de automonitoramento'],
  taxa: ['Taxa de fiscalização ambiental', 'Taxa de renovação de licença'],
  outro: ['Renovação de outorga de água', 'Visita técnica', 'Renovação do AVCB'],
};

export function useModulo(id = 'ambiental') {
  const s = useStore();
  const m = useModais();

  if (id === 'car') {
    return {
      id: 'car',
      eventos: s.carEventos,
      entidades: s.imoveis,
      entidadePorId: s.imovelPorId,
      nomeEntidade: nomeImovel,
      entidade: 'Imóvel',
      entidades_: 'imóveis',
      iconeEntidade: Trees,
      rotaEntidade: (eid) => `/car/imoveis/${eid}`,
      rotaAgenda: '/car/agenda',
      chaveEntidade: 'imovelId',
      chaveVinculo: 'pendenciaId',
      vinculo: 'pendência',
      vinculos: (ent) => (ent?.pendencias || []).map((p) => ({ id: p.id, numero: p.numero, descricao: p.descricao, prazo: p.prazo, periodicidade: p.periodicidade })),
      tipos: TIPOS_EVENTO_CAR,
      tipoVinculo: 'notificacao',
      sugestoes: SUGESTOES_EVENTO_CAR,
      salvar: s.salvarCarEvento,
      excluir: s.excluirCarEvento,
      concluir: s.concluirCarEvento,
      reabrir: s.reabrirCarEvento,
      abrirEvento: m.abrirCarEvento,
    };
  }

  return {
    id: 'ambiental',
    eventos: s.eventos,
    entidades: s.empresas,
    entidadePorId: s.empresaPorId,
    nomeEntidade: nomeEmpresa,
    entidade: 'Empresa',
    entidades_: 'empresas',
    iconeEntidade: Building2,
    rotaEntidade: (eid) => `/empresas/${eid}`,
    rotaAgenda: '/agenda',
    chaveEntidade: 'empresaId',
    chaveVinculo: 'condicionanteId',
    vinculo: 'condicionante',
    vinculos: (ent) => (ent?.condicionantes || []).map((c) => ({ id: c.id, numero: c.numero, descricao: c.descricao, prazo: c.prazo, periodicidade: c.periodicidade, licencaRef: c.licencaRef })),
    tipos: TIPOS_EVENTO,
    tipoVinculo: 'condicionante',
    sugestoes: SUGESTOES_EVENTO,
    salvar: s.salvarEvento,
    excluir: s.excluirEvento,
    concluir: s.concluirEvento,
    reabrir: s.reabrirEvento,
    abrirEvento: m.abrirEvento,
  };
}
