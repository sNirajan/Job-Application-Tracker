# Starts from an official Node.js image.
# "alpine" is a tiny Linux distribution (50MB vs 900MB for full Ubuntu).
# Smaller image = faster downloads, less attack surface.
FROM node:20-alpine

# Creates a directory inside the container for our code.
# Everything from here runs inside /app.
WORKDIR /app

# Copies ONLY package files first. Why?
# Docker caches each step. If package.json hasn't changed,
# Docker reuses the cached node_modules instead of reinstalling.
# This makes rebuilds fast, seconds instead of minutes.
COPY package*.json ./

# Installs production dependencies only. No jest, no eslint.
# --omit=dev skips devDependencies.
RUN npm ci --omit=dev

# NOW copying the rest of the code.
# This step is separate so changing a line of code
# doesn't trigger a full npm install.
COPY . .

RUN mkdir -p /app/certs && \
    apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -o /app/certs/us-east-2-bundle.pem \
    https://truststore.pki.rds.amazonaws.com/us-east-2/us-east-2-bundle.pem && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NODE_EXTRA_CA_CERTS=/app/certs/us-east-2-bundle.pem

# Tells Docker which port our app listens on.
# This doesn't actually open the port, it's documentation
# for humans and tools like docker-compose.
EXPOSE 3000

# The command that runs when the container starts.
CMD ["node", "src/server.js"]