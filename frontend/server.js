const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.FRONTEND_PORT || 3000);
const BACKEND = new URL(process.env.BACKEND_URL || "http://127.0.0.1:5000");
const PUBLIC_DIR = path.join(__dirname, "public");
const PAGE_ROUTES = {
    "/login": "login.html",
    "/register": "register.html",
    "/dashboard": "dashboard.html",
    "/weather": "weather.html",
    "/countries": "countries.html",
    "/news": "news.html"
};
const PROTECTED_PAGES = new Set(["dashboard.html", "weather.html", "countries.html", "news.html"]);
const CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon"
};

function requestBackend(options, callback) {
    const transport = BACKEND.protocol === "https:" ? https : http;
    return transport.request({
        hostname: BACKEND.hostname,
        port: BACKEND.port || (BACKEND.protocol === "https:" ? 443 : 80),
        method: options.method,
        path: options.path,
        headers: { ...options.headers, host: BACKEND.host }
    }, callback);
}

function checkSession(cookie) {
    return new Promise((resolve, reject) => {
        const request = requestBackend({
            method: "GET",
            path: "/api/auth/session",
            headers: cookie ? { cookie } : {}
        }, (response) => {
            response.resume();
            response.on("end", () => resolve(response.statusCode >= 200 && response.statusCode < 300));
        });
        request.setTimeout(5000, () => request.destroy(new Error("Backend request timed out")));
        request.on("error", reject);
        request.end();
    });
}

function serveFile(response, filename, noStore = false) {
    const fullPath = path.resolve(PUBLIC_DIR, filename);
    if (!fullPath.startsWith(PUBLIC_DIR + path.sep)) {
        response.writeHead(403).end("Forbidden");
        return;
    }
    fs.stat(fullPath, (error, stat) => {
        if (error || !stat.isFile()) {
            response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
            return;
        }
        response.writeHead(200, {
            "Content-Type": CONTENT_TYPES[path.extname(fullPath).toLowerCase()] || "application/octet-stream",
            "Content-Length": stat.size,
            "Cache-Control": noStore ? "no-store" : "public, max-age=300"
        });
        fs.createReadStream(fullPath).pipe(response);
    });
}

function proxyApi(request, response) {
    const upstream = requestBackend({
        method: request.method,
        path: request.url,
        headers: request.headers
    }, (backendResponse) => {
        response.writeHead(backendResponse.statusCode || 502, backendResponse.headers);
        backendResponse.pipe(response);
    });
    upstream.on("error", () => {
        if (!response.headersSent) response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ message: "Backend API is unavailable. Start the backend server and try again." }));
    });
    request.pipe(upstream);
}

const app = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        proxyApi(request, response);
        return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
        return;
    }
    if (url.pathname === "/") {
        response.writeHead(302, { Location: "/login" }).end();
        return;
    }

    const mappedFile = PAGE_ROUTES[url.pathname];
    const requestedFile = mappedFile || decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const filename = path.basename(requestedFile);
    if (PROTECTED_PAGES.has(filename)) {
        try {
            if (!(await checkSession(request.headers.cookie))) {
                response.writeHead(302, { Location: "/login", "Cache-Control": "no-store" }).end();
                return;
            }
        } catch (error) {
            response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" }).end("Cannot reach the backend. Start it on port 5000 and refresh.");
            return;
        }
    }
    serveFile(response, requestedFile, Boolean(mappedFile));
});

app.listen(PORT, () => console.log(`Frontend running at http://localhost:${PORT}`));
