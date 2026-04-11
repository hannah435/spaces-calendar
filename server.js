import express from "express";
import cors from "cors";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "event-data.json");
const app = express();
const PORT = process.env.PORT || 3001;

// --- Security: PIN from environment variable (never hardcoded) ---
const ADMIN_PIN = process.env.ADMIN_PIN || "1234";

// --- Security: Restrict CORS to your own domain ---
const ALLOWED_ORIGINS = [
  "https://spaces-calendar.onrender.com",
  "http://localhost:5173",
  "http://localhost:3001",
];
app.use(cors({
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(null, false);
  },
}));

app.use(express.json({ limit: "10kb" }));

// --- Security: Rate limiting for admin endpoint ---
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return false;
  if (Date.now() - record.firstAttempt > LOCKOUT_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip) {
  const record = loginAttempts.get(ip);
  if (!record || Date.now() - record.firstAttempt > LOCKOUT_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: Date.now() });
  } else {
    record.count++;
  }
}

const DEFAULT_EVENT = {
  title: "BitAngels Weekly X Spaces (US Edition)",
  description: "Join us live on X Spaces for the latest in blockchain, crypto & AI.",
  spaceUrl: "https://twitter.com/i/spaces/placeholder",
  date: "",
  time: "13:00",
  timezone: "America/Los_Angeles",
  duration: 90,
};

function loadEvent() {
  if (existsSync(DATA_FILE)) {
    return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  }
  return DEFAULT_EVENT;
}

function saveEvent(event) {
  writeFileSync(DATA_FILE, JSON.stringify(event, null, 2));
}

// --- Security: Sanitize text for ICS (prevent ICS injection) ---
function sanitizeICS(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .slice(0, 500);
}

// --- Security: Validate URL format ---
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// --- Security: Validate event data ---
function validateEvent(event) {
  if (!event || typeof event !== "object") return "Invalid event data";
  if (typeof event.title !== "string" || event.title.length > 200) return "Invalid title";
  if (typeof event.description !== "string" || event.description.length > 500) return "Invalid description";
  if (typeof event.spaceUrl !== "string" || !isValidUrl(event.spaceUrl)) return "Invalid Space URL";
  if (event.date && !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return "Invalid date format";
  if (!/^\d{2}:\d{2}$/.test(event.time)) return "Invalid time format";
  if (typeof event.duration !== "number" || event.duration < 1 || event.duration > 480) return "Invalid duration";
  const validTimezones = ["America/Los_Angeles", "America/New_York", "Asia/Singapore"];
  if (!validTimezones.includes(event.timezone)) return "Invalid timezone";
  return null;
}

// --- API: Get current event ---
app.get("/api/event", (req, res) => {
  res.json(loadEvent());
});

// --- API: Update event (admin) ---
app.post("/api/event", (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  }

  const { pin, event } = req.body;

  if (!pin || typeof pin !== "string" || pin !== ADMIN_PIN) {
    recordAttempt(ip);
    return res.status(401).json({ error: "Invalid PIN" });
  }

  const validationError = validateEvent(event);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  // Only save allowed fields
  const sanitizedEvent = {
    title: event.title.trim(),
    description: event.description.trim(),
    spaceUrl: event.spaceUrl.trim(),
    date: event.date,
    time: event.time,
    timezone: event.timezone,
    duration: event.duration,
  };

  saveEvent(sanitizedEvent);
  res.json({ ok: true });
});

// --- Dynamic ICS feed ---
app.get(["/feed.ics", "/calendar.ics"], (req, res) => {
  const event = loadEvent();

  if (!event.date) {
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.send(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//BitAngels//SpacesInvite//EN",
        "X-WR-CALNAME:BitAngels Weekly Spaces (US)",
        "METHOD:PUBLISH",
        "END:VCALENDAR",
      ].join("\r\n")
    );
  }

  const pad = (n) => String(n).padStart(2, "0");
  const [year, month, day] = event.date.split("-").map(Number);
  const [hour, minute] = event.time.split(":").map(Number);

  const tzOffsets = {
    "America/Los_Angeles": { std: -8, dst: -7 },
    "America/New_York": { std: -5, dst: -4 },
    "Asia/Singapore": { std: 8, dst: 8 },
  };
  const tz = tzOffsets[event.timezone] || { std: 0, dst: 0 };
  const isDST = month >= 3 && month <= 10;
  const offset = tz.std === tz.dst ? tz.std : (isDST ? tz.dst : tz.std);

  const utcStart = new Date(Date.UTC(year, month - 1, day, hour - offset, minute));
  const utcEnd = new Date(Date.UTC(year, month - 1, day, hour - offset, minute + event.duration));

  const dtStartUTC = `${utcStart.getUTCFullYear()}${pad(utcStart.getUTCMonth() + 1)}${pad(utcStart.getUTCDate())}T${pad(utcStart.getUTCHours())}${pad(utcStart.getUTCMinutes())}00Z`;
  const dtEndUTC = `${utcEnd.getUTCFullYear()}${pad(utcEnd.getUTCMonth() + 1)}${pad(utcEnd.getUTCDate())}T${pad(utcEnd.getUTCHours())}${pad(utcEnd.getUTCMinutes())}00Z`;

  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(
    now.getUTCDate()
  )}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const uid = "bitangels-weekly-us@spaces-calendar.onrender.com";

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BitAngels//SpacesInvite//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:BitAngels Weekly Spaces (US)",
    "METHOD:PUBLISH",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `SEQUENCE:${Math.floor(now.getTime() / 60000)}`,
    `DTSTART:${dtStartUTC}`,
    `DTEND:${dtEndUTC}`,
    `RRULE:FREQ=WEEKLY;COUNT=52`,
    `SUMMARY:${sanitizeICS(event.title)}`,
    `DESCRIPTION:${sanitizeICS(event.description)}\\n\\nJoin here: ${sanitizeICS(event.spaceUrl)}`,
    `URL:${sanitizeICS(event.spaceUrl)}`,
    `LOCATION:${sanitizeICS(event.spaceUrl)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(ics);
});

// --- Serve built frontend in production ---
if (existsSync(join(__dirname, "dist"))) {
  app.use(express.static(join(__dirname, "dist")));
  app.get("*path", (req, res) => {
    res.sendFile(join(__dirname, "dist", "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
