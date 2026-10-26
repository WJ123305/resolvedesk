package dev.resolvedesk.ticket;

import dev.resolvedesk.auth.WorkspaceUser;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TicketService {
  private final JdbcTemplate jdbc;

  public TicketService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public static final Map<String, List<String>> TRANSITIONS =
      Map.of(
          "OPEN",
          List.of("IN_PROGRESS"),
          "IN_PROGRESS",
          List.of("WAITING", "RESOLVED"),
          "WAITING",
          List.of("IN_PROGRESS", "RESOLVED"),
          "RESOLVED",
          List.of("IN_PROGRESS", "CLOSED"),
          "CLOSED",
          List.of());
  private static final String SELECT =
      """
      SELECT t.*,c.name AS creator_name,a.name AS assignee_name FROM tickets t
      JOIN app_users c ON c.id=t.created_by AND c.tenant_id=t.tenant_id
      LEFT JOIN app_users a ON a.id=t.assignee_id AND a.tenant_id=t.tenant_id
      """;

  public static void staff(WorkspaceUser u) {
    if (u.customer()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "此操作需要客服或管理员权限");
  }

  private Map<String, Object> row(WorkspaceUser u, long id) {
    var rows =
        jdbc.queryForList(
            SELECT
                + " WHERE t.tenant_id=? AND t.id=?"
                + (u.customer() ? " AND t.created_by=?" : ""),
            u.customer()
                ? new Object[] {u.tenantId(), id, u.id()}
                : new Object[] {u.tenantId(), id});
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "工单不存在或不可访问");
    return rows.get(0);
  }

  public Map<String, Object> list(
      WorkspaceUser u, String q, String status, String priority, int page, int size) {
    if (page < 0 || page > 100000 || size < 1 || size > 100 || q.length() > 200)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "分页或搜索参数不正确");
    var args = new ArrayList<Object>();
    args.add(u.tenantId());
    String where = " WHERE t.tenant_id=?";
    if (u.customer()) {
      where += " AND t.created_by=?";
      args.add(u.id());
    }
    if (!q.isBlank()) {
      where += " AND (LOWER(t.title) LIKE ? ESCAPE '!' OR LOWER(t.description) LIKE ? ESCAPE '!')";
      String escaped =
          q.toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_");
      args.add("%" + escaped + "%");
      args.add("%" + escaped + "%");
    }
    if (!status.isBlank()) {
      where += " AND t.status=?";
      args.add(status);
    }
    if (!priority.isBlank()) {
      where += " AND t.priority=?";
      args.add(priority);
    }
    Long count =
        jdbc.queryForObject("SELECT COUNT(*) FROM tickets t" + where, Long.class, args.toArray());
    args.add(size);
    args.add(page * size);
    return Map.of(
        "items",
        jdbc.queryForList(
            SELECT + where + " ORDER BY t.updated_at DESC,t.id DESC LIMIT ? OFFSET ?",
            args.toArray()),
        "total",
        count,
        "page",
        page,
        "size",
        size);
  }

  public Map<String, Object> stats(WorkspaceUser u) {
    String where = " WHERE tenant_id=?" + (u.customer() ? " AND created_by=?" : "");
    Object[] args =
        u.customer() ? new Object[] {u.tenantId(), u.id()} : new Object[] {u.tenantId()};
    var counts = new LinkedHashMap<String, Object>();
    for (String s : List.of("OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"))
      counts.put(s, 0L);
    for (var r :
        jdbc.queryForList(
            "SELECT status,COUNT(*) AS n FROM tickets" + where + " GROUP BY status", args))
      counts.put(r.get("status").toString(), r.get("n"));
    counts.put(
        "urgent",
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM tickets"
                + where
                + " AND priority='URGENT' AND status NOT IN ('RESOLVED','CLOSED')",
            Long.class,
            args));
    return counts;
  }

  public Map<String, Object> detail(WorkspaceUser u, long id) {
    var ticket = new LinkedHashMap<>(row(u, id));
    ticket.put(
        "comments",
        jdbc.queryForList(
            """
SELECT c.id,c.body,c.created_at,u.name AS author_name,u.role AS author_role FROM ticket_comments c
JOIN app_users u ON u.id=c.author_id AND u.tenant_id=c.tenant_id
WHERE c.tenant_id=? AND c.ticket_id=? ORDER BY c.created_at,c.id
""",
            u.tenantId(),
            id));
    ticket.put(
        "events",
        jdbc.queryForList(
            """
            SELECT e.id,e.action,e.detail,e.created_at,u.name AS actor_name FROM ticket_events e
            JOIN app_users u ON u.id=e.actor_id AND u.tenant_id=e.tenant_id
            WHERE e.tenant_id=? AND e.ticket_id=? ORDER BY e.created_at DESC,e.id DESC
            """,
            u.tenantId(),
            id));
    ticket.put(
        "allowedTransitions",
        u.customer() ? List.of() : TRANSITIONS.get(ticket.get("status").toString()));
    return ticket;
  }

  public long insert(String sql, Object... args) {
    var key = new GeneratedKeyHolder();
    jdbc.update(
        conn -> {
          var ps = conn.prepareStatement(sql, new String[] {"id"});
          for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
          return ps;
        },
        key);
    return Objects.requireNonNull(key.getKey()).longValue();
  }

  private void event(WorkspaceUser u, long id, String action, String detail) {
    jdbc.update(
        "INSERT INTO ticket_events(tenant_id,ticket_id,actor_id,action,detail) VALUES(?,?,?,?,?)",
        u.tenantId(),
        id,
        u.id(),
        action,
        detail);
  }

  @Transactional
  public Map<String, Object> create(
      WorkspaceUser u, String title, String description, String priority) {
    long id =
        insert(
            "INSERT INTO tickets(tenant_id,title,description,status,priority,created_by)"
                + " VALUES(?,?,?,'OPEN',?,?)",
            u.tenantId(),
            title.strip(),
            description.strip(),
            priority,
            u.id());
    event(u, id, "CREATED", "创建工单");
    return detail(u, id);
  }

  @Transactional
  public Map<String, Object> transition(WorkspaceUser u, long id, String target, int version) {
    staff(u);
    var current = row(u, id);
    String from = current.get("status").toString();
    if (((Number) current.get("version")).intValue() != version) conflict();
    if (!TRANSITIONS.get(from).contains(target))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不允许从 " + from + " 转为 " + target);
    int changed =
        jdbc.update(
            "UPDATE tickets SET status=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE"
                + " tenant_id=? AND id=? AND version=?",
            target,
            u.tenantId(),
            id,
            version);
    if (changed != 1) conflict();
    event(u, id, "STATUS_CHANGED", from + " → " + target);
    return detail(u, id);
  }

  @Transactional
  public Map<String, Object> assign(WorkspaceUser u, long id, Long assignee, int version) {
    staff(u);
    var current = row(u, id);
    if (current.get("status").equals("CLOSED"))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "已关闭工单不能重新分配");
    String name = "未分配";
    if (assignee != null) {
      var users =
          jdbc.queryForList(
              "SELECT name FROM app_users WHERE tenant_id=? AND id=? AND role IN ('ADMIN','AGENT')",
              u.tenantId(),
              assignee);
      if (users.isEmpty())
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "负责人必须是本企业的客服或管理员");
      name = users.get(0).get("name").toString();
    }
    int changed =
        jdbc.update(
            "UPDATE tickets SET assignee_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE"
                + " tenant_id=? AND id=? AND version=?",
            assignee,
            u.tenantId(),
            id,
            version);
    if (changed != 1) conflict();
    event(u, id, "ASSIGNED", "负责人设为：" + name);
    return detail(u, id);
  }

  @Transactional
  public Map<String, Object> comment(WorkspaceUser u, long id, String body, int version) {
    var current = row(u, id);
    if (current.get("status").equals("CLOSED"))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "已关闭工单不能回复");
    int changed =
        jdbc.update(
            "UPDATE tickets SET version=version+1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=?"
                + " AND id=? AND version=?",
            u.tenantId(),
            id,
            version);
    if (changed != 1) conflict();
    jdbc.update(
        "INSERT INTO ticket_comments(tenant_id,ticket_id,author_id,body) VALUES(?,?,?,?)",
        u.tenantId(),
        id,
        u.id(),
        body.strip());
    event(u, id, "COMMENTED", "添加回复");
    return detail(u, id);
  }

  public List<Map<String, Object>> members(WorkspaceUser u) {
    staff(u);
    return jdbc.queryForList(
        "SELECT id,name,email,role FROM app_users WHERE tenant_id=? ORDER BY id", u.tenantId());
  }

  private static void conflict() {
    throw new ResponseStatusException(HttpStatus.CONFLICT, "工单已被其他人更新，请刷新后重试；你的输入已保留");
  }
}
