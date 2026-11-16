// Conector do Claude (servidor MCP) para o sistema VACG.
//
// Endereço: https://vacg-gestao.vercel.app/api/mcp
// Acesso: cada pessoa usa a própria chave (criada em Equipe → Conector do Claude), enviada
// pelo Claude no cabeçalho "Authorization: Bearer <chave>". O servidor confere a chave, vê quem
// é o dono e aplica as mesmas regras do sistema: perfil ativo, financeiro só para administrador.
// Tudo o que é feito por aqui entra no registro de atividades como "via Claude".
//
// Variáveis de ambiente na Vercel: VITE_SUPABASE_URL e SUPABASE_SECRET_KEY (chave secreta do
// Supabase — fica só no servidor, nunca vai para o navegador).
import { createHash } from 'node:crypto';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { createClient } from '@supabase/supabase-js';
import { uid, proximaData } from '../src/utils.js';

const URL_SUPABASE = process.env.VITE_SUPABASE_URL;
const CHAVE_SECRETA = process.env.SUPABASE_SECRET_KEY;

const hash = (t) => createHash('sha256').update(t).digest('hex');
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

function clienteSupabase(userId) {
  return createClient(URL_SUPABASE, CHAVE_SECRETA, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Identifica o usuário no registro de atividades (ver registrar_atividade no schema.sql)
    global: { headers: { 'x-vacg-user-id': userId || '' } },
  });
}

// Confere a chave enviada pelo Claude e devolve o dono (perfil ativo) ou null
async function autenticar(request) {
  const cab = request.headers.get('authorization') || '';
  // Aceita "Bearer <chave>" e também a chave pura, caso tenham colado sem o "Bearer"
  const token = cab.replace(/^Bearer\s+/i, '').trim();
  if (token.length < 30) return null;
  const sb = clienteSupabase();
  const { data: chave } = await sb
    .from('mcp_tokens')
    .select('id, user_id, revogado')
    .eq('token_hash', hash(token))
    .maybeSingle();
  if (!chave || chave.revogado) return null;
  const { data: perfil } = await sb.from('perfis').select('user_id, nome, email, papel, ativo').eq('user_id', chave.user_id).maybeSingle();
  if (!perfil?.ativo) return null;
  await sb.from('mcp_tokens').update({ ultimo_uso: new Date().toISOString() }).eq('id', chave.id);
  return perfil;
}

// ---------- Respostas ----------
const resposta = (dados) => ({ content: [{ type: 'text', text: typeof dados === 'string' ? dados : JSON.stringify(dados, null, 2) }] });
const erro = (msg) => ({ content: [{ type: 'text', text: `Erro: ${msg}` }], isError: true });

function ok({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ---------- Esquemas reutilizados ----------
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD');
const recorrencia = z.enum(['nenhuma', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual', 'bienal', 'quadrienal']);
const tiposAmbiental = z.enum(['licenca', 'analise', 'condicionante', 'relatorio', 'taxa', 'outro']);
const tiposCar = z.enum(['retificacao', 'notificacao', 'pra', 'recomposicao', 'vistoria', 'itr', 'outro']);

const condicionanteEntrada = z.object({
  numero: z.string().optional().describe('Número da condicionante, ex.: "01"'),
  descricao: z.string().describe('Texto da condicionante'),
  licenca_ref: z.string().optional().describe('Licença de origem, ex.: "LO nº 0123/2024"'),
  prazo: data.optional().describe('Prazo de cumprimento (AAAA-MM-DD), se houver'),
  periodicidade: recorrencia.optional().describe('Se a obrigação se repete'),
});

const pendenciaEntrada = z.object({
  numero: z.string().optional(),
  tipo: z.enum(['notificacao', 'documental', 'retificacao', 'app', 'rl', 'pra', 'outro']).optional(),
  descricao: z.string(),
  origem: z.string().optional().describe('Ex.: "Notificação SICAR de 10/09/2026", nº do ofício'),
  prazo: data.optional(),
  periodicidade: recorrencia.optional(),
});

const INSTRUCOES = `Conector do sistema de gestão ambiental da VACG (consultoria ambiental). Responda sempre em português do Brasil.

O sistema tem dois módulos:
- Ambiental (licenciamento): empresas clientes, condicionantes das licenças e eventos de controle (avisos de vencimento de licenças, análises, condicionantes, relatórios e taxas).
- CAR (Cadastro Ambiental Rural): imóveis rurais com nº do recibo do CAR, áreas (APP, Reserva Legal…), proprietários, PRA, pendências da análise e eventos.

Como trabalhar:
- Antes de cadastrar, use "buscar" para ver se a empresa ou o imóvel já existe e evitar duplicidade.
- Ao receber foto ou PDF de documento (cartão CNPJ, licença, certificado/recibo do CAR, notificação), extraia os dados, mostre um resumo do que vai cadastrar e peça confirmação antes de gravar.
- Datas sempre no formato AAAA-MM-DD. Hoje é ${hoje()}.
- Condicionantes e pendências com prazo devem virar eventos de controle (as ferramentas fazem isso quando criar_eventos for true).
- Não invente dados que não estejam no documento ou na conversa; deixe o campo vazio.`;

// ---------- Ferramentas ----------
export function criarServidor(usuario) {
  const sb = clienteSupabase(usuario.user_id);
  const admin = usuario.papel === 'admin';
  const server = new McpServer({ name: 'vacg-gestao', version: '1.0.0' }, { instructions: INSTRUCOES });

  // Envolve cada ferramenta: erros viram mensagem legível para o Claude
  const ferramenta = (nome, config, fn) =>
    server.registerTool(nome, config, async (args) => {
      try {
        return resposta(await fn(args || {}));
      } catch (e) {
        return erro(e.message);
      }
    });

  const leitura = { readOnlyHint: true, openWorldHint: false };
  const escrita = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

  const nomeEmpresa = (e) => e?.nome_fantasia || e?.razao_social;

  ferramenta('quem_sou_eu', {
    title: 'Usuário conectado',
    description: 'Mostra quem está usando o conector e o que o perfil pode fazer.',
    annotations: leitura,
  }, async () => ({
    nome: usuario.nome,
    email: usuario.email,
    perfil: admin ? 'Administrador (acesso a tudo, inclusive mensalidades)' : 'Colaborador (sem acesso ao financeiro)',
  }));

  ferramenta('buscar', {
    title: 'Buscar empresas e imóveis',
    description: 'Procura empresas (por nome, razão social, CNPJ ou cidade) e imóveis rurais do CAR (por nome, nº do CAR ou município). Use antes de cadastrar para evitar duplicidade.',
    inputSchema: z.object({ texto: z.string().min(2).describe('Parte do nome, CNPJ, nº do CAR ou cidade') }),
    annotations: leitura,
  }, async ({ texto }) => {
    // A base é pequena: compara no código, ignorando acentos, maiúsculas e pontuação
    const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const soDig = (s) => (s || '').replace(/[^0-9a-z]/gi, '').toLowerCase();
    const t = norm(texto.trim());
    const td = soDig(texto);
    const bate = (campos, codigos) =>
      campos.some((c) => norm(c).includes(t)) || (td.length >= 4 && codigos.some((c) => soDig(c).includes(td)));
    const [empresas, imoveis] = await Promise.all([
      sb.from('empresas').select('id, razao_social, nome_fantasia, cnpj, cidade, uf').then(ok),
      sb.from('imoveis_car').select('id, nome, codigo_car, municipio, uf, situacao, condicao, proprietarios').then(ok),
    ]);
    return {
      empresas: empresas.filter((e) => bate([e.razao_social, e.nome_fantasia, e.cidade], [e.cnpj])).slice(0, 15),
      imoveis_car: imoveis
        .filter((i) => bate([i.nome, i.municipio, ...(i.proprietarios || []).map((p) => p.nome)], [i.codigo_car, ...(i.proprietarios || []).map((p) => p.documento)]))
        .slice(0, 15)
        .map(({ proprietarios, ...i }) => ({ ...i, proprietarios: (proprietarios || []).map((p) => p.nome) })),
    };
  });

  ferramenta('vencimentos', {
    title: 'Vencimentos e alertas',
    description: 'Lista os eventos de controle vencidos e os que vencem nos próximos dias, das empresas e/ou dos imóveis do CAR.',
    inputSchema: z.object({
      modulo: z.enum(['todos', 'ambiental', 'car']).optional().describe('Padrão: todos'),
      dias: z.number().int().min(1).max(365).optional().describe('Janela à frente, em dias. Padrão: 30'),
    }),
    annotations: leitura,
  }, async ({ modulo = 'todos', dias = 30 }) => {
    const ate = new Date(Date.now() + dias * 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const h = hoje();
    const out = {};
    if (modulo !== 'car') {
      const evs = ok(await sb.from('eventos').select('id, titulo, tipo, data_vencimento, documento, empresa_id, empresas(razao_social, nome_fantasia)').eq('status', 'pendente').lte('data_vencimento', ate).order('data_vencimento'));
      out.ambiental = evs.map((e) => ({ id: e.id, titulo: e.titulo, tipo: e.tipo, vencimento: e.data_vencimento, situacao: e.data_vencimento < h ? 'VENCIDO' : 'a vencer', empresa: nomeEmpresa(e.empresas), documento: e.documento }));
    }
    if (modulo !== 'ambiental') {
      const evs = ok(await sb.from('car_eventos').select('id, titulo, tipo, data_vencimento, documento, imovel_id, imoveis_car(nome)').eq('status', 'pendente').lte('data_vencimento', ate).order('data_vencimento'));
      out.car = evs.map((e) => ({ id: e.id, titulo: e.titulo, tipo: e.tipo, vencimento: e.data_vencimento, situacao: e.data_vencimento < h ? 'VENCIDO' : 'a vencer', imovel: e.imoveis_car?.nome, documento: e.documento }));
    }
    return { hoje: h, ate, ...out };
  });

  ferramenta('ver_empresa', {
    title: 'Ver empresa',
    description: 'Mostra os dados completos de uma empresa: cadastro, condicionantes, eventos em aberto, serviços' + (admin ? ' e mensalidade.' : '.'),
    inputSchema: z.object({ empresa_id: z.string() }),
    annotations: leitura,
  }, async ({ empresa_id }) => {
    const emp = ok(await sb.from('empresas').select('*').eq('id', empresa_id).maybeSingle());
    if (!emp) throw new Error('Empresa não encontrada');
    const [conds, evs, anexos] = await Promise.all([
      sb.from('condicionantes').select('id, numero, descricao, licenca_ref, prazo, periodicidade, status').eq('empresa_id', empresa_id).order('ordem').then(ok),
      sb.from('eventos').select('id, titulo, tipo, data_vencimento, recorrencia, status, documento').eq('empresa_id', empresa_id).eq('status', 'pendente').order('data_vencimento').then(ok),
      sb.from('anexos').select('nome, categoria, validade').eq('empresa_id', empresa_id).then(ok),
    ]);
    const { criado_por, ...dados } = emp;
    const out = { empresa: dados, condicionantes: conds, eventos_em_aberto: evs, documentos: anexos };
    if (admin) out.mensalidade = ok(await sb.from('mensalidades').select('dados').eq('empresa_id', empresa_id).maybeSingle())?.dados || null;
    return out;
  });

  ferramenta('cadastrar_empresa', {
    title: 'Cadastrar empresa',
    description: 'Cadastra uma nova empresa cliente, opcionalmente já com condicionantes e serviços. Confirme os dados com o usuário antes. Verifique com "buscar" se já não existe.',
    inputSchema: z.object({
      razao_social: z.string(),
      nome_fantasia: z.string().optional(),
      cnpj: z.string().optional().describe('Com ou sem pontuação'),
      atividade: z.string().optional(),
      cnae: z.string().optional(),
      porte: z.enum(['Micro', 'Pequeno', 'Médio', 'Grande', 'Excepcional']).optional(),
      potencial_poluidor: z.enum(['Baixo', 'Médio', 'Alto']).optional(),
      orgao_ambiental: z.string().optional(),
      cep: z.string().optional(),
      endereco: z.string().optional(),
      cidade: z.string().optional(),
      uf: z.string().length(2).optional(),
      responsavel: z.string().optional(),
      telefone: z.string().optional(),
      email: z.string().optional(),
      observacoes: z.string().optional(),
      servicos: z.array(z.string()).optional().describe('Nomes dos serviços que a VACG presta, ex.: "Licenciamento ambiental"'),
      condicionantes: z.array(condicionanteEntrada).optional(),
      criar_eventos: z.boolean().optional().describe('Criar evento de controle para cada condicionante com prazo. Padrão: true'),
    }),
    annotations: escrita,
  }, async ({ servicos = [], condicionantes = [], criar_eventos = true, cnpj, ...campos }) => {
    const cnpjFmt = formatarCnpj(cnpj);
    if (cnpjFmt) {
      const existe = ok(await sb.from('empresas').select('id, razao_social').eq('cnpj', cnpjFmt).maybeSingle());
      if (existe) throw new Error(`Já existe empresa com este CNPJ: ${existe.razao_social} (id ${existe.id}). Use atualizar_empresa.`);
    }
    const id = uid();
    ok(await sb.from('empresas').insert({
      id,
      ...campos,
      uf: campos.uf?.toUpperCase(),
      cnpj: cnpjFmt,
      servicos: servicos.map((nome) => ({ id: uid(), nome, descricao: '', status: 'ativo', inicio: '' })),
    }));
    const criados = await inserirCondicionantes(id, condicionantes, criar_eventos, 0);
    return { ok: true, empresa_id: id, mensagem: `Empresa "${campos.nome_fantasia || campos.razao_social}" cadastrada.`, ...criados, link: `https://vacg-gestao.vercel.app/#/empresas/${id}` };
  });

  ferramenta('atualizar_empresa', {
    title: 'Atualizar empresa',
    description: 'Altera dados cadastrais de uma empresa existente. Informe só os campos que mudam.',
    inputSchema: z.object({
      empresa_id: z.string(),
      razao_social: z.string().optional(),
      nome_fantasia: z.string().optional(),
      cnpj: z.string().optional(),
      atividade: z.string().optional(),
      cnae: z.string().optional(),
      orgao_ambiental: z.string().optional(),
      cep: z.string().optional(),
      endereco: z.string().optional(),
      cidade: z.string().optional(),
      uf: z.string().length(2).optional(),
      responsavel: z.string().optional(),
      telefone: z.string().optional(),
      email: z.string().optional(),
      observacoes: z.string().optional(),
    }),
    annotations: escrita,
  }, async ({ empresa_id, cnpj, ...campos }) => {
    const mud = { ...campos };
    if (cnpj !== undefined) mud.cnpj = formatarCnpj(cnpj);
    if (mud.uf) mud.uf = mud.uf.toUpperCase();
    if (!Object.keys(mud).length) throw new Error('Nenhum campo para alterar');
    const r = ok(await sb.from('empresas').update(mud).eq('id', empresa_id).select('id'));
    if (!r.length) throw new Error('Empresa não encontrada');
    return { ok: true, alterados: Object.keys(mud) };
  });

  ferramenta('adicionar_condicionantes', {
    title: 'Adicionar condicionantes',
    description: 'Adiciona condicionantes a uma empresa (ex.: lidas do certificado da licença) e, se tiverem prazo, cria os eventos de controle.',
    inputSchema: z.object({
      empresa_id: z.string(),
      condicionantes: z.array(condicionanteEntrada).min(1),
      criar_eventos: z.boolean().optional().describe('Padrão: true'),
    }),
    annotations: escrita,
  }, async ({ empresa_id, condicionantes, criar_eventos = true }) => {
    const emp = ok(await sb.from('empresas').select('id').eq('id', empresa_id).maybeSingle());
    if (!emp) throw new Error('Empresa não encontrada');
    const { count } = await sb.from('condicionantes').select('id', { count: 'exact', head: true }).eq('empresa_id', empresa_id);
    return { ok: true, ...(await inserirCondicionantes(empresa_id, condicionantes, criar_eventos, count || 0)) };
  });

  async function inserirCondicionantes(empresaId, lista, criarEventos, ordemInicial) {
    if (!lista.length) return { condicionantes_criadas: 0, eventos_criados: 0 };
    const linhas = lista.map((c, i) => ({
      id: uid(),
      empresa_id: empresaId,
      numero: c.numero || String(ordemInicial + i + 1).padStart(2, '0'),
      descricao: c.descricao,
      licenca_ref: c.licenca_ref || null,
      prazo: c.prazo || null,
      periodicidade: c.periodicidade || 'nenhuma',
      status: 'pendente',
      ordem: ordemInicial + i,
    }));
    ok(await sb.from('condicionantes').insert(linhas));
    const eventos = criarEventos
      ? linhas.filter((c) => c.prazo).map((c) => ({
          id: uid(),
          empresa_id: empresaId,
          condicionante_id: c.id,
          tipo: 'condicionante',
          titulo: `Condicionante ${c.numero}: ${c.descricao.length > 60 ? c.descricao.slice(0, 60) + '…' : c.descricao}`,
          documento: c.licenca_ref,
          data_vencimento: c.prazo,
          antecedencia_dias: 30,
          recorrencia: c.periodicidade,
          observacoes: c.descricao,
        }))
      : [];
    if (eventos.length) ok(await sb.from('eventos').insert(eventos));
    return { condicionantes_criadas: linhas.length, eventos_criados: eventos.length };
  }

  ferramenta('criar_evento', {
    title: 'Criar evento de controle (empresa)',
    description: 'Cria um aviso de vencimento para uma empresa: licença, análise, condicionante, relatório, taxa ou outro.',
    inputSchema: z.object({
      empresa_id: z.string(),
      tipo: tiposAmbiental,
      titulo: z.string(),
      data_vencimento: data,
      antecedencia_dias: z.number().int().min(0).max(730).optional().describe('Dias de antecedência do aviso. Padrão: 30 (licenças: 120)'),
      recorrencia: recorrencia.optional(),
      documento: z.string().optional().describe('Nº da licença/documento'),
      observacoes: z.string().optional(),
    }),
    annotations: escrita,
  }, async ({ empresa_id, antecedencia_dias, recorrencia: rec = 'nenhuma', ...ev }) => {
    const emp = ok(await sb.from('empresas').select('id').eq('id', empresa_id).maybeSingle());
    if (!emp) throw new Error('Empresa não encontrada');
    const id = uid();
    ok(await sb.from('eventos').insert({ id, empresa_id, ...ev, recorrencia: rec, antecedencia_dias: antecedencia_dias ?? (ev.tipo === 'licenca' ? 120 : 30) }));
    return { ok: true, evento_id: id };
  });

  ferramenta('concluir_evento', {
    title: 'Concluir evento',
    description: 'Marca um evento como concluído. Se for recorrente, agenda automaticamente a próxima ocorrência.',
    inputSchema: z.object({ evento_id: z.string(), modulo: z.enum(['ambiental', 'car']).describe('ambiental = evento de empresa; car = evento de imóvel rural') }),
    annotations: escrita,
  }, async ({ evento_id, modulo }) => {
    const tabela = modulo === 'car' ? 'car_eventos' : 'eventos';
    const ev = ok(await sb.from(tabela).select('*').eq('id', evento_id).maybeSingle());
    if (!ev) throw new Error('Evento não encontrado');
    if (ev.status === 'concluido') return { ok: true, mensagem: 'O evento já estava concluído.' };
    ok(await sb.from(tabela).update({ status: 'concluido', concluido_em: hoje() }).eq('id', evento_id));
    let proximo = null;
    if (ev.recorrencia && ev.recorrencia !== 'nenhuma') {
      const { id, criado_em, criado_por, concluido_em, ...resto } = ev;
      proximo = proximaData(ev.data_vencimento, ev.recorrencia);
      ok(await sb.from(tabela).insert({ ...resto, id: uid(), status: 'pendente', data_vencimento: proximo }));
    }
    return { ok: true, proxima_ocorrencia: proximo };
  });

  // ---------- CAR ----------
  ferramenta('ver_imovel_car', {
    title: 'Ver imóvel rural (CAR)',
    description: 'Mostra os dados de um imóvel rural do CAR: recibo, situação, áreas, proprietários, PRA, pendências e eventos em aberto.',
    inputSchema: z.object({ imovel_id: z.string() }),
    annotations: leitura,
  }, async ({ imovel_id }) => {
    const im = ok(await sb.from('imoveis_car').select('*').eq('id', imovel_id).maybeSingle());
    if (!im) throw new Error('Imóvel não encontrado');
    const [pend, evs] = await Promise.all([
      sb.from('car_pendencias').select('id, numero, tipo, descricao, origem, prazo, status').eq('imovel_id', imovel_id).order('ordem').then(ok),
      sb.from('car_eventos').select('id, titulo, tipo, data_vencimento, recorrencia, documento').eq('imovel_id', imovel_id).eq('status', 'pendente').order('data_vencimento').then(ok),
    ]);
    const { criado_por, ...dados } = im;
    return { imovel: dados, pendencias: pend, eventos_em_aberto: evs };
  });

  ferramenta('cadastrar_imovel_car', {
    title: 'Cadastrar imóvel rural (CAR)',
    description: 'Cadastra um imóvel rural do Cadastro Ambiental Rural (ex.: a partir do recibo ou demonstrativo do CAR). Áreas em hectares. Confirme os dados com o usuário antes.',
    inputSchema: z.object({
      nome: z.string().describe('Nome do imóvel, ex.: "Fazenda Boa Esperança"'),
      codigo_car: z.string().optional().describe('Nº do recibo: UF-1234567-XXXX.XXXX.XXXX.XXXX.XXXX.XXXX.XXXX.XXXX'),
      situacao: z.enum(['ativo', 'pendente', 'suspenso', 'cancelado']).optional(),
      condicao: z.enum(['aguardando', 'em_analise', 'pendencias', 'regularizacao', 'conforme']).optional().describe('aguardando = aguardando análise; pendencias = analisado com pendências; regularizacao = aguardando regularização (PRA); conforme = em conformidade'),
      data_inscricao: data.optional(),
      data_retificacao: data.optional(),
      municipio: z.string().optional(),
      uf: z.string().length(2).optional(),
      empresa_id: z.string().optional().describe('Empresa cliente vinculada, se houver'),
      area_total_ha: z.number().optional(),
      modulos_fiscais: z.number().optional(),
      bioma: z.enum(['demais', 'amazonia_floresta', 'amazonia_cerrado', 'amazonia_campos']).optional().describe('Para o mínimo de Reserva Legal: demais regiões = 20%'),
      app_ha: z.number().optional(),
      reserva_legal_ha: z.number().optional(),
      vegetacao_nativa_ha: z.number().optional(),
      area_consolidada_ha: z.number().optional(),
      uso_restrito_ha: z.number().optional(),
      proprietarios: z.array(z.object({ nome: z.string(), documento: z.string().optional().describe('CPF ou CNPJ'), tipo: z.enum(['proprietario', 'possuidor', 'representante']).optional() })).optional(),
      matriculas: z.array(z.object({ numero: z.string(), cartorio: z.string().optional(), area_ha: z.number().optional() })).optional(),
      ccir: z.string().optional(),
      nirf: z.string().optional(),
      observacoes: z.string().optional(),
      pendencias: z.array(pendenciaEntrada).optional(),
      criar_eventos: z.boolean().optional().describe('Criar evento para cada pendência com prazo. Padrão: true'),
    }),
    annotations: escrita,
  }, async (a) => {
    if (a.codigo_car) {
      const existe = ok(await sb.from('imoveis_car').select('id, nome').eq('codigo_car', a.codigo_car.toUpperCase()).maybeSingle());
      if (existe) throw new Error(`Já existe imóvel com este nº do CAR: ${existe.nome} (id ${existe.id}).`);
    }
    const num = (v) => (v === undefined ? undefined : String(v));
    const areas = Object.fromEntries(Object.entries({
      total: num(a.area_total_ha), modulos: num(a.modulos_fiscais), bioma: a.bioma || 'demais', app: num(a.app_ha), rl: num(a.reserva_legal_ha),
      vegetacao: num(a.vegetacao_nativa_ha), consolidada: num(a.area_consolidada_ha), usoRestrito: num(a.uso_restrito_ha),
    }).filter(([, v]) => v !== undefined));
    const id = uid();
    ok(await sb.from('imoveis_car').insert({
      id,
      nome: a.nome,
      codigo_car: a.codigo_car?.toUpperCase() || null,
      empresa_id: a.empresa_id || null,
      situacao: a.situacao || 'ativo',
      condicao: a.condicao || 'aguardando',
      data_inscricao: a.data_inscricao || null,
      data_retificacao: a.data_retificacao || null,
      municipio: a.municipio || null,
      uf: a.uf?.toUpperCase() || null,
      areas,
      proprietarios: (a.proprietarios || []).map((p) => ({ id: uid(), nome: p.nome, documento: p.documento || '', tipo: p.tipo || 'proprietario' })),
      matriculas: (a.matriculas || []).map((m) => ({ id: uid(), numero: m.numero, cartorio: m.cartorio || '', area: num(m.area_ha) || '' })),
      ccir: a.ccir || null,
      nirf: a.nirf || null,
      observacoes: a.observacoes || null,
    }));
    const criados = await inserirPendencias(id, a.pendencias || [], a.criar_eventos ?? true, 0);
    return { ok: true, imovel_id: id, mensagem: `Imóvel "${a.nome}" cadastrado.`, ...criados, link: `https://vacg-gestao.vercel.app/#/car/imoveis/${id}` };
  });

  ferramenta('adicionar_pendencias_car', {
    title: 'Adicionar pendências (CAR)',
    description: 'Adiciona pendências a um imóvel do CAR (ex.: exigências de uma notificação da análise) e cria eventos para as que têm prazo.',
    inputSchema: z.object({ imovel_id: z.string(), pendencias: z.array(pendenciaEntrada).min(1), criar_eventos: z.boolean().optional() }),
    annotations: escrita,
  }, async ({ imovel_id, pendencias, criar_eventos = true }) => {
    const im = ok(await sb.from('imoveis_car').select('id').eq('id', imovel_id).maybeSingle());
    if (!im) throw new Error('Imóvel não encontrado');
    const { count } = await sb.from('car_pendencias').select('id', { count: 'exact', head: true }).eq('imovel_id', imovel_id);
    return { ok: true, ...(await inserirPendencias(imovel_id, pendencias, criar_eventos, count || 0)) };
  });

  async function inserirPendencias(imovelId, lista, criarEventos, ordemInicial) {
    if (!lista.length) return { pendencias_criadas: 0, eventos_criados: 0 };
    const linhas = lista.map((p, i) => ({
      id: uid(),
      imovel_id: imovelId,
      numero: p.numero || String(ordemInicial + i + 1).padStart(2, '0'),
      tipo: p.tipo || 'outro',
      origem: p.origem || null,
      descricao: p.descricao,
      prazo: p.prazo || null,
      periodicidade: p.periodicidade || 'nenhuma',
      status: 'pendente',
      ordem: ordemInicial + i,
    }));
    ok(await sb.from('car_pendencias').insert(linhas));
    const tipoEvento = (t) => (t === 'pra' ? 'pra' : t === 'retificacao' ? 'retificacao' : t === 'app' || t === 'rl' ? 'recomposicao' : 'notificacao');
    const eventos = criarEventos
      ? linhas.filter((p) => p.prazo).map((p) => ({
          id: uid(),
          imovel_id: imovelId,
          pendencia_id: p.id,
          tipo: tipoEvento(p.tipo),
          titulo: `Pendência ${p.numero}: ${p.descricao.length > 60 ? p.descricao.slice(0, 60) + '…' : p.descricao}`,
          documento: p.origem,
          data_vencimento: p.prazo,
          antecedencia_dias: 30,
          recorrencia: p.periodicidade,
          observacoes: p.descricao,
        }))
      : [];
    if (eventos.length) ok(await sb.from('car_eventos').insert(eventos));
    return { pendencias_criadas: linhas.length, eventos_criados: eventos.length };
  }

  ferramenta('criar_evento_car', {
    title: 'Criar evento (CAR)',
    description: 'Cria um aviso de prazo para um imóvel do CAR: retificação, resposta a notificação, PRA, recomposição/PRADA, vistoria, ITR/CCIR ou outro.',
    inputSchema: z.object({
      imovel_id: z.string(),
      tipo: tiposCar,
      titulo: z.string(),
      data_vencimento: data,
      antecedencia_dias: z.number().int().min(0).max(730).optional(),
      recorrencia: recorrencia.optional(),
      documento: z.string().optional(),
      observacoes: z.string().optional(),
    }),
    annotations: escrita,
  }, async ({ imovel_id, antecedencia_dias = 30, recorrencia: rec = 'nenhuma', ...ev }) => {
    const im = ok(await sb.from('imoveis_car').select('id').eq('id', imovel_id).maybeSingle());
    if (!im) throw new Error('Imóvel não encontrado');
    const id = uid();
    ok(await sb.from('car_eventos').insert({ id, imovel_id, ...ev, recorrencia: rec, antecedencia_dias }));
    return { ok: true, evento_id: id };
  });

  // ---------- Financeiro (só administradores) ----------
  if (admin) {
    ferramenta('registrar_pagamento', {
      title: 'Registrar pagamento de mensalidade',
      description: 'Marca a mensalidade de uma empresa como paga em um mês. Somente administradores.',
      inputSchema: z.object({
        empresa_id: z.string(),
        mes: z.string().regex(/^\d{4}-\d{2}$/, 'Use AAAA-MM').describe('Mês de referência, ex.: 2026-11'),
        data_pagamento: data.optional().describe('Padrão: hoje'),
        valor: z.number().optional().describe('Padrão: valor da mensalidade'),
      }),
      annotations: escrita,
    }, async ({ empresa_id, mes, data_pagamento, valor }) => {
      const m = ok(await sb.from('mensalidades').select('dados').eq('empresa_id', empresa_id).maybeSingle());
      if (!m) throw new Error('Esta empresa não tem mensalidade configurada');
      const dados = { ...m.dados, pagamentos: { ...(m.dados.pagamentos || {}), [mes]: { pago: true, dataPagamento: data_pagamento || hoje(), valor: valor ?? Number(m.dados.valor) ?? 0 } } };
      ok(await sb.from('mensalidades').update({ dados }).eq('empresa_id', empresa_id));
      return { ok: true, mensagem: `Mensalidade de ${mes} marcada como paga.` };
    });
  }

  return server;
}

function formatarCnpj(v) {
  const d = (v || '').replace(/\D/g, '');
  if (d.length !== 14) return v ? v.trim() : null;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

// ---------- Endpoint HTTP (Vercel) ----------
const handler = createMcpHandler(
  (ctx) => criarServidor(ctx.authInfo.extra.usuario),
  { onerror: (e) => console.error('[mcp]', e.message) }
);

async function atender(request) {
  if (!URL_SUPABASE || !CHAVE_SECRETA) {
    return Response.json({ erro: 'Conector não configurado no servidor (falta SUPABASE_SECRET_KEY).' }, { status: 500 });
  }
  let usuario = null;
  try {
    usuario = await autenticar(request);
  } catch (e) {
    console.error('[mcp] autenticação', e.message);
    return Response.json({ erro: 'Banco de dados indisponível no momento.' }, { status: 503 });
  }
  // Diagnóstico (nunca registra a chave): método, se veio cabeçalho e o formato dele
  const cab = request.headers.get('authorization') || '';
  const formato = !cab ? 'sem cabeçalho' : /^Bearer\s+vacg_/i.test(cab) ? 'Bearer vacg_…' : /^vacg_/.test(cab) ? 'chave sem "Bearer"' : 'outro formato';
  if (!usuario) {
    // Com a chave secreta certa o servidor enxerga os perfis; com outra chave, enxerga zero
    const { count } = await clienteSupabase().from('perfis').select('user_id', { count: 'exact', head: true });
    const { count: chaves } = await clienteSupabase().from('mcp_tokens').select('id', { count: 'exact', head: true }).eq('revogado', false);
    console.warn(`[mcp] recusado ${request.method} · ${formato} · tamanho ${cab.length} · perfis visíveis ${count ?? '?'} · chaves ativas ${chaves ?? '?'}`);
    // 403 (e não 401 com WWW-Authenticate): o 401 faz o Claude tentar login OAuth, que este servidor não usa
    return Response.json({ erro: 'Chave de acesso ausente, inválida, revogada ou de usuário desativado. Configure o cabeçalho Authorization: Bearer <chave> no conector.' }, { status: 403 });
  }
  const resp = await handler.fetch(request, {
    authInfo: { token: 'oculto', clientId: usuario.user_id, scopes: [usuario.papel], extra: { usuario } },
  });
  console.log(`[mcp] ${request.method} de ${usuario.nome} · resposta ${resp.status}`);
  return resp;
}

export const GET = atender;
export const POST = atender;
export const DELETE = atender;
