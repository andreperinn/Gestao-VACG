import { useEffect, useState } from 'react';
import { CloudUpload, Eye, Download, Trash2, Pencil, Check, BellPlus, Paperclip, Camera, CalendarClock } from 'lucide-react';
import { CATEGORIAS_DOC, categoriaPorNome } from '../constants';
import { salvarArquivo, obterArquivo, fmtTamanho, pedirArmazenamentoPersistente } from '../arquivos';
import { uid, fmtData, diasAte } from '../utils';
import { Modal, Chips, EmptyState, Badge, Field, useUI } from './ui';

const LIMITE_MB = 25;

// Miniatura: mostra a própria imagem quando o arquivo é uma foto
function Miniatura({ anexo }) {
  const [url, setUrl] = useState(null);
  const cat = CATEGORIAS_DOC[anexo.categoria] || CATEGORIAS_DOC.outro;
  useEffect(() => {
    if (!anexo.tipo?.startsWith('image/')) return;
    let u;
    let vivo = true;
    obterArquivo(anexo.id).then((blob) => {
      if (blob && vivo) {
        u = URL.createObjectURL(blob);
        setUrl(u);
      }
    });
    return () => {
      vivo = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [anexo.id, anexo.tipo]);

  if (url) return <img className="doc-thumb" src={url} alt="" />;
  const ext = (anexo.nome.split('.').pop() || '').slice(0, 4).toUpperCase();
  return (
    <div className="doc-thumb doc-thumb-icon" style={{ '--c': cat.cor }}>
      <cat.icon size={26} />
      {ext && <span>{ext}</span>}
    </div>
  );
}

function Validade({ data }) {
  if (!data) return null;
  const d = diasAte(data);
  const cls = d < 0 ? 'danger' : d <= 60 ? 'warning' : 'success';
  const txt = d < 0 ? `Vencido em ${fmtData(data)}` : `Válido até ${fmtData(data)}`;
  return <Badge cls={cls}><CalendarClock size={12} /> {txt}</Badge>;
}

export default function Documentos({ anexos = [], onAdicionar, onAtualizar, onRemover, onCriarAviso }) {
  const { toast } = useUI();
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(0);
  const [filtro, setFiltro] = useState('todos');
  const [editando, setEditando] = useState(null);
  const [vendo, setVendo] = useState(null); // { anexo, url }

  const adicionarArquivos = async (lista) => {
    const arquivos = [...lista];
    if (!arquivos.length) return;
    pedirArmazenamentoPersistente();
    const grandes = arquivos.filter((f) => f.size > LIMITE_MB * 1024 * 1024);
    if (grandes.length) toast(`${grandes.length} arquivo(s) acima de ${LIMITE_MB} MB foram ignorados`, 'error');
    const validos = arquivos.filter((f) => f.size <= LIMITE_MB * 1024 * 1024);
    setEnviando(validos.length);
    const novos = [];
    for (const f of validos) {
      const id = uid();
      try {
        await salvarArquivo(id, f);
        novos.push({
          id,
          nome: f.name,
          tipo: f.type,
          tamanho: f.size,
          categoria: categoriaPorNome(f.name, f.type),
          descricao: '',
          validade: '',
          enviadoEm: new Date().toISOString(),
        });
      } catch {
        toast(`Não foi possível salvar "${f.name}"`, 'error');
      }
    }
    setEnviando(0);
    if (novos.length) {
      onAdicionar(novos);
      toast(`${novos.length} documento(s) anexado(s)`);
      if (novos.length === 1) setEditando(novos[0].id);
    }
  };

  const abrir = async (anexo) => {
    const blob = await obterArquivo(anexo.id);
    if (!blob) return toast('Arquivo não encontrado', 'error');
    setVendo({ anexo, url: URL.createObjectURL(blob) });
  };

  const fecharVisualizacao = () => {
    if (vendo) URL.revokeObjectURL(vendo.url);
    setVendo(null);
  };

  const baixar = async (anexo) => {
    const blob = await obterArquivo(anexo.id);
    if (!blob) return toast('Arquivo não encontrado', 'error');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = anexo.nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const presentes = Object.keys(CATEGORIAS_DOC).filter((k) => anexos.some((a) => a.categoria === k));
  const lista = anexos
    .filter((a) => filtro === 'todos' || a.categoria === filtro)
    .slice()
    .sort((a, b) => (b.enviadoEm || '').localeCompare(a.enviadoEm || ''));

  return (
    <div className="docs">
      <label
        className={`dropzone${arrastando ? ' ativo' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); adicionarArquivos(e.dataTransfer.files); }}
      >
        <input type="file" multiple hidden onChange={(e) => { adicionarArquivos(e.target.files); e.target.value = ''; }} />
        <div className="dropzone-icon"><CloudUpload size={26} /></div>
        <strong>{enviando ? `Salvando ${enviando} arquivo(s)…` : 'Arraste os documentos aqui ou toque para escolher'}</strong>
        <span className="muted small">PDF, fotos, planilhas, Word… até {LIMITE_MB} MB cada</span>
      </label>
      <label className="btn btn-block show-mobile">
        <Camera size={17} /> Fotografar documento
        <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { adicionarArquivos(e.target.files); e.target.value = ''; }} />
      </label>

      {anexos.length > 0 && presentes.length > 1 && (
        <Chips value={filtro} onChange={setFiltro} options={[
          { id: 'todos', label: 'Todos', count: anexos.length },
          ...presentes.map((k) => ({ id: k, label: CATEGORIAS_DOC[k].label, icon: CATEGORIAS_DOC[k].icon, count: anexos.filter((a) => a.categoria === k).length })),
        ]} />
      )}

      {anexos.length === 0 ? (
        <EmptyState icon={Paperclip} title="Nenhum documento anexado" text="Licenças, contrato social, cartão CNPJ, alvarás, laudos, fotos…" />
      ) : (
        <div className="doc-grid">
          {lista.map((a) => {
            const cat = CATEGORIAS_DOC[a.categoria] || CATEGORIAS_DOC.outro;
            const emEdicao = editando === a.id;
            return (
              <div key={a.id} className={`doc-card${emEdicao ? ' editando' : ''}`}>
                <button type="button" className="doc-preview" onClick={() => abrir(a)} title="Visualizar">
                  <Miniatura anexo={a} />
                </button>
                <div className="doc-body">
                  {emEdicao ? (
                    <div className="doc-edit">
                      <Field label="Nome">
                        <input value={a.nome} onChange={(e) => onAtualizar(a.id, { nome: e.target.value })} />
                      </Field>
                      <Field label="Categoria">
                        <select value={a.categoria} onChange={(e) => onAtualizar(a.id, { categoria: e.target.value })}>
                          {Object.entries(CATEGORIAS_DOC).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Validade (opcional)">
                        <input type="date" value={a.validade || ''} onChange={(e) => onAtualizar(a.id, { validade: e.target.value })} />
                      </Field>
                      <Field label="Descrição">
                        <input value={a.descricao || ''} onChange={(e) => onAtualizar(a.id, { descricao: e.target.value })} placeholder="Ex.: LO nº 0123/2024" />
                      </Field>
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditando(null)}><Check size={15} /> Pronto</button>
                    </div>
                  ) : (
                    <>
                      <strong className="doc-nome" title={a.nome}>{a.nome}</strong>
                      <div className="evento-meta">
                        <span style={{ color: cat.cor }}><cat.icon size={12} /> {cat.label}</span>
                        <span>{fmtTamanho(a.tamanho)}</span>
                        <span>{a.enviadoEm && new Date(a.enviadoEm).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {a.descricao && <p className="small doc-desc">{a.descricao}</p>}
                      <Validade data={a.validade} />
                    </>
                  )}
                </div>
                {!emEdicao && (
                  <div className="doc-actions">
                    <button type="button" className="icon-btn" onClick={() => abrir(a)} title="Visualizar"><Eye size={16} /></button>
                    <button type="button" className="icon-btn" onClick={() => baixar(a)} title="Baixar"><Download size={16} /></button>
                    <button type="button" className="icon-btn" onClick={() => setEditando(a.id)} title="Editar informações"><Pencil size={15} /></button>
                    {onCriarAviso && a.validade && (
                      <button type="button" className="icon-btn" onClick={() => onCriarAviso(a)} title="Criar aviso de vencimento"><BellPlus size={16} /></button>
                    )}
                    <button type="button" className="icon-btn danger" onClick={() => onRemover(a)} title="Remover"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!vendo} onClose={fecharVisualizacao} size="lg" title={vendo?.anexo.nome} subtitle={vendo && `${CATEGORIAS_DOC[vendo.anexo.categoria]?.label} · ${fmtTamanho(vendo.anexo.tamanho)}`}
        footer={vendo && (
          <>
            <a className="btn" href={vendo.url} target="_blank" rel="noreferrer"><Eye size={16} /> Abrir em nova aba</a>
            <button className="btn btn-primary" onClick={() => baixar(vendo.anexo)}><Download size={16} /> Baixar</button>
          </>
        )}>
        {vendo && (
          vendo.anexo.tipo?.startsWith('image/') ? (
            <img className="doc-view-img" src={vendo.url} alt={vendo.anexo.nome} />
          ) : vendo.anexo.tipo === 'application/pdf' || vendo.anexo.tipo?.startsWith('text/') ? (
            <iframe className="doc-view-frame" src={vendo.url} title={vendo.anexo.nome} />
          ) : (
            <EmptyState icon={Paperclip} title="Visualização não disponível" text="Este tipo de arquivo não abre aqui. Use o botão Baixar." />
          )
        )}
      </Modal>
    </div>
  );
}
