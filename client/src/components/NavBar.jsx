import { NavLink } from 'react-router-dom';

const s = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 56,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    background: '#0a0f1c',
    borderTop: '0.5px solid rgba(255,255,255,0.06)',
    zIndex: 100,
  },
  tab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    textDecoration: 'none',
    padding: '6px 12px',
    transition: 'color 0.15s',
  },
  label: {
    fontSize: 10,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
};

const INACTIVE = 'rgba(255,255,255,0.3)';
const ACTIVE_ICON = '#fff';
const ACTIVE_LABEL = '#D85A30';
const DISABLED = 'rgba(255,255,255,0.15)';

function DumbbellIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11M6.5 17.5h11" />
      <rect x="2" y="5" width="4" height="14" rx="1" />
      <rect x="18" y="5" width="4" height="14" rx="1" />
      <line x1="12" y1="5" x2="12" y2="19" />
    </svg>
  );
}

function ChecklistIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function BookIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function ChartIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export default function NavBar() {
  return (
    <nav style={s.nav}>
      <NavLink to="/" end style={s.tab}>
        {({ isActive }) => (
          <>
            <DumbbellIcon color={isActive ? ACTIVE_ICON : INACTIVE} />
            <span style={{ ...s.label, color: isActive ? ACTIVE_LABEL : INACTIVE }}>Workout</span>
          </>
        )}
      </NavLink>
      <NavLink to="/habits" style={s.tab}>
        {({ isActive }) => (
          <>
            <ChecklistIcon color={isActive ? ACTIVE_ICON : INACTIVE} />
            <span style={{ ...s.label, color: isActive ? ACTIVE_LABEL : INACTIVE }}>Habits</span>
          </>
        )}
      </NavLink>
      <div style={{ ...s.tab, cursor: 'default' }}>
        <BookIcon color={DISABLED} />
        <span style={{ ...s.label, color: DISABLED }}>Library</span>
      </div>
      <div style={{ ...s.tab, cursor: 'default' }}>
        <ChartIcon color={DISABLED} />
        <span style={{ ...s.label, color: DISABLED }}>Stats</span>
      </div>
    </nav>
  );
}
