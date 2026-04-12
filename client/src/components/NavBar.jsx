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
    padding: '6px 8px',
    transition: 'color 0.15s',
  },
  label: {
    fontSize: 9,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
};

const INACTIVE = 'rgba(255,255,255,0.3)';
const ACTIVE_ICON = '#fff';
const ACTIVE_LABEL = '#D85A30';

function HomeIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function YogaIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="2" />
      <path d="M12 6v4" />
      <path d="M8 14l4-4 4 4" />
      <path d="M6 20l6-6 6 6" />
    </svg>
  );
}

function BreatheIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c-4-4-8-7.5-8-12a8 8 0 1116 0c0 4.5-4 8-8 12z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ProfileIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function Tab({ to, end, icon: Icon, label }) {
  return (
    <NavLink to={to} end={end} style={s.tab}>
      {({ isActive }) => (
        <>
          <Icon color={isActive ? ACTIVE_ICON : INACTIVE} />
          <span style={{ ...s.label, color: isActive ? ACTIVE_LABEL : INACTIVE }}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

function StrengthIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11M6.5 17.5h11" />
      <rect x="2" y="5" width="4" height="14" rx="1" />
      <rect x="18" y="5" width="4" height="14" rx="1" />
      <line x1="12" y1="5" x2="12" y2="19" />
    </svg>
  );
}

export default function NavBar() {
  return (
    <nav style={s.nav}>
      <Tab to="/" end icon={HomeIcon} label="Home" />
      <Tab to="/strength" icon={StrengthIcon} label="Strength" />
      <Tab to="/yoga" icon={YogaIcon} label="Yoga" />
      <Tab to="/breathe" icon={BreatheIcon} label="Breathe" />
      <Tab to="/profile" icon={ProfileIcon} label="Profile" />
    </nav>
  );
}
