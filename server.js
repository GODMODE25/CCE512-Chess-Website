const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT) || 3000;
const messagesPath = path.join(root, "data", "messages.json");

const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
};

const events = [
    {
        title: "Monthly Chess Tournament",
        date: "2026-03-25",
        category: "tournament",
        description: "Compete with club members and test your skills in a focused match environment."
    },
    {
        title: "Strategy Workshop",
        date: "2026-04-10",
        category: "training",
        description: "Learn tactics, planning, and time management from experienced players."
    },
    {
        title: "Inter-School Championship",
        date: "2026-05-15",
        category: "community",
        description: "Represent the school, meet other players, and gain competition experience."
    }
];

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(data));
}

function readRequestBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.on("data", (chunk) => {
            body += chunk;
            if (body.length > 1_000_000) {
                request.destroy();
                reject(new Error("Request body is too large"));
            }
        });
        request.on("end", () => resolve(body));
        request.on("error", reject);
    });
}

function ensureMessageStore() {
    fs.mkdirSync(path.dirname(messagesPath), { recursive: true });
    if (!fs.existsSync(messagesPath)) {
        fs.writeFileSync(messagesPath, "[]\n", "utf8");
    }
}

function serveStatic(request, response) {
    const requestedUrl = new URL(request.url, `http://${request.headers.host}`);
    const safePath = requestedUrl.pathname === "/" ? "/cce512.html" : requestedUrl.pathname;
    const filePath = path.normalize(path.join(root, safePath));

    if (!filePath.startsWith(root)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            response.writeHead(404);
            response.end("Not found");
            return;
        }

        const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
        response.writeHead(200, { "Content-Type": contentType });
        response.end(content);
    });
}

const server = http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/api/events") {
        sendJson(response, 200, { events });
        return;
    }

    if (request.method === "POST" && request.url === "/api/contact") {
        try {
            const body = await readRequestBody(request);
            const message = JSON.parse(body);
            const requiredFields = ["name", "email", "interest", "message"];
            const missingField = requiredFields.find((field) => !String(message[field] || "").trim());

            if (missingField) {
                sendJson(response, 400, { error: `${missingField} is required` });
                return;
            }

            ensureMessageStore();
            const messages = JSON.parse(fs.readFileSync(messagesPath, "utf8"));
            messages.push({
                id: crypto.randomUUID(),
                name: String(message.name).trim(),
                email: String(message.email).trim(),
                interest: String(message.interest).trim(),
                message: String(message.message).trim(),
                createdAt: new Date().toISOString()
            });
            fs.writeFileSync(messagesPath, `${JSON.stringify(messages, null, 2)}\n`, "utf8");
            sendJson(response, 201, { ok: true });
        } catch (error) {
            sendJson(response, 400, { error: "Invalid request" });
        }
        return;
    }

    if (request.method === "GET") {
        serveStatic(request, response);
        return;
    }

    sendJson(response, 405, { error: "Method not allowed" });
});

server.listen(port, () => {
    console.log(`School Chess Club site running at http://localhost:${port}`);
});
