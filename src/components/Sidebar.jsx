import { NavLink } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.js';

const NAV_ITEMS = [
  { to: '/', label: 'Inventario', icon: '📦' },
  { to: '/terceros', label: 'Terceros externos', icon: '🪪' },
];

export function Sidebar({ collapsed, onToggleCollapse, onNavigate }) {
  const [theme, setTheme] = useTheme();

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-slate-900 border-r border-slate-800 transition-all duration-300 z-40 flex flex-col ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className={`flex items-center gap-3 p-4 border-b border-slate-800 ${collapsed ? 'justify-center' : ''}`}>
        <span className="inline-block w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-sky-300 to-sky-500" />
        {!collapsed && (
          <div>
            <p className="font-bold text-slate-100 leading-tight">MRTI Activos</p>
            <a href="/" className="text-sky-400 hover:underline text-xs">← Volver al portal</a>
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive ? 'bg-sky-500/15 text-sky-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  } ${collapsed ? 'justify-center' : ''}`
                }
                title={collapsed ? item.label : undefined}
              >
                <span aria-hidden="true">{item.icon}</span>
                {!collapsed && <span className="font-medium">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className={`border-t border-slate-800 p-4 flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between'}`}>
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Cambiar tema"
          aria-pressed={theme === 'dark'}
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          title={collapsed ? 'Expandir' : 'Colapsar'}
          aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>
    </aside>
  );
}
