export function normUrl(u: string): string {
  u = (u || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (/^(mailto:|tel:)/i.test(u)) return u;
  return "https://" + u.replace(/^\/+/, "");
}

export function host(u: string): string {
  try {
    return new URL(normUrl(u)).host.replace(/^www\./, "");
  } catch {
    return u;
  }
}

export function initials(n: string): string {
  n = (n || "").trim();
  if (!n) return "•";
  const p = n.split(/\s+/);
  return (p[0][0] + (p[1] ? p[1][0] : "")).toUpperCase();
}

export function firstName(n: string): string {
  return (n || "").trim().split(/\s+/)[0] || n;
}

export function ago(ts: string | number): string {
  const t = typeof ts === "string" ? new Date(ts).getTime() : ts;
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  if (d < 7) return d + "d ago";
  return new Date(t).toLocaleDateString();
}

export function todayStr(): string {
  const d = new Date();
  const days = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ];
  const mo = [
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${mo[d.getMonth()]} ${d.getFullYear()}`;
}

export function weekRange(d = new Date()): string {
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((day + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const mo = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const b =
    (mon.getMonth() === sun.getMonth() ? "" : mo[sun.getMonth()] + " ") +
    sun.getDate();
  return `Week of ${mo[mon.getMonth()]} ${mon.getDate()} – ${b}`;
}
