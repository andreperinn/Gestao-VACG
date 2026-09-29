import { uid, addDias, hojeISO } from './utils';
import { mesISO } from './mensalidade';

// Dados de exemplo com datas relativas a hoje, para o painel já mostrar como funciona.
export function criarExemplo() {
  const h = hojeISO();
  const agora = new Date().toISOString();

  const cond = (numero, descricao, extra = {}) => ({
    id: uid(),
    numero,
    descricao,
    licencaRef: '',
    prazo: '',
    periodicidade: 'nenhuma',
    status: 'pendente',
    gerarEvento: false,
    ...extra,
  });

  const e1 = {
    id: uid(),
    razaoSocial: 'Cerâmica Vale Verde Ltda.',
    nomeFantasia: 'Cerâmica Vale Verde',
    cnpj: '12.345.678/0001-90',
    atividade: 'Fabricação de artefatos de cerâmica',
    cnae: '2342-7/02',
    porte: 'Médio',
    potencialPoluidor: 'Médio',
    orgaoAmbiental: 'FEAM / SEMAD (MG)',
    cep: '35500-000',
    endereco: 'Rodovia MG-050, km 12',
    cidade: 'Divinópolis',
    uf: 'MG',
    responsavel: 'Carlos Menezes',
    telefone: '(37) 99876-5432',
    email: 'ambiental@valeverde.com.br',
    observacoes: 'Cliente desde 2019. Visita técnica semestral.',
    condicionantes: [],
    criadoEm: agora,
  };
  e1.condicionantes = [
    cond('01', 'Realizar monitoramento semestral de efluentes líquidos e apresentar laudo ao órgão.', { licencaRef: 'LO nº 0123/2023', prazo: addDias(h, 18), periodicidade: 'semestral', status: 'andamento' }),
    cond('02', 'Apresentar inventário anual de resíduos sólidos.', { licencaRef: 'LO nº 0123/2023', prazo: addDias(h, 75), periodicidade: 'anual' }),
    cond('03', 'Manter cortina arbórea no entorno do empreendimento.', { licencaRef: 'LO nº 0123/2023', status: 'cumprida' }),
  ];

  const e2 = {
    id: uid(),
    razaoSocial: 'Posto Estrela do Oeste Comércio de Combustíveis Ltda.',
    nomeFantasia: 'Posto Estrela',
    cnpj: '98.765.432/0001-10',
    atividade: 'Comércio varejista de combustíveis',
    cnae: '4731-8/00',
    porte: 'Pequeno',
    potencialPoluidor: 'Alto',
    orgaoAmbiental: 'Secretaria Municipal de Meio Ambiente',
    cep: '35501-120',
    endereco: 'Av. Primeiro de Junho, 2100',
    cidade: 'Divinópolis',
    uf: 'MG',
    responsavel: 'Ana Paula Ribeiro',
    telefone: '(37) 3222-1100',
    email: 'contato@postoestrela.com.br',
    observacoes: '',
    condicionantes: [],
    criadoEm: agora,
  };
  e2.condicionantes = [
    cond('01', 'Teste de estanqueidade dos tanques subterrâneos (SASC).', { licencaRef: 'LAS nº 45/2024', prazo: addDias(h, -4), periodicidade: 'anual' }),
    cond('02', 'Análise trimestral de água subterrânea dos poços de monitoramento.', { licencaRef: 'LAS nº 45/2024', prazo: addDias(h, 9), periodicidade: 'trimestral' }),
  ];

  const e3 = {
    id: uid(),
    razaoSocial: 'Laticínios Serra Azul S.A.',
    nomeFantasia: 'Laticínios Serra Azul',
    cnpj: '45.678.912/0001-33',
    atividade: 'Preparação do leite e fabricação de laticínios',
    cnae: '1052-0/00',
    porte: 'Grande',
    potencialPoluidor: 'Médio',
    orgaoAmbiental: 'FEAM / SEMAD (MG)',
    cep: '35680-000',
    endereco: 'Estrada Municipal, s/n – Zona Rural',
    cidade: 'Itaúna',
    uf: 'MG',
    responsavel: 'Roberto Faria',
    telefone: '(37) 99111-2233',
    email: 'meioambiente@serraazul.com.br',
    observacoes: 'Renovação da LO deve ser protocolada com 120 dias de antecedência.',
    condicionantes: [],
    criadoEm: agora,
  };
  e3.condicionantes = [
    cond('01', 'Monitoramento mensal da ETE (DBO, DQO, pH, sólidos).', { licencaRef: 'LO nº 0456/2021', prazo: addDias(h, 3), periodicidade: 'mensal', status: 'andamento' }),
    cond('02', 'Relatório anual de automonitoramento (RADA).', { licencaRef: 'LO nº 0456/2021', prazo: addDias(h, 140), periodicidade: 'anual' }),
  ];

  const ev = (empresa, tipo, titulo, dias, extra = {}) => ({
    id: uid(),
    empresaId: empresa.id,
    tipo,
    titulo,
    documento: '',
    dataVencimento: addDias(h, dias),
    antecedenciaDias: 30,
    recorrencia: 'nenhuma',
    status: 'pendente',
    concluidoEm: null,
    condicionanteId: null,
    observacoes: '',
    criadoEm: agora,
    ...extra,
  });

  const eventos = [
    ev(e1, 'licenca', 'Renovação da Licença de Operação', 95, { documento: 'LO nº 0123/2023', antecedenciaDias: 120 }),
    ev(e1, 'condicionante', 'Laudo de efluentes líquidos', 18, { recorrencia: 'semestral', condicionanteId: e1.condicionantes[0].id }),
    ev(e1, 'condicionante', 'Inventário anual de resíduos sólidos', 75, { recorrencia: 'anual', condicionanteId: e1.condicionantes[1].id }),
    ev(e1, 'taxa', 'Taxa de Fiscalização Ambiental (TFAMG)', 40, { recorrencia: 'trimestral', antecedenciaDias: 15 }),
    ev(e2, 'condicionante', 'Teste de estanqueidade dos tanques', -4, { recorrencia: 'anual', condicionanteId: e2.condicionantes[0].id }),
    ev(e2, 'analise', 'Análise de água subterrânea', 9, { recorrencia: 'trimestral', antecedenciaDias: 15, condicionanteId: e2.condicionantes[1].id }),
    ev(e2, 'licenca', 'Vencimento da LAS', 210, { documento: 'LAS nº 45/2024', antecedenciaDias: 90 }),
    ev(e2, 'relatorio', 'Cadastro Técnico Federal – relatório anual (RAPP)', -12, { recorrencia: 'anual' }),
    ev(e3, 'analise', 'Monitoramento mensal da ETE', 3, { recorrencia: 'mensal', antecedenciaDias: 7, condicionanteId: e3.condicionantes[0].id }),
    ev(e3, 'licenca', 'Protocolar renovação da LO', 115, { documento: 'LO nº 0456/2021', antecedenciaDias: 120 }),
    ev(e3, 'relatorio', 'RADA – Relatório de automonitoramento', 140, { recorrencia: 'anual', condicionanteId: e3.condicionantes[1].id }),
    ev(e3, 'outro', 'Renovar outorga de uso de água', 27, { documento: 'Portaria IGAM 1234/2022', antecedenciaDias: 60 }),
    ev(e1, 'analise', 'Análise de emissões atmosféricas', -30, { status: 'concluido', concluidoEm: addDias(h, -32) }),
  ];

  // Localização, serviços e mensalidade
  const mesAtras = (n) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - n);
    return mesISO(d);
  };
  const pagos = (meses, valor, dia) =>
    Object.fromEntries(meses.map((n) => [mesAtras(n), { pago: true, dataPagamento: `${mesAtras(n)}-${String(dia).padStart(2, '0')}`, valor }]));
  const serv = (nome, descricao, extra = {}) => ({ id: uid(), nome, descricao, status: 'ativo', inicio: '', ...extra });

  e1.localizacao = { lat: -20.1692, lng: -44.9107 };
  e1.servicos = [
    serv('Licenciamento ambiental', 'Acompanhamento da LO e preparação da renovação junto à SEMAD.', { inicio: addDias(h, -900) }),
    serv('Monitoramento de efluentes', 'Coleta semestral e envio ao laboratório. Laudo protocolado no órgão.'),
    serv('PGRS – Plano de Gerenciamento de Resíduos', 'Atualização anual do plano e inventário de resíduos.'),
  ];
  e1.mensalidade = { ativa: true, valor: 1200, diaVencimento: 10, formaPagamento: 'Boleto', inicio: mesAtras(8), observacoes: 'Reajuste anual pelo IPCA em janeiro.', pagamentos: pagos([8, 7, 6, 5, 4, 3, 2, 1, 0], 1200, 9) };

  e2.localizacao = { lat: -20.1435, lng: -44.8838 };
  e2.servicos = [
    serv('Monitoramento de água subterrânea', 'Análise trimestral dos poços de monitoramento (BTEX e PAH).'),
    serv('Teste de estanqueidade', 'Contratação e acompanhamento do teste anual dos tanques.'),
    serv('Cadastro Técnico Federal (IBAMA)', 'Entrega do RAPP todo mês de março.', { status: 'pausado' }),
  ];
  e2.mensalidade = { ativa: true, valor: 650, diaVencimento: 5, formaPagamento: 'PIX', inicio: mesAtras(5), observacoes: '', pagamentos: pagos([5, 4, 3, 2], 650, 5) };

  e3.localizacao = { lat: -20.0747, lng: -44.5761 };
  e3.servicos = [
    serv('Monitoramento de efluentes', 'Monitoramento mensal da ETE: DBO, DQO, pH, sólidos e óleos e graxas.'),
    serv('Renovação de licença', 'Preparar e protocolar a renovação da LO com 120 dias de antecedência.'),
    serv('Outorga de uso de água', 'Renovação da outorga do poço tubular junto ao IGAM.'),
  ];
  e3.mensalidade = { ativa: true, valor: 2400, diaVencimento: 20, formaPagamento: 'Transferência', inicio: mesAtras(11), observacoes: 'Nota fiscal enviada ao financeiro (financeiro@serraazul.com.br).', pagamentos: pagos([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0], 2400, 18) };

  [e1, e2, e3].forEach((e) => (e.anexos = []));

  return { empresas: [e1, e2, e3], eventos, exemplo: true };
}
