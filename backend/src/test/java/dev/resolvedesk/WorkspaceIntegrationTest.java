package dev.resolvedesk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestBuilders.formLogin;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.resolvedesk.auth.WorkspaceUser;
import dev.resolvedesk.ticket.TicketService;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithUserDetails;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:integration;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
      "app.demo-data=true"
    })
@AutoConfigureMockMvc
class WorkspaceIntegrationTest {
  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate jdbc;
  @Autowired TicketService service;
  @Autowired UserDetailsService users;
  @Autowired ObjectMapper json;

  WorkspaceUser admin() {
    return (WorkspaceUser) users.loadUserByUsername("admin@acme.demo");
  }

  long fresh() {
    return ((Number) service.create(admin(), "测试工单", "独立测试数据", "MEDIUM").get("id")).longValue();
  }

  long foreign() {
    return jdbc.queryForObject(
        "SELECT t.id FROM tickets t JOIN tenants w ON w.id=t.tenant_id WHERE w.name='北辰工作室' ORDER"
            + " BY t.id LIMIT 1",
        Long.class);
  }

  @Test
  void unauthenticatedRequestsAreRejected() throws Exception {
    mvc.perform(get("/api/tickets")).andExpect(status().isUnauthorized());
  }

  @Test
  void passwordLoginEstablishesSessionAndRejectsInvalidPassword() throws Exception {
    mvc.perform(formLogin("/api/login").user("admin@acme.demo").password("wrong"))
        .andExpect(status().isUnauthorized());
    var result =
        mvc.perform(formLogin("/api/login").user("admin@acme.demo").password("Demo@12345"))
            .andExpect(status().isOk())
            .andReturn();
    var session = (MockHttpSession) result.getRequest().getSession(false);
    mvc.perform(get("/api/me").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tenantName").value("拾光科技"));
    mvc.perform(post("/api/logout").session(session).with(csrf()))
        .andExpect(status().isNoContent());
    assertThat(session.isInvalid()).isTrue();
  }

  @Test
  @WithUserDetails("admin@acme.demo")
  void csrfIsRequiredForMutations() throws Exception {
    mvc.perform(
            post("/api/tickets")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"x\",\"description\":\"x\",\"priority\":\"HIGH\"}"))
        .andExpect(status().isForbidden());
  }

  @Test
  @WithUserDetails("admin@acme.demo")
  void tenantIsolationAppliesToReadWriteAndSuggestions() throws Exception {
    long id = foreign();
    mvc.perform(get("/api/tickets/" + id)).andExpect(status().isNotFound());
    mvc.perform(
            post("/api/tickets/" + id + "/comments")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"body\":\"intrusion\",\"version\":0}"))
        .andExpect(status().isNotFound());
    mvc.perform(post("/api/tickets/" + id + "/suggestion").with(csrf()))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/tickets").param("q", "北辰专属")).andExpect(jsonPath("$.total").value(0));
    mvc.perform(get("/api/articles"))
        .andExpect(
            content()
                .string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("北辰内部"))));
  }

  @Test
  @WithUserDetails("customer2@acme.demo")
  void customerOnlySeesOwnTicketsWithinSameTenant() throws Exception {
    long id = fresh();
    mvc.perform(get("/api/tickets/" + id)).andExpect(status().isNotFound());
    mvc.perform(get("/api/tickets")).andExpect(jsonPath("$.total").value(0));
    var response =
        mvc.perform(
                post("/api/tickets")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"title\":\"客户独立工单\",\"description\":\"详细描述\",\"priority\":\"LOW\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    long own = json.readTree(response.getResponse().getContentAsString()).get("id").asLong();
    mvc.perform(get("/api/tickets/" + own)).andExpect(status().isOk());
    mvc.perform(
            post("/api/tickets/" + own + "/comments")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"body\":\"补充信息\",\"version\":0}"))
        .andExpect(status().isOk());
  }

  @Test
  @WithUserDetails("customer@acme.demo")
  void customerCannotPerformStaffOperationsOrReadDrafts() throws Exception {
    mvc.perform(get("/api/members")).andExpect(status().isForbidden());
    mvc.perform(
            patch("/api/tickets/1/status")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"RESOLVED\",\"version\":0}"))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/api/articles")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"x\",\"body\":\"x\",\"published\":true}"))
        .andExpect(status().isForbidden());
    mvc.perform(post("/api/tickets/1/suggestion").with(csrf())).andExpect(status().isForbidden());
    mvc.perform(get("/api/articles"))
        .andExpect(
            content()
                .string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("内部草稿"))));
  }

  @Test
  @WithUserDetails("admin@acme.demo")
  void invalidTransitionDoesNotChangeTicketOrAudit() throws Exception {
    long id = fresh();
    mvc.perform(
            patch("/api/tickets/" + id + "/status")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"CLOSED\",\"version\":0}"))
        .andExpect(status().isBadRequest());
    assertThat(jdbc.queryForObject("SELECT status FROM tickets WHERE id=?", String.class, id))
        .isEqualTo("OPEN");
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM ticket_events WHERE ticket_id=?", Long.class, id))
        .isEqualTo(1L);
  }

  @Test
  @WithUserDetails("admin@acme.demo")
  void staleVersionProducesConflictAndNoExtraAuditEntry() throws Exception {
    long id = fresh();
    mvc.perform(
            patch("/api/tickets/" + id + "/status")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"IN_PROGRESS\",\"version\":0}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.version").value(1));
    mvc.perform(
            patch("/api/tickets/" + id + "/status")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"RESOLVED\",\"version\":0}"))
        .andExpect(status().isConflict());
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM ticket_events WHERE ticket_id=?", Long.class, id))
        .isEqualTo(2L);
  }

  @Test
  void simultaneousUpdatesHaveExactlyOneWinner() throws Exception {
    long id = fresh();
    var u = admin();
    var ready = new CountDownLatch(2);
    var start = new CountDownLatch(1);
    var pool = Executors.newFixedThreadPool(2);
    try {
      Callable<Integer> task =
          () -> {
            ready.countDown();
            start.await(5, TimeUnit.SECONDS);
            try {
              service.transition(u, id, "IN_PROGRESS", 0);
              return 200;
            } catch (ResponseStatusException e) {
              return e.getStatusCode().value();
            }
          };
      var a = pool.submit(task);
      var b = pool.submit(task);
      assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
      start.countDown();
      assertThat(List.of(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(200, 409);
      assertThat(jdbc.queryForObject("SELECT version FROM tickets WHERE id=?", Integer.class, id))
          .isEqualTo(1);
      assertThat(
              jdbc.queryForObject(
                  "SELECT COUNT(*) FROM ticket_events WHERE ticket_id=?", Long.class, id))
          .isEqualTo(2L);
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  @WithUserDetails("admin@acme.demo")
  void assignmentCannotReferenceOtherTenantOrCustomer() throws Exception {
    long id = fresh();
    for (String email : List.of("admin@north.demo", "customer@acme.demo")) {
      long user = ((WorkspaceUser) users.loadUserByUsername(email)).id();
      mvc.perform(
              patch("/api/tickets/" + id + "/assignee")
                  .with(csrf())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"assigneeId\":" + user + ",\"version\":0}"))
          .andExpect(status().isBadRequest());
    }
    assertThat(jdbc.queryForObject("SELECT version FROM tickets WHERE id=?", Integer.class, id))
        .isZero();
  }

  @Test
  @WithUserDetails("admin@acme.demo")
  void closedTicketsRejectCommentsAndAssignment() throws Exception {
    long id = fresh();
    service.transition(admin(), id, "IN_PROGRESS", 0);
    service.transition(admin(), id, "RESOLVED", 1);
    service.transition(admin(), id, "CLOSED", 2);
    mvc.perform(
            post("/api/tickets/" + id + "/comments")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"body\":\"late\",\"version\":3}"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            patch("/api/tickets/" + id + "/assignee")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"assigneeId\":null,\"version\":3}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  @WithUserDetails("admin@acme.demo")
  void suggestionsAreExplicitlyDemoAndUsePublishedTenantSourcesOnly() throws Exception {
    mvc.perform(post("/api/tickets/1/suggestion").with(csrf()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.mode").value("keyword-demo"))
        .andExpect(jsonPath("$.citations[0].title").value("报表导出提示权限不足"))
        .andExpect(
            content()
                .string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("内部草稿"))))
        .andExpect(
            content()
                .string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("北辰内部"))));
    long id =
        ((Number) service.create(admin(), "zzqqvvxx", "zzqqvvxx", "LOW").get("id")).longValue();
    mvc.perform(post("/api/tickets/" + id + "/suggestion").with(csrf()))
        .andExpect(jsonPath("$.draft").value(""))
        .andExpect(jsonPath("$.citations").isEmpty());
  }

  @Test
  @WithUserDetails("admin@acme.demo")
  void validationAndLiteralSearchAreEnforced() throws Exception {
    mvc.perform(
            post("/api/tickets")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"  \",\"description\":\"x\",\"priority\":\"HIGH\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/tickets").param("size", "10000")).andExpect(status().isBadRequest());
    mvc.perform(get("/api/tickets").param("page", "-1")).andExpect(status().isBadRequest());
    mvc.perform(get("/api/tickets").param("q", "%' OR 1=1 --"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));
  }
}
