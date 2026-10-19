import { supabase } from './supabase';
import { obterArquivoLocal, BUCKET } from './arquivos';

// Todas as gravações passam por uma fila, para chegarem ao banco na ordem em que
// foram feitas (ex.: a condicionante precisa existir antes do evento vinculado a ela).
let fila = Promise.resolve();
let pendentes = 0;

export function enfileirar(fn) {
  pendentes++;
  const p = fila.then(fn).finally(() => pendentes--);
  fila = p.catch(() => {});
  return p;
}

export const temPendentes = () => pendentes > 0;

// ---------- Conversão entre o formato do app (camelCase) e do banco (snake_case) ----------
const nulo = (v) => (v === '' || v === undefined ? null : v);
const txt = (v) => v ?? '';

const empresaParaDb = (e) => ({
  id: e.id,
  razao_social: e.razaoSocial,
  nome_fantasia: nulo(e.nomeFantasia),
  cnpj: nulo(e.cnpj),
  atividade: nulo(e.atividade),
  cnae: nulo(e.cnae),
  porte: nulo(e.porte),
  potencial_poluidor: nulo(e.potencialPoluidor),
  orgao_ambiental: nulo(e.orgaoAmbiental),
  cep: nulo(e.cep),
  endereco: nulo(e.endereco),
  cidade: nulo(e.cidade),
  uf: nulo(e.uf),
  responsavel: nulo(e.responsavel),
  telefone: nulo(e.telefone),
  email: nulo(e.email),
  observacoes: nulo(e.observacoes),
  latitude: e.localizacao?.lat ?? null,
  longitude: e.localizacao?.lng ?? null,
  servicos: e.servicos || [],
  ...(e.criadoEm && { criado_em: e.criadoEm }),
});

const empresaDoDb = (r, condicionantes, anexos, mensalidade) => ({
  id: r.id,
  razaoSocial: txt(r.razao_social),
  nomeFantasia: txt(r.nome_fantasia),
  cnpj: txt(r.cnpj),
  atividade: txt(r.atividade),
  cnae: txt(r.cnae),
  porte: txt(r.porte),
  potencialPoluidor: txt(r.potencial_poluidor),
  orgaoAmbiental: txt(r.orgao_ambiental),
  cep: txt(r.cep),
  endereco: txt(r.endereco),
  cidade: txt(r.cidade),
  uf: txt(r.uf),
  responsavel: txt(r.responsavel),
  telefone: txt(r.telefone),
  email: txt(r.email),
  observacoes: txt(r.observacoes),
  criadoEm: r.criado_em,
  atualizadoEm: r.atualizado_em,
  localizacao: r.latitude != null && r.longitude != null ? { lat: r.latitude, lng: r.longitude } : null,
  servicos: r.servicos || [],
  mensalidade: mensalidade || null,
  condicionantes,
  anexos,
});

const anexoParaDb = (empresaId, a) => ({
  id: a.id,
  empresa_id: empresaId,
  nome: a.nome,
  tipo: nulo(a.tipo),
  tamanho: a.tamanho ?? null,
  categoria: a.categoria || 'outro',
  descricao: nulo(a.descricao),
  validade: nulo(a.validade),
  ...(a.enviadoEm && { enviado_em: a.enviadoEm }),
});

const anexoDoDb = (r) => ({
  id: r.id,
  nome: r.nome,
  tipo: txt(r.tipo),
  tamanho: r.tamanho,
  categoria: r.categoria || 'outro',
  descricao: txt(r.descricao),
  validade: txt(r.validade),
  enviadoEm: r.enviado_em,
});

const condParaDb = (empresaId, c, ordem) => ({
  id: c.id,
  empresa_id: empresaId,
  numero: nulo(c.numero),
  descricao: nulo(c.descricao),
  licenca_ref: nulo(c.licencaRef),
  prazo: nulo(c.prazo),
  periodicidade: c.periodicidade || 'nenhuma',
  status: c.status || 'pendente',
  ordem,
});

const condDoDb = (r) => ({
  id: r.id,
  numero: txt(r.numero),
  descricao: txt(r.descricao),
  licencaRef: txt(r.licenca_ref),
  prazo: txt(r.prazo),
  periodicidade: r.periodicidade || 'nenhuma',
  status: r.status || 'pendente',
});

const eventoParaDb = (ev) => ({
  id: ev.id,
  empresa_id: ev.empresaId,
  condicionante_id: nulo(ev.condicionanteId),
  tipo: ev.tipo || 'outro',
  titulo: ev.titulo,
  documento: nulo(ev.documento),
  data_vencimento: ev.dataVencimento,
  antecedencia_dias: Number(ev.antecedenciaDias) || 0,
  recorrencia: ev.recorrencia || 'nenhuma',
  status: ev.status || 'pendente',
  concluido_em: nulo(ev.concluidoEm),
  observacoes: nulo(ev.observacoes),
  ...(ev.criadoEm && { criado_em: ev.criadoEm }),
});

const eventoDoDb = (r) => ({
  id: r.id,
  empresaId: r.empresa_id,
  condicionanteId: r.condicionante_id,
  tipo: r.tipo,
  titulo: txt(r.titulo),
  documento: txt(r.documento),
  dataVencimento: r.data_vencimento,
  antecedenciaDias: r.antecedencia_dias,
  recorrencia: r.recorrencia,
  status: r.status,
  concluidoEm: r.concluido_em,
  observacoes: txt(r.observacoes),
  criadoEm: r.criado_em,
});

// ---------- CAR: imóveis rurais, pendências, eventos e documentos ----------
const imovelParaDb = (im) => ({
  id: im.id,
  nome: im.nome,
  codigo_car: nulo(im.codigoCar),
  empresa_id: nulo(im.empresaId),
  situacao: im.situacao || 'ativo',
  condicao: im.condicao || 'aguardando',
  data_inscricao: nulo(im.dataInscricao),
  data_retificacao: nulo(im.dataRetificacao),
  municipio: nulo(im.municipio),
  uf: nulo(im.uf),
  latitude: im.localizacao?.lat ?? null,
  longitude: im.localizacao?.lng ?? null,
  areas: im.areas || {},
  proprietarios: im.proprietarios || [],
  matriculas: im.matriculas || [],
  ccir: nulo(im.ccir),
  nirf: nulo(im.nirf),
  pra: im.pra || {},
  observacoes: nulo(im.observacoes),
  ...(im.criadoEm && { criado_em: im.criadoEm }),
});

const imovelDoDb = (r, pendencias, anexos) => ({
  id: r.id,
  nome: txt(r.nome),
  codigoCar: txt(r.codigo_car),
  empresaId: r.empresa_id || '',
  situacao: r.situacao,
  condicao: r.condicao,
  dataInscricao: txt(r.data_inscricao),
  dataRetificacao: txt(r.data_retificacao),
  municipio: txt(r.municipio),
  uf: txt(r.uf),
  localizacao: r.latitude != null && r.longitude != null ? { lat: r.latitude, lng: r.longitude } : null,
  areas: r.areas || {},
  proprietarios: r.proprietarios || [],
  matriculas: r.matriculas || [],
  ccir: txt(r.ccir),
  nirf: txt(r.nirf),
  pra: r.pra || {},
  observacoes: txt(r.observacoes),
  criadoEm: r.criado_em,
  atualizadoEm: r.atualizado_em,
  pendencias,
  anexos,
});

const pendenciaParaDb = (imovelId, p, ordem) => ({
  id: p.id,
  imovel_id: imovelId,
  numero: nulo(p.numero),
  tipo: p.tipo || 'outro',
  origem: nulo(p.origem),
  descricao: nulo(p.descricao),
  prazo: nulo(p.prazo),
  periodicidade: p.periodicidade || 'nenhuma',
  status: p.status || 'pendente',
  ordem,
});

const pendenciaDoDb = (r) => ({
  id: r.id,
  numero: txt(r.numero),
  tipo: r.tipo || 'outro',
  origem: txt(r.origem),
  descricao: txt(r.descricao),
  prazo: txt(r.prazo),
  periodicidade: r.periodicidade || 'nenhuma',
  status: r.status || 'pendente',
});

const carEventoParaDb = (ev) => ({
  id: ev.id,
  imovel_id: ev.imovelId,
  pendencia_id: nulo(ev.pendenciaId),
  tipo: ev.tipo || 'outro',
  titulo: ev.titulo,
  documento: nulo(ev.documento),
  data_vencimento: ev.dataVencimento,
  antecedencia_dias: Number(ev.antecedenciaDias) || 0,
  recorrencia: ev.recorrencia || 'nenhuma',
  status: ev.status || 'pendente',
  concluido_em: nulo(ev.concluidoEm),
  observacoes: nulo(ev.observacoes),
  ...(ev.criadoEm && { criado_em: ev.criadoEm }),
});

const carEventoDoDb = (r) => ({
  id: r.id,
  imovelId: r.imovel_id,
  pendenciaId: r.pendencia_id,
  tipo: r.tipo,
  titulo: txt(r.titulo),
  documento: txt(r.documento),
  dataVencimento: r.data_vencimento,
  antecedenciaDias: r.antecedencia_dias,
  recorrencia: r.recorrencia,
  status: r.status,
  concluidoEm: r.concluido_em,
  observacoes: txt(r.observacoes),
  criadoEm: r.criado_em,
});

const carAnexoParaDb = (imovelId, a) => {
  const { empresa_id, ...resto } = anexoParaDb(imovelId, a);
  return { ...resto, imovel_id: imovelId };
};

// ---------- Helpers ----------
function ok({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// O Supabase devolve no máximo 1000 linhas por consulta; busca em páginas.
async function selecionarTodos(tabela, ordem) {
  const tam = 1000;
  let todos = [];
  for (let de = 0; ; de += tam) {
    const pagina = ok(await supabase.from(tabela).select('*').order(ordem).range(de, de + tam - 1));
    todos = todos.concat(pagina);
    if (pagina.length < tam) return todos;
  }
}

async function upsertEmLotes(tabela, linhas) {
  for (let i = 0; i < linhas.length; i += 500) {
    ok(await supabase.from(tabela).upsert(linhas.slice(i, i + 500)));
  }
}

// ---------- Operações ----------
export async function carregarTudo() {
  const [emp, cond, ev, anx, mens, imov, pend, carEv, carAnx] = await Promise.all([
    selecionarTodos('empresas', 'razao_social'),
    selecionarTodos('condicionantes', 'ordem'),
    selecionarTodos('eventos', 'data_vencimento'),
    selecionarTodos('anexos', 'enviado_em'),
    // Para quem não é administrador o banco devolve vazio (regra de segurança)
    financeiro ? selecionarTodos('mensalidades', 'empresa_id') : Promise.resolve([]),
    selecionarTodos('imoveis_car', 'nome'),
    selecionarTodos('car_pendencias', 'ordem'),
    selecionarTodos('car_eventos', 'data_vencimento'),
    selecionarTodos('car_anexos', 'enviado_em'),
  ]);
  const pendPorImovel = {};
  pend.forEach((p) => (pendPorImovel[p.imovel_id] ||= []).push(pendenciaDoDb(p)));
  const anxPorImovel = {};
  carAnx.forEach((a) => (anxPorImovel[a.imovel_id] ||= []).push(anexoDoDb(a)));
  const car = {
    imoveis: imov.map((r) => imovelDoDb(r, pendPorImovel[r.id] || [], anxPorImovel[r.id] || [])),
    carEventos: carEv.map(carEventoDoDb),
  };
  const porEmpresa = {};
  cond.forEach((c) => (porEmpresa[c.empresa_id] ||= []).push(condDoDb(c)));
  const anexosPorEmpresa = {};
  anx.forEach((a) => (anexosPorEmpresa[a.empresa_id] ||= []).push(anexoDoDb(a)));
  const mensPorEmpresa = Object.fromEntries(mens.map((m) => [m.empresa_id, m.dados]));
  return {
    empresas: emp.map((r) => empresaDoDb(r, porEmpresa[r.id] || [], anexosPorEmpresa[r.id] || [], mensPorEmpresa[r.id])),
    eventos: ev.map(eventoDoDb),
    ...car,
  };
}

// ---------- Perfil e permissões ----------
// Só administradores leem e gravam mensalidades (o banco também bloqueia)
let financeiro = false;
export const definirFinanceiro = (v) => (financeiro = v);

export async function carregarMeuPerfil(userId) {
  return ok(await supabase.from('perfis').select('*').eq('user_id', userId).maybeSingle());
}

export async function carregarPerfis() {
  return ok(await supabase.from('perfis').select('*').order('nome'));
}

export async function salvarPerfil(p) {
  ok(await supabase.from('perfis').update({ nome: p.nome, papel: p.papel, ativo: p.ativo }).eq('user_id', p.user_id));
}

// ---------- Registro de atividades (só administradores leem) ----------
export async function registrarEntrada(userId, nome) {
  await supabase.from('atividades').insert({ user_id: userId, usuario: nome, acao: 'entrou', descricao: 'Entrou no sistema' });
}

export async function carregarAtividades({ userId, desde, limite = 200 } = {}) {
  let q = supabase.from('atividades').select('*').order('criado_em', { ascending: false }).limit(limite);
  if (userId) q = q.eq('user_id', userId);
  if (desde) q = q.gte('criado_em', desde);
  return ok(await q);
}

export function assinarAtividades(aoMudar) {
  const canal = supabase
    .channel('vacg-atividades')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'atividades' }, aoMudar)
    .subscribe();
  return () => supabase.removeChannel(canal);
}

// Grava as linhas filhas (da empresa ou do imóvel) e apaga as que foram removidas no app
async function sincronizarFilhos(tabela, paiId, linhas, coluna = 'empresa_id') {
  if (linhas.length) ok(await supabase.from(tabela).upsert(linhas));
  let del = supabase.from(tabela).delete().eq(coluna, paiId);
  if (linhas.length) del = del.not('id', 'in', `(${linhas.map((l) => `"${l.id}"`).join(',')})`);
  ok(await del);
}

export async function salvarEmpresa(e) {
  ok(await supabase.from('empresas').upsert(empresaParaDb(e)));
  await sincronizarFilhos('condicionantes', e.id, (e.condicionantes || []).map((c, i) => condParaDb(e.id, c, i)));
  await sincronizarFilhos('anexos', e.id, (e.anexos || []).map((a) => anexoParaDb(e.id, a)));
  if (financeiro && e.mensalidade) {
    ok(await supabase.from('mensalidades').upsert({ empresa_id: e.id, dados: e.mensalidade }));
  }
}

export async function salvarCondicionante(empresaId, c, ordem) {
  ok(await supabase.from('condicionantes').upsert(condParaDb(empresaId, c, ordem)));
}

export async function salvarEventos(lista) {
  if (lista.length) await upsertEmLotes('eventos', lista.map(eventoParaDb));
}

export async function salvarImovel(im) {
  ok(await supabase.from('imoveis_car').upsert(imovelParaDb(im)));
  await sincronizarFilhos('car_pendencias', im.id, (im.pendencias || []).map((p, i) => pendenciaParaDb(im.id, p, i)), 'imovel_id');
  await sincronizarFilhos('car_anexos', im.id, (im.anexos || []).map((a) => carAnexoParaDb(im.id, a)), 'imovel_id');
}

export async function salvarCarEventos(lista) {
  if (lista.length) await upsertEmLotes('car_eventos', lista.map(carEventoParaDb));
}

export async function excluir(tabela, id) {
  ok(await supabase.from(tabela).delete().eq('id', id));
}

export async function limparTudo() {
  // Itens filhos (condicionantes, eventos, pendências…) são apagados junto (on delete cascade)
  ok(await supabase.from('imoveis_car').delete().not('id', 'is', null));
  ok(await supabase.from('empresas').delete().not('id', 'is', null));
}

// Envia os imóveis do CAR e seus itens para o banco sem apagar o que já existe
async function mesclarCar(imoveis, carEventos, idsEmp) {
  const idsImovel = new Set(imoveis.map((im) => im.id));
  const idsPend = new Set();
  const pendencias = [];
  const anexos = [];
  for (const im of imoveis) {
    (im.pendencias || []).forEach((p, i) => {
      idsPend.add(p.id);
      pendencias.push(pendenciaParaDb(im.id, p, i));
    });
    for (const a of im.anexos || []) {
      const blob = await obterArquivoLocal(a.id);
      if (!blob) continue;
      ok(await supabase.storage.from(BUCKET).upload(a.id, blob, { contentType: a.tipo || undefined, upsert: true }));
      anexos.push(carAnexoParaDb(im.id, a));
    }
  }
  await upsertEmLotes('imoveis_car', imoveis.map((im) => imovelParaDb({ ...im, empresaId: idsEmp.has(im.empresaId) ? im.empresaId : null })));
  await upsertEmLotes('car_pendencias', pendencias);
  await upsertEmLotes('car_anexos', anexos);
  await upsertEmLotes(
    'car_eventos',
    carEventos
      .filter((ev) => idsImovel.has(ev.imovelId))
      .map((ev) => carEventoParaDb({ ...ev, pendenciaId: idsPend.has(ev.pendenciaId) ? ev.pendenciaId : null }))
  );
}

// Envia empresas/eventos (e o CAR) para o banco sem apagar o que já existe.
export async function mesclar({ empresas, eventos, imoveis = [], carEventos = [] }) {
  const idsEmp = new Set(empresas.map((e) => e.id));
  const idsCond = new Set();
  const conds = [];
  empresas.forEach((e) =>
    (e.condicionantes || []).forEach((c, i) => {
      idsCond.add(c.id);
      conds.push(condParaDb(e.id, c, i));
    })
  );
  // Documentos: sobe para o Storage os arquivos que estão guardados neste navegador
  const anexos = [];
  for (const e of empresas) {
    for (const a of e.anexos || []) {
      const blob = await obterArquivoLocal(a.id);
      if (!blob) continue;
      ok(await supabase.storage.from(BUCKET).upload(a.id, blob, { contentType: a.tipo || undefined, upsert: true }));
      anexos.push(anexoParaDb(e.id, a));
    }
  }

  await upsertEmLotes('empresas', empresas.map(empresaParaDb));
  await upsertEmLotes('condicionantes', conds);
  await upsertEmLotes('anexos', anexos);
  if (financeiro) {
    await upsertEmLotes('mensalidades', empresas.filter((e) => e.mensalidade).map((e) => ({ empresa_id: e.id, dados: e.mensalidade })));
  }
  await upsertEmLotes(
    'eventos',
    eventos
      .filter((ev) => idsEmp.has(ev.empresaId))
      .map((ev) => eventoParaDb({ ...ev, condicionanteId: idsCond.has(ev.condicionanteId) ? ev.condicionanteId : null }))
  );
  // Imóveis podem estar vinculados a empresas, por isso vêm depois delas
  await mesclarCar(imoveis, carEventos, idsEmp);
}

export async function substituirTudo(dados) {
  await limparTudo();
  await mesclar(dados);
}

// Recarrega os dados quando algo muda no banco (ex.: edição feita em outro aparelho).
export function assinarMudancas(aoMudar) {
  let timer;
  const agendar = () => {
    clearTimeout(timer);
    timer = setTimeout(function tentar() {
      if (temPendentes()) timer = setTimeout(tentar, 500);
      else aoMudar();
    }, 700);
  };
  const canal = supabase.channel('vacg-mudancas');
  ['empresas', 'condicionantes', 'eventos', 'anexos', 'mensalidades', 'imoveis_car', 'car_pendencias', 'car_eventos', 'car_anexos'].forEach((table) =>
    canal.on('postgres_changes', { event: '*', schema: 'public', table }, agendar)
  );
  canal.subscribe();
  return () => {
    clearTimeout(timer);
    supabase.removeChannel(canal);
  };
}
