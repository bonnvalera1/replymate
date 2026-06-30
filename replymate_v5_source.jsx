import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: "google",      label: "Google"      },
  { id: "yelp",        label: "Yelp"        },
  { id: "tripadvisor", label: "TripAdvisor" },
  { id: "facebook",    label: "Facebook"    },
];

const TONES = [
  { id: "professional", label: "Professional"         },
  { id: "friendly",     label: "Friendly & Warm"      },
  { id: "concise",      label: "Concise"              },
  { id: "apologetic",   label: "Sincere & Apologetic" },
];

const BUSINESS_TYPES = [
  "Restaurant / Café", "Retail Store", "Salon / Spa",
  "Medical / Dental",  "Auto Service", "Hotel / Lodging",
  "Law Firm",          "Fitness / Gym","Home Services",   "Other",
];

const LENGTH_OPTIONS = [
  { id: "brief",    label: "Brief",    desc: "1–2 sentences" },
  { id: "standard", label: "Standard", desc: "2–4 sentences" },
  { id: "detailed", label: "Detailed", desc: "4–6 sentences" },
];

const URGENCY = {
  low:    { bg: "#ECFDF5", border: "#A7F3D0", text: "#065F46", dot: "#10B981", label: "Low urgency"                    },
  medium: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", dot: "#F59E0B", label: "Medium urgency"                 },
  high:   { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B", dot: "#DC2626", label: "High — reply promptly"          },
};

const STORAGE_KEY   = "replymate_v4";
const API_KEY_STORE = "replymate_apikey";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 8);

function getApiKey() {
  try { return localStorage.getItem(API_KEY_STORE) || ""; } catch { return ""; }
}
function saveApiKey(k) {
  try { localStorage.setItem(API_KEY_STORE, k.trim()); } catch {}
}

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
  catch { return null; }
}

function saveProfile(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch {}
}

async function callClaude(prompt, maxTokens = 1000) {
  const key = getApiKey();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key && {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      }),
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.stop_reason === "max_tokens")
    throw new Error("Response cut short — try reducing input length and regenerate.");
  const raw = data.content?.find(b => b.type === "text")?.text ?? "";
  if (!raw) throw new Error("Empty response from API.");
  return raw;
}

function parseJSON(raw) {
  try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); }
  catch { throw new Error("Format error — hit Regenerate to try again."); }
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function CopyButton({ getText, small }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const text = getText();
    let ok = false;
    if (navigator?.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); ok = true; } catch {}
    }
    if (!ok) {
      try {
        const el = Object.assign(document.createElement("textarea"),
          { value: text, style: "position:fixed;opacity:0" });
        document.body.appendChild(el); el.select();
        document.execCommand("copy"); document.body.removeChild(el); ok = true;
      } catch {}
    }
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  return (
    <button onClick={copy} style={{
      padding: small ? "4px 10px" : "5px 12px",
      background: copied ? "#1A3D2B" : "transparent",
      color:      copied ? "#fff"    : "#1A3D2B",
      border:     `1px solid ${copied ? "#1A3D2B" : "#BFD0C5"}`,
      borderRadius: 6, cursor: "pointer",
      fontSize: small ? 11 : 12, fontWeight: 600, transition: "all 0.15s",
    }}>{copied ? "✓ Copied" : "Copy"}</button>
  );
}

function Chip({ label, variant }) {
  const colors = variant === "complaint"
    ? { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" }
    : { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 100,
      background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
      display: "inline-block", marginRight: 5, marginBottom: 4,
    }}>{label}</span>
  );
}

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;
  const getColor = r => r <= 2 ? "#DC2626" : r === 3 ? "#F59E0B" : "#16A34A";
  const dotColor = active ? getColor(active) : "#D1D5DB";
  const label = !value ? "" : value <= 2 ? "Unhappy customer" : value === 3 ? "Mixed experience" : "Happy customer";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
      {[1,2,3,4,5].map(s => (
        <button key={s}
          onClick={() => onChange(s === value ? 0 : s)}
          onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)}
          title={s === value ? "Click to clear" : `${s} star${s > 1 ? "s" : ""}`}
          style={{ background:"none", border:"none", cursor:"pointer",
            fontSize:28, padding:"0 2px", lineHeight:1,
            color: s <= active ? dotColor : "#D1D5DB",
            transform: s <= active ? "scale(1.1)" : "scale(1)",
            transition:"color 0.1s,transform 0.1s" }}>★</button>
      ))}
      {label && <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.03em",
        color:getColor(value), marginLeft:6 }}>{label}</span>}
    </div>
  );
}

// ─── Review Breakdown Card (NEW v4) ──────────────────────────────────────────

function BreakdownCard({ breakdown, loading, onDismiss }) {
  if (!loading && !breakdown) return null;
  const urg = URGENCY[breakdown?.urgency] ?? URGENCY.medium;
  return (
    <div style={{ background: "#F7F8F6", border: "1px solid #DDE2D9",
      borderRadius: 10, padding: "13px 15px", marginBottom: 12 }}>
      {loading ? (
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:14, height:14, border:"2px solid #DDE2D9",
            borderTopColor:"#1A3D2B", borderRadius:"50%",
            animation:"spin 0.8s linear infinite", flexShrink:0 }} />
          <span style={{ fontSize:12, color:"#9CA3AF" }}>Analyzing review…</span>
        </div>
      ) : (
        <>
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", marginBottom:9 }}>
            <span style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
              letterSpacing:"0.08em", color:"#9CA3AF" }}>Review Analysis</span>
            <button onClick={onDismiss} style={{ background:"none", border:"none", cursor:"pointer", color:"#C4CAC0", fontSize:16, padding:"0 2px", lineHeight:1, marginLeft:"auto" }} title="Dismiss">×</button>
            <span style={{ fontSize:11, fontWeight:700, color:urg.text,
              background:urg.bg, border:`1px solid ${urg.border}`,
              padding:"2px 9px", borderRadius:100, display:"flex",
              alignItems:"center", gap:5 }}>
              <span style={{ width:6, height:6, borderRadius:"50%",
                background:urg.dot, display:"inline-block" }} />
              {urg.label}
            </span>
          </div>
          {breakdown.tone && (
            <p style={{ fontSize:12, color:"#6B7280", margin:"0 0 9px",
              lineHeight:1.5, fontStyle:"italic" }}>"{breakdown.tone}"</p>
          )}
          {breakdown.complaints?.length > 0 && (
            <div style={{ marginBottom:6 }}>
              <span style={{ fontSize:10, fontWeight:700, color:"#B91C1C",
                textTransform:"uppercase", letterSpacing:"0.05em",
                marginRight:6 }}>Issues</span>
              {breakdown.complaints.map((c,i) => <Chip key={i} label={c} variant="complaint" />)}
            </div>
          )}
          {breakdown.praise?.length > 0 && (
            <div>
              <span style={{ fontSize:10, fontWeight:700, color:"#065F46",
                textTransform:"uppercase", letterSpacing:"0.05em",
                marginRight:6 }}>Praise</span>
              {breakdown.praise.map((p,i) => <Chip key={i} label={p} variant="praise" />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Reply Response Card (inline-editable, from v3) ──────────────────────────

function ResponseCard({ text, index, loading }) {
  const [localText, setLocalText] = useState(text || "");
  const [isEditing, setIsEditing] = useState(false);
  const taRef = useRef(null);

  useEffect(() => { setLocalText(text || ""); setIsEditing(false); }, [text]);
  useEffect(() => {
    if (isEditing && taRef.current) {
      taRef.current.focus();
      const l = taRef.current.value.length;
      taRef.current.setSelectionRange(l, l);
    }
  }, [isEditing]);

  if (loading) return (
    <div style={{ background:"#F7F8F6", border:"1px solid #DDE2D9",
      borderRadius:12, padding:"22px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <div style={{ width:16, height:16, border:"2px solid #DDE2D9",
          borderTopColor:"#1A3D2B", borderRadius:"50%",
          animation:"spin 0.8s linear infinite", flexShrink:0 }} />
        <span style={{ fontSize:12, color:"#9CA3AF" }}>Writing option {index+1}…</span>
      </div>
      {[90,75,82,60].map((w,i) => (
        <div key={i} style={{ height:10, background:"#E5E7EB", borderRadius:4,
          width:`${w}%`, marginBottom:8,
          animation:"pulse 1.4s ease-in-out infinite",
          animationDelay:`${i*0.12}s` }} />
      ))}
    </div>
  );
  if (!text) return null;

  return (
    <div style={{ background:"#fff",
      border:`1px solid ${isEditing ? "#1A3D2B" : "#DDE2D9"}`,
      borderRadius:12, padding:"18px 20px",
      boxShadow: isEditing ? "0 0 0 3px rgba(26,61,43,0.08)" : "none",
      transition:"border-color 0.15s,box-shadow 0.15s" }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:12 }}>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em",
          textTransform:"uppercase", color:"#1A3D2B",
          background:"#E8F0EC", padding:"3px 8px", borderRadius:4 }}>
          Option {index+1}
        </span>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:11, color:"#C4CAC0" }}>{localText.length} chars</span>
          {isEditing
            ? <button onClick={() => setIsEditing(false)} style={{
                padding:"5px 12px", background:"#1A3D2B", color:"#fff",
                border:"none", borderRadius:6, cursor:"pointer",
                fontSize:12, fontWeight:600 }}>Done</button>
            : <>
                <button onClick={() => setIsEditing(true)} style={{
                  padding:"5px 12px", background:"transparent", color:"#6B7280",
                  border:"1px solid #DDE2D9", borderRadius:6, cursor:"pointer",
                  fontSize:12, fontWeight:600 }}>Edit</button>
                <CopyButton getText={() => localText} />
              </>
          }
        </div>
      </div>
      {isEditing
        ? <textarea ref={taRef} value={localText}
            onChange={e => setLocalText(e.target.value)}
            style={{ width:"100%", border:"none", outline:"none", fontSize:14,
              lineHeight:1.75, color:"#374151", background:"transparent",
              resize:"vertical", minHeight:120, padding:0, fontFamily:"inherit" }} />
        : <p onClick={() => setIsEditing(true)}
            style={{ fontSize:14, lineHeight:1.75, color:"#374151",
              margin:0, whiteSpace:"pre-wrap", cursor:"text" }}>{localText}</p>
      }
      {isEditing && <p style={{ fontSize:11, color:"#C4CAC0",
        margin:"8px 0 0", textAlign:"right" }}>Click "Done" when finished</p>}
    </div>
  );
}

// ─── Inline-editable Request Card (NEW v4) ───────────────────────────────────

function RequestCard({ title, badge, content, loading, loadingLabel }) {
  const [edited, setEdited] = useState(content || "");
  const [isEditing, setIsEditing] = useState(false);
  const taRef = useRef(null);

  useEffect(() => { setEdited(content || ""); setIsEditing(false); }, [content]);
  useEffect(() => {
    if (isEditing && taRef.current) { taRef.current.focus(); }
  }, [isEditing]);

  const charCount = edited.length;
  const isSMS = badge === "SMS";
  const over160 = isSMS && charCount >= 160;
  const over320 = isSMS && charCount >= 320;

  if (loading) return (
    <div style={{ background:"#F7F8F6", border:"1px solid #DDE2D9",
      borderRadius:12, padding:"20px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
        <div style={{ width:14, height:14, border:"2px solid #DDE2D9",
          borderTopColor:"#1A3D2B", borderRadius:"50%",
          animation:"spin 0.8s linear infinite" }} />
        <span style={{ fontSize:12, color:"#9CA3AF" }}>{loadingLabel}</span>
      </div>
      {[85,70,60].map((w,i) => (
        <div key={i} style={{ height:10, background:"#E5E7EB", borderRadius:4,
          width:`${w}%`, marginBottom:8,
          animation:"pulse 1.4s ease-in-out infinite",
          animationDelay:`${i*0.1}s` }} />
      ))}
    </div>
  );
  if (!content) return null;

  return (
    <div style={{ background:"#fff",
      border:`1px solid ${isEditing ? "#1A3D2B" : "#DDE2D9"}`,
      borderRadius:12, padding:"18px 20px",
      boxShadow:isEditing ? "0 0 0 3px rgba(26,61,43,0.08)" : "none",
      transition:"border-color 0.15s,box-shadow 0.15s" }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em",
            textTransform:"uppercase", color:"#1A3D2B",
            background:"#E8F0EC", padding:"3px 8px", borderRadius:4 }}>{badge}</span>
          <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{title}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:11,
            color: over320 ? "#DC2626" : over160 ? "#F59E0B" : "#C4CAC0" }}>
            {charCount}{isSMS ? "/160" : " chars"}
          </span>
          {isEditing
            ? <button onClick={() => setIsEditing(false)} style={{
                padding:"5px 12px", background:"#1A3D2B", color:"#fff",
                border:"none", borderRadius:6, cursor:"pointer",
                fontSize:12, fontWeight:600 }}>Done</button>
            : <>
                <button onClick={() => setIsEditing(true)} style={{
                  padding:"5px 10px", background:"transparent", color:"#6B7280",
                  border:"1px solid #DDE2D9", borderRadius:6, cursor:"pointer",
                  fontSize:11, fontWeight:600 }}>Edit</button>
                <CopyButton getText={() => edited} small />
              </>
          }
        </div>
      </div>
      {isEditing
        ? <textarea ref={taRef} value={edited} onChange={e => setEdited(e.target.value)}
            style={{ width:"100%", border:"none", outline:"none", fontSize:13,
              lineHeight:1.7, color:"#374151", background:"transparent",
              resize:"vertical", minHeight:80, padding:0, fontFamily:"inherit" }} />
        : <p onClick={() => setIsEditing(true)}
            style={{ fontSize:13, lineHeight:1.7, color:"#374151",
              margin:0, whiteSpace:"pre-wrap", cursor:"text" }}>{edited}</p>
      }
      {isSMS && over160 && (
        <p style={{ fontSize:11, color: over320 ? "#DC2626" : "#F59E0B",
          margin:"6px 0 0" }}>
          {over320 ? "⚠ Over 320 chars — will send as 3+ messages" : "⚠ Over 160 chars — will send as 2 messages"}
        </p>
      )}
    </div>
  );
}


function DeleteButton({ onDelete }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onDelete}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background:"none", border:"none", cursor:"pointer",
        color: hov ? "#DC2626" : "#D1D5DB", fontSize:18, flexShrink:0,
        padding:"0 2px", lineHeight:1, transition:"color 0.12s" }}>×</button>
  );
}

// ─── Smart Snippets Panel (from v3) ──────────────────────────────────────────

function SmartSnippetsPanel({ snippets, onAdd, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newResponse, setNewResponse] = useState("");

  const handleAdd = () => {
    if (!newTopic.trim() || !newResponse.trim()) return;
    onAdd({ id: uid(), topic: newTopic.trim(), response: newResponse.trim() });
    setNewTopic(""); setNewResponse(""); setAdding(false);
  };

  const inp = { width:"100%", padding:"7px 10px", border:"1px solid #DDE2D9",
    borderRadius:6, fontSize:13, color:"#111827", background:"#fff" };

  return (
    <section style={{ background:"#fff", border:"1px solid #DDE2D9",
      borderRadius:14, overflow:"hidden" }}>
      <button onClick={() => setExpanded(e => !e)} style={{
        width:"100%", padding:"16px 20px",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        background:"none", border:"none", cursor:"pointer", textAlign:"left" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em",
            textTransform:"uppercase", color:"#9CA3AF" }}>Smart Snippets</span>
          {snippets.length > 0 && (
            <span style={{ fontSize:10, fontWeight:700, color:"#1A3D2B",
              background:"#E8F0EC", padding:"2px 7px", borderRadius:100 }}>
              {snippets.length}
            </span>
          )}
        </div>
        <span style={{ fontSize:14, color:"#9CA3AF",
          transform:expanded ? "rotate(180deg)" : "none",
          transition:"transform 0.2s", display:"inline-block" }}>▾</span>
      </button>

      {expanded && (
        <div style={{ padding:"0 20px 20px" }}>
          <p style={{ fontSize:12, color:"#6B7280", lineHeight:1.55, margin:"0 0 14px" }}>
            Teach REPLYMATE how to handle recurring topics — parking complaints,
            wait times, specific policies. It weaves them in naturally.
          </p>
          {snippets.map(s => (
            <div key={s.id} style={{ background:"#F7F8F6", border:"1px solid #DDE2D9",
              borderRadius:8, padding:"11px 13px", marginBottom:9,
              display:"flex", gap:10, alignItems:"flex-start" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#1A3D2B",
                  marginBottom:3, textTransform:"uppercase", letterSpacing:"0.04em" }}>
                  When: {s.topic}</div>
                <div style={{ fontSize:12, color:"#6B7280", lineHeight:1.5 }}>{s.response}</div>
              </div>
              <DeleteButton onDelete={() => onRemove(s.id)} />
            </div>
          ))}
          {adding ? (
            <div style={{ background:"#F7F8F6", border:"1px solid #1A3D2B",
              borderRadius:8, padding:"14px" }}>
              <div style={{ marginBottom:9 }}>
                <label style={{ fontSize:11, fontWeight:700, color:"#374151",
                  display:"block", marginBottom:4, textTransform:"uppercase",
                  letterSpacing:"0.05em" }}>Topic / Trigger</label>
                <input value={newTopic} onChange={e => setNewTopic(e.target.value)}
                  placeholder="e.g. parking, wait time, vegan options"
                  style={inp} />
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, fontWeight:700, color:"#374151",
                  display:"block", marginBottom:4, textTransform:"uppercase",
                  letterSpacing:"0.05em" }}>How to address it</label>
                <textarea value={newResponse} onChange={e => setNewResponse(e.target.value)}
                  placeholder="e.g. We have free 2-hour parking on Oak Street, just one block away."
                  rows={2} style={{ ...inp, resize:"vertical" }} />
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={handleAdd}
                  disabled={!newTopic.trim() || !newResponse.trim()}
                  style={{ padding:"7px 16px", background:"#1A3D2B", color:"#fff",
                    border:"none", borderRadius:6, fontSize:12, fontWeight:700,
                    cursor:newTopic.trim()&&newResponse.trim() ? "pointer":"not-allowed",
                    opacity:newTopic.trim()&&newResponse.trim() ? 1:0.5 }}>
                  Save Snippet</button>
                <button onClick={() => { setAdding(false); setNewTopic(""); setNewResponse(""); }}
                  style={{ padding:"7px 16px", background:"transparent", color:"#6B7280",
                    border:"1px solid #DDE2D9", borderRadius:6, fontSize:12,
                    fontWeight:600, cursor:"pointer" }}>Cancel</button>
              </div>
            </div>
          ) : snippets.length < 5 ? (
            <button onClick={() => setAdding(true)} style={{
              width:"100%", padding:"9px", background:"transparent", color:"#1A3D2B",
              border:"1px dashed #BFD0C5", borderRadius:8, cursor:"pointer",
              fontSize:12, fontWeight:600 }}>
              + Add Snippet {snippets.length > 0 ? `(${snippets.length}/5)` : ""}
            </button>
          ) : (
            <p style={{ fontSize:11, color:"#9CA3AF", textAlign:"center", margin:0 }}>
              Max 5 snippets reached</p>
          )}
        </div>
      )}
    </section>
  );
}


// ─── Settings Modal (deploy-only) ────────────────────────────────────────────

function SettingsModal({ onClose }) {
  const [draft, setDraft] = useState(getApiKey);
  const [saved,  setSaved] = useState(false);
  const [show,   setShow]  = useState(false);

  const handleSave = () => {
    saveApiKey(draft);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 900);
  };

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:1000, padding:16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#fff", borderRadius:16, padding:28,
        maxWidth:460, width:"100%",
        boxShadow:"0 20px 60px rgba(0,0,0,0.25)",
      }}>
        <div style={{ fontSize:18, fontWeight:800, color:"#111827",
          marginBottom:6, letterSpacing:"-0.02em" }}>Anthropic API Key</div>
        <p style={{ fontSize:13, color:"#6B7280", lineHeight:1.6, margin:"0 0 18px" }}>
          REPLYMATE runs on your own Anthropic API key. It's stored locally in your
          browser and never sent anywhere except directly to Anthropic.{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank"
            rel="noopener noreferrer"
            style={{ color:"#1A3D2B", fontWeight:600 }}>
            Get a key →
          </a>
        </p>
        <div style={{ position:"relative", marginBottom:14 }}>
          <input
            type={show ? "text" : "password"}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="sk-ant-api03-..."
            style={{
              width:"100%", padding:"10px 42px 10px 12px",
              border:"1px solid #DDE2D9", borderRadius:8,
              fontSize:13, color:"#111827", background:"#F7F8F6",
              fontFamily:"monospace",
            }}
          />
          <button onClick={() => setShow(s => !s)} style={{
            position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
            background:"none", border:"none", cursor:"pointer",
            fontSize:15, color:"#9CA3AF",
          }}>{show ? "🙈" : "👁"}</button>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={handleSave} style={{
            flex:1, padding:"11px",
            background: saved ? "#16A34A" : "#1A3D2B",
            color:"#fff", border:"none", borderRadius:8,
            fontSize:13, fontWeight:700, cursor:"pointer",
            transition:"background 0.2s",
          }}>{saved ? "✓ Saved!" : "Save Key"}</button>
          <button onClick={onClose} style={{
            padding:"11px 18px", background:"transparent", color:"#6B7280",
            border:"1px solid #DDE2D9", borderRadius:8, fontSize:13,
            fontWeight:600, cursor:"pointer",
          }}>Cancel</button>
        </div>
        <p style={{ fontSize:11, color:"#9CA3AF", margin:"12px 0 0", lineHeight:1.5 }}>
          Your key is stored only in this browser's localStorage.
          It is never transmitted to any server other than api.anthropic.com.
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function REPLYMATE() {
  // ── Tab ──
  const [activeTab,    setActiveTab]    = useState("reply");
  const [profileExpanded, setProfileExpanded] = useState(() => !(loadProfile()?.bizName));
  const [showSettings, setShowSettings] = useState(false);
  const [hasKey,       setHasKey]       = useState(() => getApiKey().length > 10);

  // ── Business profile (shared, persisted) ──
  const [bizName,   setBizName]   = useState("");
  const [bizType,   setBizType]   = useState(BUSINESS_TYPES[0]);
  const [tone,      setTone]      = useState("professional");
  const [voiceNote, setVoiceNote] = useState("");
  const [signature, setSignature] = useState("");
  const [snippets,  setSnippets]  = useState([]);
  const [contactInfo, setContactInfo] = useState(""); // for negative review escalations

  // ── Reply tab ──
  const [platform,      setPlatform]      = useState("google");
  const [rating,        setRating]        = useState(0);
  const [reviewerName,  setReviewerName]  = useState("");
  const [reviewText,    setReviewText]    = useState("");
  const [reviewContext, setReviewContext] = useState("");
  const [responseLength,setResponseLength]= useState("standard");
  const [responses,     setResponses]     = useState([]);
  const [replyLoading,  setReplyLoading]  = useState(false);
  const [replyError,    setReplyError]    = useState("");
  const [replyGenerated,setReplyGenerated]= useState(false);
  const [attempted,     setAttempted]     = useState(false);

  // ── Breakdown (NEW v4) ──
  const [breakdown,        setBreakdown]        = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const breakdownTimer = useRef(null);
  const breakdownSeq   = useRef(0); // cancel stale requests

  // ── Request tab (NEW v4) ──
  const [customerName,    setCustomerName]    = useState("");
  const [visitType,       setVisitType]       = useState("");
  const [reqPlatform,     setReqPlatform]     = useState("google");
  const [reqLink,         setReqLink]         = useState("");
  const [reqSMS,          setReqSMS]          = useState("");
  const [reqEmailSubject, setReqEmailSubject] = useState("");
  const [reqEmailBody,    setReqEmailBody]    = useState("");
  const [reqLoading,      setReqLoading]      = useState(false);
  const [reqError,        setReqError]        = useState("");
  const [reqGenerated,    setReqGenerated]    = useState(false);

  const handleCloseSettings = () => {
    setShowSettings(false);
    setHasKey(getApiKey().length > 10);
  };

  // race-condition locks
  const replyLock = useRef(false);
  const reqLock   = useRef(false);

  // ── localStorage ──
  useEffect(() => {
    const p = loadProfile();
    if (!p) return;
    if (p.bizName)   setBizName(p.bizName);
    if (p.bizType)   setBizType(p.bizType);
    if (p.tone)      setTone(p.tone);
    if (p.voiceNote) setVoiceNote(p.voiceNote);
    if (p.signature) setSignature(p.signature);
    if (p.snippets)  setSnippets(p.snippets);
    if (p.contactInfo) setContactInfo(p.contactInfo);
  }, []);

  useEffect(() => {
    saveProfile({ bizName, bizType, tone, voiceNote, signature, snippets, contactInfo });
  }, [bizName, bizType, tone, voiceNote, signature, snippets, contactInfo]);

  // ── Auto-analyze review (NEW v4) ──
  const analyzeReview = useCallback(async (text, seq) => {
    setBreakdownLoading(true);
    try {
      const raw = await callClaude(
        `Analyze this customer review. Return ONLY valid JSON with no markdown, no preamble.

JSON SCHEMA (do not include these descriptions in values):
{
  "complaints": [],  // array of up to 4 short phrases for specific issues raised
  "praise": [],      // array of up to 4 short phrases for specific things praised
  "tone": "",        // one sentence describing the reviewer's emotional tone
  "urgency": ""      // exactly one of: "low", "medium", or "high"
}

URGENCY CRITERIA:
- "high"   — threatens legal action, mentions health/safety, says never returning, very angry
- "medium" — clearly unhappy, wants resolution, moderately negative
- "low"    — minor complaint or mostly positive with a small issue

REVIEW TO ANALYZE:
Rating: ${text.length > 0 ? "provided" : "not provided"}
"${text.replace(/"/g, '\\"')}"`,
        300
      );
      if (seq !== breakdownSeq.current) return; // stale — discard
      const parsed = parseJSON(raw);
      setBreakdown(parsed);
    } catch {
      if (seq === breakdownSeq.current) setBreakdown(null);
    } finally {
      if (seq === breakdownSeq.current) setBreakdownLoading(false);
    }
  }, []);

  const handleReviewBlur = () => {
    if (reviewText.trim().length < 40) return;
    const seq = ++breakdownSeq.current;
    analyzeReview(reviewText, seq);
  };

  // ── Generate replies ──
  const replyValid = bizName.trim().length > 0 && rating > 0 && reviewText.trim().length > 10;
  const replyHint  = !bizName.trim()             ? "Enter your business name"
    : rating === 0                               ? "Select a star rating"
    : reviewText.trim().length <= 10             ? "Paste the review text" : "";

  const handleGenerateReply = async () => {
    if (!replyValid || replyLock.current) return;
    replyLock.current = true;
    setReplyLoading(true); setReplyError(""); setResponses([]);
    setReplyGenerated(true); setAttempted(true);
    setProfileExpanded(false);

    try {
      const toneName = TONES.find(t => t.id === tone)?.label ?? tone;
      const platName = PLATFORMS.find(p => p.id === platform)?.label ?? platform;
      const sentiment = rating <= 2 ? "negative (unhappy customer)"
        : rating === 3 ? "mixed" : "positive (happy customer)";
      const lengthGuide = {
        brief:    "Keep each response to 1–2 sentences only.",
        standard: "Each response should be 2–4 sentences.",
        detailed: "Each response should be 4–6 sentences.",
      }[responseLength] ?? "";
      const snippetsBlock = snippets.length > 0
        ? `\nSMART SNIPPETS (weave in naturally when topic is detected):\n${snippets.map(s => `- When "${s.topic}" is mentioned → ${s.response}`).join("\n")}`
        : "";
      const sigBlock = signature.trim()
        ? `\nEnd each response with this sign-off on a new line: ${signature.trim()}` : "";
      const ctxBlock = reviewContext.trim()
        ? `\nIMPORTANT CONTEXT: ${reviewContext.trim()}` : "";
      const contactBlock = contactInfo.trim() && rating <= 3
        ? `\nESCALATION CONTACT: ${contactInfo.trim()} — for negative/mixed reviews, naturally include this so the customer can reach out privately to resolve the issue` : "";

      const raw = await callClaude(
        `You are an expert reputation manager. Generate 2 distinct professional reply options to this review. Vary wording and structure — not just minor rewrites of each other.

BUSINESS: ${bizName} (${bizType}) on ${platName}
PLATFORM CONTEXT: ${platName === "Google" ? "Google responses are public and indexed — professional tone recommended, 150–250 words ideal" : platName === "Yelp" ? "Yelp users expect conversational, warm responses — avoid corporate language" : platName === "TripAdvisor" ? "TripAdvisor responses are read by future travellers — address what matters to them, not just the individual" : "Facebook responses are semi-public and conversational — keep warm and personal"}
TONE: ${toneName}${voiceNote ? `\nVOICE NOTE: ${voiceNote}` : ""}${snippetsBlock}${sigBlock}

REVIEW: ${rating}/5 — ${sentiment}
Reviewer: ${reviewerName || "Anonymous"}
"${reviewText}"${ctxBlock}${contactBlock}

RULES:
- ${lengthGuide}
- Reply as the business owner
- Address reviewer by name if given
- Negative: acknowledge issue, apologize, offer concrete next step, non-defensive
- Positive: warm specific thanks, echo what they mentioned, invite back
- Mixed: validate positives, acknowledge gap, commit to improvement
- Option 1: lead by acknowledging the specific issue or experience the reviewer described
- Option 2: open with recognition of their time/loyalty before addressing the issue
- These structural differences must be clear — not just different wording
- No placeholder text like [phone number]
${snippets.length > 0 ? "- Naturally include relevant Smart Snippets only when detected" : ""}

Return ONLY valid JSON:
{"response1": "...", "response2": "..."}`,
        1500
      );

      const parsed = parseJSON(raw);
      const list = [parsed.response1, parsed.response2].filter(r => typeof r === "string" && r.trim());
      if (!list.length) throw new Error("No responses returned — try again.");
      setResponses(list);
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setReplyLoading(false); replyLock.current = false;
    }
  };

  // ── Generate review request (NEW v4) ──
  const reqValid = bizName.trim().length > 0 && customerName.trim().length > 0;

  const handleGenerateRequest = async () => {
    if (!reqValid || reqLock.current) return;
    reqLock.current = true;
    setReqLoading(true); setReqError("");
    setReqSMS(""); setReqEmailSubject(""); setReqEmailBody("");
    setReqGenerated(true);

    try {
      const platName = PLATFORMS.find(p => p.id === reqPlatform)?.label ?? reqPlatform;
      const raw = await callClaude(
        `You are writing review request messages for a local business. Generate a warm, natural SMS and email asking a satisfied customer to leave a review. They should feel personal, not copy-paste template-like.

BUSINESS: ${bizName} (${bizType})
CUSTOMER NAME: ${customerName}
VISIT/SERVICE: ${visitType || "their recent visit"}
PLATFORM: ${platName}${reqLink ? `\nREVIEW LINK: ${reqLink}` : ""}

RULES:
- SMS: 159 characters or fewer (strict), warm and personal, include the review link if provided, otherwise ask them to search on ${platName}
- Email subject: Punchy, under 8 words, personal
- Email body: 3–5 sentences, genuine not salesy, mention what they came in for, include the link if provided
- Use the customer's first name
- Never say "we'd love a 5-star review" — just ask for honest feedback

Return ONLY valid JSON:
{"sms": "...", "emailSubject": "...", "emailBody": "..."}`,
        800
      );

      const parsed = parseJSON(raw);
      if (!parsed.sms && !parsed.emailBody) throw new Error("No content returned — try again.");
      setReqSMS(parsed.sms || "");
      setReqEmailSubject(parsed.emailSubject || "");
      setReqEmailBody(parsed.emailBody || "");
    } catch (err) {
      setReqError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setReqLoading(false); reqLock.current = false;
    }
  };


  // ── Demo content ──
  const loadDemo = () => {
    setPlatform("google");
    setRating(2);
    setReviewerName("Sarah M.");
    setReviewText("Really disappointing experience. Waited 45 minutes for our food even though the restaurant wasn't busy, and when it finally arrived my pasta was cold. The waiter was polite at least, but I won't be coming back.");
    setReviewContext("");
    setBreakdown(null);
    setResponses([]);
    setReplyGenerated(false);
  };

  // ── Snippet helpers ──
  const addSnippet    = s  => setSnippets(p => [...p, s]);
  const removeSnippet = id => setSnippets(p => p.filter(s => s.id !== id));

  // ── Shared styles ──
  const inp = {
    width:"100%", padding:"9px 11px", border:"1px solid #DDE2D9", borderRadius:8,
    fontSize:14, color:"#111827", background:"#F7F8F6",
    transition:"border-color 0.15s,box-shadow 0.15s",
  };
  const lbl  = { fontSize:12, fontWeight:600, color:"#374151", display:"block", marginBottom:5 };
  const sec  = { fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase",
                 color:"#9CA3AF", marginBottom:16 };
  const card = { background:"#fff", border:"1px solid #DDE2D9", borderRadius:14, padding:"20px" };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#F7F8F6",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes spin  { to { transform:rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        * { box-sizing:border-box; }
        input:focus,textarea:focus,select:focus {
          outline:none; border-color:#1A3D2B!important;
          box-shadow:0 0 0 3px rgba(26,61,43,0.08)!important; }
        ::placeholder { color:#C4CAC0; }
        button { transition:opacity 0.15s; }
        button:active { opacity:0.85; }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#DDE2D9;border-radius:4px}
        select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%236B7280' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; padding-right:28px!important; }
        .rm-grid {
          display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start;
          max-width:1100px; margin:0 auto; padding:28px 20px;
        }
        .rm-right {
          position:sticky; top:24px;
          max-height:calc(100vh - 80px); overflow-y:auto; padding-right:4px;
        }
        .rm-left { display:flex; flex-direction:column; gap:16px; }
        .rm-right-inner { display:flex; flex-direction:column; gap:14px; }
        .rm-hidden { display:none !important; }
        @media (max-width:720px) {
          .rm-grid { grid-template-columns:1fr; padding:16px; gap:16px; }
          .rm-right { position:relative; top:0; max-height:none; overflow-y:visible; padding-right:0; }
          .rm-header-title { font-size:14px!important; }
          .rm-badge { display:none!important; }
        }
      `}</style>

      {/* ── Header ── */}
      <header style={{ background:"#1A3D2B", padding:"14px 24px",
        display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ width:34, height:34, background:"#E8A020", borderRadius:9,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:17, flexShrink:0 }}>★</div>
        <span className="rm-header-title"
          style={{ color:"#fff", fontWeight:800, fontSize:17, letterSpacing:"-0.02em" }}>
          REPLYMATE</span>
        <span className="rm-badge" style={{ fontSize:10, fontWeight:700, color:"#E8A020",
          background:"rgba(232,160,32,0.15)",
          padding:"2px 8px", borderRadius:100, letterSpacing:"0.06em" }}>
          AI REVIEW MANAGER</span>

        {/* ── Tabs in header ── */}
        <div style={{ marginLeft:"auto", display:"flex", gap:4 }}>
          {[
            { id:"reply",   label:"★  Reply"   },
            { id:"request", label:"✉  Request" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding:"7px 14px",
              background: activeTab === t.id ? "#fff" : "rgba(255,255,255,0.1)",
              color:       activeTab === t.id ? "#1A3D2B" : "rgba(255,255,255,0.7)",
              border:"none", borderRadius:8, cursor:"pointer",
              fontSize:12, fontWeight:700, transition:"all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        <button onClick={() => setShowSettings(true)} title="API Key Settings" style={{
          background:"rgba(255,255,255,0.12)", border:"none", borderRadius:7,
          color:"rgba(255,255,255,0.75)", cursor:"pointer",
          fontSize:16, padding:"6px 9px", lineHeight:1, marginLeft:8,
        }}>⚙</button>

      </header>

      {/* Settings modal */}
      {showSettings && <SettingsModal onClose={handleCloseSettings} />}

      {/* No-key banner */}
      {!hasKey && (
        <div style={{
          background:"#FFFBEB", borderBottom:"1px solid #FDE68A",
          padding:"10px 24px",
          display:"flex", alignItems:"center", justifyContent:"center", gap:12,
          flexWrap:"wrap",
        }}>
          <span style={{ fontSize:13, color:"#92400E" }}>
            ⚠ Add your Anthropic API key to start generating replies
          </span>
          <button onClick={() => setShowSettings(true)} style={{
            padding:"5px 14px", background:"#1A3D2B", color:"#fff",
            border:"none", borderRadius:6, fontSize:12, fontWeight:700,
            cursor:"pointer",
          }}>Add Key →</button>
        </div>
      )}

      {/* Onboarding banner — shown until business name set */}
      {!bizName && (
        <div style={{
          background:"#1A3D2B", color:"#fff",
          padding:"12px 24px",
          display:"flex", alignItems:"center", justifyContent:"center",
          gap:16, flexWrap:"wrap",
        }}>
          <span style={{ fontSize:13 }}>
            <strong>Get started:</strong>
            {"  "}①&nbsp;Add your business&nbsp;&nbsp;
            ②&nbsp;Paste a review&nbsp;&nbsp;
            ③&nbsp;Generate
          </span>
          <button onClick={loadDemo} style={{
            padding:"6px 14px", background:"#E8A020", color:"#1A3D2B",
            border:"none", borderRadius:6, fontSize:12, fontWeight:700,
            cursor:"pointer",
          }}>Try an example →</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ TAB 1: REPLY ══ */}
      {(true) && (
        <div className={`rm-grid${activeTab !== "reply" ? " rm-hidden" : ""}`}>

          {/* LEFT */}
          <div className="rm-left">

            {/* Business Profile - collapsible */}
            <section style={card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: profileExpanded ? 16 : 0 }}>
                <div style={sec}>Your Business</div>
                {bizName && (
                  <button onClick={() => setProfileExpanded(e => !e)} style={{
                    background:"none", border:"none", cursor:"pointer",
                    fontSize:12, fontWeight:600, color:"#1A3D2B", padding:"2px 6px" }}>
                    {profileExpanded ? "Collapse ▲" : "Edit ▼"}
                  </button>
                )}
              </div>

              {/* Collapsed summary */}
              {!profileExpanded && bizName && (
                <div style={{ fontSize:13, color:"#374151", lineHeight:1.6 }}>
                  <strong>{bizName}</strong>
                  <span style={{ color:"#9CA3AF", margin:"0 6px" }}>·</span>
                  <span style={{ color:"#6B7280" }}>{bizType}</span>
                  <span style={{ color:"#9CA3AF", margin:"0 6px" }}>·</span>
                  <span style={{ color:"#6B7280" }}>{TONES.find(t => t.id === tone)?.label}</span>
                  {signature && <><span style={{ color:"#9CA3AF", margin:"0 6px" }}>·</span><span style={{ color:"#6B7280" }}>{signature}</span></>}
                </div>
              )}

              {/* Expanded form */}
              {profileExpanded && (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div>
                  <label style={lbl}>Business Name *</label>
                  <input value={bizName} onChange={e => setBizName(e.target.value)}
                    placeholder="e.g. Marco's Trattoria" style={inp} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label style={lbl}>Business Type</label>
                    <select value={bizType} onChange={e => setBizType(e.target.value)}
                      style={{ ...inp, appearance:"none", cursor:"pointer", fontSize:13 }}>
                      {BUSINESS_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Tone</label>
                    <select value={tone} onChange={e => setTone(e.target.value)}
                      style={{ ...inp, appearance:"none", cursor:"pointer", fontSize:13 }}>
                      {TONES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={lbl}>
                    Voice Note <span style={{ fontWeight:400, color:"#9CA3AF" }}>(optional)</span>
                  </label>
                  <input value={voiceNote} onChange={e => setVoiceNote(e.target.value)}
                    placeholder="e.g. Always mention our satisfaction guarantee"
                    maxLength={200} style={{ ...inp, fontSize:13 }} />
                  {voiceNote.length > 150 && (
                    <div style={{ fontSize:11, textAlign:"right", marginTop:3,
                      color:voiceNote.length>=200?"#DC2626":"#9CA3AF" }}>
                      {voiceNote.length}/200</div>
                  )}
                </div>
                <div>
                  <label style={lbl}>
                    Sign-Off <span style={{ fontWeight:400, color:"#9CA3AF" }}>(optional)</span>
                  </label>
                  <input value={signature} onChange={e => setSignature(e.target.value)}
                    placeholder="e.g. — Marco, Owner"
                    maxLength={80} style={{ ...inp, fontSize:13 }} />
                </div>
                <div>
                  <label style={lbl}>
                    Escalation Contact <span style={{ fontWeight:400, color:"#9CA3AF" }}>(for unhappy customers)</span>
                  </label>
                  <input value={contactInfo} onChange={e => setContactInfo(e.target.value)}
                    placeholder="e.g. call us at (555) 123-4567 or email hello@yourbiz.com"
                    maxLength={200} style={{ ...inp, fontSize:13 }} />
                </div>
              </div>
              )} {/* end profileExpanded */}
            </section>

            {/* Smart Snippets */}
            <SmartSnippetsPanel snippets={snippets} onAdd={addSnippet} onRemove={removeSnippet} />

            {/* Review Input */}
            <section style={card}>
              <div style={sec}>The Review</div>

              {/* Platform */}
              <div style={{ marginBottom:16 }}>
                <label style={lbl}>Platform</label>
                <div style={{ display:"flex", gap:6 }}>
                  {PLATFORMS.map(p => (
                    <button key={p.id} onClick={() => setPlatform(p.id)} style={{
                      flex:1, padding:"7px 4px",
                      border:platform===p.id ? "2px solid #1A3D2B" : "1px solid #DDE2D9",
                      borderRadius:8, cursor:"pointer",
                      background:platform===p.id ? "#E8F0EC" : "#F7F8F6",
                      color:platform===p.id ? "#1A3D2B" : "#6B7280",
                      fontSize:12, fontWeight:600, minHeight:44 }}>{p.label}</button>
                  ))}
                </div>
              </div>

              {/* Stars */}
              <div style={{ marginBottom:16 }}>
                <label style={lbl}>
                  Star Rating *{" "}
                  <span style={{ fontWeight:400, color:"#C4CAC0" }}>(click again to clear)</span>
                </label>
                <StarRating value={rating} onChange={setRating} />
              </div>

              {/* Reviewer */}
              <div style={{ marginBottom:12 }}>
                <label style={lbl}>
                  Reviewer Name <span style={{ fontWeight:400, color:"#9CA3AF" }}>(optional)</span>
                </label>
                <input value={reviewerName} onChange={e => setReviewerName(e.target.value)}
                  placeholder="e.g. Sarah M." style={inp} />
              </div>

              {/* Review text */}
              <div style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                <span style={{ fontSize:12, fontWeight:600, color:"#374151" }}>Review Text *</span>
                <button onClick={loadDemo} style={{ background:"none", border:"none", cursor:"pointer",
                  fontSize:11, color:"#1A3D2B", fontWeight:600, padding:0 }}>
                  Try an example →</button>
              </div>
                <textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
                  placeholder="Paste the customer's review here…" rows={4}
                  onBlur={handleReviewBlur}
                  style={{ ...inp, resize:"vertical", lineHeight:1.65 }} />
                {reviewText.length > 0 && (
                  <div style={{ fontSize:11, color:"#C4CAC0", marginTop:3, textAlign:"right" }}>
                    {reviewText.length} chars</div>
                )}
              </div>

              {/* ── Review Breakdown (NEW v4) ── */}
              <BreakdownCard breakdown={breakdown} loading={breakdownLoading} onDismiss={() => setBreakdown(null)} />

              {/* Situation context */}
              <div style={{ marginBottom:12 }}>
                <label style={lbl}>
                  Situation Context <span style={{ fontWeight:400, color:"#9CA3AF" }}>(optional)</span>
                </label>
                <input value={reviewContext} onChange={e => setReviewContext(e.target.value)}
                  placeholder="e.g. We already refunded this customer"
                  maxLength={300} style={{ ...inp, fontSize:13 }} />
              </div>

              {/* Response length */}
              <div style={{ marginBottom:20 }}>
                <label style={lbl}>Response Length</label>
                <div style={{ display:"flex", gap:6 }}>
                  {LENGTH_OPTIONS.map(l => (
                    <button key={l.id} onClick={() => setResponseLength(l.id)} style={{
                      flex:1, padding:"8px 4px",
                      border:responseLength===l.id ? "2px solid #1A3D2B" : "1px solid #DDE2D9",
                      borderRadius:8, cursor:"pointer",
                      background:responseLength===l.id ? "#E8F0EC" : "#F7F8F6",
                      color:responseLength===l.id ? "#1A3D2B" : "#6B7280" }}>
                      <div style={{ fontSize:12, fontWeight:700 }}>{l.label}</div>
                      <div style={{ fontSize:10, marginTop:2,
                        color:responseLength===l.id ? "#2D6A4F" : "#9CA3AF" }}>{l.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate */}
              <button onClick={handleGenerateReply} disabled={!replyValid || replyLoading} style={{
                width:"100%", padding:"13px",
                background:replyValid&&!replyLoading ? "#1A3D2B" : "#E5E7EB",
                color:replyValid&&!replyLoading ? "#fff" : "#9CA3AF",
                border:"none", borderRadius:10, fontSize:14, fontWeight:700,
                cursor:replyValid&&!replyLoading ? "pointer":"not-allowed",
                letterSpacing:"-0.01em" }}>
                {replyLoading ? "Generating responses…" : "Generate Replies →"}
              </button>

              {attempted && !replyValid && !replyLoading && (
                <p style={{ fontSize:11, color:"#C4CAC0", textAlign:"center",
                  marginTop:8, marginBottom:0 }}>{replyHint}</p>
              )}
            </section>
          </div>

          {/* RIGHT */}
          <div className="rm-right">
            <div className="rm-right-inner">

              {(replyGenerated || replyLoading) && (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em",
                    textTransform:"uppercase", color:"#9CA3AF" }}>Response Options</span>
                  {responses.length > 0 && !replyLoading && (
                    <button onClick={handleGenerateReply} disabled={!replyValid} style={{
                      fontSize:12, fontWeight:600, color:"#1A3D2B",
                      background:"none", border:"none",
                      cursor:replyValid ? "pointer":"not-allowed",
                      padding:"4px 8px", opacity:replyValid ? 1:0.4 }}>
                      ↻ Regenerate</button>
                  )}
                </div>
              )}

              {replyError && (
                <div style={{ background:"#FEF2F2", border:"1px solid #FECACA",
                  borderRadius:10, padding:"14px 16px", color:"#DC2626",
                  fontSize:13, lineHeight:1.5 }}>
                  <strong>Error:</strong> {replyError}
                </div>
              )}

              {replyLoading && <><ResponseCard index={0} loading /><ResponseCard index={1} loading /></>}
              {!replyLoading && responses.map((r,i) => (
                <ResponseCard key={`${i}-${r.slice(0,10)}`} text={r} index={i} loading={false} />
              ))}

              {!replyGenerated && !replyLoading && (
                <div style={{ background:"#fff", border:"1px solid #DDE2D9",
                  borderRadius:14, padding:"52px 28px", textAlign:"center" }}>
                  <div style={{ fontSize:44, opacity:0.2, marginBottom:14 }}>★</div>
                  <div style={{ fontSize:15, fontWeight:600, color:"#374151", marginBottom:8 }}>
                    Replies appear here</div>
                  <p style={{ fontSize:13, color:"#9CA3AF", margin:0, lineHeight:1.65 }}>
                    Fill in your business details, paste a review, and hit Generate.</p>
                </div>
              )}

              {!replyLoading && responses.length > 0 && (
                <div style={{ background:"#F7F8F6", border:"1px solid #DDE2D9",
                  borderRadius:10, padding:"12px 14px",
                  display:"flex", gap:10, alignItems:"flex-start" }}>
                  <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>💡</span>
                  <p style={{ fontSize:12, color:"#6B7280", margin:0, lineHeight:1.55 }}>
                    <strong style={{ color:"#374151" }}>Tip:</strong> Click any response to
                    edit inline before copying. Your profile auto-saves between sessions.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ TAB 2: REQUEST ══ */}
      {(true) && (
        <div className={`rm-grid${activeTab !== "request" ? " rm-hidden" : ""}`}>

          {/* LEFT: Request form */}
          <div className="rm-left">
            <section style={card}>
              <div style={sec}>The Customer</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

                {bizName && (
                  <div style={{ background:"#E8F0EC", borderRadius:8, padding:"10px 13px",
                    fontSize:12, color:"#1A3D2B", fontWeight:600 }}>
                    From: {bizName}
                    <span style={{ color:"#2D6A4F", fontWeight:400, marginLeft:4 }}>
                      — from your business profile</span>
                  </div>
                )}
                {!bizName && (
                  <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A",
                    borderRadius:8, padding:"10px 13px",
                    fontSize:12, color:"#92400E" }}>
                    ⚠ Add your business name in the Reply tab first
                  </div>
                )}

                <div>
                  <label style={lbl}>Customer Name *</label>
                  <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                    placeholder="e.g. Sarah" style={inp} />
                </div>

                <div>
                  <label style={lbl}>
                    What They Came In For <span style={{ fontWeight:400, color:"#9CA3AF" }}>(optional)</span>
                  </label>
                  <input value={visitType} onChange={e => setVisitType(e.target.value)}
                    placeholder="e.g. haircut, oil change, lunch visit"
                    style={{ ...inp, fontSize:13 }} />
                </div>

                <div>
                  <label style={lbl}>Request Review On</label>
                  <div style={{ display:"flex", gap:6 }}>
                    {PLATFORMS.map(p => (
                      <button key={p.id} onClick={() => setReqPlatform(p.id)} style={{
                        flex:1, padding:"7px 4px",
                        border:reqPlatform===p.id ? "2px solid #1A3D2B" : "1px solid #DDE2D9",
                        borderRadius:8, cursor:"pointer",
                        background:reqPlatform===p.id ? "#E8F0EC" : "#F7F8F6",
                        color:reqPlatform===p.id ? "#1A3D2B" : "#6B7280",
                        fontSize:12, fontWeight:600, minHeight:44 }}>{p.label}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={lbl}>
                    Review Link <span style={{ fontWeight:400, color:"#9CA3AF" }}>(optional but recommended)</span>
                  </label>
                  <input value={reqLink} onChange={e => setReqLink(e.target.value)}
                    placeholder="https://g.page/your-business/review"
                    style={{ ...inp, fontSize:13 }} />
                </div>

                <button onClick={handleGenerateRequest}
                  disabled={!reqValid || reqLoading} style={{
                    width:"100%", padding:"13px",
                    background:reqValid&&!reqLoading ? "#1A3D2B" : "#E5E7EB",
                    color:reqValid&&!reqLoading ? "#fff" : "#9CA3AF",
                    border:"none", borderRadius:10, fontSize:14, fontWeight:700,
                    cursor:reqValid&&!reqLoading ? "pointer":"not-allowed",
                    letterSpacing:"-0.01em", marginTop:4 }}>
                  {reqLoading ? "Writing request messages…" : "Generate Request Messages →"}
                </button>

                {!reqValid && !reqLoading && (
                  <p style={{ fontSize:11, color:"#C4CAC0", textAlign:"center",
                    marginTop:4, marginBottom:0 }}>
                    {!bizName.trim() ? "Add your business name in the Reply tab" : "Enter the customer's name"}
                  </p>
                )}
              </div>
            </section>

            {/* Tip */}
            <div style={{ background:"#fff", border:"1px solid #DDE2D9",
              borderRadius:10, padding:"14px 16px",
              display:"flex", gap:10, alignItems:"flex-start" }}>
              <span style={{ fontSize:16, flexShrink:0 }}>💡</span>
              <div style={{ fontSize:12, color:"#6B7280", lineHeight:1.6 }}>
                <strong style={{ color:"#374151", display:"block", marginBottom:4 }}>
                  Best time to send?</strong>
                Within 1–2 hours of the visit while the experience is fresh.
                Texts get 3× the open rate of email — send SMS first, email as follow-up.
              </div>
            </div>
          </div>

          {/* RIGHT: Request output */}
          <div className="rm-right">
            <div className="rm-right-inner">

              {(reqGenerated || reqLoading) && (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em",
                    textTransform:"uppercase", color:"#9CA3AF" }}>Request Messages</span>
                  {(reqSMS || reqEmailBody) && !reqLoading && (
                    <button onClick={handleGenerateRequest} disabled={!reqValid} style={{
                      fontSize:12, fontWeight:600, color:"#1A3D2B",
                      background:"none", border:"none",
                      cursor:reqValid ? "pointer":"not-allowed",
                      padding:"4px 8px", opacity:reqValid ? 1:0.4 }}>
                      ↻ Regenerate</button>
                  )}
                </div>
              )}

              {reqError && (
                <div style={{ background:"#FEF2F2", border:"1px solid #FECACA",
                  borderRadius:10, padding:"14px 16px", color:"#DC2626",
                  fontSize:13, lineHeight:1.5 }}>
                  <strong>Error:</strong> {reqError}
                </div>
              )}

              {reqLoading && (
                <>
                  <RequestCard badge="SMS" title="Text Message" loading loadingLabel="Writing SMS…" />
                  <RequestCard badge="Email" title="Email Subject" loading loadingLabel="Writing email…" />
                </>
              )}

              {!reqLoading && reqSMS && (
                <RequestCard badge="SMS" title="Text Message" content={reqSMS} />
              )}
              {!reqLoading && reqEmailSubject && (
                <RequestCard badge="Subject" title="Email Subject Line" content={reqEmailSubject} />
              )}
              {!reqLoading && reqEmailBody && (
                <RequestCard badge="Email" title="Email Body" content={reqEmailBody} />
              )}

              {!reqGenerated && !reqLoading && (
                <div style={{ background:"#fff", border:"1px solid #DDE2D9",
                  borderRadius:14, padding:"52px 28px", textAlign:"center" }}>
                  <div style={{ fontSize:40, opacity:0.2, marginBottom:14 }}>✉</div>
                  <div style={{ fontSize:15, fontWeight:600, color:"#374151", marginBottom:8 }}>
                    SMS + email appear here</div>
                  <p style={{ fontSize:13, color:"#9CA3AF", margin:0, lineHeight:1.65 }}>
                    Enter the customer's name on the left and hit Generate to create
                    a personalized review request ready to send.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
