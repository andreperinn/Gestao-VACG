import { useEffect, useState } from 'react';
import { CalendarPlus, Save, Trash2, Bell, Repeat } from 'lucide-react';
import { Modal, Field, useUI } from './ui';
import { useStore } from '../store';
import { TIPOS_EVENTO, ANTECEDENCIAS } from '../constants';
import { RECORRENCIAS, addDias, fmtData, nomeEmpresa, hojeISO, diasAte } from '../utils';

const vazio = () => ({
  empresaId: '',
  tipo: 'licenca',
  titulo: '',
  documento: '',
  dataVencimento: '',
  antecedenciaDias: 30,
  recorrencia: 'nenhuma',
  condicionanteId: null,
  observacoes: '',
});

const SUGESTOES = {
  licenca: ['Renovação da Licença de Operação', 'Vencimento da Licença de Instalação', 'Vencimento da LAS'],
  analise: ['Análise de efluentes', 'Análise de água subterrânea', 'Monitoramento de emissões atmosféricas', 'Análise de ruído'],
  condicionante: ['Cumprimento de condicionante'],
  relatorio: ['RAPP – Cadastro Técnico Federal', 'Inventário de resíduos sólidos', 'Relatório de automonitoramento'],
  taxa: ['Taxa de fiscalização ambiental', 'Taxa de renovação de licença'],
  outro: ['Renovação de outorga de água', 'Visita técnica', 'Renovação do AVCB'],
};

export default function EventoForm({ open, onClose, evento }) {
  const { empresas, empresaPorId, salvarEvento, excluirEvento } = useStore();
  const { toast, confirm } = useUI();
  const [f, setF] = useState(vazio);
  const [erros, setErros] = useState({});
  const editando = !!evento?.id;

  useEffect(() => {
    if (open) {
      setF({ ...vazio(), ...(evento || {}), empresaId: evento?.empresaId || (empresas.length === 1 ? empresas[0].id : '') });
      setErros({});
    }
  }, [open, evento, empresas]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const empresa = empresaPorId[f.empresaId];
  const condicionantes = empresa?.condicionantes || [];

  const salvar = (e) => {
    e.preventDefault();
    const er = {};
    if (!f.empresaId) er.empresaId = 'Escolha a empresa';
    if (!f.titulo.trim()) er.titulo = 'Dê um título ao evento';
    if (!f.dataVencimento) er.dataVencimento = 'Informe a data de vencimento';
    setErros(er);
    if (Object.keys(er).length) return;
    salvarEvento({ ...f, antecedenciaDias: Number(f.antecedenciaDias) || 0 });
    toast(editando ? 'Evento atualizado' : 'Evento de controle criado');
    onClose();
  };

  const excluir = async () => {
    const ok = await confirm({ title: 'Excluir evento?', message: `"${f.titulo}" será removido permanentemente.`, confirmLabel: 'Excluir' });
    if (ok) {
      excluirEvento(f.id);
      toast('Evento excluído', 'info');
      onClose();
    }
  };

  const vincularCondicionante = (id) => {
    const c = condicionantes.find((x) => x.id === id);
    setF((p) => ({
      ...p,
      condicionanteId: id || null,
      ...(c && !p.id
        ? {
            tipo: 'condicionante',
            titulo: p.titulo || `Condicionante ${c.numero}: ${c.descricao.slice(0, 60)}`,
            documento: p.documento || c.licencaRef,
            dataVencimento: p.dataVencimento || c.prazo,
            recorrencia: c.periodicidade || p.recorrencia,
          }
        : {}),
    }));
  };

  const dataAviso = f.dataVencimento ? addDias(f.dataVencimento, -Number(f.antecedenciaDias || 0)) : null;
  const avisoJaAtivo = dataAviso && diasAte(dataAviso) <= 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      icon={<CalendarPlus size={20} />}
      title={editando ? 'Editar evento de controle' : 'Novo evento de controle'}
      subtitle="Avisos de vencimento de licenças, análises, condicionantes e taxas"
      footer={
        <>
          {editando && (
            <button type="button" className="btn btn-ghost-danger mr-auto" onClick={excluir}>
              <Trash2 size={16} /> Excluir
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" form="form-evento" className="btn btn-primary">
            <Save size={16} /> Salvar
          </button>
        </>
      }
    >
      <form id="form-evento" onSubmit={salvar} className="form-body">
        <Field label="Empresa *" error={erros.empresaId}>
          <select value={f.empresaId} onChange={(e) => setF((p) => ({ ...p, empresaId: e.target.value, condicionanteId: null }))}>
            <option value="">Selecione a empresa…</option>
            {[...empresas].sort((a, b) => nomeEmpresa(a).localeCompare(nomeEmpresa(b))).map((e) => (
              <option key={e.id} value={e.id}>{nomeEmpresa(e)}</option>
            ))}
          </select>
        </Field>

        <div className="field">
          <span className="field-label">Tipo de evento</span>
          <div className="tipo-grid">
            {Object.entries(TIPOS_EVENTO).map(([k, t]) => (
              <button type="button" key={k} className={`tipo-btn${f.tipo === k ? ' active' : ''}`} style={{ '--c': t.cor }} onClick={() => set('tipo', k)}>
                <t.icon size={20} />
                <span>{t.curto}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Título *" error={erros.titulo}>
          <input value={f.titulo} onChange={(e) => set('titulo', e.target.value)} list="sugestoes-titulo" placeholder={SUGESTOES[f.tipo]?.[0]} />
          <datalist id="sugestoes-titulo">{(SUGESTOES[f.tipo] || []).map((s) => <option key={s} value={s} />)}</datalist>
        </Field>

        {condicionantes.length > 0 && (
          <Field label="Vincular a uma condicionante">
            <select value={f.condicionanteId || ''} onChange={(e) => vincularCondicionante(e.target.value)}>
              <option value="">Nenhuma</option>
              {condicionantes.map((c) => (
                <option key={c.id} value={c.id}>{c.numero ? `${c.numero} – ` : ''}{c.descricao.slice(0, 70)}</option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid-2">
          <Field label="Data de vencimento *" error={erros.dataVencimento}>
            <input type="date" value={f.dataVencimento} onChange={(e) => set('dataVencimento', e.target.value)} min={editando ? undefined : addDias(hojeISO(), -365)} />
          </Field>
          <Field label="Nº do documento / licença">
            <input value={f.documento} onChange={(e) => set('documento', e.target.value)} placeholder="Ex.: LO nº 0123/2024" />
          </Field>
        </div>

        <div className="field">
          <span className="field-label"><Bell size={14} /> Avisar com antecedência de</span>
          <div className="chips">
            {ANTECEDENCIAS.map((d) => (
              <button type="button" key={d} className={`chip${Number(f.antecedenciaDias) === d ? ' active' : ''}`} onClick={() => set('antecedenciaDias', d)}>
                {d} dias
              </button>
            ))}
            <input className="chip-input" type="number" min="0" value={f.antecedenciaDias} onChange={(e) => set('antecedenciaDias', e.target.value)} aria-label="Dias de antecedência" />
          </div>
          {dataAviso && (
            <span className={`field-hint${avisoJaAtivo ? ' warn' : ''}`}>
              {avisoJaAtivo ? 'O aviso já está ativo — aparecerá nos alertas.' : `O aviso começa em ${fmtData(dataAviso)}.`}
            </span>
          )}
        </div>

        <Field label="Repetição" icon={<Repeat size={14} />} hint="Ao concluir, o próximo vencimento é agendado automaticamente.">
          <select value={f.recorrencia} onChange={(e) => set('recorrencia', e.target.value)}>
            {Object.entries(RECORRENCIAS).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
          </select>
        </Field>

        <Field label="Observações">
          <textarea rows={3} value={f.observacoes} onChange={(e) => set('observacoes', e.target.value)} placeholder="Laboratório, protocolo, detalhes…" />
        </Field>
      </form>
    </Modal>
  );
}
