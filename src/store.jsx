import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { uid, proximaData, hojeISO } from './utils';
import { criarExemplo } from './seed';
import { supabase } from './supabase';
import { useUI } from './components/ui';
import * as db from './db';
import { excluirArquivo, limparArquivos } from './arquivos';

// Camada de dados.
// - Modo "nuvem" (Supabase configurado no .env): exige login e grava no banco.
// - Modo "local": dados ficam no localStorage deste navegador.
// A tela é atualizada na hora (otimista) e a gravação no banco acontece em seguida.
const KEY = 'vacg-gestao:v1';
const NUVEM = !!supabase;
const VAZIO = { empresas: [], eventos: [], imoveis: [], carEventos: [], exemplo: false };

// Garante as listas do CAR em dados salvos antes de o módulo existir
const normalizar = (d) => ({ ...VAZIO, ...d, imoveis: d?.imoveis || [], carEventos: d?.carEventos || [] });

export function lerLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* sem armazenamento disponível */
  }
  return null;
}

function salvarLocal(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignora */
  }
}

const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const { toast } = useUI();
  const [state, setState] = useState(() => (NUVEM ? VAZIO : normalizar(lerLocal() || criarExemplo())));
  const [sessao, setSessao] = useState(null);
  // iniciando → sem-sessao | carregando → pronto
  const [fase, setFase] = useState(NUVEM ? 'iniciando' : 'pronto');
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);
  // No modo local não há login: quem usa é tratado como administrador
  const [perfil, setPerfil] = useState(NUVEM ? null : { nome: 'Modo local', papel: 'admin', ativo: true });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!NUVEM) salvarLocal(state);
  }, [state]);

  // Sessão de login
  useEffect(() => {
    if (!NUVEM) return;
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      if (!data.session) setFase('sem-sessao');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessao(s);
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoSenha(true);
      if (!s) {
        setFase('sem-sessao');
        setState(VAZIO);
        setPerfil(null);
        db.definirFinanceiro(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const dados = await db.carregarTudo();
      setState(normalizar({ ...dados, exemplo: false }));
    } catch (e) {
      toast(`Erro ao carregar dados: ${e.message}`, 'error');
    } finally {
      setFase('pronto');
    }
  }, [toast]);

  // Ao entrar: carrega o perfil (admin/colaborador), depois os dados,
  // e passa a ouvir mudanças feitas em outros aparelhos
  const userId = sessao?.user?.id;
  useEffect(() => {
    if (!NUVEM || !userId) return;
    let vivo = true;
    let desligar = () => {};
    setFase((f) => (f === 'pronto' ? f : 'carregando'));
    (async () => {
      let p = null;
      try {
        p = await db.carregarMeuPerfil(userId);
      } catch (e) {
        toast(`Erro ao carregar o perfil: ${e.message}`, 'error');
      }
      if (!vivo) return;
      if (!p?.ativo) {
        setPerfil(p);
        setFase('bloqueado');
        return;
      }
      setPerfil(p);
      db.definirFinanceiro(p.papel === 'admin');
      await recarregar();
      if (vivo) desligar = db.assinarMudancas(recarregar);
    })();
    return () => {
      vivo = false;
      desligar();
    };
  }, [userId, recarregar, toast]);

  const api = useMemo(() => {
    const upsert = (lista, item) =>
      lista.some((x) => x.id === item.id) ? lista.map((x) => (x.id === item.id ? item : x)) : [...lista, item];
    const agora = () => new Date().toISOString();

    // Envia a operação para o banco (só no modo nuvem). Se falhar, avisa e recarrega do servidor.
    const remoto = (fn) => {
      if (!NUVEM) return Promise.resolve();
      return db.enfileirar(fn).catch((e) => {
        toast(`Não foi possível salvar na nuvem: ${e.message}`, 'error');
        recarregar();
        throw e;
      });
    };
    const semErro = (p) => p.catch(() => {});

    // Ações de eventos de controle para uma coleção (eventos das empresas ou do CAR)
    const acoesEventos = (chave, salvarNoBanco, tabela) => ({
      salvar(evento) {
        const ev = { status: 'pendente', concluidoEm: null, ...evento, id: evento.id || uid(), criadoEm: evento.criadoEm || agora() };
        setState((s) => ({ ...s, [chave]: upsert(s[chave], ev) }));
        semErro(remoto(() => salvarNoBanco([ev])));
        return ev;
      },
      salvarVarios(lista) {
        const novos = lista.map((ev) => ({ status: 'pendente', concluidoEm: null, ...ev, id: uid(), criadoEm: agora() }));
        setState((s) => ({ ...s, [chave]: [...s[chave], ...novos] }));
        semErro(remoto(() => salvarNoBanco(novos)));
      },
      excluir(id) {
        setState((s) => ({ ...s, [chave]: s[chave].filter((e) => e.id !== id) }));
        semErro(remoto(() => db.excluir(tabela, id)));
      },
      // Conclui o evento; se for recorrente, já agenda a próxima ocorrência.
      // Retorna a data da próxima ocorrência (ou null).
      concluir(ev) {
        const concluido = { ...ev, status: 'concluido', concluidoEm: hojeISO() };
        const recorrente = ev.recorrencia && ev.recorrencia !== 'nenhuma';
        const proximo = recorrente
          ? { ...ev, id: uid(), status: 'pendente', concluidoEm: null, dataVencimento: proximaData(ev.dataVencimento, ev.recorrencia), criadoEm: agora() }
          : null;
        setState((s) => ({
          ...s,
          [chave]: [...s[chave].map((x) => (x.id === ev.id ? concluido : x)), ...(proximo ? [proximo] : [])],
        }));
        semErro(remoto(() => salvarNoBanco(proximo ? [concluido, proximo] : [concluido])));
        return proximo?.dataVencimento ?? null;
      },
      reabrir(id) {
        const ev = stateRef.current[chave].find((x) => x.id === id);
        if (!ev) return;
        const reaberto = { ...ev, status: 'pendente', concluidoEm: null };
        setState((s) => ({ ...s, [chave]: s[chave].map((x) => (x.id === id ? reaberto : x)) }));
        semErro(remoto(() => salvarNoBanco([reaberto])));
      },
    });
    const eventosAmbiental = acoesEventos('eventos', db.salvarEventos, 'eventos');
    const eventosCar = acoesEventos('carEventos', db.salvarCarEventos, 'car_eventos');

    return {
      salvarEmpresa(emp) {
        const e = { ...emp, id: emp.id || uid(), criadoEm: emp.criadoEm || agora(), atualizadoEm: agora() };
        setState((s) => ({ ...s, empresas: upsert(s.empresas, e) }));
        semErro(remoto(() => db.salvarEmpresa(e)));
        return e;
      },
      // Atualiza parte da empresa: atualizarEmpresa(id, (empresa) => ({ ...empresa, campo }))
      atualizarEmpresa(id, fn) {
        const atual = stateRef.current.empresas.find((e) => e.id === id);
        if (!atual) return;
        const nova = { ...fn(atual), atualizadoEm: agora() };
        setState((s) => ({ ...s, empresas: s.empresas.map((e) => (e.id === id ? nova : e)) }));
        semErro(remoto(() => db.salvarEmpresa(nova)));
      },
      excluirEmpresa(id) {
        (stateRef.current.empresas.find((e) => e.id === id)?.anexos || []).forEach((a) => excluirArquivo(a.id));
        setState((s) => ({
          ...s,
          empresas: s.empresas.filter((e) => e.id !== id),
          eventos: s.eventos.filter((e) => e.empresaId !== id),
          imoveis: s.imoveis.map((im) => (im.empresaId === id ? { ...im, empresaId: '' } : im)),
        }));
        semErro(remoto(() => db.excluir('empresas', id)));
      },
      salvarCondicionante(empresaId, cond) {
        const c = { ...cond, id: cond.id || uid() };
        const lista = stateRef.current.empresas.find((e) => e.id === empresaId)?.condicionantes || [];
        const idx = lista.findIndex((x) => x.id === c.id);
        setState((s) => ({
          ...s,
          empresas: s.empresas.map((e) =>
            e.id === empresaId ? { ...e, condicionantes: upsert(e.condicionantes || [], c), atualizadoEm: agora() } : e
          ),
        }));
        semErro(remoto(() => db.salvarCondicionante(empresaId, c, idx >= 0 ? idx : lista.length)));
        return c;
      },
      excluirCondicionante(empresaId, condId) {
        setState((s) => ({
          ...s,
          empresas: s.empresas.map((e) =>
            e.id === empresaId ? { ...e, condicionantes: (e.condicionantes || []).filter((c) => c.id !== condId) } : e
          ),
          eventos: s.eventos.map((ev) => (ev.condicionanteId === condId ? { ...ev, condicionanteId: null } : ev)),
        }));
        semErro(remoto(() => db.excluir('condicionantes', condId)));
      },
      // Eventos de controle: os do licenciamento (empresas) e os do CAR (imóveis)
      salvarEvento: eventosAmbiental.salvar,
      salvarEventos: eventosAmbiental.salvarVarios,
      excluirEvento: eventosAmbiental.excluir,
      concluirEvento: eventosAmbiental.concluir,
      reabrirEvento: eventosAmbiental.reabrir,
      salvarCarEvento: eventosCar.salvar,
      salvarCarEventos: eventosCar.salvarVarios,
      excluirCarEvento: eventosCar.excluir,
      concluirCarEvento: eventosCar.concluir,
      reabrirCarEvento: eventosCar.reabrir,

      // ---------- CAR: imóveis rurais ----------
      salvarImovel(im) {
        const i = { ...im, id: im.id || uid(), criadoEm: im.criadoEm || agora(), atualizadoEm: agora() };
        setState((s) => ({ ...s, imoveis: upsert(s.imoveis, i) }));
        semErro(remoto(() => db.salvarImovel(i)));
        return i;
      },
      atualizarImovel(id, fn) {
        const atual = stateRef.current.imoveis.find((im) => im.id === id);
        if (!atual) return;
        const novo = { ...fn(atual), atualizadoEm: agora() };
        setState((s) => ({ ...s, imoveis: s.imoveis.map((im) => (im.id === id ? novo : im)) }));
        semErro(remoto(() => db.salvarImovel(novo)));
      },
      excluirImovel(id) {
        (stateRef.current.imoveis.find((im) => im.id === id)?.anexos || []).forEach((a) => excluirArquivo(a.id));
        setState((s) => ({
          ...s,
          imoveis: s.imoveis.filter((im) => im.id !== id),
          carEventos: s.carEventos.filter((ev) => ev.imovelId !== id),
        }));
        semErro(remoto(() => db.excluir('imoveis_car', id)));
      },
      async importar(dados) {
        if (!dados || !Array.isArray(dados.empresas) || !Array.isArray(dados.eventos)) {
          throw new Error('Arquivo inválido');
        }
        const novo = normalizar({ empresas: dados.empresas, eventos: dados.eventos, imoveis: dados.imoveis, carEventos: dados.carEventos });
        setState(novo);
        await remoto(() => db.substituirTudo(novo));
      },
      async carregarExemplo() {
        const ex = criarExemplo();
        limparArquivos();
        setState(normalizar({ ...ex, exemplo: !NUVEM }));
        await remoto(() => db.substituirTudo(ex));
      },
      async limparTudo() {
        limparArquivos();
        setState(VAZIO);
        await remoto(() => db.limparTudo());
      },
      // Envia para a nuvem os dados que estavam salvos neste navegador (modo local antigo)
      async enviarLocalParaNuvem() {
        const local = lerLocal();
        if (!local?.empresas?.length) throw new Error('Não há dados locais neste navegador');
        await remoto(() => db.mesclar(local));
        try {
          localStorage.removeItem(KEY);
        } catch {
          /* ignora */
        }
        await recarregar();
        return local.empresas.length;
      },
      async entrar(email, senha) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw new Error(traduzirErro(error.message));
        // Registra a entrada para o administrador acompanhar (sem travar o login se falhar)
        db.carregarMeuPerfil(data.user.id)
          .then((p) => p?.ativo && db.registrarEntrada(data.user.id, p.nome || email))
          .catch(() => {});
      },
      async esqueciSenha(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw new Error(traduzirErro(error.message));
      },
      async definirSenha(senha) {
        const { error } = await supabase.auth.updateUser({ password: senha });
        if (error) throw new Error(traduzirErro(error.message));
        setRecuperandoSenha(false);
      },
      async sair() {
        await supabase.auth.signOut();
      },
    };
  }, [toast, recarregar]);

  const value = useMemo(() => {
    const empresaPorId = Object.fromEntries(state.empresas.map((e) => [e.id, e]));
    const imovelPorId = Object.fromEntries(state.imoveis.map((im) => [im.id, im]));
    return {
      ...state,
      empresaPorId,
      imovelPorId,
      nuvem: NUVEM,
      fase,
      usuario: sessao?.user ?? null,
      perfil,
      // Administrador vê o financeiro (mensalidades) e o registro de atividades
      ehAdmin: perfil?.papel === 'admin',
      recuperandoSenha,
      ...api,
    };
  }, [state, api, fase, sessao, recuperandoSenha, perfil]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

function traduzirErro(msg) {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos';
  if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado';
  if (/password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres';
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (/failed to fetch|network/i.test(msg)) return 'Sem conexão com o servidor';
  return msg;
}

export const useStore = () => useContext(StoreCtx);
