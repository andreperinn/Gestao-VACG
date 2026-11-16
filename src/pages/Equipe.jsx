import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users, History, RefreshCw, ChevronDown, LogIn, Building2, CalendarClock, ClipboardCheck, Paperclip, Wallet,
  ShieldCheck, UserPlus, Info, Trees, Bot, KeyRound, Copy, Ban, Plus,
} from 'lucide-react';
import { useStore } from '../store';
import { useUI, Tabs, Chips, EmptyState, Badge, Modal, Field } from '../components/ui';
import * as db from '../db';
import { corDe, fmtData, MESES } from '../utils';
import { SITUACOES_CAR, CONDICOES_CAR, BIOMAS_RL, SITUACOES_RL } from '../car';

// ---------- Textos do registro de atividades ----------
const TABELAS = {
  empresas: { artigo: 'a empresa', icon: Building2, label: 'Empresas' },
  eventos: { artigo: 'o evento', icon: CalendarClock, label: 'Eventos' },
  condicionantes: { artigo: 'a condicionante', icon: ClipboardCheck, label: 'Condicionantes' },
  anexos: { artigo: 'o documento', icon: Paperclip, label: 'Documentos' },
  mensalidades: { artigo: 'a mensalidade', icon: Wallet, label: 'Mensalidades' },
  imoveis_car: { artigo: 'o imóvel', icon: Trees, label: 'CAR · Imóveis', car: true },
  car_pendencias: { artigo: 'a pendência', icon: ClipboardCheck, label: 'CAR · Pendências', car: true },
  car_eventos: { artigo: 'o evento do CAR', icon: CalendarClock, label: 'CAR · Eventos', car: true },
  car_anexos: { artigo: 'o documento do CAR', icon: Paperclip, label: 'CAR · Documentos', car: true },
};

const VERBOS = { criou: 'criou', editou: 'editou', excluiu: 'excluiu', concluiu: 'concluiu', reabriu: 'reabriu' };

function verbo(a) {
  if (a.acao === 'criou' && (a.tabela === 'anexos' || a.tabela === 'car_anexos')) return 'anexou';
  if (a.acao === 'criou' && a.tabela === 'imoveis_car') return 'cadastrou';
  if (a.acao === 'criou' && a.tabela === 'empresas') return 'cadastrou';
  if (a.acao === 'criou' && a.tabela === 'mensalidades') return 'configurou';
  if (a.acao === 'excluiu' && (a.tabela === 'anexos' || a.tabela === 'car_anexos')) return 'removeu';
  return VERBOS[a.acao] || a.acao;
}

const CAMPOS = {
  razao_social: 'Razão social', nome_fantasia: 'Nome fantasia', cnpj: 'CNPJ', atividade: 'Atividade', cnae: 'CNAE',
  porte: 'Porte', potencial_poluidor: 'Potencial poluidor', orgao_ambiental: 'Órgão ambiental', cep: 'CEP',
  endereco: 'Endereço', cidade: 'Cidade', uf: 'UF', responsavel: 'Responsável', telefone: 'Telefone', email: 'E-mail',
  observacoes: 'Observações', latitude: 'Localização no mapa', servicos: 'Serviços', numero: 'Número',
  descricao: 'Descrição', licenca_ref: 'Licença', prazo: 'Prazo', periodicidade: 'Periodicidade', status: 'Situação',
  tipo: 'Tipo', titulo: 'Título', documento: 'Documento', data_vencimento: 'Vencimento',
  antecedencia_dias: 'Aviso (dias antes)', recorrencia: 'Repetição', concluido_em: 'Concluído em', nome: 'Nome',
  categoria: 'Categoria', validade: 'Validade',
  codigo_car: 'Nº do CAR', situacao: 'Situação do cadastro', condicao: 'Condição da análise', data_inscricao: 'Inscrição',
  data_retificacao: 'Última retificação', municipio: 'Município', areas: 'Áreas', proprietarios: 'Proprietários',
  matriculas: 'Matrículas', ccir: 'CCIR', nirf: 'NIRF / CIB', pra: 'PRA', origem: 'Origem',
  // dentro da mensalidade
  ativa: 'Cobrança ativa', valor: 'Valor', diaVencimento: 'Dia do vencimento', formaPagamento: 'Forma de pagamento',
  inicio: 'Cobrança a partir de',
};
const IGNORAR = new Set(['id', 'empresa_id', 'imovel_id', 'pendencia_id', 'criado_em', 'criado_por', 'atualizado_em', 'enviado_em', 'enviado_por', 'ordem', 'condicionante_id', 'tamanho', 'longitude']);

const SUBCAMPOS = {
  total: 'Área total (ha)', modulos: 'Módulos fiscais', bioma: 'Região / bioma', app: 'APP (ha)', rl: 'Reserva Legal (ha)',
  rlSituacao: 'Situação da RL', vegetacao: 'Vegetação nativa (ha)', consolidada: 'Área consolidada (ha)',
  usoRestrito: 'Uso restrito (ha)', deficitRl: 'Déficit de RL (ha)', appRecompor: 'APP a recompor (ha)',
  adesao: 'Adesão ao PRA', termo: 'Termo de compromisso', orgao: 'Órgão', dataAdesao: 'Data de adesão',
  prazoFinal: 'Prazo final do PRA', compromissos: 'Compromissos',
};

function fmtValor(campo, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (campo === 'latitude') return 'ponto marcado';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtData(v);
  if (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v)) return `${MESES[Number(v.slice(5)) - 1]}/${v.slice(0, 4)}`;
  if (Array.isArray(v)) return `${v.length} item(ns)`;
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

const nomeMes = (ym) => `${MESES[Number(ym.slice(5)) - 1]}/${ym.slice(0, 4)}`;

// Lista do que mudou entre "antes" e "depois"
function mudancas(a) {
  const antes = a.antes || {};
  const depois = a.depois || {};
  if (a.acao === 'entrou') return [];

  // Mensalidade: traduz os pagamentos marcados/desmarcados
  if (a.tabela === 'mensalidades') {
    const da = antes.dados || {};
    const dd = depois.dados || {};
    const pa = da.pagamentos || {};
    const pd = dd.pagamentos || {};
    const linhas = [];
    Object.keys(pd).filter((m) => pd[m]?.pago && !pa[m]?.pago).sort().forEach((m) => linhas.push({ texto: `Marcou ${nomeMes(m)} como pago` }));
    Object.keys(pa).filter((m) => pa[m]?.pago && !pd[m]?.pago).sort().forEach((m) => linhas.push({ texto: `Desmarcou o pagamento de ${nomeMes(m)}` }));
    ['ativa', 'valor', 'diaVencimento', 'formaPagamento', 'inicio', 'observacoes'].forEach((k) => {
      if (JSON.stringify(da[k]) !== JSON.stringify(dd[k]) && (a.acao !== 'criou' || dd[k] !== undefined)) {
        linhas.push({ campo: CAMPOS[k], de: fmtValor(k, da[k]), para: fmtValor(k, dd[k]) });
      }
    });
    return linhas;
  }

  if (a.acao !== 'editou') return [];
  const linhas = [];
  Object.keys({ ...antes, ...depois }).forEach((k) => {
    if (IGNORAR.has(k) || JSON.stringify(antes[k]) === JSON.stringify(depois[k])) return;
    // Listas (serviços, proprietários, matrículas): o que entrou, saiu ou mudou
    const LISTAS = { servicos: 'o serviço', proprietarios: 'o proprietário', matriculas: 'a matrícula' };
    if (LISTAS[k]) {
      const nomeItem = (s) => s.nome || s.numero || '—';
      const ia = Object.fromEntries((antes[k] || []).map((s) => [s.id, s]));
      const id = Object.fromEntries((depois[k] || []).map((s) => [s.id, s]));
      Object.values(id).filter((s) => !ia[s.id]).forEach((s) => linhas.push({ texto: `Adicionou ${LISTAS[k]} "${nomeItem(s)}"` }));
      Object.values(ia).filter((s) => !id[s.id]).forEach((s) => linhas.push({ texto: `Removeu ${LISTAS[k]} "${nomeItem(s)}"` }));
      Object.values(id).filter((s) => ia[s.id] && JSON.stringify(ia[s.id]) !== JSON.stringify(s)).forEach((s) => linhas.push({ texto: `Alterou ${LISTAS[k]} "${nomeItem(s)}"` }));
      return;
    }
    // Objetos do CAR (áreas e PRA): campo a campo
    if (k === 'areas' || k === 'pra') {
      const oa = antes[k] || {};
      const od = depois[k] || {};
      Object.keys({ ...oa, ...od }).forEach((sub) => {
        if (JSON.stringify(oa[sub]) === JSON.stringify(od[sub]) || sub === 'gerarEvento') return;
        const v = (x) => (sub === 'bioma' ? BIOMAS_RL[x]?.label : sub === 'rlSituacao' ? SITUACOES_RL[x] : x);
        linhas.push({ campo: SUBCAMPOS[sub] || sub, de: fmtValor(sub, v(oa[sub])), para: fmtValor(sub, v(od[sub])) });
      });
      return;
    }
    if (k === 'situacao' || k === 'condicao') {
      const mapa = k === 'situacao' ? SITUACOES_CAR : CONDICOES_CAR;
      linhas.push({ campo: CAMPOS[k], de: mapa[antes[k]]?.label || '—', para: mapa[depois[k]]?.label || '—' });
      return;
    }
    linhas.push({ campo: CAMPOS[k] || k, de: fmtValor(k, antes[k]), para: fmtValor(k, depois[k]) });
  });
  return linhas;
}

const PERIODOS = [
  { id: 'hoje', label: 'Hoje', dias: 0 },
  { id: '7', label: '7 dias', dias: 7 },
  { id: '30', label: '30 dias', dias: 30 },
  { id: 'tudo', label: 'Tudo', dias: null },
];

function desdeISO(periodo) {
  const p = PERIODOS.find((x) => x.id === periodo);
  if (!p || p.dias === null) return undefined;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - p.dias);
  return d.toISOString();
}

function rotuloDia(iso) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function Pessoa({ nome, size = 34 }) {
  return (
    <div className="conta-avatar" style={{ width: size, height: size, background: `color-mix(in srgb, ${corDe(nome)} 18%, var(--surface))`, color: corDe(nome) }}>
      {(nome || '?')[0].toUpperCase()}
    </div>
  );
}

export default function Equipe() {
  const [tab, setTab] = useState('atividades');
  const [perfis, setPerfis] = useState([]);
  const { toast } = useUI();

  const carregarPerfis = useCallback(async () => {
    try {
      setPerfis(await db.carregarPerfis());
    } catch (e) {
      toast(`Erro ao carregar usuários: ${e.message}`, 'error');
    }
  }, [toast]);

  useEffect(() => {
    carregarPerfis();
  }, [carregarPerfis]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Equipe</h1>
          <p className="muted">Acompanhe o que cada pessoa faz no sistema e gerencie os acessos</p>
        </div>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'atividades', label: 'Atividades', icon: History },
          { id: 'usuarios', label: 'Usuários', icon: Users, count: perfis.length },
          { id: 'claude', label: 'Conector do Claude', icon: Bot },
        ]}
      />
      {tab === 'atividades' && <Atividades perfis={perfis} />}
      {tab === 'usuarios' && <Usuarios perfis={perfis} recarregar={carregarPerfis} />}
      {tab === 'claude' && <ConectorClaude perfis={perfis} />}
    </div>
  );
}

// ---------- Aba: atividades ----------
function Atividades({ perfis }) {
  const { empresaPorId, imovelPorId } = useStore();
  const { toast } = useUI();
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [pessoa, setPessoa] = useState('');
  const [periodo, setPeriodo] = useState('7');
  const [tipo, setTipo] = useState('');
  const [aberto, setAberto] = useState(null);

  const nomes = useMemo(() => Object.fromEntries(perfis.map((p) => [p.user_id, p.nome || p.email])), [perfis]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setLista(await db.carregarAtividades({ userId: pessoa || undefined, desde: desdeISO(periodo), limite: 500 }));
    } catch (e) {
      toast(`Erro ao carregar atividades: ${e.message}`, 'error');
    } finally {
      setCarregando(false);
    }
  }, [pessoa, periodo, toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Atualiza sozinho quando alguém faz algo
  useEffect(() => db.assinarAtividades(() => carregar()), [carregar]);

  const filtradas = lista.filter((a) => !tipo || (tipo === 'entrou' ? a.acao === 'entrou' : a.tabela === tipo));

  // Resumo por pessoa no período
  const resumo = useMemo(() => {
    const m = {};
    lista.forEach((a) => {
      const k = a.user_id || 'desconhecido';
      m[k] ||= { user_id: a.user_id, acoes: 0, ultimaEntrada: null, ultimaAcao: null };
      if (a.acao === 'entrou') m[k].ultimaEntrada ||= a.criado_em;
      else {
        m[k].acoes++;
        m[k].ultimaAcao ||= a.criado_em;
      }
    });
    return Object.values(m).sort((a, b) => b.acoes - a.acoes);
  }, [lista]);

  const porDia = [];
  filtradas.forEach((a) => {
    const dia = rotuloDia(a.criado_em);
    const ultimo = porDia[porDia.length - 1];
    if (ultimo?.dia === dia) ultimo.itens.push(a);
    else porDia.push({ dia, itens: [a] });
  });

  return (
    <div className="atividades">
      <div className="toolbar wrap">
        <select className="select-inline" value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
          <option value="">Todas as pessoas</option>
          {perfis.map((p) => <option key={p.user_id} value={p.user_id}>{p.nome || p.email}</option>)}
        </select>
        <select className="select-inline" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Tudo</option>
          <option value="entrou">Entradas no sistema</option>
          {Object.entries(TABELAS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
        <button className="btn" onClick={carregar} disabled={carregando}><RefreshCw size={16} /> Atualizar</button>
      </div>
      <Chips value={periodo} onChange={setPeriodo} options={PERIODOS} />

      {resumo.length > 0 && (
        <div className="resumo-equipe">
          {resumo.map((r) => {
            const nome = nomes[r.user_id] || 'Desconhecido';
            return (
              <button key={r.user_id || 'x'} className={`resumo-pessoa${pessoa === r.user_id ? ' ativo' : ''}`} onClick={() => setPessoa(pessoa === r.user_id ? '' : r.user_id || '')}>
                <Pessoa nome={nome} size={38} />
                <div className="grow">
                  <strong>{nome}</strong>
                  <span className="muted small">{r.acoes} alteração(ões) no período</span>
                  <span className="muted small">
                    {r.ultimaEntrada ? `Último acesso: ${rotuloDia(r.ultimaEntrada).toLowerCase()} às ${hora(r.ultimaEntrada)}` : 'Sem acesso registrado no período'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {carregando && !lista.length ? (
        <p className="muted">Carregando…</p>
      ) : filtradas.length === 0 ? (
        <EmptyState icon={History} title="Nenhuma atividade" text="Nada registrado com esses filtros. As ações aparecem aqui assim que alguém usar o sistema." />
      ) : (
        porDia.map(({ dia, itens }) => (
          <section key={dia} className="dia-grupo">
            <h3 className="dia-titulo cap">{dia}</h3>
            <div className="card feed">
              {itens.map((a) => {
                const nome = nomes[a.user_id] || a.usuario || 'Alguém';
                const T = TABELAS[a.tabela];
                const Icone = a.acao === 'entrou' ? LogIn : T?.icon || History;
                const linhas = mudancas(a);
                const ehCar = !!T?.car;
                const empresaExiste = a.empresa_id && (ehCar ? imovelPorId[a.empresa_id] : empresaPorId[a.empresa_id]);
                const expandido = aberto === a.id;
                return (
                  <div key={a.id} className={`feed-item ac-${a.acao}`}>
                    <button className="feed-linha" onClick={() => linhas.length && setAberto(expandido ? null : a.id)} disabled={!linhas.length}>
                      <Pessoa nome={nome} />
                      <div className="feed-icone"><Icone size={14} /></div>
                      <div className="grow feed-texto">
                        <b>{nome}</b>{' '}
                        {a.acao === 'entrou' ? (
                          'entrou no sistema'
                        ) : a.tabela === 'mensalidades' ? (
                          <>{verbo(a)} a mensalidade de <b>{a.empresa_nome}</b></>
                        ) : (
                          <>
                            {verbo(a)} {T?.artigo} <b>{a.descricao || '—'}</b>
                            {!['empresas', 'imoveis_car'].includes(a.tabela) && a.empresa_nome && <> {ehCar ? 'no imóvel' : 'em'} <span className="feed-empresa">{a.empresa_nome}</span></>}
                          </>
                        )}
                      </div>
                      <span className="muted small feed-hora">{hora(a.criado_em)}</span>
                      {linhas.length > 0 && <ChevronDown size={16} className={`feed-seta${expandido ? ' aberta' : ''}`} />}
                    </button>
                    {expandido && (
                      <div className="feed-detalhe">
                        {linhas.map((l, i) =>
                          l.texto ? (
                            <div key={i} className="mud-linha">{l.texto}</div>
                          ) : (
                            <div key={i} className="mud-linha">
                              <span className="mud-campo">{l.campo}</span>
                              <span className="mud-de">{l.de}</span>
                              <span className="muted">→</span>
                              <span className="mud-para">{l.para}</span>
                            </div>
                          )
                        )}
                        {empresaExiste && <a className="link" href={ehCar ? `#/car/imoveis/${a.empresa_id}` : `#/empresas/${a.empresa_id}`}>{ehCar ? "Abrir imóvel →" : "Abrir empresa →"}</a>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
      {lista.length >= 500 && <p className="muted small">Mostrando as 500 atividades mais recentes. Use os filtros para ver períodos específicos.</p>}
    </div>
  );
}

// ---------- Aba: usuários ----------
function Usuarios({ perfis, recarregar }) {
  const { usuario } = useStore();
  const { toast, confirm } = useUI();
  const [nomes, setNomes] = useState({});

  const salvar = async (p, mudanca, msg) => {
    try {
      await db.salvarPerfil({ ...p, ...mudanca });
      toast(msg);
      recarregar();
    } catch (e) {
      toast(`Não foi possível salvar: ${e.message}`, 'error');
    }
  };

  const alternarAtivo = async (p) => {
    if (p.ativo) {
      const ok = await confirm({
        title: `Desativar ${p.nome || p.email}?`,
        message: 'A pessoa perde o acesso aos dados na hora. Você pode reativar quando quiser.',
        confirmLabel: 'Desativar',
      });
      if (!ok) return;
    }
    salvar(p, { ativo: !p.ativo }, p.ativo ? 'Acesso desativado' : 'Acesso reativado');
  };

  return (
    <div className="usuarios">
      <div className="banner banner-info">
        <Info size={18} />
        <span>
          <b>Para adicionar alguém:</b> no Supabase, vá em <b>Authentication → Users → Add user</b>, informe o e-mail e uma senha
          provisória (mínimo 6 caracteres) e marque <b>Auto Confirm User</b>. A pessoa aparece aqui como <b>colaborador</b>, sem
          acesso ao financeiro, e pode trocar a senha no primeiro acesso.
        </span>
      </div>

      {perfis.length === 0 ? (
        <EmptyState icon={UserPlus} title="Nenhum usuário" />
      ) : (
        <div className="card lista-usuarios">
          {perfis.map((p) => {
            const eu = p.user_id === usuario?.id;
            const nome = nomes[p.user_id] ?? p.nome;
            return (
              <div key={p.user_id} className={`usuario-linha${p.ativo ? '' : ' inativo'}`}>
                <Pessoa nome={p.nome || p.email} size={42} />
                <div className="grow usuario-info">
                  <input
                    className="usuario-nome"
                    value={nome}
                    onChange={(e) => setNomes((n) => ({ ...n, [p.user_id]: e.target.value }))}
                    onBlur={() => nome.trim() && nome !== p.nome && salvar(p, { nome: nome.trim() }, 'Nome atualizado')}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    aria-label="Nome"
                  />
                  <span className="muted small">{p.email}{eu && ' · você'}</span>
                </div>
                <div className="usuario-acoes">
                  <div className="seg" title={eu ? 'Você não pode alterar o seu próprio perfil' : ''}>
                    <button className={p.papel === 'colaborador' ? 'active' : ''} disabled={eu} onClick={() => p.papel !== 'colaborador' && salvar(p, { papel: 'colaborador' }, 'Agora é colaborador')}>
                      Colaborador
                    </button>
                    <button className={p.papel === 'admin' ? 'active' : ''} disabled={eu} onClick={() => p.papel !== 'admin' && salvar(p, { papel: 'admin' }, 'Agora é administrador')}>
                      <ShieldCheck size={13} /> Admin
                    </button>
                  </div>
                  {p.ativo ? <Badge cls="success" dot>Ativo</Badge> : <Badge cls="danger" dot>Desativado</Badge>}
                  {!eu && (
                    <button className={`btn btn-sm${p.ativo ? ' btn-ghost-danger' : ''}`} onClick={() => alternarAtivo(p)}>
                      {p.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card permissoes">
        <h3>O que cada perfil pode fazer</h3>
        <div className="perm-grid">
          <div>
            <strong><ShieldCheck size={15} /> Administrador</strong>
            <span>Tudo: empresas, condicionantes, eventos, documentos, <b>mensalidades</b>, registro de atividades, usuários e backup.</span>
          </div>
          <div>
            <strong><Users size={15} /> Colaborador</strong>
            <span>Empresas, condicionantes, eventos, serviços e documentos. <b>Não vê nada do financeiro</b> nem o registro de atividades.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Aba: conector do Claude (MCP) ----------
const URL_MCP = 'https://vacg-gestao.vercel.app/api/mcp';

function ConectorClaude({ perfis }) {
  const { toast, confirm } = useUI();
  const [chaves, setChaves] = useState([]);
  const [criando, setCriando] = useState(false);
  const [pessoa, setPessoa] = useState('');
  const [nomeChave, setNomeChave] = useState('');
  const [novaChave, setNovaChave] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const nomes = Object.fromEntries(perfis.map((p) => [p.user_id, p.nome || p.email]));

  const carregar = useCallback(async () => {
    try {
      setChaves(await db.carregarChavesMcp());
    } catch (e) {
      toast(`Erro ao carregar as chaves: ${e.message}`, 'error');
    }
  }, [toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const gerar = async (e) => {
    e.preventDefault();
    if (!pessoa) return toast('Escolha a pessoa', 'error');
    setSalvando(true);
    try {
      const token = await db.criarChaveMcp(pessoa, nomeChave.trim() || `Claude de ${nomes[pessoa]}`);
      setCriando(false);
      setNovaChave({ token, pessoa: nomes[pessoa] });
      setPessoa('');
      setNomeChave('');
      carregar();
    } catch (err) {
      toast(`Não foi possível gerar a chave: ${err.message}`, 'error');
    } finally {
      setSalvando(false);
    }
  };

  const revogar = async (c) => {
    const ok = await confirm({ title: 'Revogar chave?', message: `"${c.nome}" deixa de funcionar na hora. O Claude dessa pessoa perde o acesso ao sistema.`, confirmLabel: 'Revogar' });
    if (!ok) return;
    try {
      await db.revogarChaveMcp(c.id);
      toast('Chave revogada', 'info');
      carregar();
    } catch (err) {
      toast(`Erro: ${err.message}`, 'error');
    }
  };

  const copiar = async (texto, msg) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast(msg);
    } catch {
      toast('Não foi possível copiar', 'error');
    }
  };

  const ativas = chaves.filter((c) => !c.revogado);

  return (
    <div className="usuarios">
      <div className="banner banner-info">
        <Bot size={18} />
        <span>
          Com o conector, a pessoa usa o <b>app do Claude</b> (celular ou computador) para conversar com o sistema: mandar foto de
          um documento e cadastrar a empresa ou o imóvel, perguntar o que vence no mês, concluir eventos… Cada pessoa usa a
          <b> própria chave</b>, com as mesmas permissões do perfil dela. Tudo aparece em Atividades como "via Claude".
        </span>
      </div>

      <div className="row-between wrap gap">
        <h3>Chaves de acesso</h3>
        <button className="btn btn-primary" onClick={() => setCriando(true)}><Plus size={16} /> Gerar chave</button>
      </div>

      {ativas.length === 0 ? (
        <EmptyState icon={KeyRound} title="Nenhuma chave ativa" text="Gere uma chave para cada pessoa que vai usar o Claude com o sistema." />
      ) : (
        <div className="card lista-usuarios">
          {ativas.map((c) => (
            <div key={c.id} className="usuario-linha">
              <Pessoa nome={nomes[c.user_id] || '?'} size={42} />
              <div className="grow usuario-info">
                <strong>{c.nome}</strong>
                <span className="muted small">
                  {nomes[c.user_id] || 'Usuário removido'} · <span className="mono">{c.prefixo}…</span> · criada {fmtData(c.criado_em.slice(0, 10))}
                  {' · '}{c.ultimo_uso ? `último uso ${rotuloDia(c.ultimo_uso).toLowerCase()} às ${hora(c.ultimo_uso)}` : 'ainda não usada'}
                </span>
              </div>
              <button className="btn btn-sm btn-ghost-danger" onClick={() => revogar(c)}><Ban size={15} /> Revogar</button>
            </div>
          ))}
        </div>
      )}

      <div className="card permissoes">
        <h3>Como conectar no Claude</h3>
        <ol className="passos">
          <li>No Claude (claude.ai ou app no computador), abra <b>Configurações → Conectores</b>.</li>
          <li>Clique em <b>Adicionar → Adicionar conector personalizado</b>.</li>
          <li>
            Nome: <b>VACG</b> · URL:{' '}
            <button className="codigo-car" onClick={() => copiar(URL_MCP, 'Endereço copiado')}><span className="mono">{URL_MCP}</span> <Copy size={13} /></button>
          </li>
          <li>Em <b>Autenticação</b>, escolha <b>sem login</b> ("No sign in") e, em <b>Cabeçalhos da requisição</b> ("Request headers"), adicione <span className="mono">Authorization</span> com o valor <span className="mono">Bearer</span> + espaço + a chave da pessoa.</li>
          <li>Salve. Depois de configurado, o conector também funciona no app do Claude no celular.</li>
        </ol>
      </div>

      <Modal open={criando} onClose={() => setCriando(false)} size="sm" icon={<KeyRound size={20} />} title="Gerar chave do conector"
        footer={
          <>
            <button className="btn" onClick={() => setCriando(false)}>Cancelar</button>
            <button type="submit" form="form-chave" className="btn btn-primary" disabled={salvando}>{salvando ? 'Gerando…' : 'Gerar chave'}</button>
          </>
        }>
        <form id="form-chave" className="form-body" onSubmit={gerar}>
          <Field label="Para quem é a chave">
            <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} autoFocus>
              <option value="">Escolha a pessoa…</option>
              {perfis.filter((p) => p.ativo).map((p) => <option key={p.user_id} value={p.user_id}>{p.nome || p.email} ({p.papel === 'admin' ? 'admin' : 'colaborador'})</option>)}
            </select>
          </Field>
          <Field label="Nome da chave (opcional)" hint="Para saber onde ela está em uso, ex.: Claude do celular do pai">
            <input value={nomeChave} onChange={(e) => setNomeChave(e.target.value)} placeholder="Claude do celular" />
          </Field>
        </form>
      </Modal>

      <Modal open={!!novaChave} onClose={() => setNovaChave(null)} size="sm" icon={<KeyRound size={20} />} title="Chave gerada"
        footer={<button className="btn btn-primary" onClick={() => setNovaChave(null)}>Já copiei</button>}>
        {novaChave && (
          <div className="form-body">
            <p>Chave de <b>{novaChave.pessoa}</b>. <b>Copie agora:</b> por segurança, ela não aparece de novo. Se perder, é só revogar e gerar outra.</p>
            <button className="chave-gerada mono" onClick={() => copiar(`Bearer ${novaChave.token}`, 'Valor do cabeçalho copiado')}>
              Bearer {novaChave.token} <Copy size={14} />
            </button>
            <p className="muted small">Esse é o valor completo do cabeçalho <span className="mono">Authorization</span> no conector do Claude. Não compartilhe: quem tiver a chave acessa o sistema como essa pessoa.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
