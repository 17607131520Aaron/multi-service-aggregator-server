# multi-service-aggregator-server

一个基于 NestJS 的多服务聚合后端，当前聚焦 3 类能力：

- 用户鉴权：支持 Web 注册/登录，以及 App 端账号、手机号、验证码登录
- AI 对话：提供 Web 端 SSE 流式聊天接口，对接 SenseNova，并用 LangChain 做上下文裁剪与补充
- 系统健康检查：提供 MySQL / Redis 的存活与就绪探针

## 1. 项目概览

### 技术栈

- Node.js + TypeScript
- NestJS 11
- TypeORM
- MySQL
- Redis（ioredis）
- JWT
- Swagger / Scalar API 文档
- LangChain
- Docker

### 已实现模块

```text
src
├── ai              AI 对话、上下文构建
├── app             App 端鉴权接口
├── auth            用户实体、鉴权服务、JWT 守卫
├── common          公共异常、请求上下文、注入 token
├── config          配置解析
├── health          存活/就绪检查
├── interceptors    统一响应、异常处理、DTO 转换、请求日志
├── system          Redis 模块
└── web             Web 端鉴权与 AI 接口
```

## 2. 核心能力

### 2.1 统一响应结构

普通 JSON 接口默认返回：

```json
{
  "code": 0,
  "data": {},
  "message": "success"
}
```

异常场景返回：

```json
{
  "code": 1003,
  "data": null,
  "message": "未授权",
  "path": "/app/auth/profile",
  "requestId": "xxx",
  "timestamp": "2026-05-13T00:00:00.000Z"
}
```

说明：

- `code` 为业务码，默认成功码是 `0`
- `x-request-id` 会自动写入响应头，便于链路追踪
- `web/ai/chat/stream` 是 SSE 流式接口，不走统一 JSON 包装

### 2.2 鉴权机制

- 通过 `Authorization: Bearer <token>` 传递 JWT
- JWT 校验通过后，还会到 Redis 校验登录态是否仍有效
- 登录成功后，服务端会把 token 写入 Redis，key 形如：
  - `auth:token:<userId>`
- App 手机验证码会写入 Redis，key 形如：
  - `auth:sms-code:<phone>`

### 2.3 AI 流式对话

- 接口协议：SSE
- 上游模型：SenseNova
- 支持：
  - 纯文本消息
  - 图文混合输入
  - 模型、温度、`top_p`、`maxTokens`、推理力度参数透传
- 服务端会使用 LangChain 做：
  - 历史消息裁剪
  - 最近轮次提取
  - 用户信息与请求上下文注入
  - 系统提示词合并

## 3. 接口清单

### 3.1 Web 端

#### `POST /web/auth/register`

Web 用户注册。

请求体：

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "secret123",
  "confirmPassword": "secret123"
}
```

#### `POST /web/auth/login`

Web 用户登录。

请求体：

```json
{
  "username": "alice",
  "password": "secret123"
}
```

#### `POST /web/ai/chat/stream`

Web 端 AI 流式聊天。

请求体示例：

```json
{
  "messages": [
    {
      "role": "user",
      "content": "帮我总结一下这个项目"
    }
  ],
  "model": "sensenova-6.7-flash-lite",
  "maxTokens": 2048,
  "temperature": 1,
  "topP": 1,
  "reasoningEffort": "none",
  "deepThinking": false
}
```

SSE 事件类型：

- `meta`：会话元信息
- `chunk`：流式输出片段
- `error`：错误事件
- `done`：流结束

### 3.2 App 端

#### `POST /app/auth/register`

支持两种注册方式：

- `account`：用户名 + 密码
- `phone`：手机号 + 密码

账号注册示例：

```json
{
  "type": "account",
  "username": "alice",
  "password": "secret123",
  "confirmPassword": "secret123"
}
```

手机号注册示例：

```json
{
  "type": "phone",
  "phone": "13800138000",
  "password": "secret123",
  "confirmPassword": "secret123"
}
```

#### `POST /app/auth/login`

支持三种登录方式：

- `account_password`
- `phone_password`
- `phone_code`

账号密码登录示例：

```json
{
  "type": "account_password",
  "username": "alice",
  "password": "secret123"
}
```

手机号验证码登录示例：

```json
{
  "type": "phone_code",
  "phone": "13800138000",
  "verificationCode": "123456"
}
```

#### `POST /app/auth/verification-code`

发送手机验证码。

```json
{
  "phone": "13800138000"
}
```

说明：

- 验证码有效期 300 秒
- 非生产环境下，响应体会回传 `verificationCode`，方便联调

#### `GET /app/auth/profile`

获取当前登录用户信息，需要 Bearer Token。

### 3.3 系统接口

#### `GET /system/health/live`

存活探针。

#### `GET /system/health/ready`

就绪探针，会检查：

- MySQL 连通性
- Redis 连通性

## 4. 数据模型

当前核心表为 `users`，建表脚本见 [src/infrastructure/sql/001_create_users_table.sql](/Users/alone/my-project/multi-service-aggregator-server/src/infrastructure/sql/001_create_users_table.sql:1)。

主要字段：

- `id`
- `username`
- `email`
- `phone`
- `password_hash`
- `registration_source`：`app | web`
- `enabled`
- `last_login_at`
- `created_at`
- `updated_at`

实体定义见 [src/auth/entities/user.entity.ts](/Users/alone/my-project/multi-service-aggregator-server/src/auth/entities/user.entity.ts:1)。

## 5. 配置说明

项目按环境读取：

- `config/application.development.yml`
- `config/application.test.yml`
- `config/application.production.yml`

启动时根据 `NODE_ENV` 选择配置文件；如果未命中，会回退到 `application.test.yml`。

### 关键配置项

#### `app`

- `env`：环境名
- `port`：服务端口
- `apiPrefix`：全局前缀，可选
- `corsOrigins`：允许跨域来源，支持数组或逗号分隔字符串

#### `mysql`

- `host`
- `port`
- `username`
- `password`
- `database`
- `synchronize`
- `logging`

#### `redis`

- `host`
- `port`
- `password`
- `db`
- `keyPrefix`
- `required`

#### `health`

- `mysql.enabled`
- `mysql.timeoutMs`
- `redis.enabled`
- `redis.timeoutMs`

#### `jwt`

- `secret`
- `ttlSeconds`

#### `sensenova`

- `apiUrl`
- `apiToken`
- `model`
- `timeoutMs`

## 6. 本地开发

### 安装依赖

```bash
pnpm install
```

### 启动项目

```bash
# 默认脚本实际以 test 环境启动
pnpm run start

# 开发环境
pnpm run start:dev

# 测试环境
pnpm run start:test

# 生产环境
pnpm run start:prod
```

默认端口：

- `development`: `3000`
- `test`: `9999`
- `production`: `9000`

### API 文档

启动后访问：

```text
/api-docs
```

例如：

- `http://localhost:3000/api-docs`
- `http://localhost:9999/api-docs`
- `http://localhost:9000/api-docs`

## 7. 测试

```bash
pnpm run test
pnpm run test:e2e
pnpm run test:cov
```

当前仓库已包含：

- `src/auth/auth.service.spec.ts`
- `src/auth/jwt-auth.guard.spec.ts`
- `src/ai/langchain-context.service.spec.ts`
- `src/interceptors/http-exception.interceptor.spec.ts`
- `test/app.e2e-spec.ts`

## 8. Docker 与部署

### Docker 构建

```bash
pnpm run docker:build:dev
pnpm run docker:build:test
pnpm run docker:build:prod
```

也可以手动构建：

```bash
docker build --build-arg APP_ENV=production -t multi-service-aggregator-server:production .
```

### 一键发布

```bash
pnpm run docker:release
```

发布脚本位于 [scripts/docker-release.sh](/Users/alone/my-project/multi-service-aggregator-server/scripts/docker-release.sh:1)，流程包括：

1. 构建镜像
2. 导出镜像 tar
3. 上传到远程服务器
4. 远程 `docker load`
5. 使用 `docker compose up -d` 启动

远程 compose 模板见 [docker/docker-compose.remote.yml](/Users/alone/my-project/multi-service-aggregator-server/docker/docker-compose.remote.yml:1)。

## 9. 代码行为说明

### 全局能力

- 全局参数校验：`ValidationPipe`
- 全局异常过滤：`HttpExceptionFilter`
- 全局响应包装：`GlobalResponseWrapperInterceptor`
- DTO 输出转换：`DtoTransformInterceptor`
- 请求日志：`RequestLoggingInterceptor`
- 请求上下文：自动注入 `requestId`

### 公开路由

使用 `@Public()` 标记的接口无需登录，当前主要包括：

- 注册 / 登录
- 发送验证码
- 健康检查
- Web AI 对话接口

### 关于限流

代码中已经有 `@RateLimit()` 元数据装饰器，接口上也打了限流标记，但当前仓库里还没有看到实际执行限流的 Guard / Interceptor，因此它目前更像是“限流规则声明”，不是已经生效的完整限流实现。
