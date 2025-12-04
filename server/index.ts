/**
 * Mock Server for Uptime Kuma Testing
 *
 * This server provides various endpoints that simulate different
 * monitoring states for testing Uptime Kuma status pages.
 *
 * Run with: bun run server/index.ts
 */

const PORT = process.env.PORT || 3000;

// ============ State Tracking ============

interface EndpointState {
  requestCount: number;
  lastRequestTime: number;
  isDown: boolean;
  downUntil?: number;
}

const state: Record<string, EndpointState> = {};

function getState(endpoint: string): EndpointState {
  if (!state[endpoint]) {
    state[endpoint] = {
      requestCount: 0,
      lastRequestTime: Date.now(),
      isDown: false,
    };
  }
  state[endpoint].requestCount++;
  state[endpoint].lastRequestTime = Date.now();
  return state[endpoint];
}

// ============ Response Helpers ============

function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Powered-By": "uptime-kuma-themes-mock-server",
    },
  });
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(
    `<!DOCTYPE html><html><head><title>Mock Server</title></head><body>${body}</body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html" },
    }
  );
}

// ============ Endpoint Handlers ============

const endpoints: Record<string, (req: Request) => Response | Promise<Response>> = {
  // Always successful - returns 200 OK
  "/always-up": () => {
    return jsonResponse({
      status: "ok",
      message: "This endpoint is always available",
      timestamp: new Date().toISOString(),
    });
  },

  // Always down - returns 500 error
  "/always-down": () => {
    return jsonResponse(
      {
        status: "error",
        message: "This endpoint is always down",
        timestamp: new Date().toISOString(),
      },
      500
    );
  },

  // Random failures - 20% chance of failure
  "/random-failures": () => {
    const shouldFail = Math.random() < 0.2;
    if (shouldFail) {
      return jsonResponse(
        {
          status: "error",
          message: "Random failure occurred",
          timestamp: new Date().toISOString(),
        },
        500
      );
    }
    return jsonResponse({
      status: "ok",
      message: "Request succeeded",
      timestamp: new Date().toISOString(),
    });
  },

  // Frequent failures - 50% chance of failure
  "/frequent-failures": () => {
    const shouldFail = Math.random() < 0.5;
    if (shouldFail) {
      return jsonResponse(
        {
          status: "error",
          message: "Frequent failure occurred",
          timestamp: new Date().toISOString(),
        },
        500
      );
    }
    return jsonResponse({
      status: "ok",
      message: "Request succeeded",
      timestamp: new Date().toISOString(),
    });
  },

  // Slow response - takes 2-5 seconds to respond
  "/slow-response": async () => {
    const delay = 2000 + Math.random() * 3000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return jsonResponse({
      status: "ok",
      message: "Slow response completed",
      responseTime: `${Math.round(delay)}ms`,
      timestamp: new Date().toISOString(),
    });
  },

  // Very slow - takes 10-15 seconds (may trigger timeout)
  "/very-slow": async () => {
    const delay = 10000 + Math.random() * 5000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return jsonResponse({
      status: "ok",
      message: "Very slow response completed",
      responseTime: `${Math.round(delay)}ms`,
      timestamp: new Date().toISOString(),
    });
  },

  // Intermittent - fails every 3rd request
  "/intermittent": () => {
    const s = getState("/intermittent");
    if (s.requestCount % 3 === 0) {
      return jsonResponse(
        {
          status: "error",
          message: "Every 3rd request fails",
          requestNumber: s.requestCount,
          timestamp: new Date().toISOString(),
        },
        500
      );
    }
    return jsonResponse({
      status: "ok",
      message: "Request succeeded",
      requestNumber: s.requestCount,
      timestamp: new Date().toISOString(),
    });
  },

  // Degraded - returns 200 but with warning indicators
  "/degraded": () => {
    return jsonResponse({
      status: "degraded",
      message: "Service is running but performance is degraded",
      metrics: {
        responseTime: Math.round(500 + Math.random() * 1000),
        cpuUsage: Math.round(70 + Math.random() * 25),
        memoryUsage: Math.round(80 + Math.random() * 15),
      },
      timestamp: new Date().toISOString(),
    });
  },

  // Maintenance mode - returns 503 Service Unavailable
  "/maintenance": () => {
    return jsonResponse(
      {
        status: "maintenance",
        message: "Service is under maintenance",
        expectedBackAt: new Date(Date.now() + 3600000).toISOString(),
        timestamp: new Date().toISOString(),
      },
      503
    );
  },

  // Scheduled downtime - down during specific minutes of each hour
  "/scheduled-down": () => {
    const minute = new Date().getMinutes();
    // Down for minutes 0-5 and 30-35 of each hour
    const isDowntime = minute < 5 || (minute >= 30 && minute < 35);

    if (isDowntime) {
      return jsonResponse(
        {
          status: "scheduled_downtime",
          message: "Scheduled maintenance window",
          nextUptime: "In a few minutes",
          timestamp: new Date().toISOString(),
        },
        503
      );
    }
    return jsonResponse({
      status: "ok",
      message: "Service is operational",
      timestamp: new Date().toISOString(),
    });
  },

  // Flapping - alternates between up and down rapidly
  "/flapping": () => {
    const s = getState("/flapping");
    const isDown = s.requestCount % 2 === 0;

    if (isDown) {
      return jsonResponse(
        {
          status: "error",
          message: "Service is flapping (currently down)",
          requestNumber: s.requestCount,
          timestamp: new Date().toISOString(),
        },
        500
      );
    }
    return jsonResponse({
      status: "ok",
      message: "Service is flapping (currently up)",
      requestNumber: s.requestCount,
      timestamp: new Date().toISOString(),
    });
  },

  // Timeout simulation - never responds (connection hangs)
  "/timeout": async () => {
    // Wait forever (until client times out)
    await new Promise(() => {});
    return jsonResponse({ status: "ok" }); // Never reached
  },

  // Rate limited - returns 429 after 10 requests per minute
  "/rate-limited": () => {
    const s = getState("/rate-limited");
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Reset count if last request was over a minute ago
    if (s.lastRequestTime < oneMinuteAgo) {
      s.requestCount = 1;
    }

    if (s.requestCount > 10) {
      return jsonResponse(
        {
          status: "rate_limited",
          message: "Too many requests",
          retryAfter: 60,
          timestamp: new Date().toISOString(),
        },
        429
      );
    }
    return jsonResponse({
      status: "ok",
      message: "Request succeeded",
      remainingRequests: 10 - s.requestCount,
      timestamp: new Date().toISOString(),
    });
  },

  // Health check endpoint with detailed metrics
  "/health": () => {
    return jsonResponse({
      status: "healthy",
      version: "1.0.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: {
        database: "connected",
        cache: "connected",
        queue: "connected",
      },
    });
  },

  // Partial outage - some services up, some down
  "/partial-outage": () => {
    const services = {
      api: Math.random() > 0.1,
      database: Math.random() > 0.3,
      cache: Math.random() > 0.2,
      cdn: true,
      auth: Math.random() > 0.15,
    };

    const allUp = Object.values(services).every(Boolean);
    const allDown = Object.values(services).every((v) => !v);

    return jsonResponse(
      {
        status: allUp ? "ok" : allDown ? "error" : "partial",
        message: allUp
          ? "All services operational"
          : allDown
            ? "Complete outage"
            : "Partial outage detected",
        services,
        timestamp: new Date().toISOString(),
      },
      allDown ? 500 : 200
    );
  },

  // Memory leak simulation - response gets slower over time
  "/memory-leak": async () => {
    const s = getState("/memory-leak");
    // Delay increases with each request (simulating memory pressure)
    const delay = Math.min(s.requestCount * 100, 10000);
    await new Promise((resolve) => setTimeout(resolve, delay));

    return jsonResponse({
      status: "ok",
      message: "Response with simulated memory pressure",
      simulatedDelay: `${delay}ms`,
      requestCount: s.requestCount,
      timestamp: new Date().toISOString(),
    });
  },

  // Returns different HTTP status codes based on query param
  "/status/:code": (req: Request) => {
    const url = new URL(req.url);
    const code = parseInt(url.pathname.split("/").pop() || "200", 10);
    const validCode = code >= 100 && code < 600 ? code : 200;

    return jsonResponse(
      {
        status: validCode < 400 ? "ok" : "error",
        requestedCode: validCode,
        timestamp: new Date().toISOString(),
      },
      validCode
    );
  },

  // JSON keyword check - returns specific keywords for monitoring
  "/keyword-check": () => {
    const keywords = ["OPERATIONAL", "ALL_SYSTEMS_GO", "STATUS_OK"];
    return jsonResponse({
      status: "OPERATIONAL",
      keyword: keywords[Math.floor(Math.random() * keywords.length)],
      message: "Use keyword monitoring to check for 'OPERATIONAL'",
      timestamp: new Date().toISOString(),
    });
  },

  // HTML page for HTTP(s) keyword monitoring
  "/html-status": () => {
    const isUp = Math.random() > 0.1;
    return htmlResponse(`
      <h1>Service Status</h1>
      <div class="status ${isUp ? "up" : "down"}">
        ${isUp ? "<!-- STATUS: UP -->" : "<!-- STATUS: DOWN -->"}
        <p>Current Status: <strong>${isUp ? "Operational" : "Outage"}</strong></p>
      </div>
      <p>Last updated: ${new Date().toISOString()}</p>
    `);
  },

  // TCP port check simulation
  "/tcp-check": () => {
    return jsonResponse({
      status: "ok",
      message: "TCP connection would succeed",
      port: 3000,
      timestamp: new Date().toISOString(),
    });
  },

  // Ping simulation
  "/ping": () => {
    return new Response("pong", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  },

  // Certificate expiry simulation
  "/cert-check": () => {
    const daysUntilExpiry = Math.floor(Math.random() * 90);
    const expiryDate = new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000);

    return jsonResponse({
      status: daysUntilExpiry < 7 ? "warning" : "ok",
      certificate: {
        subject: "*.example.com",
        issuer: "Let's Encrypt",
        validFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        validUntil: expiryDate.toISOString(),
        daysUntilExpiry,
      },
      timestamp: new Date().toISOString(),
    });
  },

  // Docker container simulation
  "/docker/healthy": () => {
    return jsonResponse({
      status: "healthy",
      container: "app-container",
      state: "running",
      health: {
        status: "healthy",
        failingStreak: 0,
      },
      timestamp: new Date().toISOString(),
    });
  },

  "/docker/unhealthy": () => {
    return jsonResponse(
      {
        status: "unhealthy",
        container: "db-container",
        state: "running",
        health: {
          status: "unhealthy",
          failingStreak: 5,
          log: "Connection refused",
        },
        timestamp: new Date().toISOString(),
      },
      500
    );
  },

  // API endpoint listing
  "/": () => {
    return jsonResponse({
      name: "Uptime Kuma Mock Server",
      description: "Test endpoints for various monitoring scenarios",
      endpoints: {
        // Always states
        "/always-up": "Always returns 200 OK",
        "/always-down": "Always returns 500 error",

        // Failure patterns
        "/random-failures": "20% chance of failure",
        "/frequent-failures": "50% chance of failure",
        "/intermittent": "Fails every 3rd request",
        "/flapping": "Alternates between up and down",

        // Timing issues
        "/slow-response": "2-5 second delay",
        "/very-slow": "10-15 second delay (may timeout)",
        "/timeout": "Never responds (tests timeout handling)",
        "/memory-leak": "Gets slower with each request",

        // Status variations
        "/degraded": "Returns 200 with degraded status",
        "/maintenance": "Returns 503 maintenance mode",
        "/scheduled-down": "Down during minutes 0-5 and 30-35",
        "/partial-outage": "Random partial service outage",
        "/rate-limited": "Returns 429 after 10 req/min",

        // Health checks
        "/health": "Detailed health check response",
        "/ping": "Simple ping/pong",
        "/keyword-check": "JSON with monitorable keywords",
        "/html-status": "HTML page with status",
        "/cert-check": "Certificate expiry simulation",

        // Custom status
        "/status/:code": "Returns specified HTTP status code",

        // Docker simulation
        "/docker/healthy": "Healthy container status",
        "/docker/unhealthy": "Unhealthy container status",
      },
      usage: "Configure Uptime Kuma monitors to point to these endpoints",
    });
  },
};

// ============ Request Router ============

function handleRequest(req: Request): Response | Promise<Response> {
  const url = new URL(req.url);
  let pathname = url.pathname;

  // Check for exact match first
  if (endpoints[pathname]) {
    return endpoints[pathname](req);
  }

  // Check for /status/:code pattern
  if (pathname.startsWith("/status/")) {
    const handler = endpoints["/status/:code"];
    if (handler) return handler(req);
  }

  // 404 for unknown endpoints
  return jsonResponse(
    {
      status: "not_found",
      message: `Endpoint ${pathname} not found`,
      availableEndpoints: Object.keys(endpoints).filter((e) => !e.includes(":")),
      timestamp: new Date().toISOString(),
    },
    404
  );
}

// ============ Server Setup ============

console.log(`
╔════════════════════════════════════════════════════════════╗
║         Uptime Kuma Mock Server                            ║
╠════════════════════════════════════════════════════════════╣
║  Starting server on http://localhost:${PORT}                  ║
║                                                            ║
║  Visit http://localhost:${PORT}/ for available endpoints      ║
╚════════════════════════════════════════════════════════════╝
`);

const server = Bun.serve({
  port: PORT,
  fetch: handleRequest,
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
console.log(`\nEndpoints available for monitoring:`);
Object.keys(endpoints)
  .filter((e) => !e.includes(":"))
  .forEach((e) => {
    console.log(`  → http://localhost:${server.port}${e}`);
  });
