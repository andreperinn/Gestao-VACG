import { useState } from 'react';
import { Leaf, Mail, Lock, LogIn, ArrowLeft, KeyRound, ShieldCheck, FlaskConical, CalendarClock } from 'lucide-react';
import { useStore } from '../store';
import { Field, Modal, useUI } from '../components/ui';

export default function Login() {
  const { entrar, esqueciSenha } = useStore();
  const { toast } = useUI();
  const [modo, setModo] = useState('entrar'); // entrar | esqueci
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      if (modo === 'entrar') {
        await entrar(email.trim(), senha);
      } else {
        await esqueciSenha(email.trim());
        toast('Enviamos um link para redefinir a senha. Confira seu e-mail.', 'info');
        setModo('entrar');
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <div className="login-side">
        <div className="brand">
          <div className="brand-logo"><Leaf size={22} /></div>
          <div>
            <strong>VACG</strong>
            <span>Gestão Ambiental</span>
          </div>
        </div>
        <div className="login-pitch">
          <h1>Licenças, condicionantes e vencimentos sob controle.</h1>
          <ul>
            <li><ShieldCheck size={18} /> Licenças ambientais de cada empresa</li>
            <li><FlaskConical size={18} /> Análises e monitoramentos periódicos</li>
            <li><CalendarClock size={18} /> Avisos antes de cada vencimento</li>
          </ul>
        </div>
      </div>

      <div className="login-main">
        <form className="login-card" onSubmit={enviar}>
          <div className="brand login-brand-mobile">
            <div className="brand-logo"><Leaf size={22} /></div>
            <div>
              <strong>VACG</strong>
              <span>Gestão Ambiental</span>
            </div>
          </div>
          <h2>{modo === 'entrar' ? 'Entrar no sistema' : 'Redefinir senha'}</h2>
          <p className="muted small">
            {modo === 'entrar' ? 'Use o e-mail e a senha cadastrados.' : 'Informe seu e-mail para receber o link de redefinição.'}
          </p>

          <Field label="E-mail" icon={<Mail size={14} />}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          </Field>
          {modo === 'entrar' && (
            <Field label="Senha" icon={<Lock size={14} />}>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
            </Field>
          )}

          {erro && <div className="login-erro">{erro}</div>}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={enviando}>
            {modo === 'entrar' ? <><LogIn size={18} /> {enviando ? 'Entrando…' : 'Entrar'}</> : <><KeyRound size={18} /> {enviando ? 'Enviando…' : 'Enviar link'}</>}
          </button>

          {modo === 'entrar' ? (
            <button type="button" className="link-btn" onClick={() => { setModo('esqueci'); setErro(''); }}>Esqueci minha senha</button>
          ) : (
            <button type="button" className="link-btn" onClick={() => { setModo('entrar'); setErro(''); }}><ArrowLeft size={14} /> Voltar para o login</button>
          )}
        </form>
      </div>
    </div>
  );
}

export function NovaSenha() {
  const { definirSenha } = useStore();
  const { toast } = useUI();
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres');
    if (senha !== confirma) return setErro('As senhas não conferem');
    try {
      await definirSenha(senha);
      toast('Senha alterada com sucesso');
    } catch (err) {
      setErro(err.message);
    }
  };

  return (
    <div className="login">
      <div className="login-main">
        <form className="login-card" onSubmit={enviar}>
          <h2>Criar nova senha</h2>
          <Field label="Nova senha" icon={<Lock size={14} />}>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" autoFocus />
          </Field>
          <Field label="Confirme a nova senha" icon={<Lock size={14} />}>
            <input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="new-password" />
          </Field>
          {erro && <div className="login-erro">{erro}</div>}
          <button type="submit" className="btn btn-primary btn-block btn-lg"><KeyRound size={18} /> Salvar senha</button>
        </form>
      </div>
    </div>
  );
}

// Usuário com perfil desativado pelo administrador
export function Bloqueado() {
  const { sair, usuario } = useStore();
  return (
    <div className="login">
      <div className="login-main">
        <div className="login-card">
          <div className="empty-icon"><Lock size={28} /></div>
          <h2>Acesso desativado</h2>
          <p className="muted">
            O acesso de <b>{usuario?.email}</b> está desativado. Fale com o administrador do sistema.
          </p>
          <button className="btn btn-block btn-lg" onClick={sair}>Sair</button>
        </div>
      </div>
    </div>
  );
}

// Troca de senha do próprio usuário logado
export function AlterarSenha({ open, onClose }) {
  const { definirSenha } = useStore();
  const { toast } = useUI();
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const fechar = () => {
    setSenha('');
    setConfirma('');
    setErro('');
    onClose();
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres');
    if (senha !== confirma) return setErro('As senhas não conferem');
    setSalvando(true);
    try {
      await definirSenha(senha);
      toast('Senha alterada com sucesso');
      fechar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open={open} onClose={fechar} size="sm" icon={<KeyRound size={20} />} title="Alterar minha senha"
      footer={
        <>
          <button type="button" className="btn" onClick={fechar}>Cancelar</button>
          <button type="submit" form="form-senha" className="btn btn-primary" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar senha'}
          </button>
        </>
      }>
      <form id="form-senha" className="form-body" onSubmit={salvar}>
        <Field label="Nova senha" icon={<Lock size={14} />}>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" autoFocus />
        </Field>
        <Field label="Confirme a nova senha" icon={<Lock size={14} />}>
          <input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="new-password" />
        </Field>
        {erro && <div className="login-erro">{erro}</div>}
      </form>
    </Modal>
  );
}

export function Carregando() {
  return (
    <div className="splash">
      <div className="brand-logo splash-logo"><Leaf size={28} /></div>
      <p className="muted">Carregando dados…</p>
    </div>
  );
}
