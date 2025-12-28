"""
FastAPI Proxy for AI Agent Factory
Forwards all requests to the Node.js backend running on port 3010
"""
import os
import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import subprocess
import asyncio
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Node.js backend configuration
NODE_PORT = 3010
NODE_HOST = "127.0.0.1"

# Global process reference
node_process = None

async def start_node_backend():
    """Start the Node.js backend server"""
    global node_process
    
    logger.info(f"Starting Node.js backend on port {NODE_PORT}...")
    
    env = os.environ.copy()
    env["PORT"] = str(NODE_PORT)
    env["NODE_ENV"] = "production"
    
    # Start Node.js process
    node_process = subprocess.Popen(
        ["node", "/app/dist/server.js"],
        env=env,
        cwd="/app",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT
    )
    
    # Wait for startup
    for i in range(10):
        await asyncio.sleep(1)
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"http://{NODE_HOST}:{NODE_PORT}/health", timeout=2)
                if response.status_code == 200:
                    logger.info("Node.js backend started successfully")
                    return node_process
        except:
            pass
    
    logger.warning("Node.js backend may not have started properly")
    return node_process

async def stop_node_backend():
    """Stop the Node.js backend server"""
    global node_process
    if node_process:
        logger.info("Stopping Node.js backend...")
        node_process.terminate()
        try:
            node_process.wait(timeout=5)
        except:
            node_process.kill()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    await start_node_backend()
    yield
    await stop_node_backend()

# Create FastAPI app
app = FastAPI(
    title="AI Agent Factory API",
    lifespan=lifespan
)

# CORS middleware - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

async def proxy_request(request: Request, path: str) -> Response:
    """Proxy a request to the Node.js backend"""
    url = f"http://{NODE_HOST}:{NODE_PORT}/{path}"
    
    # Add query params
    if request.query_params:
        url += f"?{request.query_params}"
    
    # Get request body
    body = await request.body()
    
    # Forward headers (exclude problematic ones)
    headers = {}
    for key, value in request.headers.items():
        if key.lower() not in ['host', 'content-length', 'transfer-encoding']:
            headers[key] = value
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.request(
                method=request.method,
                url=url,
                content=body,
                headers=headers,
            )
            
            # Build response headers (exclude problematic ones)
            response_headers = {}
            for key, value in response.headers.items():
                if key.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']:
                    response_headers[key] = value
            
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=response_headers,
                media_type=response.headers.get('content-type', 'application/json'),
            )
    except httpx.RequestError as e:
        logger.error(f"Proxy error for {url}: {e}")
        return Response(
            content=f'{{"error": "Backend unavailable", "details": "{str(e)}"}}',
            status_code=503,
            media_type="application/json",
        )

# Health check endpoint (direct, no proxy)
@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"ok": True, "service": "proxy"}

# Proxy /api/* routes
@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_api(request: Request, path: str):
    """Proxy API requests to Node.js backend"""
    return await proxy_request(request, f"api/{path}")

# Proxy /debug/* routes
@app.api_route("/debug/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_debug(request: Request, path: str):
    """Proxy debug requests to Node.js backend"""
    return await proxy_request(request, f"debug/{path}")

# Proxy /master/* routes (Telegram webhooks)
@app.api_route("/master/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_master(request: Request, path: str):
    """Proxy master webhook requests to Node.js backend"""
    return await proxy_request(request, f"master/{path}")

# Proxy /tg/* routes (Telegram bot webhooks)
@app.api_route("/tg/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_tg(request: Request, path: str):
    """Proxy Telegram bot webhook requests to Node.js backend"""
    return await proxy_request(request, f"tg/{path}")
