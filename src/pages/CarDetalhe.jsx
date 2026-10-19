import { useMemo, useState } from 'react';
import {
  ArrowLeft, Pencil, Trash2, Trees, ClipboardList, CalendarClock, Clock, Paperclip, Copy, ExternalLink, MapPin,
  MapPinned, Ruler, Users, Handshake, Landmark, Hash, Building2, StickyNote, Plus, CalendarPlus, Info, Sprout,
} from 'lucide-react';
import { useStore } from '../store';
import { useModais } from '../components/modais';
import { Avatar, Badge, Chips, EmptyState, Tabs, useUI } from '../components/ui';
import EventoItem from '../components/EventoItem';
import Documentos from '../components/Documentos';
import { MapaPonto, LinksMapa } from '../components/Mapa';
import { SICAR_CONSULTA } from '../components/ImovelForm';
import { EventosTab, Historico } from './EmpresaDetalhe';
import {
  SITUACOES_CAR, CONDICOES_CAR, SITUACOES_RL, TIPOS_PENDENCIA, STATUS_PENDENCIA, TIPOS_PROPRIETARIO, BIOMAS_RL,
  CATEGORIAS_DOC_CAR, categoriaDocCar, nomeImovel, fmtHa, calculoRL,
} from '../car';
import { statusEvento, statusEmpresa, STATUS, fmtData, nomeEmpresa, RECORRENCIAS, textoPrazo } from '../utils';
import { excluirArquivo } from '../arquivos';
import { navigate } from '../router';

export default function CarDetalhe({ id }) {
  const { imovelPorId, carEventos, empresaPorId, excluirImovel } = useStore();
  const { abrirImovel, abrirCarEvento } = useModais();
  const { confirm, toast } = useUI();
  const [tab, setTab] = useState('geral');
  const im = imovelPorId[id];
  const evs = useMemo(() => carEventos.filter((x) => x.imovelId === id), [carEventos, id]);

  if (!im) {
    return (
      <div className="page">
        <EmptyState icon={Trees} title="Imóvel não encontrado" text="Ele pode ter sido excluído."
          action={<a className="btn" href="#/car/imoveis"><ArrowLeft size={16} /> Voltar para imóveis</a>} />
      </div>
    );
  }

  const abertos = evs.filter((x) => x.status !== 'concluido');
  const st = statusEmpresa(abertos);
  const pend = im.pendencias || [];
  const pendAbertas = pend.filter((p) => p.status !== 'resolvida').length;
  const sit = SITUACOES_CAR[im.situacao] || SITUACOES_CAR.ativo;
  const cond = CONDICOES_CAR[im.condicao] || CONDICOES_CAR.aguardando;
  const rl = calculoRL(im);
  const cliente = empresaPorId[im.empresaId];

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(im.codigoCar);
      toast('Nº do CAR copiado');
    } catch {
      toast('Não foi possível copiar', 'error');
    }
  };

  const excluir = async () => {
    const ok = await confirm({
      title: 'Excluir imóvel?',
      message: `${nomeImovel(im)}, suas pendências, ${evs.length} evento(s) e documentos serão removidos permanentemente.`,
      confirmLabel: 'Excluir imóvel',
    });
    if (ok) {
      excluirImovel(im.id);
      toast('Imóvel excluído', 'info');
      navigate('/car/imoveis');
    }
  };

  const tabs = [
    { id: 'geral', label: 'Visão geral', icon: Trees },
    { id: 'pendencias', label: 'Pendências', icon: ClipboardList, count: pend.length },
    { id: 'eventos', label: 'Eventos', icon: CalendarClock, count: abertos.length },
    { id: 'documentos', label: 'Documentos', icon: Paperclip, count: (im.anexos || []).length },
    { id: 'historico', label: 'Histórico', icon: Clock },
  ];

  return (
    <div className="page">
      <a href="#/car/imoveis" className="back"><ArrowLeft size={16} /> Imóveis rurais</a>

      <div className={`detail-hero st-${st}`}>
        <Avatar nome={nomeImovel(im)} size={64} />
        <div className="grow">
          <h1>{nomeImovel(im)}</h1>
          {im.codigoCar ? (
            <button className="codigo-car" onClick={copiarCodigo} title="Copiar nº do CAR">
              <span className="mono">{im.codigoCar}</span> <Copy size={13} />
            </button>
          ) : (
            <p className="muted">Sem nº do recibo do CAR</p>
          )}
          <div className="hero-badges">
            <Badge cls={sit.cls} dot>{sit.label}</Badge>
            <Badge cls={cond.cls}>{cond.curto}</Badge>
            {im.municipio && <Badge><MapPin size={12} /> {im.municipio}/{im.uf}</Badge>}
            {im.pra?.adesao && <Badge cls="info"><Handshake size={12} /> PRA</Badge>}
          </div>
        </div>
        <div className="hero-actions">
          <a className="btn" href={SICAR_CONSULTA} target="_blank" rel="noreferrer" title="Consulta pública do CAR"><ExternalLink size={16} /> <span className="hide-mobile">SICAR</span></a>
          <button className="btn" onClick={() => abrirImovel(im)}><Pencil size={16} /> <span className="hide-mobile">Editar</span></button>
          <button className="icon-btn danger" onClick={excluir} title="Excluir imóvel"><Trash2 size={18} /></button>
        </div>
      </div>

      <div className="stat-row stat-row-4">
        <div className="stat"><Ruler size={18} /><b>{fmtHa(im.areas?.total)}</b><span>área total</span></div>
        <div className={`stat${rl.deficit > 0 ? ' stat-danger' : ''}`}><Landmark size={18} /><b>{fmtHa(rl.declarada)}</b><span>de RL · exigida {fmtHa(rl.exigida)}</span></div>
        <div className="stat"><ClipboardList size={18} /><b>{pendAbertas}/{pend.length}</b><span>pendências em aberto</span></div>
        <div className="stat"><CalendarClock size={18} /><b>{abertos.length}</b><span>eventos em aberto</span></div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'geral' && <VisaoGeral im={im} abertos={abertos} cliente={cliente} rl={rl} irPara={setTab} />}
      {tab === 'pendencias' && <PendenciasTab im={im} evs={evs} />}
      {tab === 'eventos' && <EventosTab evs={evs} modulo="car" onNovo={() => abrirCarEvento({ imovelId: im.id })} />}
      {tab === 'documentos' && <DocumentosCar im={im} />}
      {tab === 'historico' && <Historico evs={evs} modulo="car" />}
    </div>
  );
}

function Linha({ icon: Icon, label, children }) {
  if (!children) return null;
  return (
    <div className="info">
      <Icon size={16} />
      <div>
        <span className="muted small">{label}</span>
        <div>{children}</div>
      </div>
    </div>
  );
}

function VisaoGeral({ im, abertos, cliente, rl, irPara }) {
  const { abrirCarEvento, abrirImovel } = useModais();
  const a = im.areas || {};
  const proximos = [...abertos].sort((x, y) => x.dataVencimento.localeCompare(y.dataVencimento)).slice(0, 4);
  const areas = [
    ['APP', a.app],
    ['Remanescente de vegetação nativa', a.vegetacao],
    ['Área consolidada', a.consolidada],
    ['Uso restrito', a.usoRestrito],
  ].filter(([, v]) => v !== undefined && v !== '');
  const pctRl = rl.exigida ? Math.min(100, ((rl.declarada || 0) / rl.exigida) * 100) : 0;

  return (
    <div className="detail-grid">
      <div className="col">
        <section className="card">
          <div className="card-head"><h2><Trees size={18} /> Dados do CAR</h2></div>
          <div className="info-grid">
            <Linha icon={Hash} label="Nº do recibo">{im.codigoCar && <span className="mono quebra">{im.codigoCar}</span>}</Linha>
            <Linha icon={Info} label="Condição da análise">{CONDICOES_CAR[im.condicao]?.label}</Linha>
            <Linha icon={CalendarClock} label="Inscrição">{im.dataInscricao && fmtData(im.dataInscricao)}</Linha>
            <Linha icon={CalendarClock} label="Última retificação">{im.dataRetificacao && fmtData(im.dataRetificacao)}</Linha>
            <Linha icon={MapPin} label="Município">{im.municipio && `${im.municipio}/${im.uf}`}</Linha>
            <Linha icon={Building2} label="Cliente">{cliente && <a className="link" href={`#/empresas/${cliente.id}`}>{nomeEmpresa(cliente)}</a>}</Linha>
            <Linha icon={Landmark} label="CCIR">{im.ccir}</Linha>
            <Linha icon={Landmark} label="NIRF / CIB">{im.nirf}</Linha>
          </div>
          {(im.matriculas || []).length > 0 && (
            <div className="sub-lista">
              <span className="muted small">Matrículas</span>
              {im.matriculas.map((m) => (
                <div key={m.id} className="sub-item"><b>{m.numero}</b>{m.cartorio && <span className="muted"> · {m.cartorio}</span>}{m.area && <span className="muted"> · {fmtHa(m.area)}</span>}</div>
              ))}
            </div>
          )}
          {im.observacoes && <div className="note"><StickyNote size={16} /> {im.observacoes}</div>}
        </section>

        <section className="card">
          <div className="card-head"><h2><Ruler size={18} /> Áreas</h2></div>
          <div className="areas-lista">
            <div className="area-item destaque"><span>Área total</span><b>{fmtHa(a.total)}</b></div>
            {a.modulos && <div className="area-item"><span>Módulos fiscais</span><b>{String(a.modulos).replace('.', ',')}</b></div>}
            {areas.map(([l, v]) => <div key={l} className="area-item"><span>{l}</span><b>{fmtHa(v)}</b></div>)}
          </div>
          <div className="rl-bloco">
            <div className="row-between">
              <strong>Reserva Legal</strong>
              <span className="muted small">{BIOMAS_RL[a.bioma || 'demais']?.label} · mínimo {rl.pct}%</span>
            </div>
            <div className="progress"><div style={{ width: `${pctRl}%`, background: rl.deficit > 0 ? 'var(--danger)' : undefined }} /></div>
            <div className="row-between small">
              <span>Declarada: <b>{fmtHa(rl.declarada)}</b>{rl.pctDeclarado != null && ` (${rl.pctDeclarado.toFixed(1).replace('.', ',')}%)`}</span>
              <span>Exigida: <b>{fmtHa(rl.exigida)}</b></span>
            </div>
            {a.rlSituacao && <span className="muted small">Situação: {SITUACOES_RL[a.rlSituacao]}</span>}
            {rl.deficit > 0 && <span className="txt-danger small">Déficit estimado de {fmtHa(rl.deficit)}</span>}
          </div>
          {(a.deficitRl || a.appRecompor) && (
            <div className="passivo">
              <Sprout size={16} />
              <span>Passivo a regularizar: {a.deficitRl && <b>{fmtHa(a.deficitRl)} de RL</b>}{a.deficitRl && a.appRecompor && ' e '}{a.appRecompor && <b>{fmtHa(a.appRecompor)} de APP</b>}</span>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2><MapPinned size={18} /> Localização</h2>
            {im.localizacao && <button className="btn btn-sm" onClick={() => abrirImovel(im, 'local')}><Pencil size={14} /> Ajustar</button>}
          </div>
          {im.localizacao ? (
            <>
              <MapaPonto ponto={im.localizacao} />
              <LinksMapa ponto={im.localizacao} />
            </>
          ) : (
            <EmptyState icon={MapPinned} title="Sem localização" text="Marque a sede do imóvel no mapa para abrir a rota no Google Maps."
              action={<button className="btn btn-primary btn-sm" onClick={() => abrirImovel(im, 'local')}><MapPin size={15} /> Marcar no mapa</button>} />
          )}
        </section>
      </div>

      <div className="col">
        <section className="card">
          <div className="card-head">
            <h2><CalendarClock size={18} /> Próximos prazos</h2>
            <button className="btn btn-sm" onClick={() => abrirCarEvento({ imovelId: im.id })}><Plus size={15} /> Evento</button>
          </div>
          {proximos.length === 0 ? (
            <EmptyState icon={CalendarPlus} title="Sem eventos" text="Crie avisos para retificações, notificações, PRA e recomposição." />
          ) : (
            <div className="evento-list">
              {proximos.map((ev) => <EventoItem key={ev.id} ev={ev} showEmpresa={false} compact modulo="car" />)}
            </div>
          )}
          {abertos.length > 4 && <button className="btn btn-block btn-sm mt" onClick={() => irPara('eventos')}>Ver todos os {abertos.length} eventos</button>}
        </section>

        <section className="card">
          <div className="card-head">
            <h2><Users size={18} /> Proprietários / possuidores</h2>
            <button className="btn btn-sm" onClick={() => abrirImovel(im, 'fundiario')}><Pencil size={14} /></button>
          </div>
          {(im.proprietarios || []).length === 0 ? (
            <p className="muted small">Nenhum proprietário informado.</p>
          ) : (
            <div className="mini-list">
              {im.proprietarios.map((p) => (
                <div key={p.id} className="mini-item">
                  <Avatar nome={p.nome} size={32} />
                  <div className="grow">
                    <strong>{p.nome || '—'}</strong>
                    <span className="muted small mono">{p.documento} · {TIPOS_PROPRIETARIO[p.tipo]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2><Handshake size={18} /> PRA</h2>
            <button className="btn btn-sm" onClick={() => abrirImovel(im, 'pra')}><Pencil size={14} /></button>
          </div>
          {im.pra?.adesao ? (
            <div className="info-grid">
              <Linha icon={Hash} label="Termo de compromisso">{im.pra.termo}</Linha>
              <Linha icon={Landmark} label="Órgão">{im.pra.orgao}</Linha>
              <Linha icon={CalendarClock} label="Adesão">{im.pra.dataAdesao && fmtData(im.pra.dataAdesao)}</Linha>
              <Linha icon={CalendarClock} label="Prazo final">{im.pra.prazoFinal && fmtData(im.pra.prazoFinal)}</Linha>
              {im.pra.compromissos && <p className="small span-2 pre">{im.pra.compromissos}</p>}
            </div>
          ) : (
            <p className="muted small">Imóvel não aderiu ao Programa de Regularização Ambiental.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function PendenciasTab({ im, evs }) {
  const { atualizarImovel } = useStore();
  const { abrirImovel, abrirCarEvento } = useModais();
  const { confirm, toast } = useUI();
  const [filtro, setFiltro] = useState('todas');
  const pend = im.pendencias || [];
  const pct = pend.length ? Math.round((pend.filter((p) => p.status === 'resolvida').length / pend.length) * 100) : 0;
  const ciclo = { pendente: 'andamento', andamento: 'resolvida', resolvida: 'pendente' };

  const mudarStatus = (p) => {
    const status = ciclo[p.status] || 'pendente';
    atualizarImovel(im.id, (x) => ({ ...x, pendencias: x.pendencias.map((y) => (y.id === p.id ? { ...y, status } : y)) }));
    toast(`Pendência ${p.numero || ''} → ${STATUS_PENDENCIA[status].label}`, 'info');
  };

  const remover = async (p) => {
    const ok = await confirm({ title: 'Remover pendência?', message: p.descricao, confirmLabel: 'Remover' });
    if (!ok) return;
    atualizarImovel(im.id, (x) => ({ ...x, pendencias: x.pendencias.filter((y) => y.id !== p.id) }));
    toast('Pendência removida', 'info');
  };

  const lista = pend.filter((p) => filtro === 'todas' || p.status === filtro);

  return (
    <div>
      <div className="cond-summary card">
        <div className="grow">
          <div className="row-between">
            <strong>Pendências resolvidas</strong>
            <span className="muted">{pct}%</span>
          </div>
          <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        </div>
        <button className="btn btn-primary" onClick={() => abrirImovel(im, 'pendencias')}>
          <Pencil size={16} /> Gerenciar
        </button>
      </div>

      <Chips value={filtro} onChange={setFiltro} options={[
        { id: 'todas', label: 'Todas', count: pend.length },
        ...Object.entries(STATUS_PENDENCIA).map(([k, s]) => ({ id: k, label: s.label, count: pend.filter((p) => p.status === k).length, cls: s.cls })),
      ]} />

      {pend.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhuma pendência"
          text="Cadastre as exigências da análise do CAR, retificações e compromissos do PRA."
          action={<button className="btn btn-primary" onClick={() => abrirImovel(im, 'pendencias')}><Plus size={16} /> Adicionar pendências</button>} />
      ) : (
        <div className="cond-view-list">
          {lista.map((p) => {
            const ativo = evs.find((x) => x.pendenciaId === p.id && x.status !== 'concluido');
            const cs = p.status === 'resolvida' ? 'cumprida' : p.status;
            return (
              <div key={p.id} className={`cond-view cs-${cs}`}>
                <div className="cond-num-badge">{p.numero || '•'}</div>
                <div className="grow">
                  <p className="cond-desc">{p.descricao || <em className="muted">Sem descrição</em>}</p>
                  <div className="evento-meta">
                    <span>{TIPOS_PENDENCIA[p.tipo]}</span>
                    {p.origem && <span>{p.origem}</span>}
                    {p.prazo && <span><Clock size={12} /> Prazo {fmtData(p.prazo)}</span>}
                    {p.periodicidade !== 'nenhuma' && <span>{RECORRENCIAS[p.periodicidade]?.label}</span>}
                    {ativo && (
                      <button type="button" className="link-inline" onClick={() => abrirCarEvento(ativo)}>
                        <CalendarClock size={12} />
                        <Badge cls={STATUS[statusEvento(ativo)].cls}>{textoPrazo(ativo)}</Badge>
                      </button>
                    )}
                  </div>
                </div>
                <div className="cond-actions">
                  <button className={`badge badge-${STATUS_PENDENCIA[p.status]?.cls} badge-btn`} onClick={() => mudarStatus(p)} title="Clique para mudar a situação">
                    {STATUS_PENDENCIA[p.status]?.label}
                  </button>
                  {!ativo && (
                    <button className="icon-btn" title="Criar evento de controle"
                      onClick={() => abrirCarEvento({
                        imovelId: im.id,
                        tipo: p.tipo === 'pra' ? 'pra' : p.tipo === 'retificacao' ? 'retificacao' : 'notificacao',
                        titulo: `Pendência ${p.numero}: ${(p.descricao || '').slice(0, 60)}`,
                        documento: p.origem,
                        dataVencimento: p.prazo,
                        recorrencia: p.periodicidade,
                        pendenciaId: p.id,
                      })}>
                      <CalendarPlus size={17} />
                    </button>
                  )}
                  <button className="icon-btn danger" title="Remover" onClick={() => remover(p)}><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DocumentosCar({ im }) {
  const { atualizarImovel } = useStore();
  const { abrirCarEvento } = useModais();
  const { toast, confirm } = useUI();
  return (
    <Documentos
      categorias={CATEGORIAS_DOC_CAR}
      adivinhar={categoriaDocCar}
      anexos={im.anexos || []}
      onAdicionar={(novos) => atualizarImovel(im.id, (x) => ({ ...x, anexos: [...(x.anexos || []), ...novos] }))}
      onAtualizar={(aid, patch) => atualizarImovel(im.id, (x) => ({ ...x, anexos: x.anexos.map((a) => (a.id === aid ? { ...a, ...patch } : a)) }))}
      onRemover={async (anexo) => {
        const ok = await confirm({ title: 'Remover documento?', message: `"${anexo.nome}" será apagado permanentemente.`, confirmLabel: 'Remover' });
        if (!ok) return;
        excluirArquivo(anexo.id);
        atualizarImovel(im.id, (x) => ({ ...x, anexos: x.anexos.filter((a) => a.id !== anexo.id) }));
        toast('Documento removido', 'info');
      }}
      onCriarAviso={(a) =>
        abrirCarEvento({
          imovelId: im.id,
          tipo: a.categoria === 'itr' || a.categoria === 'ccir' ? 'itr' : a.categoria === 'termo' ? 'pra' : 'outro',
          titulo: `Vencimento: ${a.descricao || a.nome}`,
          documento: a.descricao,
          dataVencimento: a.validade,
          antecedenciaDias: 30,
        })
      }
    />
  );
}
