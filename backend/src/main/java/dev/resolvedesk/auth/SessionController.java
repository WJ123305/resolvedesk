package dev.resolvedesk.auth;

import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SessionController {
  @GetMapping("/api/health")
  Map<String, String> health() {
    return Map.of("status", "UP", "version", "0.1.0");
  }

  @GetMapping("/api/csrf")
  Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
  }

  @GetMapping("/api/me")
  Map<String, Object> me(@AuthenticationPrincipal WorkspaceUser user) {
    return Map.of(
        "id",
        user.id(),
        "tenantId",
        user.tenantId(),
        "name",
        user.name(),
        "email",
        user.email(),
        "role",
        user.role(),
        "tenantName",
        user.tenantName());
  }
}
