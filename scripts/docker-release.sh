#!/usr/bin/env bash

set -euo pipefail

# 终端环境选择菜单中，直接按回车时使用的默认环境。
DEFAULT_APP_ENV="${DEFAULT_APP_ENV:-test}"

# Docker Hub 的账号或命名空间，用来拼接完整镜像仓库名。
DEFAULT_DOCKER_NAMESPACE="${DEFAULT_DOCKER_NAMESPACE:-yafenghuang777}"

# Docker Hub 登录用户名。不填时默认使用上面的命名空间。
DEFAULT_DOCKER_USERNAME="${DEFAULT_DOCKER_USERNAME:-yafenghuang777}"

# Docker Hub 登录密码。当前脚本已不依赖 Docker Hub 推送，默认可留空。
DEFAULT_DOCKER_PASSWORD="${DEFAULT_DOCKER_PASSWORD:-5820@Feng}"

# Docker 镜像名称，最终仓库名格式为：<命名空间>/<镜像名>。
DEFAULT_IMAGE_NAME="${DEFAULT_IMAGE_NAME:-multi-service-aggregator-server}"

# 远程部署服务器的 IP 或域名，脚本会通过 SSH 连接它。
DEFAULT_SERVER_HOST="${DEFAULT_SERVER_HOST:-120.53.227.126}"

# 远程服务器的 SSH 登录用户名。
DEFAULT_SERVER_USER="${DEFAULT_SERVER_USER:-root}"

# 远程服务器的 SSH 登录密码。填写后会优先使用密码方式执行 ssh 和 scp。
DEFAULT_SERVER_PASSWORD="${DEFAULT_SERVER_PASSWORD:-5820@Feng}"

# 远程服务器上的部署目录，docker-compose.yml 会被复制到这里并在这里执行。
DEFAULT_REMOTE_APP_DIR="${DEFAULT_REMOTE_APP_DIR:-/opt/multi-service-aggregator-server}"

# 容器内使用的时区。
DEFAULT_TZ="${DEFAULT_TZ:-Asia/Shanghai}"

# Docker 构建时使用的 Node.js 基础镜像版本。
DEFAULT_NODE_VERSION="${DEFAULT_NODE_VERSION:-25-alpine}"

# Docker 构建镜像内安装的 pnpm 版本。
DEFAULT_PNPM_VERSION="${DEFAULT_PNPM_VERSION:-10.33.0}"

# Docker 镜像构建目标平台。云服务器通常是 linux/amd64，Apple 芯片电脑常见是 linux/arm64。
DEFAULT_DOCKER_PLATFORM="${DEFAULT_DOCKER_PLATFORM:-linux/amd64}"

# 本地临时导出的镜像 tar 包路径，会被上传到服务器再导入。
DEFAULT_IMAGE_TAR_PATH="${DEFAULT_IMAGE_TAR_PATH:-/tmp/multi-service-aggregator-server.tar}"

APP_ENV="${APP_ENV:-}"
DOCKER_NAMESPACE="${DOCKER_NAMESPACE:-}"
DOCKER_USERNAME="${DOCKER_USERNAME:-${DEFAULT_DOCKER_USERNAME}}"
DOCKER_PASSWORD="${DOCKER_PASSWORD:-${DEFAULT_DOCKER_PASSWORD}}"
IMAGE_REPO="${IMAGE_REPO:-}"
IMAGE_TAG="${IMAGE_TAG:-}"
SERVER_HOST="${SERVER_HOST:-}"
SERVER_USER="${SERVER_USER:-${DEFAULT_SERVER_USER}}"
SERVER_PASSWORD="${SERVER_PASSWORD:-${DEFAULT_SERVER_PASSWORD}}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-${DEFAULT_REMOTE_APP_DIR}}"
CONTAINER_NAME="${CONTAINER_NAME:-}"
TZ_VALUE="${TZ:-${DEFAULT_TZ}}"
NODE_VERSION="${NODE_VERSION:-${DEFAULT_NODE_VERSION}}"
PNPM_VERSION="${PNPM_VERSION:-${DEFAULT_PNPM_VERSION}}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-${DEFAULT_DOCKER_PLATFORM}}"
IMAGE_TAR_PATH="${IMAGE_TAR_PATH:-${DEFAULT_IMAGE_TAR_PATH}}"

default_container_port() {
  case "$1" in
    development) echo "3000" ;;
    test) echo "9999" ;;
    production) echo "9000" ;;
    *)
      echo "Unsupported APP_ENV: $1" >&2
      exit 1
      ;;
  esac
}

prompt_with_default() {
  local prompt="$1"
  local default_value="$2"
  local input

  read -r -p "$prompt [$default_value]: " input
  if [[ -z "$input" ]]; then
    printf '%s\n' "$default_value"
  else
    printf '%s\n' "$input"
  fi
}

run_ssh() {
  if [[ -n "$SERVER_PASSWORD" ]]; then
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$@"
  else
    ssh "$@"
  fi
}

run_scp() {
  if [[ -n "$SERVER_PASSWORD" ]]; then
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no "$@"
  else
    scp "$@"
  fi
}

choose_environment() {
  local default_env="${1:-$DEFAULT_APP_ENV}"
  local options=("development" "test" "production")
  local selected

  echo "Select deployment environment:" >&2
  PS3="Enter choice (default: $default_env): "
  select selected in "${options[@]}"; do
    if [[ -n "${selected:-}" ]]; then
      printf '%s\n' "$selected"
      return
    fi

    if [[ -z "${REPLY:-}" ]]; then
      printf '%s\n' "$default_env"
      return
    fi

    echo "Invalid selection, please choose again." >&2
  done
}

if [[ -z "$APP_ENV" && -t 0 ]]; then
  APP_ENV="$(choose_environment "$DEFAULT_APP_ENV")"
fi

APP_ENV="${APP_ENV:-$DEFAULT_APP_ENV}"

if [[ -z "$DOCKER_NAMESPACE" && -t 0 ]]; then
  DOCKER_NAMESPACE="$(prompt_with_default 'Docker login account/namespace' "$DEFAULT_DOCKER_NAMESPACE")"
fi
DOCKER_NAMESPACE="${DOCKER_NAMESPACE:-$DEFAULT_DOCKER_NAMESPACE}"

if [[ -z "$IMAGE_REPO" ]]; then
  IMAGE_REPO="${DOCKER_NAMESPACE}/${DEFAULT_IMAGE_NAME}"
fi

if [[ -z "$SERVER_HOST" && -t 0 ]]; then
  SERVER_HOST="$(prompt_with_default 'Server IP or hostname' "$DEFAULT_SERVER_HOST")"
fi
SERVER_HOST="${SERVER_HOST:-$DEFAULT_SERVER_HOST}"

if [[ -z "$SERVER_USER" && -t 0 ]]; then
  SERVER_USER="$(prompt_with_default 'Server SSH user' "$DEFAULT_SERVER_USER")"
fi

if [[ -z "$REMOTE_APP_DIR" && -t 0 ]]; then
  REMOTE_APP_DIR="$(prompt_with_default 'Remote app directory' "$DEFAULT_REMOTE_APP_DIR")"
fi

if [[ -z "$APP_ENV" ]]; then
  echo "APP_ENV is required." >&2
  exit 1
fi

CONTAINER_PORT="${CONTAINER_PORT:-$(default_container_port "$APP_ENV")}"
HOST_PORT="${HOST_PORT:-$CONTAINER_PORT}"
IMAGE_TAG="${IMAGE_TAG:-${APP_ENV}}"
CONTAINER_NAME="${CONTAINER_NAME:-multi-service-aggregator-server-${APP_ENV}}"
IMAGE_NAME="${IMAGE_REPO}:${IMAGE_TAG}"
COMPOSE_FILE="docker/docker-compose.remote.yml"

echo "==> Deployment settings"
echo "APP_ENV: $APP_ENV"
echo "Docker namespace: $DOCKER_NAMESPACE"
echo "Image repo: $IMAGE_REPO"
echo "Image tag: $IMAGE_TAG"
echo "Docker platform: $DOCKER_PLATFORM"
echo "Server: $SERVER_USER@$SERVER_HOST"
echo "Remote dir: $REMOTE_APP_DIR"
echo "Port mapping: $HOST_PORT -> $CONTAINER_PORT"
echo "Image tar path: $IMAGE_TAR_PATH"

if [[ -n "$SERVER_PASSWORD" ]] && ! command -v sshpass >/dev/null 2>&1; then
  echo "sshpass is required when SERVER_PASSWORD is configured. Please install sshpass first." >&2
  exit 1
fi

echo "==> Building image: $IMAGE_NAME"
docker build \
  --platform "$DOCKER_PLATFORM" \
  --build-arg NODE_VERSION="$NODE_VERSION" \
  --build-arg PNPM_VERSION="$PNPM_VERSION" \
  --build-arg APP_ENV="$APP_ENV" \
  -t "$IMAGE_NAME" \
  .

echo "==> Saving image tar: $IMAGE_TAR_PATH"
docker save "$IMAGE_NAME" -o "$IMAGE_TAR_PATH"

echo "==> Preparing remote directory: $SERVER_USER@$SERVER_HOST:$REMOTE_APP_DIR"
run_ssh "$SERVER_USER@$SERVER_HOST" "mkdir -p '$REMOTE_APP_DIR'"

echo "==> Uploading image tar to server"
run_scp "$IMAGE_TAR_PATH" "$SERVER_USER@$SERVER_HOST:/tmp/multi-service-aggregator-server.tar"

echo "==> Uploading compose file to server"
run_scp "$COMPOSE_FILE" "$SERVER_USER@$SERVER_HOST:$REMOTE_APP_DIR/docker-compose.yml"

REMOTE_CMD=$(cat <<EOF
set -euo pipefail
docker load -i /tmp/multi-service-aggregator-server.tar
rm -f /tmp/multi-service-aggregator-server.tar
cd '$REMOTE_APP_DIR'
if docker compose version >/dev/null 2>&1; then
  IMAGE_NAME='$IMAGE_NAME' \
  APP_ENV='$APP_ENV' \
  HOST_PORT='$HOST_PORT' \
  CONTAINER_PORT='$CONTAINER_PORT' \
  CONTAINER_NAME='$CONTAINER_NAME' \
  TZ='$TZ_VALUE' \
  docker compose up -d
elif command -v docker-compose >/dev/null 2>&1; then
  IMAGE_NAME='$IMAGE_NAME' \
  APP_ENV='$APP_ENV' \
  HOST_PORT='$HOST_PORT' \
  CONTAINER_PORT='$CONTAINER_PORT' \
  CONTAINER_NAME='$CONTAINER_NAME' \
  TZ='$TZ_VALUE' \
  docker-compose up -d
else
  echo 'Docker Compose is not installed on the server.' >&2
  exit 1
fi
EOF
)

echo "==> Deploying to server and starting container"
run_ssh "$SERVER_USER@$SERVER_HOST" "$REMOTE_CMD"

echo "==> Cleaning up local image tar"
rm -f "$IMAGE_TAR_PATH"

echo "==> Deployment complete"
echo "Image: $IMAGE_NAME"
echo "Server: $SERVER_USER@$SERVER_HOST"
echo "Port: $HOST_PORT -> $CONTAINER_PORT"
