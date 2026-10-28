# code-server + Node.js 20 image for CodeCollabAI project workspaces
# Based on the official code-server image with Node.js added

FROM codercom/code-server:latest

# Switch to root to install system packages
USER root

# Install Node.js 20 LTS and common dev tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    python3 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory
RUN mkdir -p /workspace && chown coder:coder /workspace

# Switch back to the non-root coder user
USER coder

# Set the workspace as default directory
WORKDIR /workspace

# Expose code-server port
EXPOSE 8080

# Default entrypoint: code-server with bind-addr and workspace
# Password and other settings are passed via environment variables
ENTRYPOINT ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "password", "/workspace"]


