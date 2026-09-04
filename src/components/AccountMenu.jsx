import { useEffect, useRef, useState } from 'react';

export function AccountMenu({ profile }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const name = profile.full_name || 'Usuario';
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const isAdministrator = profile.role === 'administrator';

  useEffect(() => {
    function close(event) { if (!menuRef.current?.contains(event.target)) setOpen(false); }
    function closeOnEscape(event) { if (event.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', closeOnEscape); };
  }, []);

  async function logout() {
    try {
      const token = localStorage.getItem('auth_token');
      await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' });
    } catch { /* cierre local garantizado aunque el aviso a Core falle */ }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_profile');
    window.location.replace('/');
  }

  return <div className="portal-account-menu" ref={menuRef}>
    <button type="button" className="portal-module-profile" onClick={() => setOpen((value) => !value)} aria-label="Abrir menú de usuario" aria-expanded={open}>
      <span className="portal-module-avatar" aria-hidden="true">{initials || 'U'}</span>
      <span className="portal-account-identity"><strong>{name}</strong><small>{profile.role || 'Sesión activa'}</small></span>
      <span className="portal-account-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div className="portal-account-panel" role="menu">
      <a href="/?view=account" role="menuitem"><span aria-hidden="true">○</span>Perfil</a>
      {isAdministrator && <a href="/?view=brand-assets" role="menuitem"><span aria-hidden="true">◆</span>Recursos de marca</a>}
      {isAdministrator && <a href="/?view=control-center" role="menuitem"><span aria-hidden="true">⚙</span>Centro de control</a>}
      <button type="button" className="portal-account-logout" onClick={logout} role="menuitem"><span aria-hidden="true">↪</span>Cerrar sesión</button>
    </div>}
  </div>;
}
