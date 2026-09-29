import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X, CircleCheck, TriangleAlert, Info } from 'lucide-react';
import { corDe, iniciais } from '../utils';

let modaisAbertos = 0;

export function Modal({ open, onClose, title, subtitle, icon, children, footer, size = 'md' }) {
  const fecharRef = useRef(onClose);
  fecharRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    // Só o modal do topo responde ao Esc; o scroll da página fica travado enquanto houver algum aberto
    const nivel = ++modaisAbertos;
    const onKey = (e) => e.key === 'Escape' && nivel === modaisAbertos && fecharRef.current();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      if (--modaisAbertos === 0) document.body.classList.remove('no-scroll');
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          {icon && <div className="modal-icon">{icon}</div>}
          <div className="grow">
            <h2>{title}</h2>
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

const UICtx = createContext(null);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialogo, setDialogo] = useState(null);

  const toast = useCallback((msg, type = 'success') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const confirm = useCallback((opts) => new Promise((res) => setDialogo({ ...opts, res })), []);

  const fechar = (v) => {
    dialogo?.res(v);
    setDialogo(null);
  };

  const ToastIcon = { success: CircleCheck, error: TriangleAlert, info: Info };

  return (
    <UICtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => {
          const I = ToastIcon[t.type] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <I size={18} />
              <span>{t.msg}</span>
            </div>
          );
        })}
      </div>
      <Modal
        open={!!dialogo}
        onClose={() => fechar(false)}
        title={dialogo?.title}
        icon={<TriangleAlert size={20} />}
        size="sm"
        footer={
          <>
            <button className="btn" onClick={() => fechar(false)}>Cancelar</button>
            <button className={`btn ${dialogo?.danger === false ? 'btn-primary' : 'btn-danger'}`} onClick={() => fechar(true)}>
              {dialogo?.confirmLabel || 'Confirmar'}
            </button>
          </>
        }
      >
        <p>{dialogo?.message}</p>
      </Modal>
    </UICtx.Provider>
  );
}

export const useUI = () => useContext(UICtx);

export function Field({ label, hint, error, children, span, icon }) {
  return (
    <label className={`field${span ? ` span-${span}` : ''}${error ? ' has-error' : ''}`}>
      <span className="field-label">
        {icon}
        {label}
      </span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Badge({ cls = 'muted', children, dot }) {
  return (
    <span className={`badge badge-${cls}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function Avatar({ nome, size = 44 }) {
  return (
    <div className="avatar" style={{ '--c': corDe(nome), width: size, height: size, fontSize: size * 0.36 }}>
      {iniciais(nome)}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="empty-icon">
          <Icon size={28} />
        </div>
      )}
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          className={`tab${value === t.id ? ' active' : ''}`}
          onClick={(e) => {
            onChange(t.id);
            e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
          }}
        >
          {t.icon && <t.icon size={16} />}
          <span>{t.label}</span>
          {t.count != null && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`chip${value === o.id ? ' active' : ''}${o.cls ? ` chip-${o.cls}` : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.icon && <o.icon size={14} />}
          {o.label}
          {o.count != null && <span className="chip-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
