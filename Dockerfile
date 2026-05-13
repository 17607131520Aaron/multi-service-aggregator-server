ARG NODE_VERSION=25-alpine
ARG PNPM_VERSION=10.33.0

FROM node:${NODE_VERSION} AS base

ARG PNPM_VERSION

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN npm install -g pnpm@${PNPM_VERSION}

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build

COPY nest-cli.json tsconfig.build.json tsconfig.eslint.json tsconfig.json ./
COPY src ./src
COPY config ./config
COPY test ./test

RUN pnpm build

FROM base AS prod-deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:${NODE_VERSION} AS runtime

ARG APP_ENV=production

ENV NODE_ENV=$APP_ENV
ENV APP_ENV=$APP_ENV
ENV TZ=Asia/Shanghai

WORKDIR /app

RUN apk add --no-cache tini

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/config ./config
COPY package.json ./

EXPOSE 9000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
