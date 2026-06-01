# === Stage 1: Clone repo ===
FROM alpine/git AS git-clone

WORKDIR /app
RUN git clone https://github.com/Eugeny/tabby.git .

# === Stage 2: Build tabby ===
FROM node:22-slim AS builder-tabby

WORKDIR /tabby
COPY --from=git-clone /app .

# Install required dependencies for native modules
RUN apt-get update && apt-get install -y \
    libfontconfig1-dev \
    git \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install project dependencies. The Docker build only needs Tabby's JS
# dependencies/typings, not a runnable Electron binary; skipping the Electron
# binary download avoids flaky network failures during plugin builds.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN cd app && yarn && cd .. && yarn

# Build typings and full application
RUN yarn run build:typings

# === Stage 3: Build tabby-mcp ===
FROM node:22-slim AS builder-mcp

WORKDIR /tabby

COPY --from=builder-tabby /tabby .

WORKDIR /tabby/tabby-mcp
COPY package*.json ./

# Install dependencies with alternative approach for peer deps
RUN npm install --production=false --legacy-peer-deps || npm install --production=false --force || npm ci --production=false

COPY . .
RUN npm run build

# === Stage 4: Production image ===
FROM node:22-slim AS production

WORKDIR /tabby/tabby-mcp

# Copy built artifacts
COPY --from=builder-mcp /tabby/tabby-mcp/dist ./dist

# Copy node_modules from both stages
COPY --from=builder-tabby /tabby/node_modules ./node_modules
COPY --from=builder-mcp /tabby/tabby-mcp/node_modules ./node_modules

RUN rm node_modules/tabby-core && \
    rm node_modules/tabby-settings && \
    rm -rf node_modules/tabby-terminal

# Hack
RUN mkdir -p node_modules/tabby-core && \
    mkdir -p node_modules/tabby-settings && \
    mkdir -p node_modules/tabby-terminal

COPY --from=builder-tabby /tabby/tabby-core ./node_modules/tabby-core
COPY --from=builder-tabby /tabby/tabby-settings ./node_modules/tabby-settings
COPY --from=builder-tabby /tabby/tabby-terminal ./node_modules/tabby-terminal

# Copy README, package.json, and LICENSE
COPY README.md package.json LICENSE ./

# Create volumes for output and node_modules
VOLUME ["/output"]
VOLUME ["/node_modules_export"]

# Copy dist contents and node_modules to the output volumes when container starts
CMD ["sh", "-c", "cp -r ./dist/ README.md package.json LICENSE /output/ && cp -rf ./node_modules/* /node_modules_export/"]