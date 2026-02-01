FROM node:18-slim

WORKDIR /app

# Install pnpm and build tools
# python3 is usually pre-installed or we install it properly
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    npm install -g pnpm && \
    rm -rf /var/lib/apt/lists/*

# Copy dependency definitions
COPY package.json pnpm-lock.yaml ./

# Install dependencies and rebuild better-sqlite3
# Debian environment handles native modules much better than Alpine
RUN pnpm install && \
    npm rebuild better-sqlite3

# Copy source code
COPY . .

# Build frontend
RUN pnpm build

# Expose port
EXPOSE 3001

# Start the application
CMD ["pnpm", "start"]
