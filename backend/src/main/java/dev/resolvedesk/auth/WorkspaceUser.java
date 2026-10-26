package dev.resolvedesk.auth;

import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public record WorkspaceUser(
    long id,
    long tenantId,
    String email,
    String name,
    String passwordHash,
    String role,
    String tenantName)
    implements UserDetails {
  public Collection<? extends GrantedAuthority> getAuthorities() {
    return List.of(new SimpleGrantedAuthority("ROLE_" + role));
  }

  public String getPassword() {
    return passwordHash;
  }

  public String getUsername() {
    return email;
  }

  public boolean customer() {
    return role.equals("CUSTOMER");
  }
}
