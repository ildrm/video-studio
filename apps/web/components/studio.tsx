"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clapperboard, Film, FolderOpen, LoaderCircle, LogOut, Plus, Search, Archive, Copy, Pencil, RotateCcw, Sparkles, Video } from "lucide-react";
import { ApiError, type Canvas, type Page, type Project, type Revision, type Session, type Workspace, request } from "@/lib/api";
import Editor from "@/components/editor";
import { MutationJournal, projectListPath } from "@/lib/project-actions";
import { clearRecoveryForUser } from "@/lib/recovery";

type Aspect = "portrait" | "landscape" | "square";
const canvases: Record<Aspect, Canvas> = {
  portrait: { width: 1080, height: 1920, frameRate: { num: 30, den: 1 }, backgroundColor: "#000000ff", workingColorSpace: "rec709-sdr" },
  landscape: { width: 1920, height: 1080, frameRate: { num: 30, den: 1 }, backgroundColor: "#000000ff", workingColorSpace: "rec709-sdr" },
  square: { width: 1080, height: 1080, frameRate: { num: 30, den: 1 }, backgroundColor: "#000000ff", workingColorSpace: "rec709-sdr" },
};
const message = (e: unknown) => e instanceof Error ? e.message : "Something went wrong. Please try again.";

function Logo() { return <div className="brand"><span className="brand-mark"><Clapperboard size={17}/></span><span>frame<span className="brand-light">studio</span></span></div>; }
function Auth({ onSession, initialError = "" }: { onSession: (session: Session) => void; initialError?: string }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [error, setError] = useState(initialError); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try { const result = await request<Session>(`/auth/${mode}`, { method: "POST", body: JSON.stringify({ email, password, ...(mode === "register" ? { displayName: name } : {}) }) }); onSession(result.data); }
    catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <main className="auth-layout">
    <section className="auth-story"><Logo/><div className="auth-copy"><div className="eyebrow"><span className="eyebrow-dot"/> YOUR CREATIVE WORKSPACE</div><h1>Make something<br/><em>worth watching.</em></h1><p>Bring your footage together, find the story, and make it yours.</p></div><div className="auth-decoration" aria-hidden="true"><div className="deco-top"><span>YOUR NEXT STORY</span><span>00:00:00</span></div><div className="deco-view"><span className="deco-play">▶</span></div><div className="deco-timeline"><i/><i/><i/><i/><i/><i/><i/><i/></div><div className="deco-bottom"><span>CREATE AT YOUR OWN PACE</span><span>✳</span></div></div><p className="auth-footer">Your ideas, all in one place.</p></section>
    <section className="auth-form-wrap"><div className="auth-mobile-brand"><Logo/></div><div className="auth-panel"><div className="auth-kicker">WELCOME TO FRAME</div><h2>{mode === "login" ? "Welcome back." : "Let's get started."}</h2><p>{mode === "login" ? "Sign in to pick up where you left off." : "Create an account to start making."}</p><form onSubmit={submit} className="auth-form">
      {mode === "register" && <label>Display name<input disabled={busy} required autoComplete="name" maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}
      <label>Email address<input disabled={busy} maxLength={254} required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
      <label>Password<input disabled={busy} maxLength={256} required type="password" minLength={12} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode === "register" ? "At least 12 characters" : "Enter your password"}/></label>
      {error && <p role="alert" className="error-message">{error}</p>}
      <button className="button primary full" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin"/> : <>{mode === "login" ? "Sign in" : "Create account"}<ArrowRight size={16}/></>}</button>
    </form><div className="auth-switch">{mode === "login" ? "New around here?" : "Already have an account?"} <button disabled={busy} className="text-button" onClick={()=>{setMode(mode === "login" ? "register" : "login");setError("");}}>{mode === "login" ? "Create an account" : "Sign in"}</button></div><div className="auth-note">Your projects are private to your workspace.</div></div></section>
  </main>;
}

type ProjectAction = { kind: "rename" | "duplicate" | "archive" | "restore"; project: Project };

export default function Studio() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [checking, setChecking] = useState(true);
  const [authNotice, setAuthNotice] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceCursor, setWorkspaceCursor] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectCursor, setProjectCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newProject, setNewProject] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState(false);
  const [projectAction, setProjectAction] = useState<ProjectAction | null>(null);
  const [actionName, setActionName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [aspect, setAspect] = useState<Aspect>("portrait");
  const [archived, setArchived] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalOpener = useRef<HTMLElement | null>(null);
  const activeFilter = useRef<HTMLButtonElement>(null), archivedFilter = useRef<HTMLButtonElement>(null);
  const workspaceButton = useRef<HTMLButtonElement>(null);
  const mutations = useRef(new MutationJournal());
  // Invalidate responses before a changed account, workspace or filter renders.
  const accountEpoch = useRef(0), workspaceEpoch = useRef(0), workspaceListEpoch = useRef(0);
  const projectListEpoch = useRef(0), projectOpenEpoch = useRef(0);
  const selectedWorkspace = useRef<Workspace | null>(null);
  const sessionUserId = session?.user.id, workspaceId = workspace?.id;
  const dialogOpen = newProject || newWorkspace || !!projectAction;

  const applySession = useCallback((next: Session | null, authMessage = "") => {
    accountEpoch.current++; workspaceEpoch.current++; workspaceListEpoch.current++;
    projectListEpoch.current++; projectOpenEpoch.current++; mutations.current.clear();
    selectedWorkspace.current = null;
    setWorkspaces([]); setWorkspaceCursor(null); setWorkspace(null); setProjects([]); setProjectCursor(null);
    setProject(null); setRevision(null); setEtag(null); setLoading(false); setLoadingMore(false);
    setSaving(false); setError(""); setNotice(""); setNewProject(false); setNewWorkspace(false); setProjectAction(null);
    setProjectName(""); setWorkspaceName(""); setAspect("portrait"); setArchived(false);
    setSearchInput(""); setSearchQuery(""); setAuthNotice(authMessage); setSession(next);
    setSessionEpoch(epoch => epoch + 1);
  }, []);

  const switchWorkspace = useCallback((next: Workspace | null) => {
    if (selectedWorkspace.current?.id === next?.id) return;
    workspaceEpoch.current++; projectListEpoch.current++; projectOpenEpoch.current++;
    selectedWorkspace.current = next;
    setProjects([]); setProjectCursor(null); setProject(null); setRevision(null); setEtag(null);
    setLoading(!!next); setLoadingMore(false); setSaving(false); setError(""); setNotice("");
    setNewProject(false); setProjectAction(null); setArchived(false); setSearchInput(""); setSearchQuery(""); setWorkspace(next);
  }, []);

  const showRequestError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) applySession(null, "Your session expired. Please sign in again.");
    else setError(message(err));
  }, [applySession]);

  function closeDialog() {
    if (saving) return;
    setNewProject(false); setNewWorkspace(false); setProjectAction(null); setError("");
  }
  function openDialog(event: React.MouseEvent<HTMLButtonElement>, kind: "project" | "workspace") {
    modalOpener.current = event.currentTarget; setError("");
    if (kind === "project") setNewProject(true); else setNewWorkspace(true);
  }
  function beginAction(event: React.MouseEvent<HTMLButtonElement>, item: Project, kind: ProjectAction["kind"]) {
    modalOpener.current = event.currentTarget; setError("");
    setActionName(kind === "duplicate" ? `${item.name} copy`.slice(0, 200) : item.name);
    setProjectAction({ kind, project: item });
  }

  useEffect(() => {
    if (!dialogOpen) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!saving) { setNewProject(false); setNewWorkspace(false); setProjectAction(null); setError(""); }
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const elements = Array.from(modalRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      const first = elements[0], last = elements.at(-1);
      if (!first || !last) { event.preventDefault(); modalRef.current.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handle);
    return () => { document.removeEventListener("keydown", handle); };
  }, [dialogOpen, saving]);
  useEffect(() => {
    if (dialogOpen) (modalRef.current?.querySelector<HTMLElement>("input") || modalRef.current?.querySelector<HTMLElement>("button"))?.focus();
    else if (modalOpener.current?.isConnected) modalOpener.current.focus();
    else ((archived ? archivedFilter.current : activeFilter.current) || workspaceButton.current)?.focus();
  }, [dialogOpen]);

  useEffect(() => {
    const controller = new AbortController(); let active = true;
    request<Session>("/session", { signal: controller.signal }).then(result => { if (active) applySession(result.data); })
      .catch(err => { if (active && !(err instanceof ApiError && err.status === 401)) setAuthNotice("Could not check your session. Please try signing in when the service is available."); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; controller.abort(); };
  }, [applySession]);

  const loadWorkspaces = useCallback(async () => {
    if (!sessionUserId) return;
    const account = accountEpoch.current, seq = ++workspaceListEpoch.current;
    const active = () => account === accountEpoch.current && seq === workspaceListEpoch.current;
    try {
      const result = await request<Page<Workspace>>("/workspaces?limit=100");
      if (!active()) return;
      setWorkspaces(result.data.items); setWorkspaceCursor(result.data.nextCursor);
      const current = selectedWorkspace.current;
      switchWorkspace(result.data.items.find(item => item.id === current?.id) || result.data.items[0] || null);
    } catch (err) { if (active()) showRequestError(err); }
  }, [sessionUserId, sessionEpoch, switchWorkspace, showRequestError]);
  useEffect(() => { void loadWorkspaces(); }, [loadWorkspaces]);

  const loadProjects = useCallback(async () => {
    if (!sessionUserId || !workspaceId) return;
    const account = accountEpoch.current, scope = workspaceEpoch.current, seq = ++projectListEpoch.current;
    const active = () => account === accountEpoch.current && scope === workspaceEpoch.current && seq === projectListEpoch.current;
    setLoading(true); setError("");
    try {
      const result = await request<Page<Project>>(projectListPath(workspaceId, archived, searchQuery));
      if (active()) { setProjects(result.data.items); setProjectCursor(result.data.nextCursor); }
    } catch (err) { if (active()) showRequestError(err); }
    finally { if (active()) setLoading(false); }
  }, [sessionUserId, workspaceId, archived, searchQuery, showRequestError]);
  useEffect(() => { void loadProjects(); }, [loadProjects]);

  async function moreWorkspaces() {
    if (!workspaceCursor || loadingMore) return;
    const account = accountEpoch.current, seq = workspaceListEpoch.current;
    const active = () => account === accountEpoch.current && seq === workspaceListEpoch.current;
    setLoadingMore(true);
    try {
      const result = await request<Page<Workspace>>(`/workspaces?limit=100&cursor=${encodeURIComponent(workspaceCursor)}`);
      if (active()) { setWorkspaces(items => [...items, ...result.data.items]); setWorkspaceCursor(result.data.nextCursor); }
    } catch (err) { if (active()) showRequestError(err); }
    finally { if (active()) setLoadingMore(false); }
  }
  async function moreProjects() {
    if (!workspace || !projectCursor || loadingMore) return;
    const account = accountEpoch.current, scope = workspaceEpoch.current, seq = projectListEpoch.current;
    const active = () => account === accountEpoch.current && scope === workspaceEpoch.current && seq === projectListEpoch.current;
    setLoadingMore(true);
    try {
      const result = await request<Page<Project>>(projectListPath(workspace.id, archived, searchQuery, projectCursor));
      if (active()) { setProjects(items => [...items, ...result.data.items]); setProjectCursor(result.data.nextCursor); }
    } catch (err) { if (active()) showRequestError(err); }
    finally { if (active()) setLoadingMore(false); }
  }
  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault(); if (!session || !workspaceName.trim() || saving) return;
    const account = accountEpoch.current, active = () => account === accountEpoch.current;
    setSaving(true); setError("");
    try {
      const result = await mutations.current.execute<Workspace>("create-workspace", { path: "/workspaces", method: "POST", body: { name: workspaceName.trim() } }, session.csrfToken);
      if (!active()) return;
      workspaceListEpoch.current++; setWorkspaces(items => [...items, result.data]);
      switchWorkspace(result.data); setWorkspaceName(""); setNewWorkspace(false);
    } catch (err) { if (active()) showRequestError(err); }
    finally { if (active()) setSaving(false); }
  }
  async function createProject(event: React.FormEvent) {
    event.preventDefault(); if (!session || !workspace || !projectName.trim() || saving) return;
    const account = accountEpoch.current, scope = workspaceEpoch.current;
    const active = () => account === accountEpoch.current && scope === workspaceEpoch.current;
    setSaving(true); setError("");
    try {
      const result = await mutations.current.execute<Project>("create-project", { path: `/workspaces/${workspace.id}/projects`, method: "POST", body: { name: projectName.trim(), canvas: canvases[aspect] } }, session.csrfToken);
      if (!active()) return;
      setNewProject(false); setProjectName(""); setArchived(false); setSearchInput(""); setSearchQuery("");
      setProjects(items => [result.data, ...items.filter(item => item.id !== result.data.id)]);
      await openProject(result.data);
    } catch (err) { if (active()) showRequestError(err); }
    finally { if (active()) setSaving(false); }
  }
  async function performProjectAction(event: React.FormEvent) {
    event.preventDefault(); if (!session || !workspace || !projectAction || saving) return;
    const action = projectAction;
    if ((action.kind === "rename" || action.kind === "duplicate") && !actionName.trim()) return;
    const account = accountEpoch.current, scope = workspaceEpoch.current;
    const active = () => account === accountEpoch.current && scope === workspaceEpoch.current;
    const base = `/workspaces/${workspace.id}/projects/${action.project.id}`;
    setSaving(true); setError("");
    try {
      await mutations.current.execute<Project>(`project-${action.kind}-${action.project.id}`, {
        path: action.kind === "duplicate" ? `${base}/duplicate` : base,
        method: action.kind === "duplicate" ? "POST" : "PATCH",
        body: action.kind === "rename" || action.kind === "duplicate" ? { name: actionName.trim() } : { archived: action.kind === "archive" },
      }, session.csrfToken);
      if (!active()) return;
      setProjectAction(null);
      setNotice(action.kind === "archive" ? "Project archived. You can restore it from Archived projects." : action.kind === "restore" ? "Project restored to Active projects." : action.kind === "duplicate" ? "Project copied with its saved edits and media references." : "Project renamed.");
      await loadProjects();
    } catch (err) { if (active()) showRequestError(err); }
    finally { if (active()) setSaving(false); }
  }
  async function openProject(item: Project) {
    if (!workspace) return;
    const account = accountEpoch.current, scope = workspaceEpoch.current, seq = ++projectOpenEpoch.current;
    projectListEpoch.current++; workspaceListEpoch.current++; setLoadingMore(false);
    const active = () => account === accountEpoch.current && scope === workspaceEpoch.current && seq === projectOpenEpoch.current;
    setLoading(true); setError("");
    try {
      const result = await request<Revision>(`/workspaces/${workspace.id}/projects/${item.id}/revision`);
      if (active()) { setProject(item); setRevision(result.data); setEtag(result.etag || `"rev-${result.data.revision}"`); }
    } catch (err) { if (active()) showRequestError(err); }
    finally { if (active()) setLoading(false); }
  }
  async function logout() {
    if (!session) return;
    const account = accountEpoch.current;
    try { await request("/session", { method: "DELETE" }, session.csrfToken); if (account === accountEpoch.current) { clearRecoveryForUser(session.user.id); applySession(null); } }
    catch (err) { if (account === accountEpoch.current) { if (err instanceof ApiError && err.status === 401) clearRecoveryForUser(session.user.id); showRequestError(err); } }
  }
  function changeArchiveView(value: boolean) {
    if (value === archived) return;
    projectListEpoch.current++; projectOpenEpoch.current++;
    setProjects([]); setProjectCursor(null); setLoading(true); setLoadingMore(false); setNotice(""); setArchived(value);
  }
  function searchProjects(event: React.FormEvent) {
    event.preventDefault(); const query = searchInput.trim();
    projectOpenEpoch.current++;
    if (query === searchQuery) { void loadProjects(); return; }
    projectListEpoch.current++; setLoading(true); setLoadingMore(false); setSearchQuery(query);
  }

  if (checking) return <main className="startup" aria-label="Loading workspace"><Logo/><LoaderCircle className="spin" size={20}/></main>;
  if (!session) return <Auth onSession={applySession} initialError={authNotice}/>;
  if (project && revision && workspace && etag) return <Editor key={`${session.user.id}:${workspace.id}:${project.id}`} session={session} onSessionRestored={setSession} workspace={workspace} project={project} initialRevision={revision} initialEtag={etag} onBack={() => { setProject(null); setRevision(null); void loadProjects(); }}/>;
  const actionTitle = projectAction ? `${projectAction.kind[0].toUpperCase()}${projectAction.kind.slice(1)} project` : "";

  return <main className="app-shell">
    <aside className="sidebar" inert={dialogOpen}><Logo/><div className="workspace-label">WORKSPACE</div>
      <div className="workspace-picker"><span className="workspace-avatar">{(workspace?.name || "W").slice(0, 1).toUpperCase()}</span>
        {workspaces.length ? <><select aria-label="Workspace" value={workspace?.id || ""} title={workspace?.name} onChange={event => switchWorkspace(workspaces.find(item => item.id === event.target.value) || null)}>{workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={15}/></> : <span>Get started</span>}
      </div>
      <button ref={workspaceButton} className="text-button new-workspace" title="Create workspace" aria-label="Create workspace" onClick={event => openDialog(event, "workspace")}><Plus size={14}/><span>New workspace</span></button>
      {workspaceCursor && <button className="text-button load-workspaces" disabled={loadingMore} onClick={() => void moreWorkspaces()}>Load more workspaces</button>}
      <nav className="side-nav" aria-label="Main navigation"><div className="nav-active"><FolderOpen size={17}/><span>Projects</span></div></nav>
      <div className="side-bottom"><div className="side-tip"><Sparkles size={17}/><div><strong>A little room to create.</strong><p>Everything you need starts with a project.</p></div></div><div className="account"><span className="avatar">{session.user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{session.user.displayName}</strong><span>{session.user.email}</span></div><button className="icon-button" title="Sign out" aria-label="Sign out" onClick={() => void logout()}><LogOut size={16}/></button></div></div>
    </aside>
    <section className="main-area" inert={dialogOpen}><header className="topbar"><span>{workspace?.name || "Workspace"}<span className="topbar-slash">/</span><strong>Projects</strong></span><span className="topbar-badge"><span/> YOUR WORKSPACE</span></header>
      <div className="content"><div className="page-heading"><div><div className="eyebrow muted">YOUR CREATIVE SPACE <span>✳</span></div><h1>Projects<span className="heading-period">.</span></h1><p>All your stories, in one place.</p></div>{workspace && <button className="button primary" aria-label="New project" onClick={event => openDialog(event, "project")}><Plus size={17}/><span>New project</span></button>}</div>
        {error && !dialogOpen && <div className="banner error-message" role="alert">{error}</div>}
        {notice && <div className="project-notice" role="status">{notice}</div>}
        {!workspace ? <section className="empty-state workspace-empty"><div className="empty-icon"><Clapperboard size={25}/></div><h2>First, create your workspace.</h2><p>It's where your projects and media will live.</p><form onSubmit={createWorkspace} className="inline-form"><label className="sr-only" htmlFor="workspace-name">Workspace name</label><input id="workspace-name" value={workspaceName} maxLength={200} required onChange={event => setWorkspaceName(event.target.value)} placeholder="e.g. My studio"/><button className="button primary" disabled={saving}>Create workspace <ArrowRight size={16}/></button></form></section> : <>
          <div className="project-filters"><div className="project-tabs" aria-label="Project status"><button ref={activeFilter} type="button" aria-pressed={!archived} className={!archived ? "selected" : ""} onClick={() => changeArchiveView(false)}>Active</button><button ref={archivedFilter} type="button" aria-pressed={archived} className={archived ? "selected" : ""} onClick={() => changeArchiveView(true)}><Archive size={14}/> Archived</button></div><form className="project-search" role="search" onSubmit={searchProjects}><label className="sr-only" htmlFor="project-search">Search project names</label><input id="project-search" type="search" maxLength={200} value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search project names"/><button className="icon-button" aria-label="Search projects"><Search size={17}/></button></form></div>
          <div className="section-heading project-section-heading"><div><h2>{archived ? "Archived projects" : "Active projects"}<span>{projects.length}{projectCursor ? "+" : ""}</span></h2><p>{archived ? "Restore a project to continue editing it." : "Your saved stories and edits."}</p></div><span className="small-label">MOST RECENT</span></div>
          {loading ? <div className="empty-state compact" role="status"><LoaderCircle className="spin" size={20}/> Loading projects…</div> : !projects.length ? <section className="empty-state"><div className="empty-art" aria-hidden="true"><div className="empty-art-card one"><Video size={20}/></div><div className="empty-art-card two"><Film size={22}/></div><div className="empty-art-card three"><Sparkles size={18}/></div></div><h2>{searchQuery ? "No matching projects." : archived ? "No archived projects." : "Every great video starts somewhere."}</h2><p>{searchQuery ? "Try another name or clear the search." : archived ? "Projects you archive will appear here." : "Create a project and start bringing your ideas to life."}</p>{!archived && !searchQuery && <button className="button primary" onClick={event => openDialog(event, "project")}><Plus size={17}/> Create your first project</button>}</section> : <div className="project-grid">{projects.map((item, index) => <article className="project-card project-card-container" key={item.id}>
            <button className="project-open" disabled={archived} aria-label={`Open ${item.name}`} onClick={() => void openProject(item)}><div className={`project-cover cover-${index % 4}`}><div className="cover-lines"/><Clapperboard size={26}/><span className="cover-label">{archived ? "ARCHIVED" : "PROJECT"}</span></div><div className="project-card-body"><div><strong>{item.name}</strong><span>Created {new Date(item.createdAt).toLocaleDateString()}</span></div>{!archived && <ArrowRight size={17}/>}</div></button>
            <div className="project-card-actions" role="group" aria-label={`Actions for ${item.name}`}>{archived ? <button className="text-button" onClick={event => beginAction(event, item, "restore")}><RotateCcw size={13}/> Restore</button> : <><button className="text-button" onClick={event => beginAction(event, item, "rename")}><Pencil size={13}/> Rename</button><button className="text-button" onClick={event => beginAction(event, item, "duplicate")}><Copy size={13}/> Copy</button><button className="text-button" onClick={event => beginAction(event, item, "archive")}><Archive size={13}/> Archive</button></>}</div>
          </article>)}{!archived && <button className="project-card add-card" onClick={event => openDialog(event, "project")}><span><Plus size={21}/></span><strong>Create a project</strong><small>Start with a blank canvas</small></button>}</div>}
          {projectCursor && <button className="button secondary load-more" disabled={loadingMore} onClick={() => void moreProjects()}>Load more projects</button>}
        </>}
      </div><footer className="main-footer"><span>MADE FOR THE MAKING ✳</span><span>Your workspace, your story.</span></footer>
    </section>
    {dialogOpen && <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) closeDialog(); }}><div ref={modalRef} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-labelledby="project-dialog-title">
      <div className="modal-heading"><div><div className="eyebrow muted">YOUR WORKSPACE</div><h2 id="project-dialog-title">{newProject ? "Create a project" : newWorkspace ? "Create a workspace" : actionTitle}</h2><p>{newProject ? "Give your story a name and choose a canvas." : newWorkspace ? "Keep a separate collection of projects and media." : projectAction?.project.name}</p></div><button className="icon-button" disabled={saving} aria-label="Close dialog" onClick={closeDialog}>×</button></div>
      <form onSubmit={newProject ? createProject : newWorkspace ? createWorkspace : performProjectAction}>
        {newProject && <><label className="field-label">Project name<input required disabled={saving} maxLength={200} value={projectName} onChange={event => setProjectName(event.target.value)} placeholder="My next video"/></label><fieldset className="aspect-field" disabled={saving}><legend>Canvas size</legend><div className="aspect-options">{(["portrait", "landscape", "square"] as Aspect[]).map(value => <button type="button" key={value} onClick={() => setAspect(value)} aria-pressed={aspect === value} className={`aspect-option ${aspect === value ? "selected" : ""}`}><span className={`aspect-shape ${value}`}/><strong>{value[0].toUpperCase() + value.slice(1)}</strong><small>{value === "portrait" ? "9 : 16" : value === "landscape" ? "16 : 9" : "1 : 1"}</small>{aspect === value && <Check size={14}/>}</button>)}</div></fieldset><p className="export-scope-note">Export supports portrait, landscape and square projects as H.264/AAC MP4.</p></>}
        {newWorkspace && <label className="field-label">Workspace name<input required disabled={saving} maxLength={200} value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} placeholder="My studio"/></label>}
        {(projectAction?.kind === "rename" || projectAction?.kind === "duplicate") && <label className="field-label">Project name<input required disabled={saving} maxLength={200} value={actionName} onChange={event => setActionName(event.target.value)}/></label>}
        {projectAction?.kind === "duplicate" && <p className="project-action-note">Copies the latest saved edit. Original media stays in this workspace and is shared by both projects.</p>}
        {projectAction?.kind === "archive" && <p className="project-action-note">The project and its saved edits are preserved. Restore it from Archived projects when you want to edit again.</p>}
        {projectAction?.kind === "restore" && <p className="project-action-note">Move this project back to Active projects.</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={closeDialog}>Cancel</button><button className="button primary" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={16}/> Saving…</> : newProject ? "Create project" : newWorkspace ? "Create workspace" : actionTitle}</button></div>
      </form>
    </div></div>}
  </main>;
}
