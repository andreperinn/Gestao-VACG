import { useMemo, useState } from 'react';
import { Building2, Plus, LayoutGrid, List, MapPin, ClipboardCheck, CalendarClock, Search, Landmark, ChevronRight, MapPinned, Wallet } from 'lucide-react';
import { useStore } from '../store';
import { useModais } from '../components/modais';
import { Avatar, Badge, Chips, EmptyState } from '../components/ui';
import { statusEmpresa, statusEvento, nomeEmpresa, normalizar, STATUS } from '../utils';
import { navigate } from '../router';
import { MapaEmpresas } from '../components/Mapa';
import { mesesAtrasados } from '../mensalidade';

function lerVisao() {
  try {
    return localStorage.getItem('vacg:visao') || 'cards';
  } catch {
    return 'cards';
  }
}

export default function Empresas() {
  const { empresas, eventos, ehAdmin } = useStore();
  const { abrirEmpresa } = useModais();
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [visao, setVisao] = useState(lerVisao);

  const mudarVisao = (v) => {
    setVisao(v);
    try { localStorage.setItem('vacg:visao', v); } catch { /* ignora */ }
  };

  const lista = useMemo(() => {
    return empresas.map((e) => {
      const evs = eventos.filter((x) => x.empresaId === e.id && x.status !== 'concluido');
      const conds = e.condicionantes || [];
      const proximo = [...evs].sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))[0];
      return {
        e,
        st: statusEmpresa(evs),
        nEventos: evs.length,
        nVencidos: evs.filter((x) => statusEvento(x) === 'vencido').length,
        nAlerta: evs.filter((x) => statusEvento(x) === 'alerta').length,
        nCond: conds.length,
        nCondAbertas: conds.filter((c) => c.status !== 'cumprida').length,
        proximo,
        nAtrasadas: ehAdmin ? mesesAtrasados(e.mensalidade).length : 0,
      };
    });
  }, [empresas, eventos, ehAdmin]);

  const contagem = {
    todas: lista.length,
    vencido: lista.filter((x) => x.st === 'vencido').length,
    alerta: lista.filter((x) => x.st === 'alerta').length,
    ok: lista.filter((x) => x.st === 'ok').length,
  };

  const filtradas = lista
    .filter((x) => filtro === 'todas' || x.st === filtro)
    .filter((x) => {
      const t = normalizar(q.trim());
      if (!t) return true;
      const e = x.e;
      return normalizar([e.razaoSocial, e.nomeFantasia, e.cnpj, e.cidade, e.atividade, e.responsavel, e.orgaoAmbiental].join(' ')).includes(t);
    })
    .sort((a, b) => nomeEmpresa(a.e).localeCompare(nomeEmpresa(b.e)));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Empresas</h1>
          <p className="muted">{empresas.length} empresa(s) cadastrada(s)</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => abrirEmpresa()}><Plus size={16} /> Nova empresa</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search search-inline">
          <Search size={18} className="search-icon" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por nome, CNPJ, cidade, atividade…" />
        </div>
        <div className="seg seg-icons">
          <button className={visao === 'cards' ? 'active' : ''} onClick={() => mudarVisao('cards')} title="Cartões"><LayoutGrid size={17} /></button>
          <button className={visao === 'lista' ? 'active' : ''} onClick={() => mudarVisao('lista')} title="Lista"><List size={17} /></button>
          <button className={visao === 'mapa' ? 'active' : ''} onClick={() => mudarVisao('mapa')} title="Mapa"><MapPinned size={17} /></button>
        </div>
      </div>
      <Chips
        value={filtro}
        onChange={setFiltro}
        options={[
          { id: 'todas', label: 'Todas', count: contagem.todas },
          { id: 'vencido', label: 'Com vencidos', count: contagem.vencido, cls: 'danger' },
          { id: 'alerta', label: 'Em alerta', count: contagem.alerta, cls: 'warning' },
          { id: 'ok', label: 'Em dia', count: contagem.ok, cls: 'success' },
        ]}
      />

      {empresas.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma empresa cadastrada"
          text="Comece cadastrando a primeira empresa e suas condicionantes."
          action={<button className="btn btn-primary" onClick={() => abrirEmpresa()}><Plus size={16} /> Cadastrar empresa</button>}
        />
      ) : filtradas.length === 0 ? (
        <EmptyState icon={Search} title="Nenhum resultado" text="Tente outro termo ou filtro." />
      ) : visao === 'cards' ? (
        <div className="empresa-grid">
          {filtradas.map((x) => <EmpresaCard key={x.e.id} {...x} />)}
        </div>
      ) : visao === 'mapa' ? (
        <VisaoMapa filtradas={filtradas} />
      ) : (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th className="hide-mobile">CNPJ</th>
                <th className="hide-mobile">Cidade</th>
                <th>Cond.</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(({ e, st, nCond, nCondAbertas, nVencidos, nAlerta }) => (
                <tr key={e.id} onClick={() => navigate(`/empresas/${e.id}`)}>
                  <td>
                    <div className="cell-emp">
                      <Avatar nome={nomeEmpresa(e)} size={34} />
                      <div>
                        <strong>{nomeEmpresa(e)}</strong>
                        <span className="muted small">{e.atividade}</span>
                      </div>
                    </div>
                  </td>
                  <td className="hide-mobile mono">{e.cnpj || '—'}</td>
                  <td className="hide-mobile">{e.cidade ? `${e.cidade}/${e.uf}` : '—'}</td>
                  <td>{nCondAbertas}/{nCond}</td>
                  <td><SituacaoBadge st={st} nVencidos={nVencidos} nAlerta={nAlerta} /></td>
                  <td><ChevronRight size={18} className="muted" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VisaoMapa({ filtradas }) {
  const itens = useMemo(
    () =>
      filtradas
        .filter((x) => x.e.localizacao)
        .map((x) => ({
          id: x.e.id,
          nome: nomeEmpresa(x.e),
          detalhe: [x.e.cidade && `${x.e.cidade}/${x.e.uf}`, STATUS[x.st].label].filter(Boolean).join(' · '),
          ponto: x.e.localizacao,
          st: x.st,
        })),
    [filtradas]
  );
  const semPonto = filtradas.filter((x) => !x.e.localizacao);
  return (
    <div className="card mapa-card">
      <MapaEmpresas itens={itens} />
      <div className="mapa-legenda">
        <span><i style={{ background: '#15803d' }} /> Em dia</span>
        <span><i style={{ background: '#d97706' }} /> Em alerta</span>
        <span><i style={{ background: '#dc2626' }} /> Com vencidos</span>
        {semPonto.length > 0 && (
          <span className="muted">
            {semPonto.length} sem localização: {semPonto.slice(0, 3).map((x) => (
              <a key={x.e.id} href={`#/empresas/${x.e.id}`} className="link">{nomeEmpresa(x.e)}</a>
            )).reduce((acc, el, i) => (i ? [...acc, ', ', el] : [el]), [])}
            {semPonto.length > 3 && '…'}
          </span>
        )}
      </div>
    </div>
  );
}

function SituacaoBadge({ st, nVencidos, nAlerta }) {
  if (st === 'vencido') return <Badge cls="danger" dot>{nVencidos} vencido{nVencidos > 1 ? 's' : ''}</Badge>;
  if (st === 'alerta') return <Badge cls="warning" dot>{nAlerta} em alerta</Badge>;
  return <Badge cls={STATUS.ok.cls} dot>Em dia</Badge>;
}

function EmpresaCard({ e, st, nEventos, nVencidos, nAlerta, nCond, nCondAbertas, proximo, nAtrasadas }) {
  return (
    <button className={`empresa-card st-${st}`} onClick={() => navigate(`/empresas/${e.id}`)}>
      <div className="empresa-card-head">
        <Avatar nome={nomeEmpresa(e)} />
        <div className="grow">
          <strong>{nomeEmpresa(e)}</strong>
          <span className="muted small">{e.cnpj || e.razaoSocial}</span>
        </div>
      </div>
      <div className="empresa-card-badge"><SituacaoBadge st={st} nVencidos={nVencidos} nAlerta={nAlerta} /></div>
      {e.atividade && <p className="empresa-atividade">{e.atividade}</p>}
      <div className="empresa-meta">
        {e.cidade && <span><MapPin size={14} /> {e.cidade}/{e.uf}</span>}
        {e.orgaoAmbiental && <span><Landmark size={14} /> {e.orgaoAmbiental}</span>}
        {nAtrasadas > 0 && <span className="txt-danger"><Wallet size={14} /> {nAtrasadas} mensalidade(s) em atraso</span>}
      </div>
      <div className="empresa-stats">
        <div>
          <ClipboardCheck size={16} />
          <b>{nCondAbertas}/{nCond}</b>
          <span>condicionantes</span>
        </div>
        <div>
          <CalendarClock size={16} />
          <b>{nEventos}</b>
          <span>eventos</span>
        </div>
      </div>
      {proximo && (
        <div className="empresa-proximo">
          <span className="muted small">Próximo:</span> {proximo.titulo}
        </div>
      )}
    </button>
  );
}
