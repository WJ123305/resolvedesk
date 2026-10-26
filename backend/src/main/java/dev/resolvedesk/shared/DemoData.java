package dev.resolvedesk.shared;

import dev.resolvedesk.ticket.TicketService;
import java.time.OffsetDateTime;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@ConditionalOnProperty(name = "app.demo-data", havingValue = "true")
public class DemoData implements ApplicationRunner {
  private final JdbcTemplate jdbc;
  private final TicketService service;
  private final PasswordEncoder encoder;

  public DemoData(JdbcTemplate jdbc, TicketService service, PasswordEncoder encoder) {
    this.jdbc = jdbc;
    this.service = service;
    this.encoder = encoder;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (jdbc.queryForObject("SELECT COUNT(*) FROM tenants", Long.class) > 0) return;
    long acme = service.insert("INSERT INTO tenants(name) VALUES(?)", "拾光科技");
    long north = service.insert("INSERT INTO tenants(name) VALUES(?)", "北辰工作室");
    String hash = encoder.encode("Demo@12345");
    long admin = user(acme, "admin@acme.demo", "林予安", "ADMIN", hash);
    long agent = user(acme, "agent@acme.demo", "陈晓", "AGENT", hash);
    long customer = user(acme, "customer@acme.demo", "许知远", "CUSTOMER", hash);
    user(acme, "customer2@acme.demo", "周晚晴", "CUSTOMER", hash);
    long other = user(north, "admin@north.demo", "顾明", "ADMIN", hash);
    String[][] rows = {
      {"升级后报表导出失败", "升级到最新版本后，点击导出报表显示权限不足。已经刷新浏览器，问题仍然存在。", "IN_PROGRESS", "URGENT"},
      {"团队成员无法收到邀请邮件", "新增成员后收件箱没有收到邀请邮件，垃圾邮件中也没有。", "OPEN", "HIGH"},
      {"如何配置项目的通知规则？", "希望只有负责人在工单状态变更时收到通知，请问在哪里配置？", "WAITING", "MEDIUM"},
      {"工作台加载速度变慢", "最近项目列表加载大约需要十秒，同一网络其他网页正常。", "OPEN", "HIGH"},
      {"申请调整团队空间名称", "想把团队名称修改为新的品牌名称，需要管理员操作吗？", "RESOLVED", "LOW"},
      {"批量导入数据出现重复记录", "CSV 导入后发现部分记录重复，希望确认如何避免重复。", "IN_PROGRESS", "HIGH"},
      {"登录后提示会话已过期", "登录后页面跳转到工作台时又回到登录页面，浏览器已启用 Cookie。", "OPEN", "MEDIUM"},
      {"报表字段顺序如何调整", "希望把负责人字段放到导出报表的第一列。", "CLOSED", "LOW"},
      {"知识文章中图片无法显示", "上传后的文章预览正常，但同事打开后图片没有加载出来。", "WAITING", "MEDIUM"},
      {"希望增加工单标签筛选", "团队需要按照产品模块筛选工单，想了解后续是否支持。", "OPEN", "LOW"}
    };
    for (int i = 0; i < rows.length; i++) {
      var r = rows[i];
      var at = OffsetDateTime.now().minusHours(i * 3L + 1);
      long id =
          service.insert(
              "INSERT INTO"
                  + " tickets(tenant_id,title,description,status,priority,created_by,assignee_id,created_at,updated_at)"
                  + " VALUES(?,?,?,?,?,?,?,?,?)",
              acme,
              r[0],
              r[1],
              r[2],
              r[3],
              customer,
              i % 3 == 1 ? null : (i % 2 == 0 ? admin : agent),
              at,
              at);
      jdbc.update(
          "INSERT INTO ticket_events(tenant_id,ticket_id,actor_id,action,detail,created_at)"
              + " VALUES(?,?,?,'CREATED','创建演示工单',?)",
          acme,
          id,
          customer,
          at);
      if (i == 0) {
        jdbc.update(
            "INSERT INTO ticket_comments(tenant_id,ticket_id,author_id,body) VALUES(?,?,?,?)",
            acme,
            id,
            admin,
            "已收到反馈，我们正在核查升级后的权限设置。请先确认当前账号是否具备报表导出权限。");
        jdbc.update(
            "INSERT INTO ticket_events(tenant_id,ticket_id,actor_id,action,detail)"
                + " VALUES(?,?,?,'STATUS_CHANGED','OPEN → IN_PROGRESS')",
            acme,
            id,
            admin);
      }
    }
    service.insert(
        "INSERT INTO tickets(tenant_id,title,description,status,priority,created_by)"
            + " VALUES(?,?,?,'OPEN','HIGH',?)",
        north,
        "北辰专属：部署环境无法连接",
        "此记录仅北辰工作室可见，用于验证企业数据隔离。",
        other);
    article(
        acme,
        admin,
        "报表导出提示权限不足",
        "升级后如出现报表导出失败，请依次检查：\n"
            + "1. 由管理员打开「团队设置 → 角色权限」。\n"
            + "2. 确认当前角色拥有「报表查看」和「报表导出」权限。\n"
            + "3. 退出登录后重新登录，再尝试导出。\n"
            + "仍有问题时，请提供报表名称、操作时间及错误提示。",
        true);
    article(
        acme,
        agent,
        "成员邀请邮件未收到的排查方法",
        "确认邮箱拼写正确，并检查垃圾邮件及企业邮件隔离区。邀请链接有效期为 24 小时，过期后请管理员重新发送。若仍未收到，请联系企业邮箱管理员检查收件策略。",
        true);
    article(
        acme,
        admin,
        "工单通知规则设置指南",
        "进入团队设置中的通知规则，选择触发事件与接收角色。仅通知负责人时，关闭全体成员选项，保留工单负责人。保存后仅对新触发的事件生效。",
        true);
    article(
        acme,
        agent,
        "CSV 数据导入与去重",
        "导入前为每条记录设置唯一外部编号。重复导入时选择按外部编号更新，而非新增。先使用少量数据试导入，确认字段映射后再提交完整文件。",
        true);
    article(acme, admin, "内部草稿：权限迁移排查清单", "这是一篇未发布草稿，不应出现在客户视图和辅助回复引用中。", false);
    article(north, other, "北辰内部部署指南", "北辰工作室内部知识，其他企业不可检索。", true);
  }

  private long user(long tenant, String email, String name, String role, String hash) {
    return service.insert(
        "INSERT INTO app_users(tenant_id,email,name,role,password_hash) VALUES(?,?,?,?,?)",
        tenant,
        email,
        name,
        role,
        hash);
  }

  private void article(long tenant, long author, String title, String body, boolean published) {
    service.insert(
        "INSERT INTO articles(tenant_id,title,body,published,author_id) VALUES(?,?,?,?,?)",
        tenant,
        title,
        body,
        published,
        author);
  }
}
