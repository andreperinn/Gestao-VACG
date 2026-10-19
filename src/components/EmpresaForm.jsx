import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, MapPin, ClipboardCheck, Save, User, Phone, Mail, Factory, Landmark, Hash, Briefcase, Wallet, Paperclip, MapPinned } from 'lucide-react';
import { Modal, Field, Tabs, useUI } from './ui';
import CondicionantesEditor from './CondicionantesEditor';
import ServicosEditor from './ServicosEditor';
import MensalidadeForm from './MensalidadeForm';
import Documentos from './Documentos';
import { MapaSeletor } from './Mapa';
import { useStore } from '../store';
import { navigate } from '../router';
import { PORTES, POTENCIAL, ORGAOS, UFS } from '../constants';
import { mascaraCNPJ, mascaraTelefone, mascaraCEP, soDigitos, nomeEmpresa } from '../utils';
import { mensalidadeVazia } from '../mensalidade';
import { excluirArquivo } from '../arquivos';

const vazia = () => ({
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  atividade: '',
  cnae: '',
  porte: '',
  potencialPoluidor: '',
  orgaoAmbiental: '',
  cep: '',
  endereco: '',
  cidade: '',
  uf: '',
  responsavel: '',
  telefone: '',
  email: '',
  observacoes: '',
  localizacao: null,
  condicionantes: [],
  servicos: [],
  mensalidade: mensalidadeVazia(),
  anexos: [],
});

export default function EmpresaForm({ open, onClose, empresa, tabInicial }) {
  const { salvarEmpresa, salvarEventos, eventos, ehAdmin } = useStore();
  const { toast } = useUI();
  const [f, setF] = useState(vazia);
  const [tab, setTab] = useState('dados');
  const [erros, setErros] = useState({});
  const editando = !!empresa?.id;
  // Arquivos enviados nesta edição (apagados se o usuário cancelar)
  const enviadosAgora = useRef(new Set());

  useEffect(() => {
    if (open) {
      const base = empresa ? { ...vazia(), ...structuredClone(empresa) } : vazia();
      base.mensalidade = { ...mensalidadeVazia(), ...base.mensalidade };
      setF(base);
      setTab(tabInicial || 'dados');
      setErros({});
      enviadosAgora.current = new Set();
    }
  }, [open, empresa, tabInicial]);

  const cancelar = () => {
    enviadosAgora.current.forEach(excluirArquivo);
    enviadosAgora.current = new Set();
    onClose();
  };

  const vinculados = useMemo(
    () => new Set(eventos.filter((e) => e.empresaId === empresa?.id && e.condicionanteId).map((e) => e.condicionanteId)),
    [eventos, empresa]
  );

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setMask = (k, mask) => (e) => setF((p) => ({ ...p, [k]: mask(e.target.value) }));

  const salvar = (e) => {
    e?.preventDefault();
    const er = {};
    if (!f.razaoSocial.trim()) er.razaoSocial = 'Informe a razão social';
    if (f.cnpj && soDigitos(f.cnpj).length !== 14) er.cnpj = 'CNPJ incompleto';
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'E-mail inválido';
    setErros(er);
    if (Object.keys(er).length) {
      setTab(er.email ? 'contato' : 'dados');
      return;
    }

    const condicionantes = f.condicionantes.filter((c) => c.descricao.trim() || c.numero.trim());
    const salva = salvarEmpresa({
      ...f,
      condicionantes: condicionantes.map(({ gerarEvento, ...c }) => c),
      servicos: f.servicos.filter((s) => s.nome.trim() || s.descricao.trim()),
      mensalidade: { ...f.mensalidade, valor: f.mensalidade.valor === '' ? '' : Number(f.mensalidade.valor) },
    });

    // Apaga do aparelho os arquivos que foram removidos nesta edição
    const mantidos = new Set(f.anexos.map((a) => a.id));
    (empresa?.anexos || []).filter((a) => !mantidos.has(a.id)).forEach((a) => excluirArquivo(a.id));
    enviadosAgora.current = new Set();

    const novosEventos = condicionantes
      .filter((c) => c.prazo && c.gerarEvento && !vinculados.has(c.id))
      .map((c) => ({
        empresaId: salva.id,
        tipo: 'condicionante',
        titulo: `Condicionante ${c.numero}: ${c.descricao.length > 60 ? c.descricao.slice(0, 60) + '…' : c.descricao}`,
        documento: c.licencaRef,
        dataVencimento: c.prazo,
        antecedenciaDias: 30,
        recorrencia: c.periodicidade,
        condicionanteId: c.id,
        observacoes: c.descricao,
      }));
    if (novosEventos.length) salvarEventos(novosEventos);

    toast(
      `${editando ? 'Empresa atualizada' : 'Empresa cadastrada'}${novosEventos.length ? ` · ${novosEventos.length} evento(s) de controle criado(s)` : ''}`
    );
    onClose();
    if (!editando) navigate(`/empresas/${salva.id}`);
  };

  const tabs = [
    { id: 'dados', label: 'Dados', icon: Building2 },
    { id: 'contato', label: 'Endereço e mapa', icon: MapPin },
    { id: 'condicionantes', label: 'Condicionantes', icon: ClipboardCheck, count: f.condicionantes.length },
    { id: 'servicos', label: 'Serviços', icon: Briefcase, count: f.servicos.length },
    ...(ehAdmin ? [{ id: 'mensalidade', label: 'Mensalidade', icon: Wallet }] : []),
    { id: 'documentos', label: 'Documentos', icon: Paperclip, count: f.anexos.length },
  ];

  const enderecoBusca = [f.endereco, f.cidade, f.uf].filter(Boolean).join(', ');

  return (
    <Modal
      open={open}
      onClose={cancelar}
      size="lg"
      icon={<Building2 size={20} />}
      title={editando ? `Editar ${nomeEmpresa(empresa)}` : 'Nova empresa'}
      subtitle="Dados cadastrais, localização, condicionantes, serviços, mensalidade e documentos"
      footer={
        <>
          <button type="button" className="btn" onClick={cancelar}>Cancelar</button>
          <button type="submit" form="form-empresa" className="btn btn-primary">
            <Save size={16} /> Salvar empresa
          </button>
        </>
      }
    >
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <form id="form-empresa" onSubmit={salvar} className="form-body">
        {tab === 'dados' && (
          <div className="grid-2">
            <Field label="Razão social *" span={2} error={erros.razaoSocial} icon={<Building2 size={14} />}>
              <input value={f.razaoSocial} onChange={set('razaoSocial')} placeholder="Empresa Exemplo Ltda." autoFocus />
            </Field>
            <Field label="Nome fantasia">
              <input value={f.nomeFantasia} onChange={set('nomeFantasia')} placeholder="Como a empresa é conhecida" />
            </Field>
            <Field label="CNPJ" error={erros.cnpj} icon={<Hash size={14} />}>
              <input value={f.cnpj} onChange={setMask('cnpj', mascaraCNPJ)} placeholder="00.000.000/0000-00" inputMode="numeric" />
            </Field>
            <Field label="Atividade principal" span={2} icon={<Factory size={14} />}>
              <input value={f.atividade} onChange={set('atividade')} placeholder="Ex.: Fabricação de produtos cerâmicos" />
            </Field>
            <Field label="CNAE">
              <input value={f.cnae} onChange={set('cnae')} placeholder="0000-0/00" />
            </Field>
            <Field label="Órgão ambiental" icon={<Landmark size={14} />}>
              <input value={f.orgaoAmbiental} onChange={set('orgaoAmbiental')} list="orgaos" placeholder="Selecione ou digite" />
              <datalist id="orgaos">{ORGAOS.map((o) => <option key={o} value={o} />)}</datalist>
            </Field>
            <Field label="Porte">
              <div className="seg">
                {PORTES.map((p) => (
                  <button type="button" key={p} className={f.porte === p ? 'active' : ''} onClick={() => setF((x) => ({ ...x, porte: x.porte === p ? '' : p }))}>{p}</button>
                ))}
              </div>
            </Field>
            <Field label="Potencial poluidor">
              <div className="seg">
                {POTENCIAL.map((p) => (
                  <button type="button" key={p} className={f.potencialPoluidor === p ? 'active' : ''} onClick={() => setF((x) => ({ ...x, potencialPoluidor: x.potencialPoluidor === p ? '' : p }))}>{p}</button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {tab === 'contato' && (
          <div className="grid-2">
            <div className="field span-2">
              <span className="field-label"><MapPinned size={14} /> Localização no mapa</span>
              <MapaSeletor
                value={f.localizacao}
                onChange={(localizacao) => setF((p) => ({ ...p, localizacao }))}
                buscaInicial={enderecoBusca}
                onEndereco={(end) => {
                  setF((p) => ({ ...p, ...Object.fromEntries(Object.entries(end).filter(([, v]) => v)) }));
                  toast('Endereço preenchido a partir do ponto', 'info');
                }}
              />
            </div>
            <Field label="CEP">
              <input value={f.cep} onChange={setMask('cep', mascaraCEP)} placeholder="00000-000" inputMode="numeric" />
            </Field>
            <Field label="Endereço" icon={<MapPin size={14} />}>
              <input value={f.endereco} onChange={set('endereco')} placeholder="Rua, número, bairro" />
            </Field>
            <Field label="Cidade">
              <input value={f.cidade} onChange={set('cidade')} />
            </Field>
            <Field label="UF">
              <select value={f.uf} onChange={set('uf')}>
                <option value="">—</option>
                {UFS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Responsável / contato" icon={<User size={14} />}>
              <input value={f.responsavel} onChange={set('responsavel')} placeholder="Nome do contato na empresa" />
            </Field>
            <Field label="Telefone / WhatsApp" icon={<Phone size={14} />}>
              <input value={f.telefone} onChange={setMask('telefone', mascaraTelefone)} placeholder="(00) 00000-0000" inputMode="tel" />
            </Field>
            <Field label="E-mail" span={2} error={erros.email} icon={<Mail size={14} />}>
              <input type="email" value={f.email} onChange={set('email')} placeholder="contato@empresa.com.br" />
            </Field>
            <Field label="Observações" span={2}>
              <textarea rows={3} value={f.observacoes} onChange={set('observacoes')} placeholder="Anotações gerais sobre o cliente" />
            </Field>
          </div>
        )}

        {tab === 'condicionantes' && (
          <CondicionantesEditor
            value={f.condicionantes}
            onChange={(condicionantes) => setF((p) => ({ ...p, condicionantes }))}
            eventosVinculados={vinculados}
          />
        )}

        {tab === 'servicos' && (
          <ServicosEditor value={f.servicos} onChange={(servicos) => setF((p) => ({ ...p, servicos }))} />
        )}

        {tab === 'mensalidade' && (
          <MensalidadeForm value={f.mensalidade} onChange={(mensalidade) => setF((p) => ({ ...p, mensalidade }))} />
        )}

        {tab === 'documentos' && (
          <Documentos
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
