import { createContext, useContext, useMemo, useState } from 'react';
import EmpresaForm from './EmpresaForm';
import EventoForm from './EventoForm';

// Formulários de empresa e evento podem ser abertos de qualquer tela.
const ModaisCtx = createContext(null);

export function ModaisProvider({ children }) {
  const [empresa, setEmpresa] = useState(null); // { dados } | null
  const [evento, setEvento] = useState(null);

  const api = useMemo(
    () => ({
      abrirEmpresa: (dados = null, tab) => setEmpresa({ dados, tab }),
      abrirEvento: (dados = null) => setEvento({ dados }),
    }),
    []
  );

  return (
    <ModaisCtx.Provider value={api}>
      {children}
      <EmpresaForm open={!!empresa} empresa={empresa?.dados} tabInicial={empresa?.tab} onClose={() => setEmpresa(null)} />
      <EventoForm open={!!evento} evento={evento?.dados} onClose={() => setEvento(null)} />
    </ModaisCtx.Provider>
  );
}

export const useModais = () => useContext(ModaisCtx);
