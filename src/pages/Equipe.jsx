import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users, History, RefreshCw, ChevronDown, LogIn, Building2, CalendarClock, ClipboardCheck, Paperclip, Wallet,
  ShieldCheck, UserPlus, Info,
} from 'lucide-react';
import { useStore } from '../store';
import { useUI, Tabs, Chips, EmptyState, Badge } from '../components/ui';
import * as db from '../db';
import { corDe, fmtData, MESES } from '../utils';

// ---------- Textos do registro de atividades ----------
const TABELAS = {
  empresas: { artigo: 'a empresa', icon: Building2, label: 'Empresas' },
  eventos: { artigo: 'o evento', icon: CalendarClock, label: 'Eventos' },
  condicionantes: { artigo: 'a condicionante', icon: ClipboardCheck, label: 'Condicionantes' },
  anexos: { artigo: 'o documento', icon: Paperclip, label: 'Documentos' },
  mensalidades: { artigo: 'a mensalidade', icon: Wallet, label: 'Mensalidades' },
};

const VERBOS = { criou: 'criou', editou: 'editou', excluiu: 'excluiu', concluiu: 'concluiu', reabriu: 'reabriu' };

function verbo(a) {
  if (a.acao === 'criou' && a.tabela === 'anexos') return 'anexou';
  if (a.acao === 'criou' && a.tabela === 'empresas') return 'cadastrou';
  if (a.acao === 'criou' && a.tabela === 'mensalidades') return 'configurou';
  if (a.acao === 'excluiu' && a.tabela === 'anexos') return 'removeu';
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
  // dentro da mensalidade
  ativa: 'Cobrança ativa', valor: 'Valor', diaVencimento: 'Dia do vencimento', formaPagamento: 'Forma de pagamento',
  inicio: 'Cobrança a partir de',
};
const IGNORAR = new Set(['id', 'empresa_id', 'criado_em', 'criado_por', 'atualizado_em', 'enviado_em', 'enviado_por', 'ordem', 'condicionante_id', 'tamanho', 'longitude']);

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
    if (k === 'servicos') {
      const ia = Object.fromEntries((antes[k] || []).map((s) => [s.id, s]));
      const id = Object.fromEntries((depois[k] || []).map((s) => [s.id, s]));
      Object.values(id).filter((s) => !ia[s.id]).forEach((s) => linhas.push({ texto: `Adicionou o serviço "${s.nome}"` }));
      Object.values(ia).filter((s) => !id[s.id]).forEach((s) => linhas.push({ texto: `Removeu o serviço "${s.nome}"` }));
      Object.values(id).filter((s) => ia[s.id] && JSON.stringify(ia[s.id]) !== JSON.stringify(s)).forEach((s) => linhas.push({ texto: `Alterou o serviço "${s.nome}"` }));
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
        ]}
      />
      {tab === 'atividades' ? <Atividades perfis={perfis} /> : <Usuarios perfis={perfis} recarregar={carregarPerfis} />}
    </div>
  );
}

// ---------- Aba: atividades ----------
function Atividades({ perfis }) {
  const { empresaPorId } = useStore();
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
                const empresaExiste = a.empresa_id && empresaPorId[a.empresa_id];
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
                            {a.tabela !== 'empresas' && a.empresa_nome && <> em <span className="feed-empresa">{a.empresa_nome}</span></>}
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
                        {empresaExiste && <a className="link" href={`#/empresas/${a.empresa_id}`}>Abrir empresa →</a>}
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
