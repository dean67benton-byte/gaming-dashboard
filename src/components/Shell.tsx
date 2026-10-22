import Link from "next/link";
import { getSession } from "@/lib/session";
import { getProfile, isDemo } from "@/lib/steam";

// App frame: icon sidebar on desktop, a scrolling tab row on phones, and a top bar.

type NavItem = { href: string; label: string; icon: keyof typeof ICONS; soon?: boolean };

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/games/overwatch", label: "Overwatch", icon: "target" },
  { href: "#", label: "CS2", icon: "crosshair", soon: true },
  { href: "#", label: "Siege", icon: "shield", soon: true },
  { href: "#", label: "Friends", icon: "users", soon: true },
  { href: "#", label: "Deals", icon: "tag", soon: true },
];

const ICONS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  crosshair: "M12 3v5M12 16v5M3 12h5M16 12h5M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z",
  shield: "M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z",
  users: "M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 9v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 3.15a4 4 0 0 1 0 7.7",
  tag: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 8.5h.01",
};

function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={ICONS[name]} />
    </svg>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function Shell({ active, children }: { active: string; children: React.ReactNode }) {
  const demo = isDemo();
  const steamid = demo ? "demo" : await getSession();
  const profile = steamid ? await getProfile(steamid).catch(() => null) : null;
  const name = profile?.personaname ?? "player";

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] gap-4 p-3 md:p-5">
      <aside className="card sticky top-5 hidden h-[calc(100vh-2.5rem)] w-[72px] shrink-0 flex-col items-center gap-2 py-5 md:flex">
        <Link href="/" title="Home" className="mb-4 flex h-10 w-10 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-9 w-9" />
        </Link>
        {NAV.map((item) => (
          <NavLink key={item.label} item={item} active={active === item.label} />
        ))}
        {!demo && steamid && (
          <form action="/api/auth/logout" method="post" className="mt-auto">
            <button title="Sign out" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5">
                <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H3" />
              </svg>
            </button>
          </form>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        <header className="mb-4 flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted">{greeting()},</p>
            <h1 className="truncate text-xl font-semibold">{name}</h1>
          </div>
          {demo && <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">Demo data</span>}
          <div className="ml-auto">
            {profile?.avatarfull ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarfull} alt="" className="h-11 w-11 rounded-full ring-2 ring-accent/60" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 font-semibold text-muted ring-2 ring-accent/60">
                {name[0]?.toUpperCase()}
              </div>
            )}
          </div>
        </header>

        <nav className="no-scrollbar -mx-3 mb-4 flex gap-2 overflow-x-auto px-3 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-disabled={item.soon}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm ${
                active === item.label ? "bg-accent text-background" : item.soon ? "pointer-events-none bg-surface text-muted/60" : "bg-surface text-muted"
              }`}
            >
              <Icon name={item.icon} className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const base = "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors";
  const tip = (
    <span className="pointer-events-none absolute left-12 z-10 whitespace-nowrap rounded-md bg-surface-2 px-2 py-1 text-xs opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
      {item.label}
      {item.soon && " (soon)"}
    </span>
  );
  if (item.soon) {
    return (
      <span className={`${base} cursor-default text-muted/40`}>
        <Icon name={item.icon} />
        {tip}
      </span>
    );
  }
  return (
    <Link href={item.href} className={`${base} ${active ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-2 hover:text-foreground"}`}>
      {active && <span className="absolute -left-[15px] h-5 w-1 rounded-r bg-accent" />}
      <Icon name={item.icon} />
      {tip}
    </Link>
  );
}
