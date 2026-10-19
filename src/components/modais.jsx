import { createContext, useContext, useMemo, useState } from 'react';
import EmpresaForm from './EmpresaForm';
import EventoForm from './EventoForm';
import ImovelForm from './ImovelForm';

// Formulários de empresa, imóvel do CAR e eventos podem ser abertos de qualquer tela.
const ModaisCtx = createContext(null);

export function ModaisProvider({ children }) {
  const [empresa, setEmpresa] = useState(null); // { dados, tab } | null
  const [evento, setEvento] = useState(null);
  const [imovel, setImovel] = useState(null);
  const [carEvento, setCarEvento] = useState(null);

  const api = useMemo(
    () => ({
      abrirEmpresa: (dados = null, tab) => setEmpresa({ dados, tab }),
      abrirEvento: (dados = null) => setEvento({ dados }),
      abrirImovel: (dados = null, tab) => setImovel({ dados, tab }),
      abrirCarEvento: (dados = null) => setCarEvento({ dados }),
    }),
    []
  );

  return (
    <ModaisCtx.Provider value={api}>
      {children}
      <EmpresaForm open={!!empresa} empresa={empresa?.dados} tabInicial={empresa?.tab} onClose={() => setEmpresa(null)} />
      <EventoForm open={!!evento} evento={evento?.dados} onClose={() => setEvento(null)} />
      <ImovelForm open={!!imovel} imovel={imovel?.dados} tabInicial={imovel?.tab} onClose={() => setImovel(null)} />
      <EventoForm modulo="car" open={!!carEvento} evento={carEvento?.dados} onClose={() => setCarEvento(null)} />
    </ModaisCtx.Provider>
  );
}

export const useModais = () => useContext(ModaisCtx);
