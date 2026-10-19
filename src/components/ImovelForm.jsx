import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Trees, MapPinned, Ruler, Users, Handshake, ClipboardList, Paperclip, Save, Plus, Trash2, Hash, ExternalLink,
  Landmark, CalendarClock, Info,
} from 'lucide-react';
import { Modal, Field, Tabs, useUI } from './ui';
import PendenciasEditor from './PendenciasEditor';
import Documentos from './Documentos';
import { MapaSeletor } from './Mapa';
import { useStore } from '../store';
import { navigate } from '../router';
import { UFS } from '../constants';
import {
  SITUACOES_CAR, CONDICOES_CAR, SITUACOES_RL, BIOMAS_RL, TIPOS_PROPRIETARIO, CATEGORIAS_DOC_CAR, categoriaDocCar,
  mascaraCodigoCar, codigoCarValido, nomeImovel, calculoRL, fmtHa,
} from '../car';
import { uid, nomeEmpresa, mascaraCNPJ, soDigitos } from '../utils';
import { excluirArquivo } from '../arquivos';

export const SICAR_CONSULTA = 'https://consultapublica.car.gov.br/publico/imoveis/index';

const vazio = () => ({
  nome: '',
  codigoCar: '',
  empresaId: '',
  situacao: 'ativo',
  condicao: 'aguardando',
  dataInscricao: '',
  dataRetificacao: '',
  municipio: '',
  uf: '',
  localizacao: null,
  areas: { bioma: 'demais' },
  proprietarios: [],
  matriculas: [],
  ccir: '',
  nirf: '',
  pra: { adesao: false },
  observacoes: '',
  pendencias: [],
  anexos: [],
});

function mascaraCpfCnpj(v) {
  const d = soDigitos(v).slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
  }
  return mascaraCNPJ(d);
}

// Campo numérico em hectares
function Hectares({ label, value, onChange, hint, span }) {
  return (
    <Field label={label} hint={hint} span={span}>
      <div className="input-prefix input-sufixo">
        <input type="number" min="0" step="0.0001" inputMode="decimal" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="0,0000" />
        <span>ha</span>
      </div>
    </Field>
  );
}

export default function ImovelForm({ open, onClose, imovel, tabInicial }) {
  const { salvarImovel, salvarCarEventos, carEventos, empresas } = useStore();
  const { toast } = useUI();
  const [f, setF] = useState(vazio);
  const [tab, setTab] = useState('dados');
  const [erros, setErros] = useState({});
  const editando = !!imovel?.id;
  const enviadosAgora = useRef(new Set());

  useEffect(() => {
    if (open) {
      const base = imovel ? { ...vazio(), ...structuredClone(imovel) } : vazio();
      base.areas = { bioma: 'demais', ...base.areas };
      base.pra = { adesao: false, ...base.pra };
      setF(base);
      setTab(tabInicial || 'dados');
      setErros({});
      enviadosAgora.current = new Set();
    }
  }, [open, imovel, tabInicial]);

  const vinculados = useMemo(
    () => new Set(carEventos.filter((e) => e.imovelId === imovel?.id && e.pendenciaId).map((e) => e.pendenciaId)),
    [carEventos, imovel]
  );

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setArea = (k) => (v) => setF((p) => ({ ...p, areas: { ...p.areas, [k]: v } }));
  const setPra = (k, v) => setF((p) => ({ ...p, pra: { ...p.pra, [k]: v } }));
  const atualizarLista = (lista, id, campo, v) => setF((p) => ({ ...p, [lista]: p[lista].map((x) => (x.id === id ? { ...x, [campo]: v } : x)) }));
  const removerDaLista = (lista, id) => setF((p) => ({ ...p, [lista]: p[lista].filter((x) => x.id !== id) }));

  const cancelar = () => {
    enviadosAgora.current.forEach(excluirArquivo);
    enviadosAgora.current = new Set();
    onClose();
  };

  const salvar = (e) => {
    e?.preventDefault();
    const er = {};
    if (!f.nome.trim()) er.nome = 'Informe o nome do imóvel';
    if (f.codigoCar && !codigoCarValido(f.codigoCar)) er.codigoCar = 'Código incompleto. Formato: UF-1234567-XXXX.XXXX.XXXX.XXXX.XXXX.XXXX.XXXX.XXXX';
    setErros(er);
    if (Object.keys(er).length) {
      setTab('dados');
      return;
    }

    const pendencias = f.pendencias.filter((p) => p.descricao.trim() || p.numero.trim());
    const { gerarEvento: gerarEventoPra, ...pra } = f.pra;
    const salvo = salvarImovel({
      ...f,
      pra,
      pendencias: pendencias.map(({ gerarEvento, ...p }) => p),
      proprietarios: f.proprietarios.filter((p) => p.nome.trim() || p.documento.trim()),
      matriculas: f.matriculas.filter((m) => m.numero.trim()),
    });

    // Apaga do aparelho/nuvem os arquivos removidos nesta edição
    const mantidos = new Set(f.anexos.map((a) => a.id));
    (imovel?.anexos || []).filter((a) => !mantidos.has(a.id)).forEach((a) => excluirArquivo(a.id));
    enviadosAgora.current = new Set();

    // Eventos de controle automáticos: pendências com prazo e prazo final do PRA
    const novos = pendencias
      .filter((p) => p.prazo && p.gerarEvento && !vinculados.has(p.id))
      .map((p) => ({
        imovelId: salvo.id,
        tipo: p.tipo === 'pra' ? 'pra' : p.tipo === 'retificacao' ? 'retificacao' : p.tipo === 'app' || p.tipo === 'rl' ? 'recomposicao' : 'notificacao',
        titulo: `Pendência ${p.numero}: ${p.descricao.length > 60 ? p.descricao.slice(0, 60) + '…' : p.descricao}`,
        documento: p.origem,
        dataVencimento: p.prazo,
        antecedenciaDias: 30,
        recorrencia: p.periodicidade,
        pendenciaId: p.id,
        observacoes: p.descricao,
      }));
    if (pra.adesao && pra.prazoFinal && gerarEventoPra) {
      novos.push({
        imovelId: salvo.id,
        tipo: 'pra',
        titulo: 'Prazo final do termo de compromisso (PRA)',
        documento: pra.termo || '',
        dataVencimento: pra.prazoFinal,
        antecedenciaDias: 120,
        recorrencia: 'nenhuma',
      });
    }
    if (novos.length) salvarCarEventos(novos);

    toast(`${editando ? 'Imóvel atualizado' : 'Imóvel cadastrado'}${novos.length ? ` · ${novos.length} evento(s) de controle criado(s)` : ''}`);
    onClose();
    if (!editando) navigate(`/car/imoveis/${salvo.id}`);
  };

  const rl = calculoRL(f);
  const tabs = [
    { id: 'dados', label: 'Dados do CAR', icon: Trees },
    { id: 'local', label: 'Localização', icon: MapPinned },
    { id: 'areas', label: 'Áreas', icon: Ruler },
    { id: 'fundiario', label: 'Proprietários', icon: Users, count: f.proprietarios.length },
    { id: 'pra', label: 'PRA', icon: Handshake },
    { id: 'pendencias', label: 'Pendências', icon: ClipboardList, count: f.pendencias.length },
    { id: 'documentos', label: 'Documentos', icon: Paperclip, count: f.anexos.length },
  ];

  return (
    <Modal
      open={open}
      onClose={cancelar}
      size="lg"
      icon={<Trees size={20} />}
      title={editando ? `Editar ${nomeImovel(imovel)}` : 'Novo imóvel rural (CAR)'}
      subtitle="Cadastro Ambiental Rural: dados do recibo, áreas, proprietários, PRA, pendências e documentos"
      footer={
        <>
          <button type="button" className="btn" onClick={cancelar}>Cancelar</button>
          <button type="submit" form="form-imovel" className="btn btn-primary">
            <Save size={16} /> Salvar imóvel
          </button>
        </>
      }
    >
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <form id="form-imovel" onSubmit={salvar} className="form-body">
        {tab === 'dados' && (
          <div className="grid-2">
            <Field label="Nome do imóvel *" span={2} error={erros.nome} icon={<Trees size={14} />}>
              <input value={f.nome} onChange={set('nome')} placeholder="Ex.: Fazenda Boa Esperança" autoFocus />
            </Field>
            <Field
              label="Nº do recibo do CAR"
              span={2}
              icon={<Hash size={14} />}
              error={erros.codigoCar}
              hint={f.codigoCar ? (codigoCarValido(f.codigoCar) ? '✓ Formato válido' : 'Continue digitando: UF-código do município-32 caracteres') : 'Está no recibo de inscrição do imóvel no SICAR'}
            >
              <input className="mono" value={f.codigoCar} onChange={(e) => setF((p) => ({ ...p, codigoCar: mascaraCodigoCar(e.target.value) }))} placeholder="MG-3122306-0A1B.2C3D.4E5F.6A7B.8C9D.0E1F.2A3B.4C5D" />
            </Field>
            <Field label="Situação do cadastro" span={2}>
              <div className="seg">
                {Object.entries(SITUACOES_CAR).map(([k, s]) => (
                  <button type="button" key={k} className={f.situacao === k ? 'active' : ''} onClick={() => setF((p) => ({ ...p, situacao: k }))}>{s.label}</button>
                ))}
              </div>
            </Field>
            <Field label="Condição da análise" span={2}>
              <select value={f.condicao} onChange={set('condicao')}>
                {Object.entries(CONDICOES_CAR).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Data de inscrição">
              <input type="date" value={f.dataInscricao} onChange={set('dataInscricao')} />
            </Field>
            <Field label="Última retificação">
              <input type="date" value={f.dataRetificacao} onChange={set('dataRetificacao')} />
            </Field>
            <Field label="Município">
              <input value={f.municipio} onChange={set('municipio')} />
            </Field>
            <Field label="UF">
              <select value={f.uf} onChange={set('uf')}>
                <option value="">—</option>
                {UFS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Cliente vinculado (opcional)" span={2} hint="Liga o imóvel a uma empresa já cadastrada no módulo de licenciamento">
              <select value={f.empresaId} onChange={set('empresaId')}>
                <option value="">Nenhum</option>
                {[...empresas].sort((a, b) => nomeEmpresa(a).localeCompare(nomeEmpresa(b))).map((e) => (
                  <option key={e.id} value={e.id}>{nomeEmpresa(e)}</option>
                ))}
              </select>
            </Field>
            <Field label="Observações" span={2}>
              <textarea rows={3} value={f.observacoes} onChange={set('observacoes')} placeholder="Acesso ao imóvel, contato do caseiro, histórico…" />
            </Field>
            <a className="link span-2" href={SICAR_CONSULTA} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Consulta pública do CAR (SICAR)</a>
          </div>
        )}

        {tab === 'local' && (
          <div className="field">
            <span className="field-label"><MapPinned size={14} /> Sede ou ponto de referência do imóvel</span>
            <MapaSeletor
              value={f.localizacao}
              onChange={(localizacao) => setF((p) => ({ ...p, localizacao }))}
              buscaInicial={[f.municipio, f.uf].filter(Boolean).join(', ')}
              onEndereco={(end) => {
                setF((p) => ({ ...p, municipio: end.cidade || p.municipio, uf: end.uf || p.uf }));
                toast('Município e UF preenchidos a partir do ponto', 'info');
              }}
            />
            <span className="field-hint">Use a visão <b>Satélite</b> (botão de camadas no canto do mapa) para achar a sede. O polígono completo do imóvel pode ser anexado como shapefile/KML na aba Documentos.</span>
          </div>
        )}

        {tab === 'areas' && (
          <>
            <div className="grid-2">
              <Hectares label="Área total do imóvel" value={f.areas.total} onChange={setArea('total')} />
              <Field label="Módulos fiscais">
                <input type="number" min="0" step="0.01" inputMode="decimal" value={f.areas.modulos ?? ''} onChange={(e) => setArea('modulos')(e.target.value)} />
              </Field>
              <Field label="Região / bioma (para a Reserva Legal mínima)" span={2}>
                <select value={f.areas.bioma} onChange={(e) => setArea('bioma')(e.target.value)}>
                  {Object.entries(BIOMAS_RL).map(([k, b]) => <option key={k} value={k}>{b.label} — {b.pct}%</option>)}
                </select>
              </Field>
              <Hectares label="Reserva Legal declarada" value={f.areas.rl} onChange={setArea('rl')} />
              <Field label="Situação da Reserva Legal">
                <select value={f.areas.rlSituacao || ''} onChange={(e) => setArea('rlSituacao')(e.target.value)}>
                  <option value="">—</option>
                  {Object.entries(SITUACOES_RL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </Field>
              <Hectares label="APP (Área de Preservação Permanente)" value={f.areas.app} onChange={setArea('app')} />
              <Hectares label="Remanescente de vegetação nativa" value={f.areas.vegetacao} onChange={setArea('vegetacao')} />
              <Hectares label="Área consolidada" value={f.areas.consolidada} onChange={setArea('consolidada')} hint="Ocupação antrópica anterior a 22/07/2008" />
              <Hectares label="Área de uso restrito" value={f.areas.usoRestrito} onChange={setArea('usoRestrito')} />
            </div>

            <div className="card rl-resumo">
              <h4><Landmark size={16} /> Reserva Legal</h4>
              <div className="rl-numeros">
                <div><span className="muted small">Exigida ({rl.pct}%)</span><b>{fmtHa(rl.exigida)}</b></div>
                <div><span className="muted small">Declarada{rl.pctDeclarado != null ? ` (${rl.pctDeclarado.toFixed(1).replace('.', ',')}%)` : ''}</span><b>{fmtHa(rl.declarada)}</b></div>
                <div><span className="muted small">Déficit estimado</span><b className={rl.deficit > 0 ? 'txt-danger' : 'txt-success'}>{rl.deficit == null ? '—' : rl.deficit > 0 ? fmtHa(rl.deficit) : 'Sem déficit'}</b></div>
              </div>
              {Number(f.areas.modulos) > 0 && Number(f.areas.modulos) <= 4 && (
                <p className="small rl-aviso"><Info size={14} /> Imóvel com até 4 módulos fiscais: pelo art. 67 da Lei 12.651/2012, a Reserva Legal pode ser a vegetação nativa existente em 22/07/2008, sem obrigação de recompor o restante.</p>
              )}
            </div>

            <h4 className="secao-form">Passivo ambiental a regularizar</h4>
            <div className="grid-2">
              <Field label="Déficit de Reserva Legal" hint={rl.deficit > 0 ? `Estimativa pelo cálculo: ${fmtHa(rl.deficit)}` : undefined}>
                <div className="input-prefix input-sufixo">
                  <input type="number" min="0" step="0.0001" inputMode="decimal" value={f.areas.deficitRl ?? ''} onChange={(e) => setArea('deficitRl')(e.target.value)} placeholder="0,0000" />
                  <span>ha</span>
                  {rl.deficit > 0 && (
                    <button type="button" className="btn btn-sm" onClick={() => setArea('deficitRl')(rl.deficit.toFixed(4))}>Usar</button>
                  )}
                </div>
              </Field>
              <Hectares label="APP a recompor" value={f.areas.appRecompor} onChange={setArea('appRecompor')} />
            </div>
          </>
        )}

        {tab === 'fundiario' && (
          <>
            <div className="row-between">
              <h4 className="secao-form">Proprietários e possuidores</h4>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setF((p) => ({ ...p, proprietarios: [...p.proprietarios, { id: uid(), nome: '', documento: '', tipo: 'proprietario' }] }))}>
                <Plus size={15} /> Adicionar
              </button>
            </div>
            {f.proprietarios.length === 0 && <p className="muted small">Nenhum proprietário informado.</p>}
            {f.proprietarios.map((p) => (
              <div key={p.id} className="linha-lista">
                <input className="grow" value={p.nome} onChange={(e) => atualizarLista('proprietarios', p.id, 'nome', e.target.value)} placeholder="Nome completo / razão social" aria-label="Nome" />
                <input className="mono doc-input" value={p.documento} onChange={(e) => atualizarLista('proprietarios', p.id, 'documento', mascaraCpfCnpj(e.target.value))} placeholder="CPF ou CNPJ" inputMode="numeric" aria-label="CPF ou CNPJ" />
                <select value={p.tipo} onChange={(e) => atualizarLista('proprietarios', p.id, 'tipo', e.target.value)} aria-label="Tipo">
                  {Object.entries(TIPOS_PROPRIETARIO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <button type="button" className="icon-btn danger" onClick={() => removerDaLista('proprietarios', p.id)} title="Remover"><Trash2 size={16} /></button>
              </div>
            ))}

            <div className="row-between mt">
              <h4 className="secao-form">Matrículas</h4>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setF((p) => ({ ...p, matriculas: [...p.matriculas, { id: uid(), numero: '', cartorio: '', area: '' }] }))}>
                <Plus size={15} /> Adicionar
              </button>
            </div>
            {f.matriculas.length === 0 && <p className="muted small">Nenhuma matrícula informada (imóveis de posse podem não ter).</p>}
            {f.matriculas.map((m) => (
              <div key={m.id} className="linha-lista">
                <input value={m.numero} onChange={(e) => atualizarLista('matriculas', m.id, 'numero', e.target.value)} placeholder="Nº da matrícula" aria-label="Número da matrícula" />
                <input className="grow" value={m.cartorio} onChange={(e) => atualizarLista('matriculas', m.id, 'cartorio', e.target.value)} placeholder="Cartório / comarca" aria-label="Cartório" />
                <div className="input-prefix input-sufixo area-input">
                  <input type="number" min="0" step="0.0001" value={m.area} onChange={(e) => atualizarLista('matriculas', m.id, 'area', e.target.value)} placeholder="Área" aria-label="Área" />
                  <span>ha</span>
                </div>
                <button type="button" className="icon-btn danger" onClick={() => removerDaLista('matriculas', m.id)} title="Remover"><Trash2 size={16} /></button>
              </div>
            ))}

            <div className="grid-2 mt">
              <Field label="CCIR (Certificado de Cadastro de Imóvel Rural)">
                <input value={f.ccir} onChange={set('ccir')} placeholder="Nº do CCIR / código do imóvel no SNCR" />
              </Field>
              <Field label="NIRF / CIB (Receita Federal – ITR)">
                <input value={f.nirf} onChange={set('nirf')} placeholder="0.000.000-0" />
              </Field>
            </div>
          </>
        )}

        {tab === 'pra' && (
          <div className="mensal-form">
            <label className={`switch-card${f.pra.adesao ? ' on' : ''}`}>
              <div className="kpi-icon" style={{ '--c': '#7c3aed' }}><Handshake size={22} /></div>
              <div className="grow">
                <strong>Aderiu ao PRA (Programa de Regularização Ambiental)</strong>
                <span className="muted small">Para regularizar passivos de APP, Reserva Legal e uso restrito por termo de compromisso</span>
              </div>
              <input type="checkbox" className="switch" checked={!!f.pra.adesao} onChange={(e) => setPra('adesao', e.target.checked)} />
            </label>
            <div className={`grid-2${f.pra.adesao ? '' : ' desativado'}`}>
              <Field label="Nº do termo de compromisso">
                <input value={f.pra.termo || ''} onChange={(e) => setPra('termo', e.target.value)} />
              </Field>
              <Field label="Órgão">
                <input value={f.pra.orgao || ''} onChange={(e) => setPra('orgao', e.target.value)} placeholder="Ex.: SEMAD, IEF, IAT…" />
              </Field>
              <Field label="Data de adesão / assinatura">
                <input type="date" value={f.pra.dataAdesao || ''} onChange={(e) => setPra('dataAdesao', e.target.value)} />
              </Field>
              <Field label="Prazo final do compromisso">
                <input type="date" value={f.pra.prazoFinal || ''} onChange={(e) => setPra('prazoFinal', e.target.value)} />
              </Field>
              <Field label="Compromissos assumidos" span={2}>
                <textarea rows={3} value={f.pra.compromissos || ''} onChange={(e) => setPra('compromissos', e.target.value)} placeholder="Recompor 2,5 ha de APP do córrego até 2030; recompor RL em 1/10 da área a cada 2 anos…" />
              </Field>
            </div>
            {f.pra.adesao && f.pra.prazoFinal && (
              <label className="check small">
                <input type="checkbox" checked={!!f.pra.gerarEvento} onChange={(e) => setPra('gerarEvento', e.target.checked)} />
                <CalendarClock size={14} /> Criar evento de controle para o prazo final (aviso 120 dias antes)
              </label>
            )}
          </div>
        )}

        {tab === 'pendencias' && (
          <PendenciasEditor value={f.pendencias} onChange={(pendencias) => setF((p) => ({ ...p, pendencias }))} eventosVinculados={vinculados} />
        )}

        {tab === 'documentos' && (
          <Documentos
            categorias={CATEGORIAS_DOC_CAR}
            adivinhar={categoriaDocCar}
            anexos={f.anexos}
            onAdicionar={(novos) => {
              novos.forEach((a) => enviadosAgora.current.add(a.id));
              setF((p) => ({ ...p, anexos: [...p.anexos, ...novos] }));
            }}
            onAtualizar={(id, patch) => setF((p) => ({ ...p, anexos: p.anexos.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))}
            onRemover={(anexo) => {
              if (enviadosAgora.current.delete(anexo.id)) excluirArquivo(anexo.id);
              setF((p) => ({ ...p, anexos: p.anexos.filter((a) => a.id !== anexo.id) }));
            }}
          />
        )}
      </form>
    </Modal>
  );
}
