import { useSearchParams } from 'react-router-dom';
import { AntivirusLicensesPage } from './AntivirusLicensesPage.jsx';
import { TeamViewerPage } from './TeamViewerPage.jsx';

// Una sola entrada de menú para lo que se administra por equipo: licencias
// antivirus y acceso remoto. Cada pestaña conserva su propia pantalla; la
// pestaña vive en la URL (?tab=) para poder enlazarla y usar "atrás".
const TABS = [
  { key: 'antivirus', label: 'Antivirus', Page: AntivirusLicensesPage },
  { key: 'teamviewer', label: 'TeamViewer', Page: TeamViewerPage },
];

export function SecurityAccessPage() {
  const [params, setParams] = useSearchParams();
  const active = TABS.find((tab) => tab.key === params.get('tab')) || TABS[0];
  const { Page } = active;
  return <div className="space-y-6">
    <nav role="tablist" aria-label="Seguridad y acceso" className="flex gap-1 border-b border-slate-800">
      {TABS.map((tab) => <button key={tab.key} type="button" role="tab" aria-selected={tab.key === active.key}
        onClick={() => setParams({ tab: tab.key })}
        className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab.key === active.key ? 'border-sky-400 text-sky-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>{tab.label}</button>)}
    </nav>
    <Page key={active.key} />
  </div>;
}
