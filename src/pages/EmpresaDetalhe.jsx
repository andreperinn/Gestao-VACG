import { useMemo, useState } from 'react';
import {
  ArrowLeft, Pencil, Trash2, Phone, Mail, MessageCircle, MapPin, Building2, ClipboardCheck, CalendarClock,
  Clock, Plus, Landmark, Factory, User, Hash, StickyNote, CalendarPlus, CircleCheck, TriangleAlert, MapPinned, Briefcase, Wallet, Paperclip,
} from 'lucide-react';
import { useStore } from '../store';
import { useModais } from '../components/modais';
import { Avatar, Badge, Chips, EmptyState, Tabs, useUI } from '../components/ui';
import EventoItem from '../components/EventoItem';
import { STATUS_COND } from '../constants';
import { nomeEmpresa, statusEvento, statusEmpresa, STATUS, fmtData, soDigitos, RECORRENCIAS, textoPrazo } from '../utils';
import { navigate } from '../router';
import { MapaPonto, LinksMapa } from '../components/Mapa';
import { ServicosTab, MensalidadeTab, DocumentosTab } from './EmpresaAbas';
import { mesesAtrasados } from '../mensalidade';
import { useModulo } from '../modulos';

export default function EmpresaDetalhe({ id }) {
  const { empresaPorId, eventos, excluirEmpresa, ehAdmin } = useStore();
  const { abrirEmpresa, abrirEvento } = useModais();
  const { confirm, toast } = useUI();
  const [tab, setTab] = useState('geral');
  const e = empresaPorId[id];

  const evs = useMemo(() => eventos.filter((x) => x.empresaId === id), [eventos, id]);

  if (!e) {
    return (
      <div className="page">
        <EmptyState icon={Building2} title="Empresa não encontrada" text="Ela pode ter sido excluída."
          action={<a className="btn" href="#/empresas"><ArrowLeft size={16} /> Voltar para empresas</a>} />
      </div>
    );
  }

  const abertos = evs.filter((x) => x.status !== 'concluido');
  const st = statusEmpresa(abertos);
  const conds = e.condicionantes || [];
  const nVencidos = abertos.filter((x) => statusEvento(x) === 'vencido').length;
  const nAlerta = abertos.filter((x) => statusEvento(x) === 'alerta').length;
  const cumpridas = conds.filter((c) => c.status === 'cumprida').length;
  const tel = soDigitos(e.telefone);
  const atrasadas = ehAdmin ? mesesAtrasados(e.mensalidade) : [];

  const excluir = async () => {
    const ok = await confirm({
      title: 'Excluir empresa?',
      message: `${nomeEmpresa(e)} e seus ${evs.length} evento(s) serão removidos permanentemente.`,
      confirmLabel: 'Excluir empresa',
    });
    if (ok) {
      excluirEmpresa(e.id);
      toast('Empresa excluída', 'info');
      navigate('/empresas');
    }
  };

  const tabs = [
    { id: 'geral', label: 'Visão geral', icon: Building2 },
    { id: 'condicionantes', label: 'Condicionantes', icon: ClipboardCheck, count: conds.length },
    { id: 'eventos', label: 'Eventos', icon: CalendarClock, count: abertos.length },
    { id: 'servicos', label: 'Serviços', icon: Briefcase, count: (e.servicos || []).length },
    ...(ehAdmin ? [{ id: 'mensalidade', label: 'Mensalidade', icon: Wallet, count: atrasadas.length || null }] : []),
    { id: 'documentos', label: 'Documentos', icon: Paperclip, count: (e.anexos || []).length },
    { id: 'historico', label: 'Histórico', icon: Clock },
  ];

  return (
    <div className="page">
      <a href="#/empresas" className="back"><ArrowLeft size={16} /> Empresas</a>

      <div className={`detail-hero st-${st}`}>
        <Avatar nome={nomeEmpresa(e)} size={64} />
        <div className="grow">
          <h1>{nomeEmpresa(e)}</h1>
          <p className="muted">{e.razaoSocial !== nomeEmpresa(e) && e.razaoSocial}{e.cnpj && <span className="mono"> · {e.cnpj}</span>}</p>
          <div className="hero-badges">
            {nVencidos > 0 && <Badge cls="danger" dot>{nVencidos} vencido(s)</Badge>}
            {nAlerta > 0 && <Badge cls="warning" dot>{nAlerta} em alerta</Badge>}
            {st === 'ok' && <Badge cls="success" dot>Tudo em dia</Badge>}
            {atrasadas.length > 0 && <Badge cls="danger"><Wallet size={12} /> {atrasadas.length} mensalidade(s) em atraso</Badge>}
            {e.porte && <Badge>Porte {e.porte}</Badge>}
            {e.potencialPoluidor && <Badge>Potencial {e.potencialPoluidor.toLowerCase()}</Badge>}
          </div>
        </div>
        <div className="hero-actions">
          {tel && <a className="icon-btn round" href={`tel:${tel}`} title="Ligar"><Phone size={18} /></a>}
          {tel.length >= 10 && <a className="icon-btn round wa" href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle size={18} /></a>}
          {e.email && <a className="icon-btn round" href={`mailto:${e.email}`} title="E-mail"><Mail size={18} /></a>}
          <button className="btn" onClick={() => abrirEmpresa(e)}><Pencil size={16} /> <span className="hide-mobile">Editar</span></button>
          <button className="icon-btn danger" onClick={excluir} title="Excluir empresa"><Trash2 size={18} /></button>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat"><ClipboardCheck size={18} /><b>{cumpridas}/{conds.length}</b><span>condicionantes cumpridas</span></div>
        <div className="stat"><CalendarClock size={18} /><b>{abertos.length}</b><span>eventos em aberto</span></div>
        <div className="stat"><CircleCheck size={18} /><b>{evs.length - abertos.length}</b><span>concluídos</span></div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'geral' && <VisaoGeral e={e} abertos={abertos} irPara={setTab} />}
      {tab === 'condicionantes' && <CondicionantesTab e={e} evs={evs} />}
      {tab === 'eventos' && (
        <EventosTab evs={evs} onNovo={() => abrirEvento({ empresaId: e.id })} />
      )}
      {tab === 'servicos' && <ServicosTab e={e} />}
      {tab === 'mensalidade' && ehAdmin && <MensalidadeTab e={e} />}
      {tab === 'documentos' && <DocumentosTab e={e} />}
      {tab === 'historico' && <Historico evs={evs} />}
    </div>
  );
}

function Info({ icon: Icon, label, children }) {
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

function VisaoGeral({ e, abertos, irPara }) {
  const { abrirEvento, abrirEmpresa } = useModais();
  const proximos = [...abertos].sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento)).slice(0, 4);
  return (
    <div className="detail-grid">
      <div className="col">
      <section className="card">
        <div className="card-head"><h2><Building2 size={18} /> Dados cadastrais</h2></div>
        <div className="info-grid">
          <Info icon={Building2} label="Razão social">{e.razaoSocial}</Info>
          <Info icon={Hash} label="CNPJ">{e.cnpj}</Info>
          <Info icon={Factory} label="Atividade">{e.atividade}{e.cnae && <span className="muted"> · CNAE {e.cnae}</span>}</Info>
          <Info icon={Landmark} label="Órgão ambiental">{e.orgaoAmbiental}</Info>
          <Info icon={MapPin} label="Endereço">
            {[e.endereco, e.cidade && `${e.cidade}/${e.uf}`, e.cep].filter(Boolean).join(' – ')}
          </Info>
          <Info icon={User} label="Responsável">{e.responsavel}</Info>
          <Info icon={Phone} label="Telefone">{e.telefone}</Info>
          <Info icon={Mail} label="E-mail">{e.email}</Info>
        </div>
        {e.observacoes && (
          <div className="note"><StickyNote size={16} /> {e.observacoes}</div>
        )}
      </section>
      <section className="card">
        <div className="card-head">
          <h2><MapPinned size={18} /> Localização</h2>
          {e.localizacao && <button className="btn btn-sm" onClick={() => abrirEmpresa(e, 'contato')}><Pencil size={14} /> Ajustar</button>}
        </div>
        {e.localizacao ? (
          <>
            <MapaPonto ponto={e.localizacao} />
            <LinksMapa ponto={e.localizacao} />
          </>
        ) : (
          <EmptyState icon={MapPinned} title="Sem localização" text="Marque o ponto da empresa no mapa para abrir a rota no Google Maps."
            action={<button className="btn btn-primary btn-sm" onClick={() => abrirEmpresa(e, 'contato')}><MapPin size={15} /> Marcar no mapa</button>} />
        )}
      </section>
      </div>
      <section className="card">
        <div className="card-head">
          <h2><CalendarClock size={18} /> Próximos vencimentos</h2>
          <button className="btn btn-sm" onClick={() => abrirEvento({ empresaId: e.id })}><Plus size={15} /> Evento</button>
        </div>
        {proximos.length === 0 ? (
          <EmptyState icon={CalendarPlus} title="Sem eventos" text="Crie avisos de vencimento de licenças, análises e taxas." />
        ) : (
          <div className="evento-list">
            {proximos.map((ev) => <EventoItem key={ev.id} ev={ev} showEmpresa={false} compact />)}
          </div>
        )}
        {abertos.length > 4 && <button className="btn btn-block btn-sm mt" onClick={() => irPara('eventos')}>Ver todos os {abertos.length} eventos</button>}
      </section>
    </div>
  );
}

function CondicionantesTab({ e, evs }) {
  const { salvarCondicionante, excluirCondicionante } = useStore();
  const { abrirEmpresa, abrirEvento } = useModais();
  const { confirm, toast } = useUI();
  const [filtro, setFiltro] = useState('todas');
  const conds = e.condicionantes || [];
  const pct = conds.length ? Math.round((conds.filter((c) => c.status === 'cumprida').length / conds.length) * 100) : 0;

  const ciclo = { pendente: 'andamento', andamento: 'cumprida', cumprida: 'pendente' };
  const mudarStatus = (c, status) => {
    salvarCondicionante(e.id, { ...c, status });
    toast(`Condicionante ${c.numero || ''} → ${STATUS_COND[status].label}`, 'info');
  };

  const remover = async (c) => {
    const ok = await confirm({ title: 'Remover condicionante?', message: c.descricao, confirmLabel: 'Remover' });
    if (ok) {
      excluirCondicionante(e.id, c.id);
      toast('Condicionante removida', 'info');
    }
  };

  const lista = conds.filter((c) => filtro === 'todas' || c.status === filtro);

  return (
    <div>
      <div className="cond-summary card">
        <div className="grow">
          <div className="row-between">
            <strong>Cumprimento das condicionantes</strong>
            <span className="muted">{pct}%</span>
          </div>
          <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        </div>
        <button className="btn btn-primary" onClick={() => abrirEmpresa(e, 'condicionantes')}>
          <Pencil size={16} /> Gerenciar
        </button>
      </div>

      <Chips value={filtro} onChange={setFiltro} options={[
        { id: 'todas', label: 'Todas', count: conds.length },
        ...Object.entries(STATUS_COND).map(([k, s]) => ({ id: k, label: s.label, count: conds.filter((c) => c.status === k).length, cls: s.cls })),
      ]} />

      {conds.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nenhuma condicionante cadastrada"
          text="Adicione as condicionantes da licença para acompanhar o cumprimento."
          action={<button className="btn btn-primary" onClick={() => abrirEmpresa(e, 'condicionantes')}><Plus size={16} /> Adicionar condicionantes</button>} />
      ) : (
        <div className="cond-view-list">
          {lista.map((c) => {
            const vinc = evs.filter((x) => x.condicionanteId === c.id);
            const ativo = vinc.find((x) => x.status !== 'concluido');
            const sEv = ativo && statusEvento(ativo);
            return (
              <div key={c.id} className={`cond-view cs-${c.status}`}>
                <div className="cond-num-badge">{c.numero || '•'}</div>
                <div className="grow">
                  <p className="cond-desc">{c.descricao || <em className="muted">Sem descrição</em>}</p>
                  <div className="evento-meta">
                    {c.licencaRef && <span>{c.licencaRef}</span>}
                    {c.prazo && <span><Clock size={12} /> Prazo {fmtData(c.prazo)}</span>}
                    {c.periodicidade !== 'nenhuma' && <span>{RECORRENCIAS[c.periodicidade]?.label}</span>}
                    {ativo && (
                      <button type="button" className="link-inline" onClick={() => abrirEvento(ativo)}>
                        <CalendarClock size={12} />
                        <Badge cls={STATUS[sEv].cls}>{textoPrazo(ativo)}</Badge>
                      </button>
                    )}
                  </div>
                </div>
                <div className="cond-actions">
                  <button
                    className={`badge badge-${STATUS_COND[c.status].cls} badge-btn`}
                    onClick={() => mudarStatus(c, ciclo[c.status])}
                    title="Clique para mudar a situação"
                  >
                    {STATUS_COND[c.status].label}
                  </button>
                  {!ativo && (
                    <button className="icon-btn" title="Criar evento de controle"
                      onClick={() => abrirEvento({
                        empresaId: e.id,
                        tipo: 'condicionante',
                        titulo: `Condicionante ${c.numero}: ${c.descricao.slice(0, 60)}`,
                        documento: c.licencaRef,
                        dataVencimento: c.prazo,
                        recorrencia: c.periodicidade,
                        condicionanteId: c.id,
                      })}>
                      <CalendarPlus size={17} />
                    </button>
                  )}
                  <button className="icon-btn danger" title="Remover" onClick={() => remover(c)}><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EventosTab({ evs, onNovo, modulo = 'ambiental' }) {
  const [filtro, setFiltro] = useState('abertos');
  const abertos = evs.filter((x) => x.status !== 'concluido');
  const concluidos = evs.filter((x) => x.status === 'concluido');
  const lista = (filtro === 'abertos' ? abertos : filtro === 'concluidos' ? concluidos : evs)
    .slice()
    .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));

  return (
    <div>
      <div className="row-between wrap gap">
        <Chips value={filtro} onChange={setFiltro} options={[
          { id: 'abertos', label: 'Em aberto', count: abertos.length },
          { id: 'concluidos', label: 'Concluídos', count: concluidos.length },
          { id: 'todos', label: 'Todos', count: evs.length },
        ]} />
        <button className="btn btn-primary" onClick={onNovo}><Plus size={16} /> Novo evento</button>
      </div>
      {lista.length === 0 ? (
        <EmptyState icon={CalendarPlus} title="Nenhum evento aqui" text="Crie avisos para vencimentos de licenças, análises e condicionantes."
          action={<button className="btn btn-primary" onClick={onNovo}><Plus size={16} /> Criar evento</button>} />
      ) : (
        <div className="card evento-list">
          {lista.map((ev) => <EventoItem key={ev.id} ev={ev} showEmpresa={false} modulo={modulo} />)}
        </div>
      )}
    </div>
  );
}

export function Historico({ evs, modulo = 'ambiental' }) {
  const { abrirEvento, tipos } = useModulo(modulo);
  const itens = evs
    .map((ev) => ({ ev, data: ev.status === 'concluido' ? ev.concluidoEm || ev.dataVencimento : ev.dataVencimento }))
    .sort((a, b) => b.data.localeCompare(a.data));

  if (!itens.length) return <EmptyState icon={Clock} title="Sem histórico ainda" />;

  return (
    <div className="card">
      <ol className="timeline">
        {itens.map(({ ev, data }) => {
          const T = tipos[ev.tipo] || tipos.outro;
          const st = statusEvento(ev);
          return (
            <li key={ev.id} className={`tl-item st-${st}`} onClick={() => abrirEvento(ev)}>
              <div className="tl-dot" style={{ '--c': T.cor }}><T.icon size={14} /></div>
              <div className="tl-body">
                <div className="row-between">
                  <strong>{ev.titulo}</strong>
                  <span className="muted small">{fmtData(data)}</span>
                </div>
                <span className="small">
                  {st === 'concluido' ? (
                    <span className="txt-success"><CircleCheck size={12} /> Concluído (vencimento {fmtData(ev.dataVencimento)})</span>
                  ) : st === 'vencido' ? (
                    <span className="txt-danger"><TriangleAlert size={12} /> {textoPrazo(ev)}</span>
                  ) : (
                    <span className="muted">{T.label} · {textoPrazo(ev)}</span>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
