import { useMemo, useState } from 'react';
import { Trees, Plus, LayoutGrid, List, MapPinned, MapPin, Search, ClipboardList, CalendarClock, Ruler, ChevronRight, Building2 } from 'lucide-react';
import { useStore } from '../store';
import { useModais } from '../components/modais';
import { Avatar, Badge, Chips, EmptyState } from '../components/ui';
import { MapaEmpresas } from '../components/Mapa';
import { SITUACOES_CAR, CONDICOES_CAR, nomeImovel, fmtHa } from '../car';
import { statusEmpresa, statusEvento, normalizar, nomeEmpresa, STATUS } from '../utils';
import { navigate } from '../router';

function lerVisao() {
  try {
    return localStorage.getItem('vacg:visao-car') || 'cards';
  } catch {
    return 'cards';
  }
}

export default function CarImoveis() {
  const { imoveis, carEventos, empresaPorId } = useStore();
  const { abrirImovel } = useModais();
  const [q, setQ] = useState('');
  const [situacao, setSituacao] = useState('todos');
  const [condicao, setCondicao] = useState('');
  const [visao, setVisao] = useState(lerVisao);

  const mudarVisao = (v) => {
    setVisao(v);
    try { localStorage.setItem('vacg:visao-car', v); } catch { /* ignora */ }
  };

  const lista = useMemo(
    () =>
      imoveis.map((im) => {
        const evs = carEventos.filter((x) => x.imovelId === im.id && x.status !== 'concluido');
        const pend = im.pendencias || [];
        return {
          im,
          st: statusEmpresa(evs),
          nEventos: evs.length,
          nVencidos: evs.filter((x) => statusEvento(x) === 'vencido').length,
          nAlerta: evs.filter((x) => statusEvento(x) === 'alerta').length,
          nPend: pend.length,
          nPendAbertas: pend.filter((p) => p.status !== 'resolvida').length,
        };
      }),
    [imoveis, carEventos]
  );

  const filtradas = lista
    .filter((x) => situacao === 'todos' || x.im.situacao === situacao)
    .filter((x) => !condicao || x.im.condicao === condicao)
    .filter((x) => {
      const t = normalizar(q.trim());
      if (!t) return true;
      const im = x.im;
      const donos = (im.proprietarios || []).map((p) => `${p.nome} ${p.documento}`).join(' ');
      return normalizar([im.nome, im.codigoCar, im.municipio, im.uf, donos, nomeEmpresa(empresaPorId[im.empresaId])].join(' ')).includes(t);
    })
    .sort((a, b) => nomeImovel(a.im).localeCompare(nomeImovel(b.im)));

  const contar = (k) => lista.filter((x) => x.im.situacao === k).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Imóveis rurais</h1>
          <p className="muted">{imoveis.length} imóvel(is) no Cadastro Ambiental Rural</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => abrirImovel()}><Plus size={16} /> Novo imóvel</button>
        </div>
      </div>

      <div className="toolbar wrap">
        <div className="search search-inline">
          <Search size={18} className="search-icon" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por nome, código do CAR, município, proprietário…" />
        </div>
        <select className="select-inline" value={condicao} onChange={(e) => setCondicao(e.target.value)}>
          <option value="">Todas as condições</option>
          {Object.entries(CONDICOES_CAR).map(([k, c]) => <option key={k} value={k}>{c.curto}</option>)}
        </select>
        <div className="seg seg-icons">
          <button className={visao === 'cards' ? 'active' : ''} onClick={() => mudarVisao('cards')} title="Cartões"><LayoutGrid size={17} /></button>
          <button className={visao === 'lista' ? 'active' : ''} onClick={() => mudarVisao('lista')} title="Lista"><List size={17} /></button>
          <button className={visao === 'mapa' ? 'active' : ''} onClick={() => mudarVisao('mapa')} title="Mapa"><MapPinned size={17} /></button>
        </div>
      </div>
      <Chips
        value={situacao}
        onChange={setSituacao}
        options={[
          { id: 'todos', label: 'Todos', count: lista.length },
          ...Object.entries(SITUACOES_CAR).map(([k, s]) => ({ id: k, label: s.label, count: contar(k), cls: s.cls === 'muted' ? undefined : s.cls })),
        ]}
      />

      {imoveis.length === 0 ? (
        <EmptyState
          icon={Trees}
          title="Nenhum imóvel cadastrado"
          text="Cadastre o primeiro imóvel rural com os dados do recibo do CAR."
          action={<button className="btn btn-primary" onClick={() => abrirImovel()}><Plus size={16} /> Cadastrar imóvel</button>}
        />
      ) : filtradas.length === 0 ? (
        <EmptyState icon={Search} title="Nenhum resultado" text="Tente outro termo ou filtro." />
      ) : visao === 'mapa' ? (
        <div className="card mapa-card">
          <MapaEmpresas
            itens={filtradas.filter((x) => x.im.localizacao).map((x) => ({
              id: x.im.id,
              nome: nomeImovel(x.im),
              detalhe: [x.im.municipio && `${x.im.municipio}/${x.im.uf}`, CONDICOES_CAR[x.im.condicao]?.curto].filter(Boolean).join(' · '),
              ponto: x.im.localizacao,
              st: x.st,
            }))}
            rota={(id) => `#/car/imoveis/${id}`}
            textoLink="Abrir imóvel →"
          />
          <div className="mapa-legenda">
            <span><i style={{ background: '#15803d' }} /> Em dia</span>
            <span><i style={{ background: '#d97706' }} /> Em alerta</span>
            <span><i style={{ background: '#dc2626' }} /> Com vencidos</span>
            {filtradas.some((x) => !x.im.localizacao) && <span className="muted">{filtradas.filter((x) => !x.im.localizacao).length} sem localização</span>}
          </div>
        </div>
      ) : visao === 'cards' ? (
        <div className="empresa-grid">
          {filtradas.map((x) => <ImovelCard key={x.im.id} {...x} cliente={empresaPorId[x.im.empresaId]} />)}
        </div>
      ) : (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Imóvel</th>
                <th className="hide-mobile">Município</th>
                <th className="hide-mobile">Área</th>
                <th>Condição</th>
                <th>Pend.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(({ im, nPend, nPendAbertas }) => (
                <tr key={im.id} onClick={() => navigate(`/car/imoveis/${im.id}`)}>
                  <td>
                    <div className="cell-emp">
                      <Avatar nome={nomeImovel(im)} size={34} />
                      <div>
                        <strong>{nomeImovel(im)}</strong>
                        <span className="muted small mono">{im.codigoCar || 'Sem nº do CAR'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="hide-mobile">{im.municipio ? `${im.municipio}/${im.uf}` : '—'}</td>
                  <td className="hide-mobile">{fmtHa(im.areas?.total)}</td>
                  <td><Badge cls={CONDICOES_CAR[im.condicao]?.cls}>{CONDICOES_CAR[im.condicao]?.curto}</Badge></td>
                  <td>{nPendAbertas}/{nPend}</td>
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

function ImovelCard({ im, st, nEventos, nVencidos, nAlerta, nPend, nPendAbertas, cliente }) {
  const sit = SITUACOES_CAR[im.situacao] || SITUACOES_CAR.ativo;
  const cond = CONDICOES_CAR[im.condicao] || CONDICOES_CAR.aguardando;
  return (
    <button className={`empresa-card st-${st}`} onClick={() => navigate(`/car/imoveis/${im.id}`)}>
      <div className="empresa-card-head">
        <Avatar nome={nomeImovel(im)} />
        <div className="grow">
          <strong>{nomeImovel(im)}</strong>
          <span className="muted small mono">{im.codigoCar ? `${im.codigoCar.slice(0, 15)}…` : 'Sem nº do CAR'}</span>
        </div>
      </div>
      <div className="empresa-card-badge"><Badge cls={sit.cls} dot>{sit.label}</Badge></div>
      <div className="hero-badges">
        <Badge cls={cond.cls}>{cond.curto}</Badge>
        {nVencidos > 0 && <Badge cls="danger">{nVencidos} vencido(s)</Badge>}
        {nVencidos === 0 && nAlerta > 0 && <Badge cls="warning">{nAlerta} em alerta</Badge>}
        {st === 'ok' && nEventos > 0 && <Badge cls={STATUS.ok.cls}>Prazos em dia</Badge>}
      </div>
      <div className="empresa-meta">
        {im.municipio && <span><MapPin size={14} /> {im.municipio}/{im.uf}</span>}
        {im.areas?.total && <span><Ruler size={14} /> {fmtHa(im.areas.total)}</span>}
        {cliente && <span><Building2 size={14} /> {nomeEmpresa(cliente)}</span>}
      </div>
      <div className="empresa-stats">
        <div>
          <ClipboardList size={16} />
          <b>{nPendAbertas}/{nPend}</b>
          <span>pendências</span>
        </div>
        <div>
          <CalendarClock size={16} />
          <b>{nEventos}</b>
          <span>eventos</span>
        </div>
      </div>
    </button>
  );
}
