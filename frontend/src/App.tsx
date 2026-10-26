import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  X,
  AlertCircle,
  FileText,
  LoaderCircle,
} from "lucide-react";
import { api, ApiError, refreshCsrf } from "./api";

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  tenantName: string;
  tenantId: number;
};
type Member = { id: number; name: string; email: string; role: string };
type TicketRow = {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  creator_name: string;
  assignee_name: string | null;
  assignee_id: number | null;
  version: number;
  created_at: string;
  updated_at: string;
};
type TicketDetail = TicketRow & {
  comments: {
    id: number;
    body: string;
    author_name: string;
    author_role: string;
    created_at: string;
  }[];
  events: {
    id: number;
    action: string;
    detail: string;
    actor_name: string;
    created_at: string;
  }[];
  allowedTransitions: string[];
};
type Article = {
  id: number;
  title: string;
  body: string;
  published: boolean;
  version: number;
  updated_at: string;
};
type Suggestion = {
  mode: string;
  draft: string;
  message: string;
  citations: Article[];
};
const statuses: Record<string, string> = {
  OPEN: "待处理",
  IN_PROGRESS: "处理中",
  WAITING: "等待客户",
  RESOLVED: "已解决",
  CLOSED: "已关闭",
};
const priorities: Record<string, string> = {
  URGENT: "紧急",
  HIGH: "高",
  MEDIUM: "普通",
  LOW: "低",
};
const roles: Record<string, string> = {
  ADMIN: "管理员",
  AGENT: "客服工程师",
  CUSTOMER: "客户",
};
const navItems = [
  { id: "overview", label: "工作概览", icon: LayoutDashboard },
  { id: "tickets", label: "全部工单", icon: Inbox },
  { id: "knowledge", label: "知识库", icon: BookOpen },
  { id: "members", label: "团队成员", icon: Users },
];
function date(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
function number(id: number) {
  return `RD-${String(id).padStart(4, "0")}`;
}
function Status({ value }: { value: string }) {
  return (
    <span className={`status ${value.toLowerCase()}`}>
      <i />
      {statuses[value]}
    </span>
  );
}
function Priority({ value }: { value: string }) {
  return (
    <span className={`priority ${value.toLowerCase()}`}>
      <span>
        {value === "URGENT"
          ? "↑↑"
          : value === "HIGH"
            ? "↑"
            : value === "LOW"
              ? "↓"
              : "−"}
      </span>
      {priorities[value]}
    </span>
  );
}
function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={`avatar ${small ? "small" : ""}`}>{name.slice(-2)}</span>
  );
}
function Loading() {
  return (
    <div className="empty">
      <LoaderCircle className="spin" size={24} />
      <p>正在加载工作空间…</p>
    </div>
  );
}
function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty">
      <Inbox size={34} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
function ErrorBanner({ message }: { message: string }) {
  return message ? (
    <div className="error" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  ) : null;
}
function Modal({
  title,
  subtitle,
  onClose,
  children,
  drawer = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={drawer ? "modal drawer" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <div className="modal-head">
        <div>
          {subtitle && <p className="eyebrow">{subtitle}</p>}
          <h2>{title}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="关闭">
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("admin@acme.demo"),
    [password, setPassword] = useState("Demo@12345"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await refreshCsrf();
      await api("/login", {
        method: "POST",
        body: new URLSearchParams({ username: email, password }),
      });
      await refreshCsrf();
      onLogin(await api<User>("/me"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <Brand />
        <div>
          <p className="eyebrow">A LITTLE CLARITY. A BETTER WORKDAY.</p>
          <h1>
            每一个问题，
            <br />
            都有好的回应。
          </h1>
          <p>
            把问题、协作与知识放在一起。
            <br />
            为专注解决问题的团队，留出更多空间。
          </p>
          <div className="story-line" />
          <div className="story-marks">
            <span>
              <Ticket />
              工单有序
            </span>
            <span>
              <BookOpen />
              知识沉淀
            </span>
            <span>
              <ShieldCheck />
              企业隔离
            </span>
          </div>
        </div>
        <small>RESOLVEDESK / SUPPORT, THOUGHTFULLY.</small>
      </section>
      <section className="login-form">
        <div className="login-card">
          <span className="badge">本地演示工作空间</span>
          <h2>欢迎回来</h2>
          <p className="muted">登录后，继续让支持工作井井有条。</p>
          <form onSubmit={submit}>
            <label>
              工作邮箱
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </label>
            <label>
              密码
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <ErrorBanner message={error} />
            <button className="primary full" disabled={busy}>
              {busy ? "正在登录…" : "进入工作空间"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="demo-accounts">
            <p>
              切换演示身份 <span>统一密码：Demo@12345</span>
            </p>
            <div>
              {[
                ["管理员", "admin@acme.demo"],
                ["客服", "agent@acme.demo"],
                ["客户", "customer@acme.demo"],
                ["另一企业", "admin@north.demo"],
              ].map(([label, value]) => (
                <button
                  key={value}
                  className={email === value ? "selected" : ""}
                  onClick={() => {
                    setEmail(value);
                    setPassword("Demo@12345");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="login-foot">
            <ShieldCheck size={14} />
            数据为虚构样例，仅供本地演示
          </p>
        </div>
      </section>
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <CheckCheck size={24} />
      </span>
      <span>
        Resolve<span className="brand-light">Desk</span>
        <small>客户支持工作空间</small>
      </span>
    </div>
  );
}
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [initial, setInitial] = useState(true),
    [initError, setInitError] = useState("");
  const [nav, setNav] = useState("overview"),
    [stats, setStats] = useState<Record<string, number>>({}),
    [members, setMembers] = useState<Member[]>([]);
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [priority, setPriority] = useState(""),
    [page, setPage] = useState(0);
  const [rows, setRows] = useState<TicketRow[]>([]),
    [total, setTotal] = useState(0),
    [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [selected, setSelected] = useState<number | null>(null),
    [modal, setModal] = useState(""),
    [notice, setNotice] = useState("");
  const staff = user?.role !== "CUSTOMER";
  useEffect(() => {
    api<User>("/me")
      .then(setUser)
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401))
          setInitError(e.message);
      })
      .finally(() => setInitial(false));
    const expired = () => {
      setUser(null);
      setSelected(null);
      setModal("");
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(q);
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    Promise.all([
      api<Record<string, number>>("/stats"),
      staff ? api<Member[]>("/members") : Promise.resolve([]),
    ])
      .then(([s, m]) => {
        if (alive) {
          setStats(s);
          setMembers(m);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [user, refresh, staff]);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const task =
      nav === "knowledge"
        ? api<Article[]>("/articles", { signal: controller.signal }).then(
            setArticles,
          )
        : nav === "members"
          ? Promise.resolve()
          : api<{ items: TicketRow[]; total: number }>(
              `/tickets?${new URLSearchParams({ q: search, status, priority, page: String(page), size: "8" })}`,
              { signal: controller.signal },
            ).then((r) => {
              setRows(r.items);
              setTotal(r.total);
            });
    task
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user, nav, search, status, priority, page, refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  function updated(message?: string) {
    setRefresh((v) => v + 1);
    if (message) setNotice(message);
  }
  function navigate(id: string) {
    setNav(id);
    setQ("");
    setSearch("");
    setStatus("");
    setPriority("");
    setPage(0);
    setError("");
  }
  async function logout() {
    try {
      await api("/logout", { method: "POST" });
      setUser(null);
      setSelected(null);
      setModal("");
      navigate("overview");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (initial) return <Loading />;
  if (!user)
    return (
      <>
        <ErrorBanner message={initError} />
        <Login
          onLogin={(u) => {
            setUser(u);
            setInitError("");
            navigate("overview");
          }}
        />
      </>
    );
  const active =
      (stats.OPEN || 0) + (stats.IN_PROGRESS || 0) + (stats.WAITING || 0),
    resolved = (stats.RESOLVED || 0) + (stats.CLOSED || 0);
  const displayNav = navItems.filter((item) => staff || item.id !== "members");
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <button className="workspace" onClick={() => setModal("workspace")}>
          <span className="workspace-icon">{user.tenantName.slice(0, 1)}</span>
          <span>
            {user.tenantName}
            <small>团队工作空间</small>
          </span>
          <ChevronDown size={16} />
        </button>
        <p className="nav-caption">工作空间</p>
        <nav>
          {displayNav.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              title={item.label}
              className={nav === item.id ? "active" : ""}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === "tickets" && <b>{active}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <Sparkles size={19} />
            </span>
            <strong>让经验成为下一次答案</strong>
            <p>
              把解决方案写进知识库，
              <br />
              让每一次支持都有积累。
            </p>
            <button onClick={() => navigate("knowledge")}>
              前往知识库
              <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="help-link" onClick={() => setModal("about")}>
            <LifeBuoy size={18} />
            项目说明<span>v0.1</span>
          </button>
          <div className="user-line">
            <Avatar name={user.name} />
            <span>
              <strong>{user.name}</strong>
              <small>{roles[user.role]}</small>
            </span>
            <button aria-label="退出登录" title="退出登录" onClick={logout}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            工作空间 <span>/</span>
            <strong>{navItems.find((n) => n.id === nav)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="environment">
              <i />
              本地演示
            </span>
            <span className="divider" />
            <span>
              {new Date().toLocaleDateString("zh-CN", {
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </span>
            <Avatar name={user.name} small />
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {nav === "overview"
                  ? "YOUR SUPPORT, IN FOCUS"
                  : nav === "knowledge"
                    ? "KNOWLEDGE THAT GROWS"
                    : nav === "members"
                      ? "BETTER, TOGETHER"
                      : "EVERY CONVERSATION MATTERS"}
              </p>
              <h1>
                {nav === "overview"
                  ? "工作概览"
                  : nav === "tickets"
                    ? "所有问题，都在这里"
                    : nav === "knowledge"
                      ? "让答案持续生长"
                      : "一起，把问题解决"}
              </h1>
              <p className="muted">
                {nav === "overview"
                  ? `你好，${user.name}。今天也让每一个问题得到妥善回应。`
                  : nav === "tickets"
                    ? "从第一条反馈，到最后一次确认。跟进每一个问题的进展。"
                    : nav === "knowledge"
                      ? "记录解决问题的方法，让团队的经验成为共同的知识。"
                      : "当前企业的成员与角色，清晰协作各司其职。"}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="secondary icon-button"
                aria-label="刷新数据"
                onClick={() => updated()}
              >
                <RefreshCw size={17} />
              </button>
              {nav === "knowledge"
                ? staff && (
                    <button
                      className="primary"
                      onClick={() => setModal("article")}
                    >
                      <Plus size={17} />
                      新建文章
                    </button>
                  )
                : nav !== "members" && (
                    <button
                      className="primary"
                      onClick={() => setModal("ticket")}
                    >
                      <Plus size={17} />
                      新建工单
                    </button>
                  )}
            </div>
          </div>
          <ErrorBanner message={error} />
          {(nav === "overview" || nav === "tickets") && (
            <>
              {nav === "overview" && (
                <>
                  <section className="metrics">
                    {[
                      {
                        label: "待处理",
                        value: stats.OPEN || 0,
                        icon: Inbox,
                        caption: "等待团队接手",
                        className: "gold",
                        filter: "OPEN",
                      },
                      {
                        label: "处理中",
                        value: stats.IN_PROGRESS || 0,
                        icon: Clock3,
                        caption: "正在推进解决",
                        className: "blue",
                        filter: "IN_PROGRESS",
                      },
                      {
                        label: "等待客户",
                        value: stats.WAITING || 0,
                        icon: MessageSquare,
                        caption: "等待更多反馈",
                        className: "purple",
                        filter: "WAITING",
                      },
                      {
                        label: "已解决",
                        value: stats.RESOLVED || 0,
                        icon: CheckCheck,
                        caption: `另有 ${stats.CLOSED || 0} 个已关闭工单`,
                        className: "green",
                        filter: "RESOLVED",
                      },
                    ].map((metric) => (
                      <button
                        key={metric.label}
                        className={`metric ${metric.className}`}
                        onClick={() => {
                          setStatus(metric.filter);
                          setPage(0);
                          navigate("tickets");
                          setStatus(metric.filter);
                        }}
                      >
                        <div>
                          <span>{metric.label}</span>
                          <metric.icon size={18} />
                        </div>
                        <strong>
                          {metric.value.toString().padStart(2, "0")}
                        </strong>
                        <p>
                          {metric.caption}
                          <ArrowUpRight size={14} />
                        </p>
                      </button>
                    ))}
                  </section>
                  <section className="focus-banner">
                    <div className="focus-icon">
                      <Sparkles size={23} />
                    </div>
                    <div>
                      <strong>
                        {stats.urgent
                          ? `有 ${stats.urgent} 个紧急问题，值得优先关注`
                          : "工作有序，保持这个节奏"}
                      </strong>
                      <p>
                        {stats.urgent
                          ? "先处理影响客户使用的关键问题，让协作更有方向。"
                          : "查看最新反馈，或把最近的解决方案整理进知识库。"}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        navigate("tickets");
                        setPriority("URGENT");
                      }}
                    >
                      查看紧急工单
                      <ArrowRight size={16} />
                    </button>
                    <div className="banner-orbit" aria-hidden="true" />
                  </section>
                </>
              )}
              <section className="ticket-section">
                <div className="section-title">
                  <div>
                    <h2>{nav === "overview" ? "工单动态" : "工单列表"}</h2>
                    <span>{total} 个结果</span>
                  </div>
                  <span className="subtle">按最近更新排序</span>
                </div>
                <div className="list-toolbar">
                  <div className="tabs" role="group" aria-label="状态筛选">
                    {[
                      ["", "全部工单"],
                      ["OPEN", "待处理"],
                      ["IN_PROGRESS", "处理中"],
                      ["WAITING", "等待客户"],
                      ["RESOLVED", "已解决"],
                      ["CLOSED", "已关闭"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        className={status === value ? "active" : ""}
                        aria-pressed={status === value}
                        onClick={() => {
                          setStatus(value);
                          setPage(0);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="search-tools">
                    <label className="search">
                      <Search size={16} />
                      <input
                        aria-label="搜索工单"
                        placeholder="搜索标题或问题描述"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                      />
                      {q && (
                        <button aria-label="清空搜索" onClick={() => setQ("")}>
                          <X size={14} />
                        </button>
                      )}
                    </label>
                    <select
                      aria-label="优先级筛选"
                      value={priority}
                      onChange={(e) => {
                        setPriority(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="">所有优先级</option>
                      {Object.entries(priorities).map(([key, label]) => (
                        <option value={key} key={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {loading ? (
                  <Loading />
                ) : rows.length === 0 ? (
                  <Empty
                    title="这里暂时没有工单"
                    description={
                      search || status || priority
                        ? "试试调整筛选条件，或搜索其他关键词。"
                        : "创建第一张工单，开始记录与跟进问题。"
                    }
                  />
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th className="ticket-column">工单 / 问题</th>
                          <th>状态</th>
                          <th>优先级</th>
                          <th>负责人</th>
                          <th>最近更新</th>
                          <th>
                            <span className="sr-only">操作</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <button
                                className="ticket-title"
                                onClick={() => setSelected(t.id)}
                              >
                                <span className="ticket-id">
                                  {number(t.id)}
                                </span>
                                <strong>{t.title}</strong>
                                <span className="ticket-preview">
                                  {t.creator_name}
                                  <span>·</span>
                                  {t.description}
                                </span>
                              </button>
                            </td>
                            <td>
                              <Status value={t.status} />
                            </td>
                            <td>
                              <Priority value={t.priority} />
                            </td>
                            <td>
                              {t.assignee_name ? (
                                <span className="assignee">
                                  <Avatar name={t.assignee_name} small />
                                  {t.assignee_name}
                                </span>
                              ) : (
                                <span className="unassigned">未分配</span>
                              )}
                            </td>
                            <td className="time-cell">{date(t.updated_at)}</td>
                            <td>
                              <button
                                className="icon-button row-open"
                                onClick={() => setSelected(t.id)}
                                aria-label={`查看 ${number(t.id)}`}
                              >
                                <ArrowUpRight size={17} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="table-footer">
                  <span>
                    {total
                      ? `显示 ${page * 8 + 1}–${Math.min((page + 1) * 8, total)} 条，共 ${total} 条`
                      : "共 0 条工单"}
                  </span>
                  <div>
                    <button
                      className="icon-button"
                      disabled={page === 0 || loading}
                      aria-label="上一页"
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <span>
                      {page + 1} / {Math.max(1, Math.ceil(total / 8))}
                    </span>
                    <button
                      className="icon-button"
                      disabled={(page + 1) * 8 >= total || loading}
                      aria-label="下一页"
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </div>
              </section>
              {nav === "overview" && (
                <div className="bottom-note">
                  <span>
                    <ShieldCheck size={15} />
                    当前数据仅属于「{user.tenantName}」
                  </span>
                  <span>认真回应每一次反馈。</span>
                </div>
              )}
            </>
          )}
          {nav === "knowledge" &&
            (loading ? (
              <Loading />
            ) : (
              <>
                <div className="knowledge-intro">
                  <BookOpen size={20} />
                  <p>
                    已发布文章可供客户查看，并参与回复辅助检索。草稿仅团队可见。
                  </p>
                  <span>
                    {articles.filter((a) => a.published).length} 篇已发布
                  </span>
                </div>
                <div className="article-grid">
                  {articles.map((a) => (
                    <article className="article-card" key={a.id}>
                      <div>
                        <span className="article-symbol">
                          <FileText size={22} />
                        </span>
                        <span className={a.published ? "published" : "draft"}>
                          {a.published ? "已发布" : "草稿"}
                        </span>
                      </div>
                      <h3>{a.title}</h3>
                      <p>{a.body}</p>
                      <footer>
                        <span>{date(a.updated_at)}</span>
                        <button onClick={() => setModal(`read:${a.id}`)}>
                          阅读文章
                          <ArrowUpRight size={16} />
                        </button>
                      </footer>
                    </article>
                  ))}
                </div>
                {!articles.length && (
                  <Empty
                    title="知识从第一篇开始"
                    description="把常见问题和解决方案整理成文章。"
                  />
                )}
              </>
            ))}
          {nav === "members" && (
            <section className="members-panel">
              <div className="section-title">
                <div>
                  <h2>团队成员</h2>
                  <span>{members.length} 人</span>
                </div>
                <span className="subtle">角色管理将在后续版本开放</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>成员</th>
                      <th>工作邮箱</th>
                      <th>角色</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <span className="assignee">
                            <Avatar name={m.name} />
                            <strong>{m.name}</strong>
                            {m.id === user.id && (
                              <span className="you">你</span>
                            )}
                          </span>
                        </td>
                        <td>{m.email}</td>
                        <td>
                          <span className="role-label">{roles[m.role]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
        <footer className="main-footer">
          <span>ResolveDesk</span>
          <span>更有条理的支持，更从容的协作。</span>
          <span>演示版本 0.1.0</span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {selected !== null && (
        <TicketDrawer
          key={selected}
          id={selected}
          staff={staff}
          members={members}
          onClose={() => setSelected(null)}
          onChange={() => updated()}
        />
      )}
      {modal === "ticket" && (
        <CreateTicket
          onClose={() => setModal("")}
          onCreated={(id) => {
            setModal("");
            updated("工单已创建");
            setSelected(id);
          }}
        />
      )}
      {modal === "article" && (
        <CreateArticle
          onClose={() => setModal("")}
          onCreated={() => {
            setModal("");
            updated("知识文章已保存");
          }}
        />
      )}
      {modal.startsWith("read:") &&
        (() => {
          const a = articles.find((a) => a.id === Number(modal.slice(5)));
          return (
            a && (
              <Modal
                title={a.title}
                subtitle={a.published ? "知识库 · 已发布" : "知识库 · 草稿"}
                onClose={() => setModal("")}
              >
                <div className="modal-body prose">{a.body}</div>
              </Modal>
            )
          );
        })()}
      {modal === "workspace" && (
        <Modal
          title={user.tenantName}
          subtitle="当前工作空间"
          onClose={() => setModal("")}
        >
          <div className="modal-body">
            <p>
              你以「{roles[user.role]}
              」身份登录此企业。当前工作空间由服务端登录身份决定。
            </p>
            <p className="muted">
              体验另一家企业：退出登录后，使用 admin@north.demo 和演示密码
              Demo@12345 登录。
            </p>
            <button className="secondary" onClick={logout}>
              <LogOut size={16} />
              退出并切换账号
            </button>
          </div>
        </Modal>
      )}
      {modal === "about" && (
        <Modal
          title="一个可以验证的支持工作台"
          subtitle="RESOLVEDESK / V0.1"
          onClose={() => setModal("")}
        >
          <div className="modal-body about">
            <p>
              当前版本已实现登录、企业数据隔离、工单流转、负责人分配、回复、操作记录和知识文章创建。
            </p>
            <div>
              <ShieldCheck />
              <span>
                <strong>服务端权限检查</strong>
                客户仅能查看自己的工单，企业之间的数据互不可见。
              </span>
            </div>
            <div>
              <RefreshCw />
              <span>
                <strong>并发冲突保护</strong>
                更新使用版本号校验。旧页面提交时会提示刷新，避免覆盖他人修改。
              </span>
            </div>
            <div>
              <Sparkles />
              <span>
                <strong>回复辅助 · 演示模式</strong>
                使用关键词匹配和模板组装，附知识来源；尚未接入真实大模型或向量检索。
              </span>
            </div>
            <p className="muted">
              文章编辑与历史版本、异步索引、真实模型接入、压测评测和生产部署将在后续迭代完成。当前为本地开发版本。
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
function CreateTicket({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [priority, setPriority] = useState("MEDIUM"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<TicketRow>("/tickets", {
        method: "POST",
        body: JSON.stringify({ title, description, priority }),
      });
      onCreated(result.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="创建一张新工单"
      subtitle="从一个清晰的问题开始"
      onClose={onClose}
    >
      <form onSubmit={submit} className="modal-body form-stack">
        <label>
          问题标题
          <input
            autoFocus
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="简要描述遇到的问题"
          />
        </label>
        <label>
          问题描述
          <textarea
            required
            maxLength={10000}
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="发生了什么？你期望的结果是什么？可以补充操作步骤和错误提示。"
          />
        </label>
        <label>
          优先级
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {Object.entries(priorities).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <ErrorBanner message={error} />
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "创建中…" : "创建工单"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function CreateArticle({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [published, setPublished] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/articles", {
        method: "POST",
        body: JSON.stringify({ title, body, published }),
      });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="把经验写成答案" subtitle="新建知识文章" onClose={onClose}>
      <form onSubmit={submit} className="modal-body form-stack">
        <label>
          文章标题
          <input
            autoFocus
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="一个具体、容易检索的问题"
          />
        </label>
        <label>
          解决方案
          <textarea
            required
            rows={9}
            maxLength={20000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="说明适用场景、处理步骤与注意事项…"
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          立即发布，让客户可见并参与回复检索
        </label>
        <ErrorBanner message={error} />
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "保存中…" : published ? "发布文章" : "保存草稿"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function TicketDrawer({
  id,
  staff,
  members,
  onClose,
  onChange,
}: {
  id: number;
  staff: boolean;
  members: Member[];
  onClose: () => void;
  onChange: () => void;
}) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [body, setBody] = useState(""),
    [tab, setTab] = useState("conversation"),
    [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  async function load() {
    setError("");
    try {
      setTicket(await api<TicketDetail>(`/tickets/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    let alive = true;
    api<TicketDetail>(`/tickets/${id}`)
      .then((t) => {
        if (alive) setTicket(t);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [id]);
  async function mutate(
    path: string,
    method: string,
    payload: object,
    clear = false,
  ) {
    if (!ticket) return;
    setBusy(true);
    setError("");
    try {
      setTicket(
        await api<TicketDetail>(`/tickets/${id}/${path}`, {
          method,
          body: JSON.stringify({ ...payload, version: ticket.version }),
        }),
      );
      if (clear) setBody("");
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function suggest() {
    setBusy(true);
    setError("");
    try {
      setSuggestion(
        await api<Suggestion>(`/tickets/${id}/suggestion`, { method: "POST" }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={ticket?.title || "工单详情"}
      subtitle={number(id)}
      onClose={onClose}
      drawer
    >
      <div className="modal-body detail-body">
        <ErrorBanner message={error} />
        {error && (
          <button className="secondary" onClick={load}>
            <RefreshCw size={15} />
            刷新工单，保留输入
          </button>
        )}
        {!ticket ? (
          <Loading />
        ) : (
          <>
            <div className="detail-meta">
              <Status value={ticket.status} />
              <Priority value={ticket.priority} />
              <span>
                {ticket.creator_name} 创建于 {date(ticket.created_at)}
              </span>
            </div>
            <section className="description">
              <h3>问题描述</h3>
              <p>{ticket.description}</p>
            </section>
            {staff && (
              <div className="ticket-controls">
                <label>
                  负责人
                  <select
                    disabled={busy || ticket.status === "CLOSED"}
                    value={ticket.assignee_id ?? ""}
                    onChange={(e) =>
                      mutate("assignee", "PATCH", {
                        assigneeId: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  >
                    <option value="">未分配</option>
                    {members
                      .filter((m) => m.role !== "CUSTOMER")
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  推进状态
                  <select
                    value=""
                    disabled={busy || !ticket.allowedTransitions.length}
                    onChange={(e) => {
                      if (e.target.value)
                        mutate("status", "PATCH", { status: e.target.value });
                    }}
                  >
                    <option value="">
                      {ticket.status === "CLOSED" ? "工单已关闭" : "选择下一步"}
                    </option>
                    {ticket.allowedTransitions.map((s) => (
                      <option key={s} value={s}>
                        {statuses[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <div className="detail-tabs">
              <button
                className={tab === "conversation" ? "active" : ""}
                onClick={() => setTab("conversation")}
              >
                <MessageSquare size={16} />
                沟通记录 <span>{ticket.comments.length}</span>
              </button>
              <button
                className={tab === "activity" ? "active" : ""}
                onClick={() => setTab("activity")}
              >
                <Clock3 size={16} />
                操作记录 <span>{ticket.events.length}</span>
              </button>
            </div>
            {tab === "conversation" ? (
              <>
                <div className="comments">
                  {ticket.comments.length ? (
                    ticket.comments.map((c) => (
                      <article className="comment" key={c.id}>
                        <Avatar name={c.author_name} small />
                        <div>
                          <div className="comment-head">
                            <strong>{c.author_name}</strong>
                            <span>
                              {roles[c.author_role]} · {date(c.created_at)}
                            </span>
                          </div>
                          <p>{c.body}</p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="muted">还没有回复，先回应客户的问题吧。</p>
                  )}
                </div>
                {ticket.status !== "CLOSED" && (
                  <section className="reply-box">
                    <div className="reply-title">
                      <strong>添加回复</strong>
                      {staff && (
                        <button
                          className="suggest-button"
                          disabled={busy}
                          onClick={suggest}
                        >
                          <Sparkles size={15} />
                          知识辅助<span>演示</span>
                        </button>
                      )}
                    </div>
                    {suggestion && (
                      <div className="suggestion">
                        <p>
                          <Sparkles size={15} />
                          {suggestion.message}
                        </p>
                        {suggestion.citations.map((a) => (
                          <details key={a.id}>
                            <summary>来源：{a.title}</summary>
                            <p className="prose">{a.body}</p>
                          </details>
                        ))}
                        {suggestion.draft && (
                          <>
                            <pre>{suggestion.draft}</pre>
                            <button
                              className="secondary"
                              onClick={() => setBody(suggestion.draft)}
                            >
                              填入回复框，人工审核
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        mutate("comments", "POST", { body }, true);
                      }}
                    >
                      <textarea
                        aria-label="回复内容"
                        placeholder="写下你的回复，帮助问题向前一步…"
                        rows={4}
                        required
                        maxLength={5000}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                      />
                      <div className="reply-footer">
                        <span>回复对客户可见</span>
                        <button
                          className="primary"
                          disabled={busy || !body.trim()}
                        >
                          {busy ? "处理中…" : "发送回复"}
                          <ArrowUpRight size={15} />
                        </button>
                      </div>
                    </form>
                  </section>
                )}
              </>
            ) : (
              <div className="timeline">
                {ticket.events.map((event) => (
                  <div key={event.id}>
                    <i />
                    <div>
                      <strong>{event.actor_name}</strong>
                      <p>
                        {event.detail.replace(
                          /OPEN|IN_PROGRESS|WAITING|RESOLVED|CLOSED/g,
                          (s) => statuses[s],
                        )}
                      </p>
                      <time>{date(event.created_at)}</time>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
