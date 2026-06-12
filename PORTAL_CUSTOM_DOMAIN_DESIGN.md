# Portal Custom Domain Design

## 1. 背景和目标

Portal 需要支持客户绑定自己的自有域名，例如 `support.example.com`，使外部用户可以通过客户域名访问对应项目的 Portal。

本设计参考 GitHub Pages 的自定义域名模式：

1. 用户在产品内保存自定义域名。
2. 系统生成 DNS TXT 验证记录，证明用户拥有该域名。
3. 用户在 DNS 服务商处配置解析和 TXT 记录。
4. 用户回到产品内点击验证。
5. 验证通过后，该域名才会生效并路由到对应 Portal。
6. 网关层自动签发或加载 TLS 证书，使 HTTPS 可访问。

核心目标：

- 防止未验证域名保存后立即生效，避免域名抢占和 Host 劫持风险。
- 用户侧只需要配置 DNS，不需要接触服务器配置。
- 线上证书签发和续期尽量自动化，避免每个域名人工处理。
- 应用层只处理域名绑定、权属验证和 Portal 路由；TLS 由网关层处理。

## 2. 范围

本功能覆盖：

- 每个 Portal 绑定一个自定义域名。
- 自定义域名唯一，不能被多个 Portal 复用。
- 保存域名后生成 TXT challenge。
- 只有 TXT 验证通过的域名才允许访问 Portal。
- Portal 前端路由在自定义域名下使用根路径，例如 `/`、`/chat/`、`/my-issues/`。
- SQL 建表语句已补充到 `sql/mysql.sql`。

本功能不覆盖：

- 数据库迁移脚本，由运维或迁移流程单独处理。
- 在 Django 内部处理 TLS 证书。
- 手动为每个客户域名配置 Nginx server block。
- 支持一个 Portal 多个自定义域名。

## 3. 术语

- 自定义域名：客户自己的域名，例如 `support.example.com`。
- DNS target：平台提供给客户配置 CNAME/ALIAS 的目标，例如 `portal.seaqa.example.com`。
- TXT challenge：平台生成的 DNS TXT 记录，用于证明客户拥有该域名。
- Portal ingress：线上接收 Portal 域名流量的网关，可以是 Caddy、Nginx Ingress、Load Balancer 或 CDN。
- Verified domain：TXT 验证通过、允许生效的自定义域名。

## 4. 用户侧配置流程

用户在产品内看到的流程应为：

1. 进入项目 Portal 设置页。
2. 在 `Custom domain` 输入框填写域名，例如：

   ```text
   support.example.com
   ```

3. 点击保存。
4. 系统展示 DNS 配置说明：

   流量解析记录：

   ```text
   Type: CNAME
   Name: support
   Value: portal.seaqa.example.com
   ```

   权属验证记录：

   ```text
   Type: TXT
   Name: _seaqa-portal-challenge.support.example.com
   Value: seaqa-portal-verification=<token>
   ```

5. 用户到 DNS 服务商控制台添加上述记录。
6. 等待 DNS 生效。
7. 回到 Portal 设置页点击 `Verify`。
8. 验证成功后，系统显示域名已验证，并展示可访问地址：

   ```text
   https://support.example.com/
   ```

## 5. DNS 配置说明

### 5.1 子域名推荐使用 CNAME

推荐客户绑定子域名，例如：

```text
support.example.com
help.example.com
portal.example.com
```

客户 DNS 侧配置：

```text
Type: CNAME
Name: support
Value: portal.seaqa.example.com
TTL: 300 或默认值
```

注意：

- `Value` 只填写域名，不包含 `https://`。
- 不填写路径，例如不能写 `portal.seaqa.example.com/portal/xxx/`。
- 不填写端口。
- DNS target 由服务端配置项 `PORTAL_CUSTOM_DOMAIN_DNS_TARGET` 提供给前端展示。

### 5.2 根域名使用 ALIAS/ANAME 或 A 记录

如果客户希望绑定根域名：

```text
example.com
```

标准 DNS 不允许根域名直接配置 CNAME。此时有三种选择：

1. DNS 服务商支持 ALIAS/ANAME：配置到 `portal.seaqa.example.com`。
2. 使用 A/AAAA 记录：指向我们 Portal ingress 的固定公网 IP。
3. 建议客户改用子域名，例如 `support.example.com`。

MVP 建议只在产品说明中推荐子域名 CNAME。根域名可作为后续增强场景处理。

### 5.3 TXT 验证记录

保存自定义域名后，系统生成：

```text
Name: _seaqa-portal-challenge.<custom-domain>
Value: seaqa-portal-verification=<verification-token>
```

例如客户绑定 `support.example.com`：

```text
Type: TXT
Name: _seaqa-portal-challenge.support.example.com
Value: seaqa-portal-verification=9f1a...
```

验证接口会查询该 TXT 记录，只有完全匹配期望值时才标记为 verified。

### 5.4 CDN 代理注意事项

如果客户使用 Cloudflare 等 CDN：

- TXT 验证不受 CDN 代理影响。
- CNAME 流量解析如果开启代理，TLS 可能在 CDN 侧终止。
- MVP 建议提示客户先使用 DNS only 模式，等平台证书签发完成后再开启代理。
- 如果客户坚持使用 CDN 代理，需要确保 CDN 到源站的 Host、SNI、HTTPS 模式正确，否则可能出现 525/526 或 Host 路由失败。

## 6. 应用层设计

### 6.1 数据模型

表：`portal_custom_domains`

字段：

```sql
CREATE TABLE `portal_custom_domains` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `domain` varchar(255) NOT NULL,
  `project_uuid` char(36) NOT NULL,
  `verification_token` varchar(64) NOT NULL,
  `verified` TINYINT(1) NOT NULL DEFAULT 0,
  `verified_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `portal_custom_domains_domain_uniq` (`domain`),
  UNIQUE KEY `portal_custom_domains_project_uuid_uniq` (`project_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

约束：

- `domain` 唯一，防止同一个域名绑定到多个 Portal。
- `project_uuid` 唯一，当前设计为一个 Portal 只能绑定一个自定义域名。
- `verified = 1` 时才允许该域名作为访问入口。

### 6.2 域名保存

域名配置使用独立接口，不与 Portal 其他设置混在 `/settings/` 中提交。

读取接口：

```text
GET /api/v1/portal/<project_uuid>/custom-domain/
```

返回当前绑定、TXT 验证信息和可访问 URL：

```json
{
  "custom_domain": "support.example.com",
  "custom_domain_verified": false,
  "custom_domain_verified_at": null,
  "custom_domain_txt_record_name": "_seaqa-portal-challenge.support.example.com",
  "custom_domain_txt_record_value": "seaqa-portal-verification=<token>",
  "custom_domain_dns_target": "portal.seaqa.example.com",
  "custom_public_url": "",
  "default_public_url": "https://service.example.com/portal/<project_uuid>/",
  "public_url": "https://service.example.com/portal/<project_uuid>/"
}
```

保存接口：

```text
POST /api/v1/portal/<project_uuid>/custom-domain/
```

请求包含：

```json
{
  "custom_domain": "support.example.com"
}
```

处理逻辑：

1. 校验项目存在。
2. 校验当前用户是项目管理员。
3. 规范化域名：
   - 转小写。
   - 不允许 scheme，例如 `https://`。
   - 不允许 path、query、fragment。
   - 不允许 port。
   - 必须是完整域名。
   - 不允许保留域名，例如服务自身域名。
4. 检查域名是否已被其他项目绑定。
5. 新建或更新 `portal_custom_domains`。
6. 如果域名发生变化，重置验证状态：
   - 生成新的 `verification_token`。
   - `verified = false`。
   - `verified_at = null`。
7. 如果提交空字符串，删除当前项目的自定义域名绑定。

保存成功不代表域名可访问。

### 6.3 验证域名

接口：

```text
POST /api/v1/portal/<project_uuid>/custom-domain/verify/
```

处理逻辑：

1. 校验项目存在。
2. 校验当前用户是项目管理员。
3. 查询当前项目绑定的自定义域名。
4. 生成待查询 TXT record name：

   ```text
   _seaqa-portal-challenge.<domain>
   ```

5. 生成期望 TXT value：

   ```text
   seaqa-portal-verification=<verification-token>
   ```

6. 使用 DNS resolver 查询 TXT。
7. 如果匹配，更新：

   ```text
   verified = true
   verified_at = now()
   ```

8. 如果不匹配，返回错误：

   ```text
   TXT record not found or invalid.
   ```

### 6.4 Host 路由

中间件在请求进入 URL routing 前处理：

1. 读取请求 Host，不包含 port。
2. 根据 Host 查询 `portal_custom_domains`。
3. 只有存在且 `verified = true` 才继续处理。
4. 如果请求路径中显式包含 `project_uuid`，必须与该 Host 绑定的 `project_uuid` 一致；不一致直接返回 404。

   需要检查的路径包括：

   ```text
   /portal/<project_uuid>/...
   /portal-edit/<project_uuid>/...
   /api/v1/portal/<project_uuid>/...
   /portal-external/logout/<project_uuid>/
   /portal-external/accept/<token>/<project_uuid>/
   /upload-file/portal/<project_uuid>/...
   /file/portal/<project_uuid>/...
   ```

   这样可以防止客户 A 的自定义域名被当成客户 B Portal 或 Portal API 的入口。

5. 将自定义域名根路径下的 Portal 页面路径映射到内部标准 Portal 路径：

   ```text
   /                       -> /portal/<project_uuid>/
   /chat/                  -> /portal/<project_uuid>/chat/
   /my-issues/             -> /portal/<project_uuid>/my-issues/
   /knowledge-base/        -> /portal/<project_uuid>/knowledge-base/
   /login/                 -> /portal/<project_uuid>/login/
   /anonymous-validate/    -> /portal/<project_uuid>/anonymous-validate/
   /logout/                -> /portal-external/logout/<project_uuid>/
   /external/accept/<token>/ -> /portal-external/accept/<token>/<project_uuid>/
   ```

6. 对同一 `project_uuid` 的标准 Portal/API/文件路径，不做路径改写。
7. 对命中的自定义域名请求设置 `request.portal_custom_domain`，供后续 URL 构造使用。

未验证域名不会触发该映射。

### 6.5 URL 生成

标准 Portal URL：

```text
https://service.example.com/portal/<project_uuid>/
```

已验证自定义域名 URL：

```text
https://support.example.com/
```

规则：

- `public_url` 优先使用已验证自定义域名。
- 未验证时回退到标准 Portal URL。
- 邀请链接只有在自定义域名已验证后才使用自定义域名。
- 标准域名邀请链接使用 `/portal-external/accept/<token>/<project_uuid>/`。
- 自定义域名邀请链接使用 `/external/accept/<token>/`，项目归属由 Host 绑定关系决定。
- 前端设置页只有在自定义域名已验证后才展示可复制的自定义域名访问 URL。

## 7. TLS 证书设计

### 7.1 谁获取证书

证书应该由我们平台侧网关自动获取和续期。

用户只负责 DNS：

- CNAME/ALIAS/A 指向我们的 Portal ingress。
- TXT challenge 证明域名所有权。

不建议要求用户上传证书，也不建议运维为每个域名手工配置证书。

### 7.2 TLS 不在 Django 层处理

Django 应用只看到已经被网关转发过来的 HTTP 请求。TLS 握手发生在网关层，因此证书配置位置是：

- Caddy
- Nginx / OpenResty
- Kubernetes Ingress
- 云 Load Balancer
- CDN

Django 不负责 ACME challenge、证书私钥存储、TLS reload。

### 7.3 推荐 MVP：Caddy On-Demand TLS

如果当前部署是普通 VM 或单机服务，最简单方案是使用 Caddy 作为 Portal ingress。

请求链路：

```text
User Browser
  -> https://support.example.com
  -> DNS CNAME portal.seaqa.example.com
  -> Caddy
  -> Django/Gunicorn
```

Caddy 负责：

- 接收任意客户自定义域名 Host。
- 在首次 HTTPS 请求时申请 Let’s Encrypt 证书。
- 缓存证书。
- 自动续期。
- 反向代理到 Django。

基础 Caddyfile 示例：

```caddyfile
{
  email ops@example.com
}

:443 {
  tls {
    on_demand
  }

  reverse_proxy 127.0.0.1:8000
}
```

但不能直接开放 unrestricted on-demand TLS，否则任何人把域名解析到我们这里都可能触发证书申请，消耗证书额度。

需要增加 on-demand TLS 准入校验：

```caddyfile
{
  email ops@example.com

  on_demand_tls {
    ask http://127.0.0.1:8000/internal/portal/custom-domain/allow-tls
  }
}

:443 {
  tls {
    on_demand
  }

  reverse_proxy 127.0.0.1:8000
}
```

`ask` 接口逻辑：

```text
GET /internal/portal/custom-domain/allow-tls?domain=support.example.com
```

返回规则：

- 如果 `domain` 是已验证的 Portal 自定义域名，返回 `200`。
- 否则返回 `403`。

当前代码还没有实现该 internal ask 接口。若采用 Caddy on-demand TLS，建议补充该接口。

### 7.4 Kubernetes 推荐：cert-manager + ingress-nginx

如果线上是 Kubernetes，推荐标准方案：

- ingress-nginx 作为入口。
- cert-manager 负责 ACME 证书签发和续期。
- 每个已验证自定义域名创建或更新 Ingress TLS 配置。

流程：

1. 用户保存域名并配置 DNS。
2. 用户完成 TXT 验证。
3. 系统标记域名 verified。
4. 后台任务或控制器创建 Ingress：

   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: portal-custom-domain-support-example-com
     annotations:
       cert-manager.io/cluster-issuer: letsencrypt-prod
   spec:
     ingressClassName: nginx
     tls:
       - hosts:
           - support.example.com
         secretName: portal-custom-domain-support-example-com-tls
     rules:
       - host: support.example.com
         http:
           paths:
             - path: /
               pathType: Prefix
               backend:
                 service:
                   name: seaqa-web
                   port:
                     number: 80
   ```

5. cert-manager 通过 HTTP-01 或 DNS-01 完成证书签发。
6. ingress-nginx 自动加载证书。

注意：

- HTTP-01 要求 `support.example.com` 已经解析到 ingress。
- DNS-01 需要平台有 DNS Provider API 权限，一般不适合客户自有域名，除非客户授权。
- 对客户自有域名，HTTP-01 更常见。

### 7.5 Nginx + certbot 方案

如果必须使用传统 Nginx：

1. 保存并验证域名。
2. 后台任务为该域名生成 Nginx server 配置。
3. 执行 certbot 或 acme.sh 签发证书。
4. 写入证书路径。
5. reload Nginx。
6. 配置自动续期。

该方案可行，但不建议作为首选，因为：

- 需要动态写配置文件。
- reload 失败会影响线上入口。
- 证书续期、失败重试、并发控制都要自己处理。
- 运维复杂度高于 Caddy 或 cert-manager。

### 7.6 是否需要人工处理

目标方案不需要人工处理单个客户域名。

人工只需要处理平台级配置：

- 配置 Portal ingress 域名，例如 `portal.seaqa.example.com`。
- 配置 `PORTAL_CUSTOM_DOMAIN_DNS_TARGET`。
- 配置 Caddy/cert-manager。
- 配置证书申请邮箱、ACME issuer、限流和监控。

客户每新增一个域名，不应该需要运维手动登录服务器修改配置。

## 8. 线上部署方案

### 8.1 必需配置

应用配置：

```text
PORTAL_CUSTOM_DOMAIN_DNS_TARGET=portal.seaqa.example.com
SEAQA_WEB_SERVICE_URL=https://app.seaqa.example.com
```

DNS：

```text
portal.seaqa.example.com -> Portal ingress IP
```

客户域名：

```text
support.example.com CNAME portal.seaqa.example.com
_seaqa-portal-challenge.support.example.com TXT seaqa-portal-verification=<token>
```

网关：

- 接受客户自定义 Host。
- 保留原始 Host 转发给 Django。
- 设置 `X-Forwarded-Proto`，确保应用能判断 HTTPS。
- 负责 TLS 证书签发和续期。

### 8.2 推荐上线顺序

1. 上线数据库表。
2. 上线应用代码，但暂不对外宣传功能。
3. 配置 `PORTAL_CUSTOM_DOMAIN_DNS_TARGET`。
4. 配置 Portal ingress 支持自定义 Host。
5. 配置 TLS 自动签发。
6. 使用测试域名完成端到端验证。
7. 开放给用户。

### 8.3 证书签发状态

当前应用只记录域名 TXT 验证状态，没有记录证书状态。

如果需要更完整的产品体验，建议后续增加：

```text
tls_status: pending | issuing | active | failed
tls_error: text
tls_issued_at: datetime
```

MVP 可以先不入库证书状态，但 UI 文案应明确：

```text
DNS verification passed. HTTPS may take a few minutes to become available.
```

## 9. 本地测试

### 9.1 测试 Host 路由

本地不需要真实 DNS，可以使用 `/etc/hosts`。

添加：

```text
127.0.0.1 support.local.test
```

数据库插入已验证记录：

```sql
INSERT INTO portal_custom_domains
(domain, project_uuid, verification_token, verified, verified_at, created_at, updated_at)
VALUES
('support.local.test', '<project_uuid>', 'local-test-token', 1, NOW(6), NOW(6), NOW(6));
```

启动本地 Web 服务后访问：

```text
http://support.local.test:<port>/
```

预期：

- 中间件识别 Host。
- `/` 映射到 `/portal/<project_uuid>/`。
- 页面内部路由使用 `/chat/`、`/my-issues/` 等根路径。

### 9.2 测试 Host 与 project_uuid 不匹配

使用已验证记录：

```sql
INSERT INTO portal_custom_domains
(domain, project_uuid, verification_token, verified, verified_at, created_at, updated_at)
VALUES
('support.local.test', '<project_uuid>', 'local-test-token', 1, NOW(6), NOW(6), NOW(6));
```

访问其他项目的标准 Portal 或 Portal API：

```text
http://support.local.test:<port>/portal/<other_project_uuid>/
http://support.local.test:<port>/api/v1/portal/<other_project_uuid>/settings/
```

预期：

- 返回 404。
- 不应展示或返回其他项目的 Portal 内容。
- 同一 `project_uuid` 的 API 请求可以继续由原 API 处理，但不会映射到其他项目。

### 9.3 测试邀请链接

已验证自定义域名后，创建 Portal 外部用户邀请。

预期：

- 列表接口和邀请邮件中的链接使用 `https://support.local.test/external/accept/<token>/`。
- 访问 `/external/accept/<token>/` 会映射到绑定项目的内部接受邀请路由。
- 未验证或未配置自定义域名时，邀请链接仍使用标准 `/portal-external/accept/<token>/<project_uuid>/`。

### 9.4 测试未验证域名不生效

插入或更新：

```sql
UPDATE portal_custom_domains
SET verified = 0, verified_at = NULL
WHERE domain = 'support.local.test';
```

访问：

```text
http://support.local.test:<port>/
```

预期：

- 不应映射到 Portal。
- 不应展示该 Portal 内容。

### 9.5 测试完整 DNS TXT 验证

完整 Verify 流程需要真实可配置 DNS 的域名。`/etc/hosts` 不能让后端 DNS TXT 查询成功。

测试步骤：

1. 准备测试域名，例如 `portal-test.example.com`。
2. 在产品内保存该域名。
3. 根据设置页展示内容添加 TXT。
4. 使用命令确认 TXT 生效：

   ```bash
   dig TXT _seaqa-portal-challenge.portal-test.example.com
   ```

5. 点击 Verify。
6. 确认状态变为 verified。

### 9.6 本地 TLS 测试

本地一般不测试 Let’s Encrypt，因为 ACME 需要公网可访问域名。

可选方案：

- 只测 HTTP Host 路由。
- 使用 Caddy 本地自签证书测试 HTTPS。
- 使用 ngrok/cloudflared 暴露本地服务，再用真实测试域名做端到端验证。

## 10. 错误和边界场景

### 10.1 保存域名但未配置 DNS

结果：

- 保存成功。
- 状态是 Not verified。
- 自定义域名不生效。

### 10.2 只配置 TXT，不配置 CNAME

结果：

- Verify 可以成功。
- 应用层认为域名已验证。
- 但用户访问域名可能打不开，因为流量没有指向 Portal ingress。

可选增强：

- 在 Verify 时同时检查 CNAME/A 是否指向平台 DNS target。
- 或在 UI 上显示 DNS target 检测状态。

### 10.3 只配置 CNAME，不配置 TXT

结果：

- 流量可能能到达平台网关。
- 应用层不会映射到 Portal，因为域名未 verified。
- Verify 会失败。

### 10.4 DNS 已正确配置但 HTTPS 不可用

可能原因：

- 证书还在签发中。
- ACME HTTP-01 无法访问。
- 域名经过 CDN 代理导致 ACME 验证失败。
- Caddy/cert-manager 未正确配置。
- Let’s Encrypt rate limit。

处理：

- 检查网关证书签发日志。
- 检查域名是否解析到 Portal ingress。
- 检查 `/.well-known/acme-challenge/` 是否能到达 ACME handler。
- 检查是否开启 CDN proxy。

### 10.5 用户更换域名

结果：

- 新域名保存后重新生成 token。
- `verified` 重置为 false。
- 旧域名不再绑定该 Portal。
- 新域名必须重新配置 TXT 并验证。

### 10.6 Host 已验证但 project_uuid 不匹配

场景：

- `support.example.com` 已验证并绑定到项目 A。
- 请求路径显式访问项目 B，例如 `/portal/<project_b_uuid>/` 或 `/api/v1/portal/<project_b_uuid>/...`。

结果：

- 应用直接返回 404。
- 不应回退到标准 Portal 路由。
- 不应返回项目 B 的 Portal 页面、API 数据、文件或邀请/登录相关响应。

## 11. 安全考虑

- 只有项目管理员可以保存和验证自定义域名。
- 域名保存后不会立即生效，必须 TXT 验证。
- Host 路由只接受 verified 域名。
- verified 自定义 Host 下，所有显式包含 `project_uuid` 的 Portal 页面、Portal API、文件、邀请和登出路径都必须与绑定项目一致；不一致直接 404。
- 邀请链接只使用 verified 域名。
- Caddy on-demand TLS 必须配置 ask 接口，防止任意域名触发证书申请。
- 不允许用户输入 scheme、path、query、fragment、port。
- 自定义域名不能等于平台自身服务域名。
- 生产环境应限制内部 TLS ask 接口只能被本机或网关访问。

## 12. 运维监控建议

建议监控：

- 域名验证失败次数。
- DNS 查询异常。
- 已验证域名数量。
- TLS 签发成功率。
- TLS 签发失败原因。
- 证书即将过期数量。
- 自定义域名 Host 请求 4xx/5xx。

建议日志：

- 保存域名：project_uuid、domain、operator。
- 验证成功/失败：project_uuid、domain、reason。
- Host 路由命中：domain、project_uuid。
- Host/project_uuid 不匹配拒绝：domain、bound_project_uuid、requested_project_uuid、route_type。
- TLS ask 拒绝：domain、reason。

## 13. MVP 建议

最简单且可运维的 MVP：

1. 产品内支持保存域名和 TXT 验证。
2. 用户配置：
   - CNAME 到 `PORTAL_CUSTOM_DOMAIN_DNS_TARGET`。
   - TXT challenge。
3. 应用只对 verified 域名生效。
4. 线上使用 Caddy on-demand TLS。
5. 补充 Caddy ask 接口，只允许 verified 域名签证书。
6. UI 提示：验证通过后 HTTPS 可能需要几分钟生效。

如果当前线上已经是 Kubernetes，则用 `cert-manager + ingress-nginx` 替代 Caddy。

## 14. 后续增强

- 增加 TLS 状态入库和前端展示。
- 验证 CNAME/A 是否指向平台 DNS target。
- 支持 apex domain 的 ALIAS/A 记录检测。
- 支持多个自定义域名绑定到同一个 Portal。
- 增加后台任务定期重新校验域名 DNS。
- 自定义域名解绑时清理网关证书或 Ingress 配置。
- 提供用户可复制的一键 DNS 配置说明。
