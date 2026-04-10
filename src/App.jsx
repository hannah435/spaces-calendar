import { useState, useEffect } from "react";

// In production, set this to your deployed server URL (e.g. "https://yourdomain.com")
// Calendar apps (Google, Apple) need a full public URL to fetch the .ics feed.
const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

const DEFAULT_EVENT = {
  title: "Tokenize Weekly X Spaces",
  description: "Join us live on X Spaces for the latest in blockchain, crypto & AI.",
  spaceUrl: "https://twitter.com/i/spaces/placeholder",
  date: "",
  time: "04:00",
  timezone: "Asia/Singapore",
  duration: 90,
};

function googleCalLink(event) {
  const [year, month, day] = event.date.split("-").map(Number);
  const [hour, minute] = event.time.split(":").map(Number);
  const pad = (n) => String(n).padStart(2, "0");
  const dt = `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`;
  const endDate = new Date(year, month - 1, day, hour, minute + event.duration);
  const dtEnd = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${dt}/${dtEnd}`,
    details: `${event.description}\n\nJoin here: ${event.spaceUrl}`,
    location: event.spaceUrl,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function outlookLink(event) {
  const [year, month, day] = event.date.split("-").map(Number);
  const [hour, minute] = event.time.split(":").map(Number);
  const pad = (n) => String(n).padStart(2, "0");
  const startISO = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
  const endDate = new Date(year, month - 1, day, hour, minute + event.duration);
  const endISO = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: startISO,
    enddt: endISO,
    body: `${event.description}\n\nJoin here: ${event.spaceUrl}`,
    location: event.spaceUrl,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}

function formatDisplayDate(dateStr, timeStr) {
  if (!dateStr) return "Date TBA";
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const d = new Date(year, month - 1, day, hour, minute);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatDisplayTime(timeStr) {
  if (!timeStr) return "";
  const [hour, minute] = timeStr.split(":").map(Number);
  const d = new Date(2000, 0, 1, hour, minute);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const btnBase = {
  border: "none",
  borderRadius: "12px",
  padding: "14px 20px",
  fontSize: "14px",
  fontFamily: "'Poppins', sans-serif",
  fontWeight: "600",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  width: "100%",
  transition: "all 0.2s",
};

export default function App() {
  const [event, setEvent] = useState(DEFAULT_EVENT);
  const [view, setView] = useState("public");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [form, setForm] = useState(DEFAULT_EVENT);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const feedUrlHttps = API_BASE + "/calendar.ics";
  const feedUrl = feedUrlHttps.replace(/^https?:/, "webcal:");

  // Google Calendar: direct to "add by URL" settings page with the URL pre-copied
  const googleSubscribeUrl = `https://calendar.google.com/calendar/r/settings/addbyurl`;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/event`);
        if (res.ok) {
          const data = await res.json();
          setEvent(data);
          setForm(data);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const handleLogin = () => {
    if (pin.length > 0) {
      setView("admin");
      setPinError(false);
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, event: form }),
      });
      if (!res.ok) {
        setPinError(true);
        setView("login");
        return;
      }
      setEvent(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert("Failed to save. Is the server running?");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(event.spaceUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!loaded) return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#FF6B35", fontFamily: "monospace", letterSpacing: "0.1em" }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", fontFamily: "'Poppins', sans-serif", color: "#f0f0f0" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "48px 20px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.25)",
            borderRadius: "100px", padding: "5px 14px", marginBottom: "18px",
          }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#FF6B35", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.12em", color: "#FF6B35", textTransform: "uppercase" }}>Live Weekly</span>
          </div>
          <h1 style={{
            fontSize: "24px", fontWeight: "700", margin: "0 0 6px", color: "#fff", lineHeight: 1.3,
          }}>
            {event.title}
          </h1>
          <p style={{ fontSize: "13px", color: "#666", margin: 0, lineHeight: 1.5 }}>{event.description}</p>
        </div>

        {/* Event info */}
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "16px", padding: "20px", marginBottom: "16px",
        }}>
          <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "12px",
              background: "linear-gradient(135deg, #FF6B35, #ED7F31)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "20px", flexShrink: 0,
            }}>📅</div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: "600", color: "#eee" }}>
                {formatDisplayDate(event.date, event.time)}
              </div>
              <div style={{ fontSize: "13px", color: "#FF6B35", fontFamily: "'Space Mono', monospace", marginTop: "2px" }}>
                {event.date ? `${formatDisplayTime(event.time)} GMT+8 · ${event.duration} min` : "Date & time TBA"}
              </div>
            </div>
          </div>
        </div>

        {/* Space link */}
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "12px", padding: "12px 16px", marginBottom: "24px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
        }}>
          <span style={{
            fontSize: "12px", fontFamily: "'Space Mono', monospace",
            color: "#777", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
          }}>
            {event.spaceUrl}
          </span>
          <button onClick={handleCopyLink} style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "6px", color: "#aaa", fontSize: "11px", fontFamily: "'Space Mono', monospace",
            padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap",
          }}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {/* Subscribe buttons — one click each */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(feedUrlHttps);
              window.open(googleSubscribeUrl, "_blank");
              alert("Calendar URL copied to clipboard!\n\nPaste it in the 'URL of calendar' field that just opened.");
            }}
            style={{ ...btnBase, background: "#fff", color: "#333" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Subscribe via Google Calendar
          </button>

          <button
            onClick={() => window.open(feedUrl)}
            style={{ ...btnBase, background: "rgba(255,255,255,0.06)", color: "#f0f0f0", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <span style={{ fontSize: "16px" }}>🍎</span>
            Subscribe via Apple Calendar
          </button>

          <button
            onClick={() => window.open(outlookLink(event), "_blank")}
            disabled={!event.date}
            style={{ ...btnBase, background: "rgba(255,255,255,0.06)", color: event.date ? "#f0f0f0" : "#555", border: "1px solid rgba(255,255,255,0.1)", cursor: event.date ? "pointer" : "not-allowed" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M24 7.387v10.478c0 .23-.08.424-.238.583a.793.793 0 01-.583.238h-9.322V6.566h9.322c.23 0 .424.08.583.238.159.159.238.353.238.583z" fill="#0072C6"/><path d="M14.857 6.566v12.12l-5.88-1.2L0 16.166V7.387l8.977-1.32 5.88 .499z" fill="#0072C6" opacity=".6"/><path d="M14.857 6.566H24v-2.88c0-.23-.08-.424-.238-.583A.793.793 0 0023.179 2.865H14.857v3.701z" fill="#0072C6" opacity=".8"/><rect x="1" y="8" width="13" height="8" rx="1" fill="#0072C6" opacity=".4"/></svg>
            Add to Outlook
          </button>

          <button
            onClick={() => window.open(googleCalLink(event), "_blank")}
            disabled={!event.date}
            style={{ ...btnBase, background: "transparent", color: event.date ? "#777" : "#444", border: "1px solid rgba(255,255,255,0.06)", fontSize: "12px", padding: "10px", cursor: event.date ? "pointer" : "not-allowed" }}
          >
            Add this week only (Google one-time)
          </button>
        </div>

        <div style={{ fontSize: "11px", color: "#444", textAlign: "center", lineHeight: 1.5, marginBottom: "32px" }}>
          Subscribe once — the event auto-updates weekly with the new Space link.
        </div>

        {/* Admin toggle */}
        <div style={{ textAlign: "center" }}>
          {view === "public" && (
            <button onClick={() => setView("login")} style={{
              background: "transparent", border: "none", color: "#333",
              fontSize: "11px", cursor: "pointer", fontFamily: "'Space Mono', monospace",
            }}>
              Admin
            </button>
          )}
        </div>

        {/* Login */}
        {view === "login" && (
          <div style={{
            marginTop: "16px", background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px",
          }}>
            <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "12px", color: "#888" }}>Admin PIN</div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="password" value={pin} onChange={e => setPin(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="Enter PIN"
                style={{
                  flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid ${pinError ? "#ff4444" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "14px",
                  fontFamily: "'Poppins', sans-serif", outline: "none",
                }}
              />
              <button onClick={handleLogin} style={{
                background: "#FF6B35", border: "none", borderRadius: "8px", padding: "10px 18px",
                color: "#fff", fontWeight: "600", fontSize: "13px", cursor: "pointer",
              }}>
                Go
              </button>
            </div>
            {pinError && <div style={{ color: "#ff4444", fontSize: "12px", marginTop: "6px" }}>Wrong PIN</div>}
            <button onClick={() => { setView("public"); setPin(""); setPinError(false); }} style={{
              background: "transparent", border: "none", color: "#444", fontSize: "11px",
              cursor: "pointer", marginTop: "10px",
            }}>Cancel</button>
          </div>
        )}

        {/* Admin Panel */}
        {view === "admin" && (
          <div style={{
            marginTop: "16px", background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,107,53,0.15)", borderRadius: "14px", padding: "20px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#FF6B35", fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>UPDATE EVENT</span>
              <button onClick={() => { setView("public"); setPin(""); }} style={{
                background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: "16px",
              }}>×</button>
            </div>

            {[
              { label: "Title", key: "title", type: "text" },
              { label: "Description", key: "description", type: "text" },
              { label: "X Space Link", key: "spaceUrl", type: "url" },
              { label: "Date", key: "date", type: "date" },
              { label: "Time (GMT+8)", key: "time", type: "time" },
              { label: "Duration (min)", key: "duration", type: "number" },
            ].map(({ label, key, type }) => (
              <div key={key} style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "4px", fontFamily: "'Space Mono', monospace" }}>{label}</label>
                <input
                  type={type} value={form[key]}
                  onChange={e => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
                    padding: "10px 12px", color: "#fff", fontSize: "13px",
                    fontFamily: "'Poppins', sans-serif", outline: "none", boxSizing: "border-box",
                    colorScheme: "dark",
                  }}
                />
              </div>
            ))}

            <button onClick={handleSave} style={{
              ...btnBase, background: "#FF6B35", color: "#fff", marginTop: "4px",
            }}>
              {saved ? "Saved — feed updated" : "Save & Publish"}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        input::placeholder { color: #444; }
        button:hover { opacity: 0.88; }
      `}</style>
    </div>
  );
}
