import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, LocateFixed, MapPin, ExternalLink, Navigation, Trash2, MapPinned } from 'lucide-react';

// Mapa gratuito (OpenStreetMap + satélite Esri), sem chave de API.
const CENTRO_BRASIL = [-15.8, -47.9];
const NOMINATIM = 'https://nominatim.openstreetmap.org';

export const COR_STATUS = { ok: '#15803d', alerta: '#d97706', vencido: '#dc2626' };

function pino(cor = '#15803d') {
  return L.divIcon({
    className: 'pino',
    html: `<svg viewBox="0 0 24 34" width="30" height="42"><path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 34 12 34s12-13.2 12-22.1C24 5.3 18.6 0 12 0z" fill="${cor}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -38],
    tooltipAnchor: [0, -36],
  });
}

// Cria o mapa com as camadas "Mapa" e "Satélite" e ajusta o tamanho quando o container muda
function useLeaflet(ref, opcoes = {}) {
  const mapRef = useRef(null);
  useEffect(() => {
    const map = L.map(ref.current, { zoomControl: true, ...opcoes }).setView(CENTRO_BRASIL, 4);
    const ruas = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    });
    const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Imagens © Esri',
    });
    ruas.addTo(map);
    L.control.layers({ Mapa: ruas, Satélite: satelite }, null, { position: 'topright' }).addTo(map);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(ref.current);
    mapRef.current = map;
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return mapRef;
}

export const linkGoogleMaps = (p) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
export const linkRota = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

export function LinksMapa({ ponto }) {
  if (!ponto) return null;
  return (
    <div className="mapa-links">
      <a className="btn btn-sm" href={linkGoogleMaps(ponto)} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Abrir no Google Maps</a>
      <a className="btn btn-sm btn-primary" href={linkRota(ponto)} target="_blank" rel="noreferrer"><Navigation size={15} /> Como chegar</a>
    </div>
  );
}

function enderecoDoNominatim(r) {
  const a = r.address || {};
  const rua = [a.road, a.house_number].filter(Boolean).join(', ');
  const bairro = a.suburb || a.neighbourhood || a.quarter || a.hamlet;
  const uf = (a['ISO3166-2-lvl4'] || '').replace('BR-', '');
  return {
    endereco: [rua, bairro].filter(Boolean).join(' – ') || r.display_name?.split(',').slice(0, 2).join(','),
    cidade: a.city || a.town || a.village || a.municipality || '',
    uf: uf.length === 2 ? uf : '',
    cep: (a.postcode || '').replace(/^(\d{5})(\d{3})$/, '$1-$2'),
  };
}

// ---------- Seletor de ponto (usado no cadastro) ----------
export function MapaSeletor({ value, onChange, buscaInicial = '', onEndereco }) {
  const elRef = useRef(null);
  const mapRef = useLeaflet(elRef);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [busca, setBusca] = useState(buscaInicial);
  const [resultados, setResultados] = useState(null);
  const [carregando, setCarregando] = useState('');
  const [erro, setErro] = useState('');

  // Clique no mapa coloca o pino
  useEffect(() => {
    const map = mapRef.current;
    const aoClicar = (e) => onChangeRef.current({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) });
    map.on('click', aoClicar);
    if (value) map.setView([value.lat, value.lng], 16);
    return () => map.off('click', aoClicar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantém o pino sincronizado com o valor
  useEffect(() => {
    if (!value) return;
    const m = L.marker([value.lat, value.lng], { icon: pino(), draggable: true })
      .addTo(mapRef.current)
      .on('dragend', (e) => {
        const p = e.target.getLatLng();
        onChangeRef.current({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
      });
    return () => m.remove();
  }, [value, mapRef]);

  const irPara = (p, zoom = 17) => {
    onChange(p);
    mapRef.current.setView([p.lat, p.lng], zoom);
  };

  const buscar = async (e) => {
    e?.preventDefault();
    if (!busca.trim()) return;
    setCarregando('busca');
    setErro('');
    try {
      const r = await fetch(`${NOMINATIM}/search?format=jsonv2&countrycodes=br&limit=5&accept-language=pt-BR&q=${encodeURIComponent(busca)}`);
      const lista = await r.json();
      if (!lista.length) setErro('Endereço não encontrado. Tente só a cidade ou a rua, ou marque direto no mapa.');
      if (lista.length === 1) {
        irPara({ lat: +(+lista[0].lat).toFixed(6), lng: +(+lista[0].lon).toFixed(6) }, 16);
        setResultados(null);
      } else setResultados(lista);
    } catch {
      setErro('Não foi possível buscar agora. Verifique a internet.');
    } finally {
      setCarregando('');
    }
  };

  const minhaLocalizacao = () => {
    if (!navigator.geolocation) return setErro('Este aparelho não informa a localização.');
    setCarregando('gps');
    setErro('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        irPara({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) });
        setCarregando('');
      },
      () => {
        setErro('Não foi possível obter sua localização (permissão negada?).');
        setCarregando('');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const preencherEndereco = async () => {
    setCarregando('reverso');
    setErro('');
    try {
      const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&accept-language=pt-BR&lat=${value.lat}&lon=${value.lng}`);
      onEndereco(enderecoDoNominatim(await r.json()));
    } catch {
      setErro('Não foi possível descobrir o endereço deste ponto.');
    } finally {
      setCarregando('');
    }
  };

  return (
    <div className="mapa-seletor">
      <div className="mapa-busca">
        <div className="search search-inline">
          <Search size={18} className="search-icon" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar endereço, bairro ou cidade…"
            onKeyDown={(e) => e.key === 'Enter' && buscar(e)} />
        </div>
        <button type="button" className="btn" onClick={buscar} disabled={carregando === 'busca'}>{carregando === 'busca' ? 'Buscando…' : 'Buscar'}</button>
        <button type="button" className="btn" onClick={minhaLocalizacao} title="Usar minha localização atual" disabled={carregando === 'gps'}>
          <LocateFixed size={16} /> <span className="hide-mobile">Estou aqui</span>
        </button>
      </div>

      {resultados?.length > 1 && (
        <div className="mapa-resultados">
          {resultados.map((r) => (
            <button type="button" key={r.place_id} onClick={() => { irPara({ lat: +(+r.lat).toFixed(6), lng: +(+r.lon).toFixed(6) }, 16); setResultados(null); }}>
              <MapPin size={15} /> <span>{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
      {erro && <p className="field-error">{erro}</p>}

      <div className="mapa-wrap">
        <div ref={elRef} className="mapa" style={{ height: 320 }} />
        {!value && (
          <div className="mapa-dica"><MapPinned size={16} /> Toque no mapa para marcar a empresa</div>
        )}
      </div>

      {value ? (
        <div className="mapa-info">
          <span className="mono small muted"><MapPin size={13} /> {value.lat}, {value.lng} · arraste o pino para ajustar</span>
          <div className="mapa-links">
            {onEndereco && (
              <button type="button" className="btn btn-sm" onClick={preencherEndereco} disabled={carregando === 'reverso'}>
                {carregando === 'reverso' ? 'Buscando…' : 'Preencher endereço pelo ponto'}
              </button>
            )}
            <a className="btn btn-sm" href={linkGoogleMaps(value)} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Google Maps</a>
            <button type="button" className="icon-btn danger" onClick={() => onChange(null)} title="Remover ponto"><Trash2 size={16} /></button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------- Visualização de um ponto ----------
export function MapaPonto({ ponto, altura = 220 }) {
  const elRef = useRef(null);
  const mapRef = useLeaflet(elRef, { scrollWheelZoom: false });
  useEffect(() => {
    const map = mapRef.current;
    const m = L.marker([ponto.lat, ponto.lng], { icon: pino() }).addTo(map);
    map.setView([ponto.lat, ponto.lng], 16);
    return () => m.remove();
  }, [ponto, mapRef]);
  return <div ref={elRef} className="mapa" style={{ height: altura }} />;
}

// ---------- Todas as empresas no mapa ----------
export function MapaEmpresas({ itens, altura = 520 }) {
  const elRef = useRef(null);
  const mapRef = useLeaflet(elRef);
  useEffect(() => {
    const map = mapRef.current;
    const grupo = L.featureGroup().addTo(map);
    itens.forEach(({ id, nome, detalhe, ponto, st }) => {
      const div = document.createElement('div');
      div.className = 'mapa-popup';
      const b = document.createElement('strong');
      b.textContent = nome;
      const s = document.createElement('span');
      s.textContent = detalhe || '';
      const a = document.createElement('a');
      a.href = `#/empresas/${id}`;
      a.textContent = 'Abrir empresa →';
      div.append(b, s, a);
      L.marker([ponto.lat, ponto.lng], { icon: pino(COR_STATUS[st]) }).bindPopup(div).bindTooltip(nome).addTo(grupo);
    });
    if (itens.length) map.fitBounds(grupo.getBounds(), { padding: [40, 40], maxZoom: 14 });
    return () => grupo.remove();
  }, [itens, mapRef]);
  return <div ref={elRef} className="mapa" style={{ height: altura }} />;
}
