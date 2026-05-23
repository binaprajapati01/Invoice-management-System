import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { useAuth } from "../../state/AuthContext.jsx";
import { useTheme } from "../../state/ThemeContext.jsx";
import api from "../../lib/api.js";

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/search", { params: { q: query } });
        setResults(data);
        setSearchOpen(true);
      } catch (_error) {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const loadNotifications = async () => {
    try {
      const { data } = await api.get("/search/notifications");
      setNotifications(data);
      setNotificationsOpen((value) => !value);
    } catch (_error) {
      setNotifications([]);
      setNotificationsOpen((value) => !value);
    }
  };

  const goTo = (href) => {
    setSearchOpen(false);
    setNotificationsOpen(false);
    setQuery("");
    navigate(href);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-slate-50/80 px-4 py-4 backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-950/70 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3">
        <button className="secondary-btn px-3 lg:hidden" onClick={onMenuClick} aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
        <div className="relative min-w-0 flex-1" ref={searchRef}>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input className="premium-input pl-12" value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoices, clients, users..." />
          {searchOpen && query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-40 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950">
              {results.length ? results.map((result) => (
                <button key={`${result.type}-${result.id}`} className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900" onClick={() => goTo(result.href)}>
                  <span><span className="text-xs font-bold uppercase tracking-wide text-blue-600">{result.type}</span><span className="block text-sm font-bold">{result.title}</span><span className="block text-xs text-slate-500">{result.subtitle}</span></span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800">{result.meta}</span>
                </button>
              )) : <p className="px-4 py-5 text-sm text-slate-500">No matching records found.</p>}
            </div>
          )}
        </div>
        <button className="secondary-btn px-3" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <div className="relative">
          <button className="secondary-btn px-3" onClick={loadNotifications} aria-label="Notifications"><Bell className="h-5 w-5" /></button>
          {notificationsOpen && (
            <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800"><p className="text-sm font-black">Notifications</p></div>
              {notifications.length ? notifications.map((item) => (
                <button key={item.id} className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900" onClick={() => goTo(item.href)}>
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.body}</p>
                </button>
              )) : <p className="px-4 py-6 text-sm text-slate-500">No notifications right now.</p>}
            </div>
          )}
        </div>
        <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-sm font-bold text-white">
            {user?.name?.slice(0, 1)}
          </div>
          <div>
            <p className="text-sm font-bold">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.role}</p>
          </div>
        </div>
        <button className="secondary-btn px-3" onClick={logout} aria-label="Sign out"><LogOut className="h-5 w-5" /></button>
      </div>
    </header>
  );
}
