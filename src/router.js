import { useEffect, useState } from 'react';

// Roteamento simples por hash (#/empresas/123) — funciona em qualquer hospedagem estática.
export function useRoute() {
  const ler = () => window.location.hash.slice(1) || '/';
  const [rota, setRota] = useState(ler);
  useEffect(() => {
    const onChange = () => setRota(ler());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return rota;
}

export function navigate(path) {
  window.location.hash = path;
  window.scrollTo({ top: 0 });
}
