import express from "express";
import cors from "cors";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "event-data.json");
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const DEFAULT_EVENT = {
  title: "Tokenize Weekly X Spaces",
  description: "Join us live on X Spaces for the latest in blockchain, crypto & AI.",
  spaceUrl: "https://twitter.com/i/spaces/placeholder",
  date: "",
  time: "12:00",
  timezone: "America/New_York",
  duration: 60,
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

// --- API: Get current event ---
app.get("/api/event", (req, res) => {
  res.json(loadEvent());
});

// --- API: Update event (admin) ---
app.post("/api/event", (req, res) => {
  const { pin, event } = req.body;
  if (pin !== "1234") {
    return res.status(401).json({ error: "Invalid PIN" });
  }
  saveEvent(event);
  res.json({ ok: true });
});

// --- Dynamic ICS feed (this is the magic URL users subscribe to) ---
app.get("/calendar.ics", (req, res) => {
  const event = loadEvent();

  if (!event.date) {
    // If no date set yet, return a placeholder event
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.send(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TokenizeCon//SpacesInvite//EN",
        "X-WR-CALNAME:Tokenize X Spaces",
        "METHOD:PUBLISH",
        "END:VCALENDAR",
      ].join("\r\n")
    );
  }

  const pad = (n) => String(n).padStart(2, "0");
  const [year, month, day] = event.date.split("-").map(Number);
  const [hour, minute] = event.time.split(":").map(Number);

  const dtStart = `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`;
  const endDate = new Date(year, month - 1, day, hour, minute + event.duration);
  const dtEnd = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(
    endDate.getDate()
  )}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;

  // Use a stable UID so calendar apps UPDATE the existing event instead of creating duplicates
  const uid = "tokenize-weekly-spaces@tokenizecon.com";

  // DTSTAMP = when this feed was last modified (tells calendars to refresh)
  const now = new Date();
  const dtstamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}Z`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TokenizeCon//SpacesInvite//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Tokenize X Spaces",
    "X-WR-TIMEZONE:America/New_York",
    "METHOD:PUBLISH",
    // Refresh interval hint (calendars may or may not honor this)
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    // VTIMEZONE required by Apple Calendar when using DTSTART;TZID=
    "BEGIN:VTIMEZONE",
    "TZID:America/New_York",
    "BEGIN:STANDARD",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0500",
    "TZNAME:EST",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0400",
    "TZNAME:EDT",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `SEQUENCE:${Math.floor(now.getTime() / 1000)}`,
    `DTSTART;TZID=${event.timezone}:${dtStart}`,
    `DTEND;TZID=${event.timezone}:${dtEnd}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description}\\n\\nJoin here: ${event.spaceUrl}`,
    `URL:${event.spaceUrl}`,
    `LOCATION:${event.spaceUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  // Short cache so calendars pick up changes quickly
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Calendar feed: http://localhost:${PORT}/calendar.ics`);
});
