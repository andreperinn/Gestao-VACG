import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard, Building2, CalendarDays, BellRing, Database, Leaf, Plus, Search, CalendarPlus, X, LogOut, Cloud, HardDrive, Users, KeyRound,
  Trees,
} from 'lucide-react';
import { useRoute, navigate } from './router';
import { useStore } from './store';
import { ModaisProvider, useModais } from './components/modais';
import { useUI } from './components/ui';
import { statusEvento, nomeEmpresa, normalizar, fmtData } from './utils';
import { TIPOS_EVENTO } from './constants';
import { TIPOS_EVENTO_CAR, nomeImovel } from './car';
import Dashboard from './pages/Dashboard';
import Empresas from './pages/Empresas';
import EmpresaDetalhe from './pages/EmpresaDetalhe';
import Agenda from './pages/Agenda';
import Alertas from './pages/Alertas';
import Dados from './pages/Dados';
import Login, { NovaSenha, Carregando, Bloqueado, AlterarSenha } from './pages/Login';
import Equipe from './pages/Equipe';
import CarPainel from './pages/CarPainel';
import CarImoveis from './pages/CarImoveis';
import CarDetalhe from './pages/CarDetalhe';

export default function App() {
  const { nuvem, fase, recuperandoSenha } = useStore();
  if (nuvem) {
    if (recuperandoSenha) return <NovaSenha />;
    if (fase === 'sem-sessao') return <Login />;
    if (fase === 'bloqueado') return <Bloqueado />;
    if (fase !== 'pronto') return <Carregando />;
  }
  return (
    <ModaisProvider>
      <Shell />
    </ModaisProvider>
  );
}

// Menus de cada módulo. "chave" identifica o item ativo a partir da rota.
const NAV_AMBIENTAL = [
  { path: '/', chave: 'painel', label: 'Painel', icon: LayoutDashboard },
  { path: '/empresas', chave: 'empresas', label: 'Empresas', icon: Building2 },
  { path: '/agenda', chave: 'agenda', label: 'Agenda', icon: CalendarDays },
  { path: '/alertas', chave: 'alertas', label: 'Alertas', icon: BellRing, badge: 'ambiental' },
];
const NAV_CAR = [
  { path: '/car', chave: 'car-painel', label: 'Painel CAR', curto: 'Painel', icon: LayoutDashboard },
  { path: '/car/imoveis', chave: 'car-imoveis', label: 'Imóveis rurais', curto: 'Imóveis', icon: Trees },
  { path: '/car/agenda', chave: 'car-agenda', label: 'Agenda CAR', curto: 'Agenda', icon: CalendarDays },
  { path: '/car/alertas', chave: 'car-alertas', label: 'Alertas CAR', curto: 'Alertas', icon: BellRing, badge: 'car' },
];
const NAV_GERAL = [
  { path: '/dados', chave: 'dados', label: 'Dados', icon: Database },
  { path: '/equipe', chave: 'equipe', label: 'Equipe', icon: Users, admin: true },
];

function Shell() {
  const rota = useRoute();
  const { eventos, carEventos, ehAdmin, nuvem } = useStore();
  const { abrirEmpresa, abrirEvento, abrirImovel, abrirCarEvento } = useModais();
  const [menuNovo, setMenuNovo] = useState(false);

  const partes = rota.split('/').filter(Boolean);
  const emCar = partes[0] === 'car';
  // O módulo atual vem da rota; nas telas gerais (Dados, Equipe) vale o último usado
  const [moduloSalvo, setModuloSalvo] = useState('ambiental');
  const ehGeral = ['dados', 'equipe'].includes(partes[0]);
  const modulo = emCar ? 'car' : ehGeral ? moduloSalvo : 'ambiental';
  useEffect(() => {
    if (!ehGeral) setModuloSalvo(emCar ? 'car' : 'ambiental');
  }, [emCar, ehGeral]);

  const chaveAtiva = emCar ? `car-${partes[1] || 'painel'}` : partes[0] || 'painel';
  const contar = (lista) => lista.filter((e) => ['vencido', 'alerta'].includes(statusEvento(e))).length;
  const alertas = { ambiental: contar(eventos), car: contar(carEventos) };
  const navModulo = modulo === 'car' ? NAV_CAR : NAV_AMBIENTAL;
  const navGeral = NAV_GERAL.filter((n) => !n.admin || (ehAdmin && nuvem));

  let pagina;
  if (emCar && partes[1] === 'imoveis' && partes[2]) pagina = <CarDetalhe id={partes[2]} />;
  else if (emCar && partes[1] === 'imoveis') pagina = <CarImoveis />;
  else if (emCar && partes[1] === 'agenda') pagina = <Agenda modulo="car" />;
  else if (emCar && partes[1] === 'alertas') pagina = <Alertas modulo="car" filtroInicial={partes[2]} />;
  else if (emCar) pagina = <CarPainel />;
  else if (partes[0] === 'empresas' && partes[1]) pagina = <EmpresaDetalhe id={partes[1]} />;
  else if (partes[0] === 'empresas') pagina = <Empresas />;
  else if (partes[0] === 'agenda') pagina = <Agenda />;
  else if (partes[0] === 'alertas') pagina = <Alertas filtroInicial={partes[1]} />;
  else if (partes[0] === 'dados') pagina = <Dados />;
  else if (partes[0] === 'equipe' && ehAdmin && nuvem) pagina = <Equipe />;
  else pagina = <Dashboard />;

  const novo = (tipo) => {
    setMenuNovo(false);
    if (tipo === 'empresa') abrirEmpresa();
    else if (tipo === 'evento') abrirEvento(partes[0] === 'empresas' && partes[1] ? { empresaId: partes[1] } : null);
    else if (tipo === 'imovel') abrirImovel();
    else abrirCarEvento(emCar && partes[1] === 'imoveis' && partes[2] ? { imovelId: partes[2] } : null);
  };

  const opcoesNovo = [
    { tipo: 'empresa', icon: Building2, cor: '#15803d', titulo: 'Nova empresa', texto: 'Dados cadastrais e condicionantes ambientais', modulo: 'ambiental' },
    { tipo: 'evento', icon: CalendarPlus, cor: '#0891b2', titulo: 'Novo evento de controle', texto: 'Aviso de vencimento de licença, análise, taxa…', modulo: 'ambiental' },
    { tipo: 'imovel', icon: Trees, cor: '#4d7c0f', titulo: 'Novo imóvel rural (CAR)', texto: 'Recibo do CAR, áreas, proprietários, PRA e pendências', modulo: 'car' },
    { tipo: 'car-evento', icon: CalendarPlus, cor: '#7c3aed', titulo: 'Novo evento do CAR', texto: 'Retificação, notificação, PRA, recomposição…', modulo: 'car' },
  ];
  // Opções do módulo atual aparecem primeiro
  opcoesNovo.sort((a, b) => (a.modulo === modulo ? -1 : 0) - (b.modulo === modulo ? -1 : 0));

  return (
    <div className="app">
      <aside className="sidebar">
        <a href="#/" className="brand">
          <div className="brand-logo"><Leaf size={22} /></div>
          <div>
            <strong>VACG</strong>
            <span>Gestão Ambiental</span>
          </div>
        </a>
        <TrocaModulo modulo={modulo} />
        <button className="btn btn-primary btn-block" onClick={() => setMenuNovo(true)}>
          <Plus size={18} /> Novo cadastro
        </button>
        <nav className="nav">
          {navModulo.map((n) => <ItemMenu key={n.path} n={n} ativo={chaveAtiva === n.chave} count={n.badge ? alertas[n.badge] : 0} />)}
          <div className="nav-sep" />
          {navGeral.map((n) => <ItemMenu key={n.path} n={n} ativo={chaveAtiva === n.chave} />)}
        </nav>
        <ContaRodape />
      </aside>

      <div className="main">
        <header className="topbar">
          <a href="#/" className="brand brand-mobile">
            <div className="brand-logo"><Leaf size={18} /></div>
          </a>
          <TrocaModulo modulo={modulo} compacto />
          <BuscaGlobal />
          <a href="#/dados" className="icon-btn topbar-dados" title="Dados e conta">
            <Database size={20} />
          </a>
          <a href={modulo === 'car' ? '#/car/alertas' : '#/alertas'} className="icon-btn topbar-bell" title="Alertas">
            <BellRing size={20} />
            {alertas[modulo] > 0 && <span className="dot-count">{alertas[modulo]}</span>}
          </a>
        </header>
        <main className="content" key={rota}>
          {pagina}
        </main>
      </div>

      <nav className="bottom-nav">
        {navModulo.slice(0, 2).map((n) => <BottomItem key={n.path} n={n} ativo={chaveAtiva === n.chave} />)}
        <button className="fab" onClick={() => setMenuNovo(true)} aria-label="Novo cadastro">
          <Plus size={26} />
        </button>
        {navModulo.slice(2, 4).map((n) => <BottomItem key={n.path} n={n} ativo={chaveAtiva === n.chave} count={n.badge ? alertas[n.badge] : 0} />)}
      </nav>

      {menuNovo && (
        <div className="sheet-backdrop" onClick={() => setMenuNovo(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h3>O que deseja cadastrar?</h3>
              <button className="icon-btn" onClick={() => setMenuNovo(false)} aria-label="Fechar"><X size={20} /></button>
            </div>
            {opcoesNovo.map((o) => (
              <button key={o.tipo} className="sheet-option" onClick={() => novo(o.tipo)}>
                <div className="sheet-icon" style={{ '--c': o.cor }}><o.icon size={22} /></div>
                <div>
                  <strong>{o.titulo}</strong>
                  <span>{o.texto}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Alternância entre os módulos Ambiental (licenciamento) e CAR
function TrocaModulo({ modulo, compacto }) {
  return (
    <div className={`troca-modulo${compacto ? ' compacto' : ''}`} role="tablist" aria-label="Módulo">
      <a href="#/" role="tab" aria-selected={modulo === 'ambiental'} className={modulo === 'ambiental' ? 'active' : ''}>
        <Leaf size={15} /> Ambiental
      </a>
      <a href="#/car" role="tab" aria-selected={modulo === 'car'} className={modulo === 'car' ? 'active' : ''}>
        <Trees size={15} /> CAR
      </a>
    </div>
  );
}

function ItemMenu({ n, ativo, count }) {
  return (
    <a href={`#${n.path}`} className={`nav-item${ativo ? ' active' : ''}`}>
      <n.icon size={19} />
      <span>{n.label}</span>
      {count > 0 && <span className="nav-badge">{count}</span>}
    </a>
  );
}

function ContaRodape() {
  const { nuvem, usuario, perfil, ehAdmin, sair } = useStore();
  const { confirm } = useUI();
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  if (!nuvem) {
    return (
      <a href="#/dados" className="conta conta-local" title="Os dados estão salvos só neste navegador">
        <HardDrive size={16} />
        <div className="grow">
          <strong>Modo local</strong>
          <span>Dados só neste navegador</span>
        </div>
      </a>
    );
  }
  const email = usuario?.email || '';
  const nome = perfil?.nome || email;
  const sairConfirmando = async () => {
    if (await confirm({ title: 'Sair do sistema?', message: 'Você precisará entrar com e-mail e senha novamente.', confirmLabel: 'Sair', danger: false })) sair();
  };
  return (
    <div className="conta">
      <div className="conta-avatar">{nome[0]?.toUpperCase()}</div>
      <div className="grow">
        <strong title={email}>{nome}</strong>
        <span><Cloud size={12} /> {ehAdmin ? 'Administrador' : 'Colaborador'}</span>
      </div>
      <button className="icon-btn" onClick={() => setTrocandoSenha(true)} title="Alterar minha senha"><KeyRound size={16} /></button>
      <button className="icon-btn" onClick={sairConfirmando} title="Sair"><LogOut size={17} /></button>
      <AlterarSenha open={trocandoSenha} onClose={() => setTrocandoSenha(false)} />
    </div>
  );
}

function BottomItem({ n, ativo, count }) {
  return (
    <a href={`#${n.path}`} className={`bottom-item${ativo ? ' active' : ''}`}>
      <span className="bottom-icon">
        <n.icon size={21} />
        {count > 0 && <span className="dot-count">{count}</span>}
      </span>
      <span>{n.curto || n.label}</span>
    </a>
  );
}

function BuscaGlobal() {
  const { empresas, eventos, empresaPorId, imoveis, carEventos, imovelPorId } = useStore();
  const { abrirEvento, abrirCarEvento } = useModais();
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const fora = (e) => ref.current && !ref.current.contains(e.target) && setAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const resultados = useMemo(() => {
    const t = normalizar(q.trim());
    if (!t) return null;
    const emp = empresas
      .filter((e) => normalizar([e.razaoSocial, e.nomeFantasia, e.cnpj, e.cidade, e.responsavel].join(' ')).includes(t))
      .slice(0, 5);
    const imo = imoveis
      .filter((im) => normalizar([im.nome, im.codigoCar, im.municipio, ...(im.proprietarios || []).map((p) => `${p.nome} ${p.documento}`)].join(' ')).includes(t))
      .slice(0, 5);
    const evs = [
      ...eventos.map((e) => ({ ...e, _car: false })),
      ...carEventos.map((e) => ({ ...e, _car: true })),
    ]
      .filter((e) => e.status !== 'concluido' && normalizar([e.titulo, e.documento].join(' ')).includes(t))
      .slice(0, 6);
    return { emp, imo, evs };
  }, [q, empresas, eventos, imoveis, carEventos]);

  const ir = (fn) => {
    fn();
    setQ('');
    setAberto(false);
  };

  const nada = resultados && !resultados.emp.length && !resultados.imo.length && !resultados.evs.length;

  return (
    <div className="search" ref={ref}>
      <Search size={18} className="search-icon" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        placeholder="Buscar empresa, imóvel, CNPJ, nº do CAR, evento…"
        aria-label="Buscar"
      />
      {q && <button className="icon-btn search-clear" onClick={() => setQ('')} aria-label="Limpar"><X size={16} /></button>}
      {aberto && resultados && (
        <div className="search-results">
          {nada && <div className="search-empty">Nada encontrado para “{q}”</div>}
          {resultados.emp.length > 0 && <div className="search-group">Empresas</div>}
          {resultados.emp.map((e) => (
            <button key={e.id} className="search-item" onClick={() => ir(() => navigate(`/empresas/${e.id}`))}>
              <Building2 size={16} />
              <div>
                <strong>{nomeEmpresa(e)}</strong>
                <span>{e.cnpj || e.razaoSocial}</span>
              </div>
            </button>
          ))}
          {resultados.imo.length > 0 && <div className="search-group">Imóveis rurais (CAR)</div>}
          {resultados.imo.map((im) => (
            <button key={im.id} className="search-item" onClick={() => ir(() => navigate(`/car/imoveis/${im.id}`))}>
              <Trees size={16} />
              <div>
                <strong>{nomeImovel(im)}</strong>
                <span>{im.codigoCar || [im.municipio, im.uf].filter(Boolean).join('/')}</span>
              </div>
            </button>
          ))}
          {resultados.evs.length > 0 && <div className="search-group">Eventos</div>}
          {resultados.evs.map((ev) => {
            const tipos = ev._car ? TIPOS_EVENTO_CAR : TIPOS_EVENTO;
            const T = tipos[ev.tipo] || tipos.outro;
            const dono = ev._car ? nomeImovel(imovelPorId[ev.imovelId]) : nomeEmpresa(empresaPorId[ev.empresaId]);
            return (
              <button key={ev.id} className="search-item" onClick={() => ir(() => (ev._car ? abrirCarEvento : abrirEvento)(ev))}>
                <T.icon size={16} style={{ color: T.cor }} />
                <div>
                  <strong>{ev.titulo}</strong>
                  <span>{ev._car ? 'CAR · ' : ''}{dono} · {fmtData(ev.dataVencimento)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
