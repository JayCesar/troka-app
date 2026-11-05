FROM python:3.13-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MCP_HOST=0.0.0.0
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir . && useradd -r troka
USER troka
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:%s/health' % (os.environ.get('MCP_PORT') or os.environ.get('PORT') or '8765'))"
CMD ["troka-mcp", "http"]
