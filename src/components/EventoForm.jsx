import { useEffect, useState } from 'react';
import { CalendarPlus, Save, Trash2, Bell, Repeat } from 'lucide-react';
import { Modal, Field, useUI } from './ui';
import { useModulo } from '../modulos';
import { ANTECEDENCIAS } from '../constants';
import { RECORRENCIAS, addDias, fmtData, hojeISO, diasAte } from '../utils';

// modulo: 'ambiental' (evento de uma empresa) ou 'car' (evento de um imóvel rural)
export default function EventoForm({ open, onClose, evento, modulo = 'ambiental' }) {
  const mod = useModulo(modulo);
  const { entidades, entidadePorId, chaveEntidade: chave, chaveVinculo } = mod;
  const { toast, confirm } = useUI();
  const vazio = () => ({
    [chave]: '',
    tipo: Object.keys(mod.tipos)[0],
    titulo: '',
    documento: '',
    dataVencimento: '',
    antecedenciaDias: 30,
    recorrencia: 'nenhuma',
    [chaveVinculo]: null,
    observacoes: '',
  });
  const [f, setF] = useState(vazio);
  const [erros, setErros] = useState({});
  const editando = !!evento?.id;

  useEffect(() => {
    if (open) {
      setF({ ...vazio(), ...(evento || {}), [chave]: evento?.[chave] || (entidades.length === 1 ? entidades[0].id : '') });
      setErros({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, evento, entidades]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const entidade = entidadePorId[f[chave]];
  const vinculos = mod.vinculos(entidade);

  const salvar = (e) => {
    e.preventDefault();
    const er = {};
    if (!f[chave]) er.entidade = `Escolha ${modulo === 'car' ? 'o imóvel' : 'a empresa'}`;
    if (!f.titulo.trim()) er.titulo = 'Dê um título ao evento';
    if (!f.dataVencimento) er.dataVencimento = 'Informe a data de vencimento';
    setErros(er);
    if (Object.keys(er).length) return;
    mod.salvar({ ...f, antecedenciaDias: Number(f.antecedenciaDias) || 0 });
    toast(editando ? 'Evento atualizado' : 'Evento de controle criado');
    onClose();
  };

  const excluir = async () => {
    const ok = await confirm({ title: 'Excluir evento?', message: `"${f.titulo}" será removido permanentemente.`, confirmLabel: 'Excluir' });
    if (ok) {
      mod.excluir(f.id);
      toast('Evento excluído', 'info');
      onClose();
    }
  };

  // Ao vincular a uma condicionante/pendência, já sugere título, prazo e repetição
  const vincular = (id) => {
    const v = vinculos.find((x) => x.id === id);
    const rotulo = modulo === 'car' ? 'Pendência' : 'Condicionante';
    setF((p) => ({
      ...p,
      [chaveVinculo]: id || null,
      ...(v && !p.id
        ? {
            tipo: mod.tipoVinculo,
            titulo: p.titulo || `${rotulo} ${v.numero}: ${(v.descricao || '').slice(0, 60)}`,
            documento: p.documento || v.licencaRef || '',
            dataVencimento: p.dataVencimento || v.prazo,
            recorrencia: v.periodicidade || p.recorrencia,
          }
        : {}),
    }));
  };

  const dataAviso = f.dataVencimento ? addDias(f.dataVencimento, -Number(f.antecedenciaDias || 0)) : null;
  const avisoJaAtivo = dataAviso && diasAte(dataAviso) <= 0;
  const sugestoes = mod.sugestoes[f.tipo] || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      icon={<CalendarPlus size={20} />}
      title={`${editando ? 'Editar' : 'Novo'} evento de controle${modulo === 'car' ? ' · CAR' : ''}`}
      subtitle={modulo === 'car'
        ? 'Prazos de retificação, notificações, PRA, recomposição e vistorias do imóvel'
        : 'Avisos de vencimento de licenças, análises, condicionantes e taxas'}
      footer={
        <>
          {editando && (
            <button type="button" className="btn btn-ghost-danger mr-auto" onClick={excluir}>
              <Trash2 size={16} /> Excluir
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" form={`form-evento-${modulo}`} className="btn btn-primary">
            <Save size={16} /> Salvar
          </button>
        </>
      }
    >
      <form id={`form-evento-${modulo}`} onSubmit={salvar} className="form-body">
        <Field label={`${mod.entidade} *`} error={erros.entidade}>
          <select value={f[chave]} onChange={(e) => setF((p) => ({ ...p, [chave]: e.target.value, [chaveVinculo]: null }))}>
            <option value="">{modulo === 'car' ? 'Selecione o imóvel…' : 'Selecione a empresa…'}</option>
            {[...entidades].sort((a, b) => mod.nomeEntidade(a).localeCompare(mod.nomeEntidade(b))).map((x) => (
              <option key={x.id} value={x.id}>{mod.nomeEntidade(x)}</option>
            ))}
          </select>
        </Field>

        <div className="field">
          <span className="field-label">Tipo de evento</span>
          <div className="tipo-grid">
            {Object.entries(mod.tipos).map(([k, t]) => (
              <button type="button" key={k} className={`tipo-btn${f.tipo === k ? ' active' : ''}`} style={{ '--c': t.cor }} onClick={() => set('tipo', k)}>
                <t.icon size={20} />
                <span>{t.curto}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Título *" error={erros.titulo}>
          <input value={f.titulo} onChange={(e) => set('titulo', e.target.value)} list={`sugestoes-${modulo}`} placeholder={sugestoes[0]} />
          <datalist id={`sugestoes-${modulo}`}>{sugestoes.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>

        {vinculos.length > 0 && (
          <Field label={`Vincular a uma ${mod.vinculo}`}>
            <select value={f[chaveVinculo] || ''} onChange={(e) => vincular(e.target.value)}>
              <option value="">Nenhuma</option>
              {vinculos.map((v) => (
                <option key={v.id} value={v.id}>{v.numero ? `${v.numero} – ` : ''}{(v.descricao || '').slice(0, 70)}</option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid-2">
          <Field label="Data de vencimento *" error={erros.dataVencimento}>
            <input type="date" value={f.dataVencimento} onChange={(e) => set('dataVencimento', e.target.value)} min={editando ? undefined : addDias(hojeISO(), -365)} />
          </Field>
          <Field label={modulo === 'car' ? 'Nº do documento / ofício' : 'Nº do documento / licença'}>
            <input value={f.documento} onChange={(e) => set('documento', e.target.value)} placeholder={modulo === 'car' ? 'Ex.: Ofício nº 123/2026' : 'Ex.: LO nº 0123/2024'} />
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
          <textarea rows={3} value={f.observacoes} onChange={(e) => set('observacoes', e.target.value)} placeholder="Protocolo, contato no órgão, detalhes…" />
        </Field>
      </form>
    </Modal>
  );
}
