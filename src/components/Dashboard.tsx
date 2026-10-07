"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Icon from "@/components/Icon";
import { ago, firstName, host, initials, normUrl, todayStr } from "@/lib/util";
import {
  DEFAULT_SETTINGS,
  type BoardTab,
  type Comment,
  type Profile,
  type QuickLink,
  type ReportLink,
  type Settings,
  type Tab,
  type Task,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
function renderBody(text: string): React.ReactNode[] {
  const parts = text.split(/(@[\p{L}\p{N}_.]+)/gu);
  return parts.map((p, i) =>
    /^@[\p{L}\p{N}_.]+$/u.test(p) ? (
      <span key={i} className="mention">
        {p}
      </span>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    )
  );
}
function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

const TABS: [Tab, string][] = [
  ["weekly", "Weekly Goals"],
  ["socials", "Socials"],
  ["website", "Website"],
  ["performance", "Performance"],
  ["report", "Performance Report"],
];

type LinkModal = {
  kind: "link";
  target: "ql" | "cal" | "task" | "report-new" | "report-edit";
  key?: string;
  id?: string;
  hasText: boolean;
  title: string;
  sub?: string;
  label?: string;
  url?: string;
  canRemove?: boolean;
};
type NameModal = { kind: "name"; welcome: boolean; prefill: string };
type WeekModal = { kind: "week" };
type ModalState = LinkModal | NameModal | WeekModal | null;

/* ================================================================== */
export default function Dashboard({ user }: { user: User }) {
  const myId = user.uid;

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reportLinks, setReportLinks] = useState<ReportLink[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const isTeam = true; // no login — anyone with the link can edit
  const [ready, setReady] = useState(false);
  const [localName, setLocalName] = useState("");

  const [activeTab, setActiveTab] = useState<Tab>("weekly");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState("");

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatStick = useRef(true);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const welcomedRef = useRef(false);

  const myName = profiles[myId]?.displayName || localName || "";

  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }, []);

  /* ---- ensure a profile row exists (holds the display name) ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pref = doc(db, "profiles", myId);
        const psnap = await getDoc(pref);
        if (!cancelled && !psnap.exists()) {
          await setDoc(pref, { displayName: "", createdAt: Date.now() });
        }
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myId]);

  /* ---- realtime subscriptions ---- */
  useEffect(() => {
    const unsubs = [
      onSnapshot(doc(db, "settings", "main"), (s) => {
        setSettings(
          s.exists() ? ({ ...DEFAULT_SETTINGS, ...s.data() } as Settings) : DEFAULT_SETTINGS
        );
        setReady(true);
      }),
      onSnapshot(collection(db, "quickLinks"), (s) =>
        setQuickLinks(s.docs.map((d) => d.data() as QuickLink))
      ),
      onSnapshot(collection(db, "tasks"), (s) =>
        setTasks(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Task))
      ),
      onSnapshot(collection(db, "reportLinks"), (s) =>
        setReportLinks(
          s.docs.map((d) => ({ id: d.id, ...d.data() }) as ReportLink)
        )
      ),
      onSnapshot(collection(db, "comments"), (s) => {
        setComments(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment));
      }),
      onSnapshot(collection(db, "profiles"), (s) => {
        const m: Record<string, Profile> = {};
        s.docs.forEach((d) => (m[d.id] = { id: d.id, ...d.data() } as Profile));
        setProfiles(m);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  /* ---- welcome prompt ---- */
  useEffect(() => {
    if (!ready || welcomedRef.current) return;
    welcomedRef.current = true;
    let welcomed = false;
    try {
      welcomed = !!localStorage.getItem("thswtch-welcomed");
    } catch {}
    if (!welcomed) {
      const prefill = profiles[myId]?.displayName || "";
      setModal({ kind: "name", welcome: true, prefill });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /* ---- theme ---- */
  useEffect(() => {
    try {
      const t = localStorage.getItem("thswtch-theme");
      if (t) document.documentElement.setAttribute("data-theme", t);
    } catch {}
  }, []);
  const toggleTheme = () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const sysDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme:dark)").matches;
    const next =
      cur === "dark" ? "light" : cur === "light" ? "dark" : sysDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("thswtch-theme", next);
    } catch {}
  };

  /* ---- chat auto-scroll ---- */
  useEffect(() => {
    const sc = chatRef.current;
    if (sc && chatStick.current) sc.scrollTop = sc.scrollHeight;
  });

  /* ---- derived ---- */
  const nameOf = useCallback(
    (id: string) =>
      profiles[id]?.displayName || (id === myId ? myName || "You" : "Teammate"),
    [profiles, myId, myName]
  );
  const quick = (key: string): QuickLink =>
    quickLinks.find((q) => q.key === key) || {
      key: key as QuickLink["key"],
      label: QL_LABELS[key] || key,
      url: "",
    };
  const tabTasks = (tab: BoardTab) =>
    tasks
      .filter((t) => t.tab === tab)
      .sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);
  const openCount = (tab: Tab): number =>
    tab === "report"
      ? reportLinks.length
      : tabTasks(tab as BoardTab).filter((t) => !t.done).length;
  const tabComments = (tab: Tab) =>
    comments.filter((c) => c.tab === tab).sort((a, b) => a.createdAt - b.createdAt);
  const participants = () => {
    const seen: Record<string, boolean> = {};
    const out: { id: string; name: string }[] = [];
    Object.keys(profiles).forEach((id) => {
      if (id !== myId && !seen[id] && profiles[id].displayName) {
        seen[id] = true;
        out.push({ id, name: profiles[id].displayName! });
      }
    });
    return out.slice(0, 8);
  };

  /* ---- writes ---- */
  async function teamWrite(op: () => Promise<void>, errMsg: string) {
    if (!isTeam) return;
    try {
      await op();
    } catch {
      showToast(errMsg);
    }
  }

  const toggleTask = (t: Task) => {
    chatStick.current = false;
    teamWrite(
      () => updateDoc(doc(db, "tasks", t.id), { done: !t.done }),
      "Couldn't update that task."
    );
  };
  const addTask = (tab: BoardTab, body: string) => {
    body = body.trim();
    if (!body) return;
    const id = uid();
    const pos = Math.max(0, ...tabTasks(tab).map((t) => t.position)) + 1;
    teamWrite(
      () =>
        setDoc(doc(db, "tasks", id), {
          tab,
          body,
          done: false,
          url: "",
          position: pos,
          createdAt: Date.now(),
          createdBy: myId,
        }),
      "Couldn't add that task."
    );
  };
  const commitTaskBody = (t: Task, body: string) => {
    body = body.replace(/\s+$/, "");
    if (body === t.body) return;
    teamWrite(
      () => updateDoc(doc(db, "tasks", t.id), { body }),
      "Couldn't save that change."
    );
  };
  const deleteTask = (t: Task) =>
    teamWrite(
      () => deleteDoc(doc(db, "tasks", t.id)),
      "Couldn't delete that task."
    );
  const clearCompleted = (tab: BoardTab) => {
    const done = tasks.filter((t) => t.tab === tab && t.done);
    teamWrite(
      () => Promise.all(done.map((t) => deleteDoc(doc(db, "tasks", t.id)))).then(() => {}),
      "Couldn't clear completed."
    );
  };
  const saveSettings = (patch: Partial<Settings>) =>
    teamWrite(
      () => setDoc(doc(db, "settings", "main"), patch, { merge: true }),
      "Couldn't save."
    );
  const saveQuickLink = (key: string, label: string, url: string) =>
    teamWrite(
      () => setDoc(doc(db, "quickLinks", key), { key, label, url }, { merge: true }),
      "Couldn't save the link."
    );
  const addReport = (label: string, url: string) => {
    const id = uid();
    const pos = Math.max(0, ...reportLinks.map((r) => r.position)) + 1;
    teamWrite(
      () =>
        setDoc(doc(db, "reportLinks", id), {
          label: label || host(url),
          url,
          position: pos,
          createdAt: Date.now(),
        }),
      "Couldn't add the report."
    );
  };
  const editReport = (id: string, label: string, url: string) =>
    teamWrite(
      () =>
        updateDoc(doc(db, "reportLinks", id), { label: label || host(url), url }),
      "Couldn't save the report."
    );
  const deleteReport = (id: string) =>
    teamWrite(
      () => deleteDoc(doc(db, "reportLinks", id)),
      "Couldn't delete the report."
    );

  const postComment = async (tab: Tab, body: string) => {
    body = body.trim();
    if (!body) return;
    const id = uid();
    chatStick.current = true;
    setDrafts((d) => ({ ...d, [tab]: "" }));
    try {
      await setDoc(doc(db, "comments", id), {
        tab,
        authorId: myId,
        body,
        createdAt: Date.now(),
      });
    } catch {
      showToast("Couldn't send your message.");
    }
  };
  const deleteComment = async (c: Comment) => {
    try {
      await deleteDoc(doc(db, "comments", c.id));
    } catch {
      showToast("Couldn't delete that message.");
    }
  };

  const saveName = async (name: string) => {
    name = name.trim();
    if (!name) return;
    setLocalName(name);
    try {
      localStorage.setItem("thswtch-welcomed", "1");
    } catch {}
    try {
      await setDoc(doc(db, "profiles", myId), { displayName: name }, { merge: true });
    } catch {
      showToast("Couldn't save your name.");
    }
  };

  /* ---------------------------------------------------------------- */
  if (!ready) {
    return (
      <>
        <header className="hdr">
          <div className="hdr-in">
            <div className="brand">
              <img src="/thswtch-logo.png" alt="thswtch" />
              <span className="sub">Social HQ</span>
            </div>
            <div className="hdr-right">
              <span className="rolepill off">
                <span className="dot" />
                Connecting…
              </span>
            </div>
          </div>
        </header>
        <div className="wrap">
          <div className="rail">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="sk" style={{ height: 66 }} />
            ))}
          </div>
          <div className="sk" style={{ height: 84, marginTop: 20 }} />
          <div
            className="sk"
            style={{ height: 40, width: "70%", marginTop: 26 }}
          />
          <div
            style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 9 }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="sk" style={{ height: 50 }} />
            ))}
          </div>
        </div>
      </>
    );
  }

  const roleLabel = ["team sync", "Live"];

  return (
    <>
      <header className="hdr">
        <div className="hdr-in">
          <div className="brand">
            <img src="/thswtch-logo.png" alt="thswtch" />
            <span className="sub">Social HQ</span>
          </div>
          <div className="hdr-right">
            <div className="datebox">
              <div className="d">{todayStr()}</div>
              <div
                className="w"
                style={{ cursor: isTeam ? "pointer" : "default" }}
                onClick={() => isTeam && setModal({ kind: "week" })}
                title={isTeam ? "Edit week label" : ""}
              >
                {settings.weekLabel}
              </div>
            </div>
            {myName && (
              <span className="mechip">
                <span className="av sm">{initials(myName)}</span>
                <span className="nm">{firstName(myName)}</span>
                <button
                  className="namechg"
                  title="Change your name"
                  aria-label="Change your name"
                  onClick={() =>
                    setModal({ kind: "name", welcome: false, prefill: myName })
                  }
                >
                  <Icon n="pencil" />
                </button>
              </span>
            )}
            <span className={`rolepill ${roleLabel[0]}`} title={roleLabel[1]}>
              <span className="dot" />
              {roleLabel[1]}
            </span>
            <button
              className="icon-btn"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              <Icon n="moon" />
            </button>
          </div>
        </div>
      </header>

      <div className="wrap">
        <nav className="rail" aria-label="Quick links">
          {([
            ["calendar", "excel"],
            ["website", "web"],
            ["performance", "chart"],
            ["report", "report"],
          ] as [string, string][]).map(([key, icon]) => {
            const l = quick(key);
            const u = normUrl(l.url);
            const featured = key === "calendar";
            if (u) {
              return (
                <a
                  key={key}
                  className={`ql${featured ? " excel featured" : ""}`}
                  href={u}
                  target="_blank"
                  rel="noopener"
                >
                  <span className="gi">
                    <Icon n={icon} />
                  </span>
                  <span className="qt">
                    <span className="l">{l.label}</span>
                    <span className="u">{host(u)}</span>
                  </span>
                  {isTeam && (
                    <span
                      className="edit-dot"
                      title="Edit link"
                      onClick={(e) => {
                        e.preventDefault();
                        setModal({
                          kind: "link",
                          target: "ql",
                          key,
                          hasText: true,
                          title: l.label,
                          label: l.label,
                          url: l.url,
                          canRemove: !!l.url,
                          sub: "Pinned shortcut at the top of the dashboard.",
                        });
                      }}
                    >
                      <Icon n="pencil" />
                    </span>
                  )}
                </a>
              );
            }
            if (isTeam) {
              return (
                <button
                  key={key}
                  className="ql empty"
                  onClick={() =>
                    setModal({
                      kind: "link",
                      target: "ql",
                      key,
                      hasText: true,
                      title: l.label,
                      label: l.label,
                      url: l.url,
                      canRemove: false,
                      sub: "Pinned shortcut at the top of the dashboard.",
                    })
                  }
                >
                  <span className="gi">
                    <Icon n={icon} />
                  </span>
                  <span className="qt">
                    <span className="l">{l.label}</span>
                    <span className="u">Set link →</span>
                  </span>
                </button>
              );
            }
            return null;
          })}
        </nav>

        <section className="notes">
          <h2>
            <Icon n="spark" /> This week
          </h2>
          {isTeam ? (
            <AutoTextarea
              value={settings.notes}
              placeholder="Jot the focus, themes, or reminders for the week…"
              onChange={(v) => setSettings((s) => ({ ...s, notes: v }))}
              onCommit={(v) => saveSettings({ notes: v })}
            />
          ) : (
            <div className={`ro-note${settings.notes ? "" : " empty"}`}>
              {settings.notes || "No notes for this week yet."}
            </div>
          )}
        </section>

        <div className="tabs" role="tablist">
          {TABS.map(([k, name]) => {
            const n = openCount(k);
            return (
              <button
                key={k}
                className="tab"
                role="tab"
                aria-selected={activeTab === k}
                onClick={() => {
                  setActiveTab(k);
                  chatStick.current = true;
                }}
              >
                {name}
                {n > 0 && <span className="cnt">{n}</span>}
              </button>
            );
          })}
        </div>

        <div className="panel" key={activeTab}>
          {renderPanel()}
          {renderChat(activeTab)}
        </div>

        <div className="foot">
          <span>thswtch Social HQ</span>
          <span>
            {isTeam
              ? "You can edit · changes save automatically"
              : "Live dashboard · updates in real time"}
          </span>
        </div>
      </div>

      {modal && renderModal()}
      {toast && <div className="toast show">{toast}</div>}
    </>
  );

  /* ---------------------------------------------------------------- */
  function renderPanel() {
    if (activeTab === "weekly")
      return todoPanel("weekly", {
        title: "Weekly Goals",
        desc: `Your checklist for ${settings.weekLabel}. Reset it each week.`,
        ph: "Add a goal for this week…",
        links: false,
      });
    if (activeTab === "socials") return socialsPanel();
    if (activeTab === "website")
      return todoPanel("website", {
        title: "Website",
        desc: "Site tasks — attach a link to anything that needs a click.",
        ph: "Add a website task…",
        links: true,
      });
    if (activeTab === "performance")
      return todoPanel("performance", {
        title: "Performance",
        desc: "What to watch and act on — attach the dashboards you check.",
        ph: "Add a performance task…",
        links: true,
      });
    return reportPanel();
  }

  function todoList(tab: BoardTab, links: boolean) {
    const all = tabTasks(tab);
    const active = all.filter((t) => !t.done);
    const done = all.filter((t) => t.done);
    const rowOf = (t: Task) => (
      <TaskRow
        key={t.id}
        task={t}
        isTeam={isTeam}
        allowLink={links}
        onToggle={() => toggleTask(t)}
        onCommit={(b) => commitTaskBody(t, b)}
        onDelete={() => deleteTask(t)}
        onLink={() =>
          setModal({
            kind: "link",
            target: "task",
            id: t.id,
            hasText: false,
            title: "Attach a link",
            url: t.url,
            canRemove: !!t.url,
            sub: "Clicking the task's link opens it in a new tab.",
          })
        }
      />
    );
    return (
      <>
        {all.length === 0 ? (
          <div className="empty-s">
            <div className="ei">
              <Icon n="check" />
            </div>
            <p>
              <b>Nothing here yet.</b>
            </p>
            <p>
              {isTeam
                ? "Add your first item below."
                : "The team hasn't added anything here."}
            </p>
          </div>
        ) : active.length === 0 ? (
          <div className="allclear">
            <Icon n="check" /> All done for now — nice work.
          </div>
        ) : (
          <div className="list">{active.map(rowOf)}</div>
        )}
        {isTeam && <AddControl onAdd={(v) => addTask(tab, v)} phKey={tab} />}
        {done.length > 0 && (
          <div className="done-sec">
            <div className="done-head">
              <button
                className={`dh-toggle${collapsed[tab] ? " collapsed" : ""}`}
                onClick={() => setCollapsed((c) => ({ ...c, [tab]: !c[tab] }))}
              >
                <Icon n="chev" /> Completed{" "}
                <span className="cnt">{done.length}</span>
              </button>
              {isTeam && (
                <button className="clr" onClick={() => clearCompleted(tab)}>
                  Clear completed
                </button>
              )}
            </div>
            {!collapsed[tab] && (
              <div className="list done-list">{done.map(rowOf)}</div>
            )}
          </div>
        )}
      </>
    );
  }

  function todoPanel(
    tab: BoardTab,
    opt: { title: string; desc: string; ph: string; links: boolean }
  ) {
    return (
      <>
        <div className="panel-head">
          <h1 className="pt">{opt.title}</h1>
          <div className="pd">{opt.desc}</div>
        </div>
        <PhContext.Provider value={opt.ph}>
          {todoList(tab, opt.links)}
        </PhContext.Provider>
      </>
    );
  }

  function socialsPanel() {
    const u = normUrl(settings.socialsCalendarUrl);
    return (
      <>
        <div className="panel-head">
          <h1 className="pt">Socials</h1>
          <div className="pd">
            The content calendar is the source of truth for what goes live.
          </div>
        </div>
        <div className="feature">
          <span className="fi">
            <Icon n="excel" />
          </span>
          <div className="ft">
            <div className="l">
              {settings.socialsCalendarLabel || "Content Calendar"}
            </div>
            <div className="u">
              {u
                ? u
                : isTeam
                  ? "Paste the Excel / Sheets link so it opens in one click."
                  : "No calendar linked yet."}
            </div>
          </div>
          <div className="fa">
            {u && (
              <a className="btn primary" href={u} target="_blank" rel="noopener">
                Open calendar
              </a>
            )}
            {isTeam && (
              <button
                className={u ? "btn ghost" : "btn primary"}
                onClick={() =>
                  setModal({
                    kind: "link",
                    target: "cal",
                    hasText: true,
                    title: "Content calendar",
                    label: settings.socialsCalendarLabel,
                    url: settings.socialsCalendarUrl,
                    canRemove: !!settings.socialsCalendarUrl,
                    sub: "The Excel / Google Sheets content calendar link.",
                  })
                }
              >
                {u ? "Edit" : "Add link"}
              </button>
            )}
          </div>
        </div>
        <div className="subhead">Checklist</div>
        <PhContext.Provider value="Add a social task…">
          {todoList("socials", false)}
        </PhContext.Provider>
      </>
    );
  }

  function reportPanel() {
    const links = reportLinks.slice().sort((a, b) => a.position - b.position);
    return (
      <>
        <div className="panel-head">
          <h1 className="pt">Performance Report</h1>
          <div className="pd">
            Keep any report link handy — weekly, monthly, campaign.
          </div>
        </div>
        {links.length === 0 ? (
          <div className="empty-s">
            <div className="ei">
              <Icon n="report" />
            </div>
            <p>
              <b>No reports linked yet.</b>
            </p>
            <p>
              {isTeam
                ? "Add a report link below."
                : "The team hasn't added any reports."}
            </p>
          </div>
        ) : (
          <div className="list">
            {links.map((l) => {
              const u = normUrl(l.url);
              return (
                <a
                  key={l.id}
                  className="lrow"
                  href={u}
                  target="_blank"
                  rel="noopener"
                >
                  <span className="lg">
                    <Icon n="report" />
                  </span>
                  <span className="lc">
                    <span className="l">{l.label || host(u)}</span>
                    <span className="u">{host(u)}</span>
                  </span>
                  {isTeam ? (
                    <span className="row-acts">
                      <button
                        className="mini"
                        title="Edit"
                        onClick={(e) => {
                          e.preventDefault();
                          setModal({
                            kind: "link",
                            target: "report-edit",
                            id: l.id,
                            hasText: true,
                            title: "Edit report link",
                            label: l.label,
                            url: l.url,
                            canRemove: true,
                          });
                        }}
                      >
                        <Icon n="pencil" />
                      </button>
                      <button
                        className="mini del"
                        title="Delete"
                        onClick={(e) => {
                          e.preventDefault();
                          deleteReport(l.id);
                        }}
                      >
                        <Icon n="trash" />
                      </button>
                    </span>
                  ) : (
                    <span className="go">
                      <Icon n="ext" />
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        )}
        {isTeam && (
          <div
            className="add btnlike"
            onClick={() =>
              setModal({
                kind: "link",
                target: "report-new",
                hasText: true,
                title: "Add a report link",
                label: "",
                url: "",
                canRemove: false,
                sub: "A performance report to keep handy.",
              })
            }
          >
            <span>
              <Icon n="plus" />
            </span>
            <span className="lbl">Add a report link…</span>
            <span className="go-add" style={{ opacity: 1, pointerEvents: "none" }}>
              Add
            </span>
          </div>
        )}
      </>
    );
  }

  function renderChat(tab: Tab) {
    const all = tabComments(tab);
    const ppl = participants();
    const draft = drafts[tab] || "";
    let prev: Comment | null = null;
    return (
      <section className="chat">
        <h3>
          <Icon n="chat" /> Discussion
          {all.length > 0 && <span className="cnt">{all.length}</span>}
          <span className="livedot" title="Live" />
        </h3>
        <p className="sub">
          Live chat for {TABS.find((t) => t[0] === tab)?.[1]}. Everyone on the
          dashboard sees it in real time.
        </p>
        <div
          className="chat-scroll"
          ref={chatRef}
          onScroll={(e) => {
            const sc = e.currentTarget;
            chatStick.current =
              sc.scrollHeight - sc.scrollTop - sc.clientHeight < 60;
          }}
        >
          {all.length === 0 ? (
            <div className="chat-empty">
              <div className="ei">
                <Icon n="chat" />
              </div>
              Start the conversation — say hello or drop your feedback.
            </div>
          ) : (
            all.map((c) => {
              const first =
                !prev ||
                prev.authorId !== c.authorId ||
                c.createdAt - prev.createdAt > 600000;
              const mine = c.authorId === myId;
              prev = c;
              return (
                <div
                  key={c.id}
                  className={`msg ${mine ? "me" : "them"}${first ? " grp" : ""}`}
                >
                  {!mine && (
                    <div className={`av${first ? "" : " hid"}`}>
                      {initials(nameOf(c.authorId))}
                    </div>
                  )}
                  <div className="bub-wrap">
                    {first && (
                      <div className="sender">
                        {mine ? "You" : nameOf(c.authorId)}
                        <span className="t">{ago(c.createdAt)}</span>
                      </div>
                    )}
                    <div className="bubble">
                      {renderBody(c.body)}
                      {(mine || isTeam) && (
                        <button
                          className="bdel"
                          title="Delete"
                          aria-label="Delete"
                          onClick={() => deleteComment(c)}
                        >
                          <Icon n="trash" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <Composer
          key={tab}
          tab={tab}
          draft={draft}
          people={ppl}
          myName={myName}
          onChange={(v) => setDrafts((d) => ({ ...d, [tab]: v }))}
          onSend={(v) => postComment(tab, v)}
        />
      </section>
    );
  }

  function renderModal() {
    if (!modal) return null;
    const dismissible = !(modal.kind === "name" && modal.welcome);
    return (
      <div
        className="ov"
        onMouseDown={(e) => {
          if (dismissible && e.target === e.currentTarget) setModal(null);
        }}
      >
        <div className="modal" role="dialog" aria-modal="true">
          {modal.kind === "name" && (
            <NameModalBody
              welcome={modal.welcome}
              prefill={modal.prefill}
              onCancel={() => setModal(null)}
              onSave={(n) => {
                saveName(n);
                setModal(null);
              }}
            />
          )}
          {modal.kind === "week" && (
            <WeekModalBody
              value={settings.weekLabel}
              onCancel={() => setModal(null)}
              onSave={(v) => {
                saveSettings({ weekLabel: v });
                setModal(null);
              }}
            />
          )}
          {modal.kind === "link" && (
            <LinkModalBody
              modal={modal}
              onCancel={() => setModal(null)}
              onApply={(url, label) => {
                applyLink(modal, url, label);
                setModal(null);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  function applyLink(m: LinkModal, urlRaw: string, label: string) {
    const u = urlRaw.trim();
    if (m.target === "ql" && m.key)
      saveQuickLink(m.key, label.trim() || quick(m.key).label, u);
    else if (m.target === "cal")
      saveSettings({
        socialsCalendarUrl: u,
        socialsCalendarLabel: label.trim() || settings.socialsCalendarLabel,
      });
    else if (m.target === "task" && m.id)
      teamWrite(
        () => updateDoc(doc(db, "tasks", m.id!), { url: u }),
        "Couldn't save the link."
      );
    else if (m.target === "report-new") {
      if (u) addReport(label.trim(), u);
    } else if (m.target === "report-edit" && m.id)
      editReport(m.id, label.trim(), u);
  }
}

const QL_LABELS: Record<string, string> = {
  calendar: "Brand Calendar (Excel)",
  website: "Website",
  performance: "Performance",
  report: "Performance Report",
};

/* ================================================================== */
/* subcomponents                                                      */
/* ================================================================== */
const PhContext = React.createContext<string>("Add…");

function AddControl({
  onAdd,
  phKey,
}: {
  onAdd: (v: string) => void;
  phKey: string;
}) {
  const ph = React.useContext(PhContext);
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const submit = () => {
    if (!val.trim()) return;
    onAdd(val);
    setVal("");
    inputRef.current?.focus();
  };
  return (
    <div className={`add${val.trim() ? " ready" : ""}`} data-key={phKey}>
      <span>
        <Icon n="plus" />
      </span>
      <input
        ref={inputRef}
        type="text"
        placeholder={ph}
        value={val}
        aria-label={ph}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button className="go-add" onClick={submit}>
        Add
      </button>
    </div>
  );
}

function TaskRow({
  task,
  isTeam,
  allowLink,
  onToggle,
  onCommit,
  onDelete,
  onLink,
}: {
  task: Task;
  isTeam: boolean;
  allowLink: boolean;
  onToggle: () => void;
  onCommit: (body: string) => void;
  onDelete: () => void;
  onLink: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const u = normUrl(task.url);
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== task.body) {
      el.textContent = task.body;
    }
  }, [task.body]);
  return (
    <div className={`row${task.done ? " done" : ""}`}>
      <input
        type="checkbox"
        className="check"
        checked={task.done}
        disabled={!isTeam}
        onChange={onToggle}
        aria-label="Done"
      />
      <div className="rc">
        <div
          className="rt"
          ref={ref}
          contentEditable={isTeam}
          suppressContentEditableWarning
          data-ph="Task…"
          spellCheck={false}
          onBlur={(e) => onCommit(e.currentTarget.textContent || "")}
        >
          {task.body}
        </div>
        {u && (
          <a className="rlink" href={u} target="_blank" rel="noopener">
            <Icon n="link" />
            <span className="lt">{host(u)}</span>
            <Icon n="ext" />
          </a>
        )}
      </div>
      {isTeam && (
        <div className="row-acts">
          {allowLink && (
            <button
              className={`mini${u ? " has-link" : ""}`}
              title={u ? "Edit link" : "Add link"}
              onClick={onLink}
            >
              <Icon n="link" />
            </button>
          )}
          <button className="mini del" title="Delete" onClick={onDelete}>
            <Icon n="trash" />
          </button>
        </div>
      )}
    </div>
  );
}

function AutoTextarea({
  value,
  placeholder,
  onChange,
  onCommit,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onCommit(e.target.value)}
    />
  );
}

function Composer({
  tab,
  draft,
  people,
  myName,
  onChange,
  onSend,
}: {
  tab: Tab;
  draft: string;
  people: { id: string; name: string }[];
  myName: string;
  onChange: (v: string) => void;
  onSend: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [draft]);
  const tag = (name: string) => {
    const cur = draft;
    const next = (cur && !/\s$/.test(cur) ? cur + " " : cur) + "@" + name + " ";
    onChange(next);
    ref.current?.focus();
  };
  const tabName = TABS.find((t) => t[0] === tab)?.[1];
  return (
    <div className={`composer${draft.trim() ? " ready" : ""}`}>
      <div className="av">{initials(myName || "You")}</div>
      <div className="cf">
        <textarea
          ref={ref}
          value={draft}
          placeholder={`Message the team about ${tabName}… use @ to tag`}
          rows={1}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend(draft);
            }
          }}
        />
        {people.length > 0 && (
          <div className="tagrow">
            <span className="tl">Tag</span>
            {people.map((p) => (
              <button
                key={p.id}
                className="tagchip"
                onClick={() => tag(firstName(p.name))}
              >
                @{firstName(p.name)}
              </button>
            ))}
          </div>
        )}
        <div className="cbar">
          <span className="hint">Enter to send · Shift+Enter for a new line</span>
          <button className="send" onClick={() => onSend(draft)}>
            <Icon n="send" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function NameModalBody({
  welcome,
  prefill,
  onCancel,
  onSave,
}: {
  welcome: boolean;
  prefill: string;
  onCancel: () => void;
  onSave: (n: string) => void;
}) {
  const [val, setVal] = useState(prefill);
  const [err, setErr] = useState("");
  const submit = () => {
    if (!val.trim()) {
      setErr("Please add your name.");
      return;
    }
    onSave(val);
  };
  return (
    <>
      <h3>{welcome ? "Welcome to thswtch Social HQ" : "Your name"}</h3>
      <p className="mh-sub">
        {welcome
          ? "Add your name so the team knows who left each comment. We’ll remember you on this device."
          : "Update how your name shows on comments."}
      </p>
      <div className="field">
        <label htmlFor="m-name">Your name</label>
        <input
          id="m-name"
          autoFocus
          value={val}
          maxLength={40}
          placeholder="e.g. Divya"
          autoComplete="name"
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        {err && <div className="err">{err}</div>}
      </div>
      <div className="modal-acts">
        {!welcome && (
          <button className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="btn primary" onClick={submit}>
          {welcome ? "Continue" : "Save"}
        </button>
      </div>
    </>
  );
}

function WeekModalBody({
  value,
  onCancel,
  onSave,
}: {
  value: string;
  onCancel: () => void;
  onSave: (v: string) => void;
}) {
  const [val, setVal] = useState(value);
  return (
    <>
      <h3>Week label</h3>
      <p className="mh-sub">Shown next to today&apos;s date.</p>
      <div className="field">
        <label htmlFor="m-week">Label</label>
        <input
          id="m-week"
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && val.trim()) onSave(val.trim());
          }}
        />
      </div>
      <div className="modal-acts">
        <button className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn primary"
          onClick={() => val.trim() && onSave(val.trim())}
        >
          Save
        </button>
      </div>
    </>
  );
}

function LinkModalBody({
  modal,
  onCancel,
  onApply,
}: {
  modal: LinkModal;
  onCancel: () => void;
  onApply: (url: string, label: string) => void;
}) {
  const [url, setUrl] = useState(modal.url || "");
  const [label, setLabel] = useState(modal.label || "");
  const [err, setErr] = useState("");
  const save = () => {
    if (modal.hasText && url.trim() && !label.trim()) {
      setErr("Give it a label.");
      return;
    }
    onApply(url, label);
  };
  return (
    <>
      <h3>{modal.title}</h3>
      <p className="mh-sub">{modal.sub || "Opens in a new tab when clicked."}</p>
      {modal.hasText && (
        <div className="field">
          <label htmlFor="m-label">Label</label>
          <input
            id="m-label"
            autoFocus
            value={label}
            placeholder="What is this?"
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
      )}
      <div className="field">
        <label htmlFor="m-url">Link URL</label>
        <input
          id="m-url"
          value={url}
          placeholder="https://…"
          inputMode="url"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
        {err && <div className="err">{err}</div>}
      </div>
      <div className="modal-acts">
        {modal.canRemove && (
          <button className="btn danger" onClick={() => onApply("", "")}>
            Remove
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" onClick={save}>
          Save
        </button>
      </div>
    </>
  );
}
