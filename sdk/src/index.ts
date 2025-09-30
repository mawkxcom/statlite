type StatliteOptions = {
  endpoint?: string; // e.g. https://api.example.com or https://host/statlite
  site?: string; // default: script host domain
};

function inferPagePath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname + window.location.search;
}

async function postJSON(url: string, data: any) {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'omit'
  });
}

export function track(options: StatliteOptions) {
  const defaults = getDefaults();
  const endpoint = (options.endpoint || defaults.endpoint).replace(/\/$/, '');
  const site = options.site || defaults.site;
  const page = inferPagePath();
  const title = typeof document !== 'undefined' ? document.title : undefined;

  const url = `${endpoint}/stats/track`;
  postJSON(url, { site, page, title }).catch(() => void 0);
}

export function mount(dom?: Document) {
  const d = dom || document;
  const elements = Array.from(d.querySelectorAll('[data-statlite]')) as HTMLElement[];
  elements.forEach(async (el) => {
    const metric = el.dataset.statlite; // pv | uv | pagepv
    const defaults = getDefaults();
    const site = el.dataset.site || defaults.site;
    const endpoint = (el.dataset.endpoint || defaults.endpoint).replace(/\/$/, '');
    const page = el.dataset.page || inferPagePath();
    if (!site || !metric) return;

    try {
      const qs = new URLSearchParams({ site, page });
      const resp = await fetch(`${endpoint}/stats/summary?${qs.toString()}`);
      const data = await resp.json();
      let text = '';
      if (metric === 'pv') text = String(data.totalPv ?? '0');
      if (metric === 'uv') text = String(data.totalUv ?? '0');
      if (metric === 'pagepv') text = String(data.pagePv ?? '0');
      el.textContent = text;
    } catch {
      // ignore
    }
  });
}

// auto bootstrap
if (typeof window !== 'undefined') {
  const SCRIPT_INFO = (() => {
    try {
      const s = (document.currentScript as HTMLScriptElement | null);
      if (s?.src) {
        const u = new URL(s.src, window.location.href);
        return { origin: u.origin, hostname: u.hostname };
      }
    } catch {}
    return { origin: window.location.origin, hostname: window.location.hostname };
  })();

  function getDefaults() {
    return {
      site: SCRIPT_INFO.hostname,
      endpoint: SCRIPT_INFO.origin.replace(/\/$/, '') + '/statlite',
    };
  }

  // auto-track after DOMContentLoaded
  window.addEventListener('DOMContentLoaded', () => {
    const defaults = getDefaults();
    const site = document.querySelector('[data-statlite-site]')?.getAttribute('data-statlite-site') || undefined;
    const endpoint = document.querySelector('[data-statlite-endpoint]')?.getAttribute('data-statlite-endpoint') || undefined;
    track({ site: site || defaults.site, endpoint: endpoint || defaults.endpoint });
    mount();
  });
}

// for non-window environments
function getDefaults() {
  return { site: 'localhost', endpoint: '' };
}


