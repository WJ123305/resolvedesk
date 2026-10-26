package dev.resolvedesk.ticket;

import dev.resolvedesk.auth.WorkspaceUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class TicketController {
  private final TicketService service;

  public TicketController(TicketService service) {
    this.service = service;
  }

  public record NewTicket(
      @NotBlank @Size(max = 200) String title,
      @NotBlank @Size(max = 10000) String description,
      @NotNull @Pattern(regexp = "LOW|MEDIUM|HIGH|URGENT") String priority) {}

  public record Transition(@NotBlank String status, @NotNull @Min(0) Integer version) {}

  public record Assignment(@Positive Long assigneeId, @NotNull @Min(0) Integer version) {}

  public record Comment(
      @NotBlank @Size(max = 5000) String body, @NotNull @Min(0) Integer version) {}

  @GetMapping("/tickets")
  Object list(
      @AuthenticationPrincipal WorkspaceUser u,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "") String status,
      @RequestParam(defaultValue = "") String priority,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "12") int size) {
    return service.list(u, q, status, priority, page, size);
  }

  @GetMapping("/stats")
  Object stats(@AuthenticationPrincipal WorkspaceUser u) {
    return service.stats(u);
  }

  @GetMapping("/tickets/{id}")
  Object detail(@AuthenticationPrincipal WorkspaceUser u, @PathVariable long id) {
    return service.detail(u, id);
  }

  @PostMapping("/tickets")
  @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
  Object create(@AuthenticationPrincipal WorkspaceUser u, @Valid @RequestBody NewTicket b) {
    return service.create(u, b.title(), b.description(), b.priority());
  }

  @PatchMapping("/tickets/{id}/status")
  Object status(
      @AuthenticationPrincipal WorkspaceUser u,
      @PathVariable long id,
      @Valid @RequestBody Transition b) {
    return service.transition(u, id, b.status(), b.version());
  }

  @PatchMapping("/tickets/{id}/assignee")
  Object assign(
      @AuthenticationPrincipal WorkspaceUser u,
      @PathVariable long id,
      @Valid @RequestBody Assignment b) {
    return service.assign(u, id, b.assigneeId(), b.version());
  }

  @PostMapping("/tickets/{id}/comments")
  Object comment(
      @AuthenticationPrincipal WorkspaceUser u,
      @PathVariable long id,
      @Valid @RequestBody Comment b) {
    return service.comment(u, id, b.body(), b.version());
  }

  @GetMapping("/members")
  Object members(@AuthenticationPrincipal WorkspaceUser u) {
    return service.members(u);
  }
}
