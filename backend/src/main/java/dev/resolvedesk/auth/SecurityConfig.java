package dev.resolvedesk.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {
  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  UserDetailsService users(JdbcTemplate jdbc) {
    return email ->
        jdbc
            .query(
                """
SELECT u.*,t.name AS tenant_name FROM app_users u JOIN tenants t ON t.id=u.tenant_id WHERE u.email=?
""",
                (rs, n) ->
                    new WorkspaceUser(
                        rs.getLong("id"),
                        rs.getLong("tenant_id"),
                        rs.getString("email"),
                        rs.getString("name"),
                        rs.getString("password_hash"),
                        rs.getString("role"),
                        rs.getString("tenant_name")),
                email)
            .stream()
            .findFirst()
            .orElseThrow(() -> new UsernameNotFoundException("Unknown account"));
  }

  @Bean
  SecurityFilterChain security(HttpSecurity http) throws Exception {
    http.authorizeHttpRequests(
            auth ->
                auth.requestMatchers("/api/csrf", "/api/health", "/api/login")
                    .permitAll()
                    .requestMatchers("/api/**")
                    .authenticated()
                    .anyRequest()
                    .permitAll())
        .formLogin(
            form ->
                form.loginProcessingUrl("/api/login")
                    .successHandler(
                        (req, res, authentication) -> {
                          res.setContentType("application/json");
                          res.getWriter().write("{\"ok\":true}");
                        })
                    .failureHandler(
                        (req, res, ex) -> {
                          res.setStatus(401);
                          res.setContentType("application/json;charset=UTF-8");
                          res.getWriter().write("{\"message\":\"邮箱或密码不正确\"}");
                        }))
        .logout(
            logout ->
                logout
                    .logoutUrl("/api/logout")
                    .invalidateHttpSession(true)
                    .deleteCookies("JSESSIONID")
                    .logoutSuccessHandler((req, res, auth) -> res.setStatus(204)))
        .exceptionHandling(
            ex ->
                ex.authenticationEntryPoint(
                        (req, res, e) -> {
                          res.setStatus(401);
                          res.setContentType("application/json;charset=UTF-8");
                          res.getWriter().write("{\"message\":\"请先登录\"}");
                        })
                    .accessDeniedHandler(
                        (req, res, e) -> {
                          res.setStatus(403);
                          res.setContentType("application/json;charset=UTF-8");
                          res.getWriter().write("{\"message\":\"操作被拒绝，请刷新页面后重试\"}");
                        }));
    return http.build();
  }
}
