import { useRef, useState } from 'react';
import {
  Download, Upload, RotateCcw, Eraser, Database, Building2, CalendarClock, ClipboardCheck, Info, Cloud, CloudUpload, LogOut, HardDrive,
} from 'lucide-react';
import { useStore, lerLocal } from '../store';
import { useUI } from '../components/ui';
import { hojeISO } from '../utils';

export default function Dados() {
  const { empresas, eventos, importar, carregarExemplo, limparTudo, nuvem, usuario, sair, enviarLocalParaNuvem } = useStore();
  const { toast, confirm } = useUI();
  const inputRef = useRef(null);
  const [ocupado, setOcupado] = useState(false);
  const nCond = empresas.reduce((n, e) => n + (e.condicionantes || []).length, 0);
  const local = nuvem ? lerLocal() : null;
  const temLocal = !!local?.empresas?.length;

  // Executa uma ação que grava no banco, com aviso de sucesso/erro
  const executar = async (fn, msgOk, tipo = 'success') => {
    setOcupado(true);
    try {
      await fn();
      toast(msgOk, tipo);
    } catch {
      /* o erro já foi avisado pelo store */
    } finally {
      setOcupado(false);
    }
  };

  const exportar = () => {
    const blob = new Blob([JSON.stringify({ versao: 1, exportadoEm: new Date().toISOString(), empresas, eventos }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vacg-backup-${hojeISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup baixado');
  };

  const aoEscolherArquivo = async (e) => {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;
    let dados;
    try {
      dados = JSON.parse(await arq.text());
      if (!Array.isArray(dados.empresas) || !Array.isArray(dados.eventos)) throw new Error();
    } catch {
      toast('Não foi possível ler este arquivo', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Restaurar backup?',
      message: `Os dados atuais serão substituídos por ${dados.empresas.length} empresa(s) e ${dados.eventos.length} evento(s) do arquivo.`,
      confirmLabel: 'Restaurar',
    });
    if (ok) executar(() => importar(dados), 'Backup restaurado');
  };

  const exemplo = async () => {
    if (await confirm({ title: 'Carregar dados de exemplo?', message: 'Os dados atuais serão substituídos pelos exemplos.', confirmLabel: 'Carregar' })) {
      executar(carregarExemplo, 'Dados de exemplo carregados', 'info');
    }
  };

  const limpar = async () => {
    const onde = nuvem ? ' do banco na nuvem, para todos os usuários' : '';
    if (await confirm({ title: 'Apagar todos os dados?', message: `Todas as empresas, condicionantes e eventos serão removidos${onde}. Recomendamos baixar um backup antes.`, confirmLabel: 'Apagar tudo' })) {
      executar(limparTudo, 'Todos os dados foram apagados', 'info');
    }
  };

  const enviarLocal = async () => {
    const ok = await confirm({
      title: 'Enviar dados deste navegador?',
      message: `${local.empresas.length} empresa(s) e ${local.eventos?.length ?? 0} evento(s) salvos neste navegador serão enviados para a nuvem. O que já está na nuvem é mantido.`,
      confirmLabel: 'Enviar',
      danger: false,
    });
    if (ok) executar(enviarLocalParaNuvem, 'Dados enviados para a nuvem');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dados e backup</h1>
          <p className="muted">Exporte, restaure ou reinicie as informações do sistema</p>
        </div>
      </div>

      {nuvem && (
        <div className="card conta-card">
          <div className="conta-avatar">{usuario?.email?.[0]?.toUpperCase()}</div>
          <div className="grow">
            <strong>{usuario?.email}</strong>
            <span className="muted small"><Cloud size={13} /> Conectado — dados sincronizados na nuvem</span>
          </div>
          <button className="btn" onClick={sair}><LogOut size={16} /> Sair</button>
        </div>
      )}

      <div className="kpis kpis-3">
        <div className="kpi static"><div className="kpi-icon" style={{ '--c': '#15803d' }}><Building2 size={22} /></div><div><div className="kpi-valor">{empresas.length}</div><div className="kpi-label">Empresas</div></div></div>
        <div className="kpi static"><div className="kpi-icon" style={{ '--c': '#7c3aed' }}><ClipboardCheck size={22} /></div><div><div className="kpi-valor">{nCond}</div><div className="kpi-label">Condicionantes</div></div></div>
        <div className="kpi static"><div className="kpi-icon" style={{ '--c': '#0891b2' }}><CalendarClock size={22} /></div><div><div className="kpi-valor">{eventos.length}</div><div className="kpi-label">Eventos</div></div></div>
      </div>

      {!nuvem && (
        <div className="banner banner-info">
          <Info size={18} />
          <span>
            O sistema está em <b>modo local</b>: os dados ficam salvos só neste navegador. Configure o Supabase
            (arquivo <code>.env</code>) para guardar tudo na nuvem e acessar de qualquer aparelho.
          </span>
        </div>
      )}

      {temLocal && (
        <div className="banner">
          <CloudUpload size={18} />
          <span className="grow">
            Encontramos <b>{local.empresas.length} empresa(s)</b> salvas neste navegador antes da conexão com a nuvem.
          </span>
          <button className="btn btn-sm btn-primary" onClick={enviarLocal} disabled={ocupado}>Enviar para a nuvem</button>
        </div>
      )}

      <div className="action-grid">
        <button className="action-card" onClick={exportar}>
          <div className="kpi-icon" style={{ '--c': '#15803d' }}><Download size={22} /></div>
          <strong>Baixar backup</strong>
          <span className="muted small">Salva um .json com os dados (os documentos anexados não entram)</span>
        </button>
        <button className="action-card" onClick={() => inputRef.current?.click()} disabled={ocupado}>
          <div className="kpi-icon" style={{ '--c': '#2563eb' }}><Upload size={22} /></div>
          <strong>Restaurar backup</strong>
          <span className="muted small">Carrega um arquivo de backup salvo antes</span>
        </button>
        <button className="action-card" onClick={exemplo} disabled={ocupado}>
          <div className="kpi-icon" style={{ '--c': '#d97706' }}><RotateCcw size={22} /></div>
          <strong>Dados de exemplo</strong>
          <span className="muted small">Carrega empresas fictícias para testes</span>
        </button>
        <button className="action-card danger" onClick={limpar} disabled={ocupado}>
          <div className="kpi-icon" style={{ '--c': '#dc2626' }}><Eraser size={22} /></div>
          <strong>Apagar tudo</strong>
          <span className="muted small">Começar do zero com o sistema vazio</span>
        </button>
      </div>
      <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={aoEscolherArquivo} />
      <p className="muted small mt">
        {nuvem ? <><Database size={14} /> Armazenamento: Supabase (nuvem)</> : <><HardDrive size={14} /> Armazenamento: navegador (localStorage)</>}
      </p>
    </div>
  );
}
