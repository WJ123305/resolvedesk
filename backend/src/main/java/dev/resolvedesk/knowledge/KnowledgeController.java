package dev.resolvedesk.knowledge;

import dev.resolvedesk.auth.WorkspaceUser;
import dev.resolvedesk.ticket.TicketService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class KnowledgeController {
  private final JdbcTemplate jdbc;
  private final TicketService tickets;

  public KnowledgeController(JdbcTemplate jdbc, TicketService tickets) {
    this.jdbc = jdbc;
    this.tickets = tickets;
  }

  public record Article(
      @NotBlank @Size(max = 200) String title,
      @NotBlank @Size(max = 20000) String body,
      boolean published) {}

  @GetMapping("/articles")
  Object list(@AuthenticationPrincipal WorkspaceUser u) {
    return jdbc.queryForList(
        "SELECT id,title,body,published,version,updated_at FROM articles WHERE tenant_id=?"
            + (u.customer() ? " AND published=TRUE" : "")
            + " ORDER BY updated_at DESC,id DESC",
        u.tenantId());
  }

  @PostMapping("/articles")
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  Object create(@AuthenticationPrincipal WorkspaceUser u, @Valid @RequestBody Article b) {
    TicketService.staff(u);
    long id =
        tickets.insert(
            "INSERT INTO articles(tenant_id,title,body,published,author_id) VALUES(?,?,?,?,?)",
            u.tenantId(),
            b.title().strip(),
            b.body().strip(),
            b.published(),
            u.id());
    return Map.of("id", id);
  }

  @PostMapping("/tickets/{id}/suggestion")
  Object suggest(@AuthenticationPrincipal WorkspaceUser u, @PathVariable long id) {
    TicketService.staff(u);
    var ticket = tickets.detail(u, id);
    String query = (ticket.get("title") + " " + ticket.get("description")).toLowerCase(Locale.ROOT);
    Set<String> queryTerms = terms(query);
    var candidates =
        jdbc.queryForList(
            "SELECT id,title,body,version FROM articles WHERE tenant_id=? AND published=TRUE ORDER"
                + " BY id",
            u.tenantId());
    var ranked =
        candidates.stream()
            .map(
                article -> {
                  var tokens =
                      terms(
                          (article.get("title") + " " + article.get("body"))
                              .toLowerCase(Locale.ROOT));
                  long score = tokens.stream().filter(queryTerms::contains).count();
                  return new AbstractMap.SimpleEntry<>(article, score);
                })
            .filter(e -> e.getValue() >= 3)
            .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
            .limit(2)
            .toList();
    if (ranked.isEmpty())
      return Map.of(
          "mode",
          "keyword-demo",
          "draft",
          "",
          "citations",
          List.of(),
          "message",
          "当前知识库缺少足够依据，请人工核查后回复。");
    var citations = ranked.stream().map(Map.Entry::getKey).toList();
    StringBuilder draft = new StringBuilder("你好，关于你反馈的问题，可以先参考以下知识库说明：\n\n");
    for (var article : citations)
      draft
          .append("【")
          .append(article.get("title"))
          .append("】\n")
          .append(article.get("body"))
          .append("\n\n");
    draft.append("如果问题仍然存在，请补充操作时间和错误信息，我们会继续跟进。");
    return Map.of(
        "mode",
        "keyword-demo",
        "draft",
        draft.toString(),
        "citations",
        citations,
        "message",
        "演示模式：关键词匹配与模板组装，未调用大模型。请核对内容后发送。");
  }

  private static Set<String> terms(String text) {
    var out = new HashSet<String>();
    for (String word : text.split("[^\\p{L}\\p{N}]+")) {
      if (word.length() < 2) continue;
      out.add(word);
      for (int i = 0; i < word.length() - 1; i++) out.add(word.substring(i, i + 2));
    }
    return out;
  }
}
