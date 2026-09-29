import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard, Building2, CalendarDays, BellRing, Database, Leaf, Plus, Search, CalendarPlus, X, LogOut, Cloud, HardDrive,
} from 'lucide-react';
import { useRoute, navigate } from './router';
import { useStore } from './store';
import { ModaisProvider, useModais } from './components/modais';
import { useUI } from './components/ui';
import { statusEvento, nomeEmpresa, normalizar, fmtData } from './utils';
import { TIPOS_EVENTO } from './constants';
import Dashboard from './pages/Dashboard';
import Empresas from './pages/Empresas';
import EmpresaDetalhe from './pages/EmpresaDetalhe';
import Agenda from './pages/Agenda';
import Alertas from './pages/Alertas';
import Dados from './pages/Dados';
import Login, { NovaSenha, Carregando } from './pages/Login';

export default function App() {
  const { nuvem, fase, recuperandoSenha } = useStore();
  if (nuvem) {
    if (recuperandoSenha) return <NovaSenha />;
    if (fase === 'sem-sessao') return <Login />;
    if (fase !== 'pronto') return <Carregando />;
  }
  return (
    <ModaisProvider>
      <Shell />
    </ModaisProvider>
  );
}

const NAV = [
  { path: '/', label: 'Painel', icon: LayoutDashboard },
  { path: '/empresas', label: 'Empresas', icon: Building2 },
  { path: '/agenda', label: 'Agenda', icon: CalendarDays },
  { path: '/alertas', label: 'Alertas', icon: BellRing, badge: true },
  { path: '/dados', label: 'Dados', icon: Database },
];

function Shell() {
  const rota = useRoute();
  const { eventos } = useStore();
  const { abrirEmpresa, abrirEvento } = useModais();
  const [menuNovo, setMenuNovo] = useState(false);

  const partes = rota.split('/').filter(Boolean);
  const base = '/' + (partes[0] || '');
  const nAlertas = eventos.filter((e) => ['vencido', 'alerta'].includes(statusEvento(e))).length;

  let pagina;
  if (partes[0] === 'empresas' && partes[1]) pagina = <EmpresaDetalhe id={partes[1]} />;
  else if (partes[0] === 'empresas') pagina = <Empresas />;
  else if (partes[0] === 'agenda') pagina = <Agenda />;
  else if (partes[0] === 'alertas') pagina = <Alertas filtroInicial={partes[1]} />;
  else if (partes[0] === 'dados') pagina = <Dados />;
  else pagina = <Dashboard />;

  const novo = (tipo) => {
    setMenuNovo(false);
    if (tipo === 'empresa') abrirEmpresa();
    else abrirEvento(partes[0] === 'empresas' && partes[1] ? { empresaId: partes[1] } : null);
  };

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
        <button className="btn btn-primary btn-block" onClick={() => setMenuNovo(true)}>
          <Plus size={18} /> Novo cadastro
        </button>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n.path} href={`#${n.path}`} className={`nav-item${base === n.path ? ' active' : ''}`}>
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.badge && nAlertas > 0 && <span className="nav-badge">{nAlertas}</span>}
            </a>
          ))}
        </nav>
        <ContaRodape />
      </aside>

      <div className="main">
        <header className="topbar">
          <a href="#/" className="brand brand-mobile">
            <div className="brand-logo"><Leaf size={18} /></div>
            <strong>VACG</strong>
          </a>
          <BuscaGlobal />
          <a href="#/dados" className="icon-btn topbar-dados" title="Dados e conta">
            <Database size={20} />
          </a>
          <a href="#/alertas" className="icon-btn topbar-bell" title="Alertas">
            <BellRing size={20} />
            {nAlertas > 0 && <span className="dot-count">{nAlertas}</span>}
          </a>
        </header>
        <main className="content" key={rota}>
          {pagina}
        </main>
      </div>

      <nav className="bottom-nav">
        {NAV.slice(0, 2).map((n) => <BottomItem key={n.path} n={n} ativo={base === n.path} />)}
        <button className="fab" onClick={() => setMenuNovo(true)} aria-label="Novo cadastro">
          <Plus size={26} />
        </button>
        {NAV.slice(2, 4).map((n) => <BottomItem key={n.path} n={n} ativo={base === n.path} count={n.badge ? nAlertas : 0} />)}
      </nav>

      {menuNovo && (
        <div className="sheet-backdrop" onClick={() => setMenuNovo(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h3>O que deseja cadastrar?</h3>
              <button className="icon-btn" onClick={() => setMenuNovo(false)} aria-label="Fechar"><X size={20} /></button>
            </div>
            <button className="sheet-option" onClick={() => novo('empresa')}>
              <div className="sheet-icon" style={{ '--c': '#15803d' }}><Building2 size={22} /></div>
              <div>
                <strong>Nova empresa</strong>
                <span>Dados cadastrais e condicionantes ambientais</span>
              </div>
            </button>
            <button className="sheet-option" onClick={() => novo('evento')}>
              <div className="sheet-icon" style={{ '--c': '#0891b2' }}><CalendarPlus size={22} /></div>
              <div>
                <strong>Novo evento de controle</strong>
                <span>Aviso de vencimento de licença, análise, taxa…</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ContaRodape() {
  const { nuvem, usuario, sair } = useStore();
  const { confirm } = useUI();
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
  const sairConfirmando = async () => {
    if (await confirm({ title: 'Sair do sistema?', message: 'Você precisará entrar com e-mail e senha novamente.', confirmLabel: 'Sair', danger: false })) sair();
  };
  return (
    <div className="conta">
      <div className="conta-avatar">{email[0]?.toUpperCase()}</div>
      <div className="grow">
        <strong title={email}>{email}</strong>
        <span><Cloud size={12} /> Sincronizado</span>
      </div>
      <button className="icon-btn" onClick={sairConfirmando} title="Sair"><LogOut size={17} /></button>
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
      <span>{n.label}</span>
    </a>
  );
}

function BuscaGlobal() {
  const { empresas, eventos, empresaPorId } = useStore();
  const { abrirEvento } = useModais();
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
    const evs = eventos
      .filter((e) => e.status !== 'concluido' && normalizar([e.titulo, e.documento].join(' ')).includes(t))
      .slice(0, 5);
    return { emp, evs };
  }, [q, empresas, eventos]);

  const ir = (fn) => {
    fn();
    setQ('');
    setAberto(false);
  };

  return (
    <div className="search" ref={ref}>
      <Search size={18} className="search-icon" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        placeholder="Buscar empresa, CNPJ, evento…"
        aria-label="Buscar"
      />
      {q && <button className="icon-btn search-clear" onClick={() => setQ('')} aria-label="Limpar"><X size={16} /></button>}
      {aberto && resultados && (
        <div className="search-results">
          {resultados.emp.length === 0 && resultados.evs.length === 0 && <div className="search-empty">Nada encontrado para “{q}”</div>}
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
          {resultados.evs.length > 0 && <div className="search-group">Eventos</div>}
          {resultados.evs.map((ev) => {
            const T = TIPOS_EVENTO[ev.tipo] || TIPOS_EVENTO.outro;
            return (
              <button key={ev.id} className="search-item" onClick={() => ir(() => abrirEvento(ev))}>
                <T.icon size={16} style={{ color: T.cor }} />
                <div>
                  <strong>{ev.titulo}</strong>
                  <span>{nomeEmpresa(empresaPorId[ev.empresaId])} · {fmtData(ev.dataVencimento)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
