import { useState, useRef, useCallback, useEffect } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#0f1117", panel: "#161b27", panelBorder: "#2a3045",
  accent: "#4f8ef7", accentMuted: "#1e3a6e",
  text: "#e2e8f0", textMuted: "#8896b0", textDim: "#4a5568",
  danger: "#e05c5c", success: "#3dba7e", warning: "#e0a020",
  edge: "#4a5568",
};
const PH = 400;
const panel = (extra = {}) => ({
  background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 8,
  padding: "12px", display: "flex", flexDirection: "column",
  height: PH, boxSizing: "border-box", overflow: "hidden", ...extra,
});
const lbl = {
  fontSize: 10, fontFamily: "monospace", letterSpacing: "0.12em",
  color: C.textMuted, textTransform: "uppercase",
  marginBottom: 8, borderBottom: `1px solid ${C.panelBorder}`, paddingBottom: 6,
  flexShrink: 0,
};
const btn = (v = "default") => ({
  fontSize: 11, fontFamily: "monospace", padding: "4px 10px", borderRadius: 4, cursor: "pointer",
  border: `1px solid ${v === "danger" ? C.danger : v === "success" ? C.success : C.panelBorder}`,
  background: v === "danger" ? "rgba(224,92,92,0.12)" : v === "success" ? "rgba(61,186,126,0.12)" : "rgba(255,255,255,0.04)",
  color: v === "danger" ? C.danger : v === "success" ? C.success : C.text,
  whiteSpace: "nowrap", flexShrink: 0,
});
const inp = (extra = {}) => ({
  background: "rgba(255,255,255,0.04)", border: `1px solid ${C.panelBorder}`,
  borderRadius: 4, color: C.text, fontSize: 11, fontFamily: "monospace",
  padding: "5px 8px", outline: "none", ...extra,
});

// ─── Context-tree helpers ──────────────────────────────────────────────────────

// Walk edges upward from nodeId, return ordered list of ancestor node IDs
// (root first, direct parent last — so history is oldest→newest)
function getAncestorIds(nodeId, edges) {
  const ancestors = [];
  let current = nodeId;
  const visited = new Set();
  while (true) {
    if (visited.has(current)) break; // cycle guard
    visited.add(current);
    // Find an edge whose target is `current` — that edge's source is the parent
    const parentEdge = edges.find(([, b]) => b === current);
    if (!parentEdge) break;
    current = parentEdge[0];
    ancestors.unshift(current); // prepend so root ends up first
  }
  return ancestors;
}

// Build the full system prompt from active constraints + active node ancestry
function buildSystemPrompt(constraints, ancestorLabels) {
  const active = constraints.filter(c => c.checked).map(c => `  - ${c.label}`).join("\n");
  const branch = ancestorLabels.length > 0
    ? `\nResearch branch context (oldest → current): ${ancestorLabels.join(" → ")}`
    : "";
  return `You are a research assistant helping with ideation, verification, and refinement of research ideas.

Pinned constraints — respect these in every response:
${active || "  (none active)"}
${branch}

When generating ideas:
1. Always respect the pinned constraints above.
2. Be concrete — cite mechanisms, not just directions.
3. Structure responses with numbered ideas followed by brief rationale.`;
}

// Collect the flattened API history from all ancestor nodes in order
function buildAncestorApiHistory(ancestorIds, nodeHistories) {
  return ancestorIds.flatMap(id => (nodeHistories[id]?.apiHistory || []));
}

// ─── Context Lock ─────────────────────────────────────────────────────────────
function ContextLock({ constraints, setConstraints }) {
  const [newLabel, setNewLabel] = useState("");
  const add = () => {
    const label = newLabel.trim() || `Constraint ${constraints.length + 1}`;
    setConstraints(p => [...p, { id: Date.now(), label, checked: true }]);
    setNewLabel("");
  };
  const deleteLast = () => setConstraints(p => p.slice(0, -1));
  const toggle = id => setConstraints(p => p.map(c => c.id === id ? { ...c, checked: !c.checked } : c));
  const edit = (id, v) => setConstraints(p => p.map(c => c.id === id ? { ...c, label: v } : c));
  return (
    <div style={panel()}>
      <div style={lbl}>Pinned Constraints</div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {constraints.map(c => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={c.checked} onChange={() => toggle(c.id)} style={{ accentColor: C.accent, flexShrink: 0 }} />
            <input value={c.label} onChange={e => edit(c.id, e.target.value)} style={{
              background: "transparent", border: "none", borderBottom: `1px solid ${C.panelBorder}`,
              color: c.checked ? C.text : C.textDim, fontSize: 12, fontFamily: "monospace",
              width: "100%", outline: "none", textDecoration: c.checked ? "none" : "line-through",
            }} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 6, flexShrink: 0 }}>
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()} placeholder="New constraint…"
          style={{ ...inp(), flex: 1, minWidth: 0 }} />
        <button style={btn("success")} onClick={add}>＋ Add</button>
        <button style={btn("danger")} onClick={deleteLast}>− Del</button>
      </div>
    </div>
  );
}

// ─── Dialogue Board ───────────────────────────────────────────────────────────
// Fully controlled — messages come from parent, new entries reported via callbacks
function DialogueBoard({
  activeNodeId, activeNodeLabel, ancestorLabels,
  displayMessages, isLoading,
  onAnnotate, onSendMessage,
}) {
  const [sel, setSel] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [displayMessages.length]);

  const onUp = (msgId) => {
    const s = window.getSelection();
    if (!s || s.isCollapsed) return;
    const text = s.toString().trim();
    if (text) setSel({ text, msgId });
  };
  const annotate = () => {
    if (!sel) return;
    onAnnotate({ id: Date.now(), source: sel.text, note: "", type: "highlight" });
    window.getSelection()?.removeAllRanges();
    setSel(null);
  };

  const branchLabel = ancestorLabels.length > 0
    ? [...ancestorLabels, activeNodeLabel].join(" → ")
    : activeNodeLabel;

  return (
    <div style={panel({ position: "relative" })}>
      {/* Node breadcrumb */}
      <div style={{ ...lbl, display: "flex", alignItems: "center", gap: 6 }}>
        <span>Dialogue Board</span>
        <span style={{ marginLeft: "auto", color: C.accent, fontSize: 10, fontStyle: "normal" }}>
          {activeNodeId ? `◈ ${branchLabel}` : "◈ No node selected — click a tree node"}
        </span>
      </div>

      {/* Ancestor context indicator */}
      {ancestorLabels.length > 0 && (
        <div style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace", marginBottom: 8, padding: "4px 8px", background: "rgba(79,142,247,0.06)", borderRadius: 4, border: `1px solid ${C.accentMuted}`, flexShrink: 0 }}>
          Inheriting context from: {ancestorLabels.join(" → ")}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {displayMessages.length === 0 && !isLoading && (
          <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace", textAlign: "center", marginTop: 30 }}>
            {activeNodeId ? "No messages yet — send a prompt below" : "Select a node in the context tree to start"}
          </div>
        )}
        {displayMessages.map(m => (
          <div key={m.id} style={{
            background: m.role === "user" ? "rgba(79,142,247,0.06)" : "rgba(255,255,255,0.03)",
            borderRadius: 6,
            border: `1px solid ${m.role === "user" ? C.accentMuted : C.panelBorder}`,
            padding: "10px 12px", flexShrink: 0,
          }}>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: m.role === "user" ? C.success : C.accent, marginBottom: 6 }}>
              {m.role === "user" ? "YOU" : "AI · " + (m.nodeLabel || activeNodeLabel)}
            </div>
            <div onMouseUp={() => onUp(m.id)}
              style={{ fontSize: 12, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap", userSelect: "text", cursor: "text" }}>
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace", padding: "10px 12px" }}>
            AI is thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {sel && (
        <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: C.panel, border: `1px solid ${C.accent}`, borderRadius: 6, padding: "8px 12px", display: "flex", gap: 8, alignItems: "center", zIndex: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.6)" }}>
          <span style={{ fontSize: 11, color: C.textMuted, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{sel.text}"</span>
          <button style={btn("success")} onClick={annotate}>Annotate</button>
          <button style={btn("danger")} onClick={() => { window.getSelection()?.removeAllRanges(); setSel(null); }}>✕</button>
        </div>
      )}
    </div>
  );
}

// ─── Annotations ──────────────────────────────────────────────────────────────
function Annotations({ annotations, setAnnotations }) {
  const [noteText, setNoteText] = useState("");
  const saveNote = () => {
    if (!noteText.trim()) return;
    setAnnotations(p => [...p, { id: Date.now(), source: null, note: noteText, type: "note" }]);
    setNoteText("");
  };
  const del = id => setAnnotations(p => p.filter(a => a.id !== id));
  const upd = (id, v) => setAnnotations(p => p.map(a => a.id === id ? { ...a, note: v } : a));
  return (
    <div style={panel()}>
      <div style={lbl}>Annotations</div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {annotations.length === 0 && (
          <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace", textAlign: "center", marginTop: 20 }}>
            Highlight text in dialogue to annotate
          </div>
        )}
        {annotations.map(a => (
          <div key={a.id} style={{
            background: a.type === "highlight" ? "rgba(79,142,247,0.08)" : "rgba(61,186,126,0.08)",
            border: `1px solid ${a.type === "highlight" ? C.accentMuted : "rgba(61,186,126,0.3)"}`,
            borderRadius: 6, padding: "8px 10px", flexShrink: 0,
          }}>
            {a.source && (
              <div style={{ fontSize: 11, color: C.accent, fontFamily: "monospace", borderLeft: `2px solid ${C.accent}`, paddingLeft: 6, marginBottom: 6, fontStyle: "italic", lineHeight: 1.5 }}>
                "{a.source.slice(0, 80)}{a.source.length > 80 ? "…" : ""}"
              </div>
            )}
            <textarea value={a.note} onChange={e => upd(a.id, e.target.value)} placeholder="Add note…" rows={2}
              style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${C.panelBorder}`, color: C.text, fontSize: 11, fontFamily: "monospace", resize: "none", outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button style={{ ...btn(), fontSize: 10 }} onClick={() => alert(`[Prototype] Move to tree node: "${(a.source || a.note || "").slice(0, 40)}"`)}>→ Tree</button>
              <button style={{ ...btn("danger"), fontSize: 10 }} onClick={() => del(a.id)}>Del</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, borderTop: `1px solid ${C.panelBorder}`, paddingTop: 8, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace", marginBottom: 4 }}>Independent note</div>
        <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Take a note…" rows={2}
          style={{ ...inp(), width: "100%", resize: "none", boxSizing: "border-box" }} />
        <button style={{ ...btn("success"), marginTop: 6, width: "100%" }} onClick={saveNote}>✓ Save Note</button>
      </div>
    </div>
  );
}

// ─── Prompt / Get Started ─────────────────────────────────────────────────────
const QUICK = [
  { label: "Research Ideation", text: "Generate novel research directions based on my constraints." },
  { label: "Verify Ideas", text: "Critically evaluate the ideas discussed so far for feasibility and rigour." },
  { label: "Refine Ideas", text: "Take the most promising ideas and suggest concrete next steps." },
];

function GetStarted({ onSend, activeNodeId, isLoading }) {
  const [prompt, setPrompt] = useState("");
  const disabled = !activeNodeId || isLoading;
  const send = (text) => {
    const t = text || prompt.trim();
    if (!t || disabled) return;
    onSend(t);
    setPrompt("");
  };
  return (
    <div style={panel()}>
      <div style={lbl}>Prompt</div>
      {!activeNodeId && (
        <div style={{ fontSize: 11, color: C.warning, fontFamily: "monospace", marginBottom: 8, padding: "4px 8px", background: "rgba(224,160,32,0.08)", borderRadius: 4 }}>
          Select a node in the context tree first
        </div>
      )}
      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace", marginBottom: 8 }}>Quick prompts</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, flexShrink: 0 }}>
        {QUICK.map(q => (
          <button key={q.label} style={{ ...btn(), fontSize: 10, opacity: disabled ? 0.4 : 1 }}
            onClick={() => send(q.text)} disabled={disabled}>{q.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flex: 1, minHeight: 0 }}>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={activeNodeId ? "Enter prompt… (Enter to send)" : "Select a tree node to enable…"}
          disabled={disabled}
          style={{ ...inp(), flex: 1, resize: "none", lineHeight: 1.6, opacity: disabled ? 0.5 : 1 }} />
        <button onClick={() => send()} disabled={disabled} style={{
          ...btn("success"), width: 36, height: 36, alignSelf: "flex-end",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          opacity: disabled ? 0.4 : 1,
        }}>▶</button>
      </div>
    </div>
  );
}

// ─── Context Tree ─────────────────────────────────────────────────────────────
const RX = 36, RY = 22;

function ellipseEdgePoints(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len, uy = dy / len;
  const denom = Math.sqrt((ux / RX) ** 2 + (uy / RY) ** 2) || 1;
  const t = 1 / denom;
  return { x1: x1 + ux * t, y1: y1 + uy * t, x2: x2 - ux * t, y2: y2 - uy * t };
}

const INIT_NODES = [
  { id: "idea", label: "Idea", x: 100, y: 170 },
];
const INIT_EDGES = [
];

function ContextTree({ nodes, edges, setNodes, setEdges, activeNodeId, onNodeSelect, nodeHistories }) {
  const [hovered, setHovered] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 20, y: 10 });
  const [menu, setMenu] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const panRef = useRef(null);

  const deleteNode = id => {
    setNodes(p => p.filter(n => n.id !== id));
    setEdges(p => p.filter(([a, b]) => a !== id && b !== id));
    setMenu(null);
    if (activeNodeId === id) onNodeSelect(null);
  };
  const deleteEdge = (a, b) => setEdges(p => p.filter(([ea, eb]) => !(ea === a && eb === b)));
  const splitNode = id => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const nid = `split_${Date.now()}`;
    setNodes(p => [...p, { id: nid, label: `${node.label}′`, x: node.x + 40, y: node.y + 90 }]);
    setEdges(p => [...p, [id, nid]]);
    setMenu(null);
  };
  const addNode = () => {
    const base = activeNodeId ? nodes.find(n => n.id === activeNodeId) : null;
    const nid = `node_${Date.now()}`;
    setNodes(p => [...p, { id: nid, label: "New Node", x: (base?.x || 300) + 100, y: (base?.y || 170) + 40 }]);
    if (activeNodeId) setEdges(p => [...p, [activeNodeId, nid]]);
  };
  const renameNode = (id, label) => setNodes(p => p.map(n => n.id === id ? { ...n, label } : n));

  const svgCoordsFromClient = useCallback((cx, cy) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (cx - rect.left - pan.x) / zoom, y: (cy - rect.top - pan.y) / zoom };
  }, [pan, zoom]);

  const onNodeClick = (e, id) => {
    e.stopPropagation();
    if (connecting && connecting !== id) {
      if (!edges.find(([a, b]) => a === connecting && b === id))
        setEdges(p => [...p, [connecting, id]]);
      setConnecting(null);
      return;
    }
    onNodeSelect(id === activeNodeId ? null : id);
  };
  const onCtx = (e, id) => { e.preventDefault(); e.stopPropagation(); setMenu({ id, x: e.clientX, y: e.clientY }); };
  const onNodeDown = (e, id) => { if (e.button !== 0) return; e.stopPropagation(); dragRef.current = { id, mx: e.clientX, my: e.clientY }; setDragging(id); };
  const onBgDown = (e) => { if (e.button !== 0) return; if (!connecting) panRef.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }; };

  const onMove = useCallback(e => {
    setMousePos(svgCoordsFromClient(e.clientX, e.clientY));
    if (dragging && dragRef.current) {
      const dx = (e.clientX - dragRef.current.mx) / zoom;
      const dy = (e.clientY - dragRef.current.my) / zoom;
      dragRef.current.mx = e.clientX; dragRef.current.my = e.clientY;
      setNodes(p => p.map(n => n.id === dragging ? { ...n, x: n.x + dx, y: n.y + dy } : n));
    } else if (panRef.current) {
      setPan({ x: panRef.current.px + (e.clientX - panRef.current.mx), y: panRef.current.py + (e.clientY - panRef.current.my) });
    }
  }, [dragging, zoom, svgCoordsFromClient]);

  const onUp = () => { setDragging(null); panRef.current = null; };
  const onWheel = useCallback(e => { e.preventDefault(); setZoom(z => Math.min(3, Math.max(0.25, z - e.deltaY * 0.001))); }, []);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const connectingNode = connecting ? nodes.find(n => n.id === connecting) : null;

  return (
    <div style={panel({ position: "relative" })}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginBottom: 6, borderBottom: `1px solid ${C.panelBorder}`, paddingBottom: 6 }}>
        <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.12em", color: C.textMuted, textTransform: "uppercase" }}>Idea Map · Directed Graph</span>
        <button style={{ ...btn("success"), fontSize: 10, marginLeft: "auto" }} onClick={addNode}>＋ Node</button>
        {connecting && <button style={{ ...btn("danger"), fontSize: 10 }} onClick={() => setConnecting(null)}>✕ Cancel</button>}
        <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>click=select · drag=move · right-click=menu</span>
      </div>
      {connecting && (
        <div style={{ fontSize: 11, color: C.warning, fontFamily: "monospace", marginBottom: 4, flexShrink: 0, padding: "4px 8px", background: "rgba(224,160,32,0.08)", borderRadius: 4, border: `1px solid rgba(224,160,32,0.3)` }}>
          ↗ Drawing edge from <strong style={{ color: "#fff" }}>{connectingNode?.label}</strong> — click target node
        </div>
      )}
      <svg ref={svgRef} width="100%" style={{ flex: 1, minHeight: 0, cursor: dragging ? "grabbing" : connecting ? "crosshair" : "grab" }}
        onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onMouseDown={onBgDown}
        onClick={() => { setMenu(null); if (!connecting) onNodeSelect(null); }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L10,3.5 z" fill={C.accent} />
          </marker>
          <marker id="arrowhead-preview" markerWidth="10" markerHeight="10" refX="9" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L10,3.5 z" fill={C.warning} />
          </marker>
        </defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map(([a, b], i) => {
            const na = nodes.find(n => n.id === a), nb = nodes.find(n => n.id === b);
            if (!na || !nb) return null;
            const pts = ellipseEdgePoints(na.x, na.y, nb.x, nb.y);
            const isHl = activeNodeId === a || activeNodeId === b;
            return (
              <g key={`${a}-${b}-${i}`}>
                <line x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2} stroke="transparent" strokeWidth={12} style={{ cursor: "pointer" }}
                  onClick={e => { e.stopPropagation(); if (window.confirm(`Delete edge ${a} → ${b}?`)) deleteEdge(a, b); }} />
                <line x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
                  stroke={isHl ? C.accent : "#3a4a6e"} strokeWidth={isHl ? 2 : 1.5}
                  markerEnd="url(#arrowhead)" opacity={isHl ? 1 : 0.7} pointerEvents="none" />
              </g>
            );
          })}
          {/* Rubber-band preview */}
          {connectingNode && (
            <line x1={connectingNode.x} y1={connectingNode.y} x2={mousePos.x} y2={mousePos.y}
              stroke={C.warning} strokeWidth={1.5} strokeDasharray="6 4"
              markerEnd="url(#arrowhead-preview)" pointerEvents="none" opacity={0.85} />
          )}
          {/* Nodes */}
          {nodes.map(node => {
            const isHov = hovered === node.id;
            const isSel = activeNodeId === node.id;
            const isSource = connecting === node.id;
            const msgCount = (nodeHistories[node.id]?.displayMessages || []).length;
            const strokeCol = isSource ? C.warning : isSel ? C.accent : isHov ? C.accent : "#2a3a5e";
            const fillCol = isSource ? "rgba(224,160,32,0.18)" : isSel ? C.accentMuted : isHov ? "#1a2840" : "#0e1520";
            return (
              <g key={node.id} transform={`translate(${node.x},${node.y})`}
                onMouseEnter={() => setHovered(node.id)} onMouseLeave={() => setHovered(null)}
                onMouseDown={e => onNodeDown(e, node.id)} onClick={e => onNodeClick(e, node.id)}
                onContextMenu={e => onCtx(e, node.id)}
                style={{ cursor: connecting ? "pointer" : "grab" }}>
                {(isSel || isSource) && <ellipse rx={RX + 5} ry={RY + 5} fill="none" stroke={isSource ? C.warning : C.accent} strokeWidth={1} opacity={0.3} />}
                <ellipse rx={RX} ry={RY} fill={fillCol} stroke={strokeCol} strokeWidth={isSource || isSel ? 2 : 1} />
                <text textAnchor="middle" dominantBaseline="middle" fontSize={10}
                  fill={isSource ? C.warning : isSel ? "#fff" : C.text}
                  fontFamily="monospace" pointerEvents="none" style={{ userSelect: "none" }}>
                  {node.label}
                </text>
                {/* Message count badge */}
                {msgCount > 0 && (
                  <g>
                    <circle cx={RX - 4} cy={-(RY - 4)} r={8} fill={C.accent} />
                    <text x={RX - 4} y={-(RY - 4)} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#fff" pointerEvents="none">{msgCount}</text>
                  </g>
                )}
                {isHov && !dragging && !connecting && (
                  <g>
                    <circle cx={RX - 2} cy={-(RY + 8)} r={10} fill={C.danger} opacity={0.92}
                      onClick={e => { e.stopPropagation(); deleteNode(node.id); }} style={{ cursor: "pointer" }} />
                    <text x={RX - 2} y={-(RY + 8)} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#fff" pointerEvents="none">✕</text>
                    <circle cx={RX + 16} cy={0} r={10} fill={C.accent} opacity={0.92}
                      onClick={e => { e.stopPropagation(); setConnecting(node.id); setMenu(null); }} style={{ cursor: "pointer" }} />
                    <text x={RX + 16} y={0} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="#fff" pointerEvents="none">→</text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {menu && (
        <div style={{ position: "fixed", left: menu.x, top: menu.y, zIndex: 9999, background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 6, padding: 4, display: "flex", flexDirection: "column", gap: 2, minWidth: 160, boxShadow: "0 4px 24px rgba(0,0,0,0.8)" }}
          onClick={e => e.stopPropagation()}>
          {[
            { label: "→ Draw edge from here", action: () => { setConnecting(menu.id); setMenu(null); } },
            { label: "⊕ Split node", action: () => splitNode(menu.id) },
            { label: "✕ Delete node", action: () => deleteNode(menu.id), v: "danger" },
          ].map(item => (
            <button key={item.label} onClick={item.action} style={{ ...btn(item.v), border: "none", textAlign: "left", borderRadius: 4 }}>{item.label}</button>
          ))}
          <div style={{ borderTop: `1px solid ${C.panelBorder}`, marginTop: 2, paddingTop: 4 }}>
            <input defaultValue={nodes.find(n => n.id === menu.id)?.label || ""}
              onBlur={e => renameNode(menu.id, e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { renameNode(menu.id, e.target.value); setMenu(null); } }}
              style={{ ...inp(), width: "100%", boxSizing: "border-box", borderColor: C.accent }}
              placeholder="Rename node…" autoFocus />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Comparison Desk ──────────────────────────────────────────────────────────
const MOCK_SUGG = [
  { id: 1, title: "AI Suggestion A", bullets: ["Deploy federated learning with gradient compression for privacy-preserving model updates.", "Use SecAgg protocol for secure aggregation across distributed research nodes."] },
  { id: 2, title: "AI Suggestion B", bullets: ["Implement k-anonymity at the data collection layer before any model training occurs.", "Augment small datasets with differential privacy noise calibrated to ε = 0.1."] },
];
function ComparisonDesk({ suggestions, setSuggestions }) {
  const [status, setStatus] = useState({});
  const del = id => setSuggestions(p => p.filter(s => s.id !== id));
  const copy = id => {
    const s = suggestions.find(x => x.id === id);
    if (s) navigator.clipboard.writeText(s.bullets.join("\n")).catch(() => { });
    setStatus(p => ({ ...p, [id]: "copied" }));
    setTimeout(() => setStatus(p => { const n = { ...p }; delete n[id]; return n; }), 1500);
  };
  const accept = id => setStatus(p => ({ ...p, [id]: "accepted" }));
  return (
    <div style={panel()}>
      <div style={lbl}>Comparison Desk</div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {suggestions.length === 0 && <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace", textAlign: "center", marginTop: 20 }}>No suggestions</div>}
        {suggestions.map(s => (
          <div key={s.id} style={{ background: status[s.id] === "accepted" ? "rgba(61,186,126,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${status[s.id] === "accepted" ? "rgba(61,186,126,0.4)" : C.panelBorder}`, borderRadius: 6, padding: "10px 12px", flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: C.accent, fontWeight: 600, marginBottom: 6 }}>
              {s.title}
              {status[s.id] === "accepted" && <span style={{ color: C.success, marginLeft: 8 }}>✓ Accepted</span>}
              {status[s.id] === "copied" && <span style={{ color: C.warning, marginLeft: 8 }}>Copied!</span>}
            </div>
            {s.bullets.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                <span style={{ color: C.accent, fontSize: 10, marginTop: 2, flexShrink: 0 }}>◆</span>
                <span style={{ fontSize: 11, color: C.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button style={{ ...btn("success"), fontSize: 10 }} onClick={() => accept(s.id)}>✓ Accept</button>
              <button style={{ ...btn(), fontSize: 10 }} onClick={() => copy(s.id)}>Copy</button>
              <button style={{ ...btn("danger"), fontSize: 10 }} onClick={() => del(s.id)}>Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
const WORKER_URL = "https://research-workbench-worker.marieyu2004.workers.dev";

export default function ResearchWorkbench() {
  const [constraints, setConstraints] = useState([
    { id: 1, label: "Accessibility Focus", checked: true },
    { id: 2, label: "Data Privacy Focus", checked: true },
    { id: 3, label: "Budget", checked: false },
  ]);
  const [annotations, setAnnotations] = useState([]);
  const [suggestions, setSuggestions] = useState(MOCK_SUGG);

  // Tree state lifted up so it can be shared with history logic
  const [nodes, setNodes] = useState(INIT_NODES);
  const [edges, setEdges] = useState(INIT_EDGES);
  const [activeNodeId, setActiveNodeId] = useState(null);

  // Per-node history: { [nodeId]: { displayMessages: [], apiHistory: [] } }
  const [nodeHistories, setNodeHistories] = useState({});

  const [isLoading, setIsLoading] = useState(false);

  const [mockMode, setMockMode] = useState(true); // ← flip to false to enable real API calls

  // ── Derived values for the active node ──────────────────────────────────────
  const activeNode = nodes.find(n => n.id === activeNodeId) || null;
  const ancestorIds = activeNodeId ? getAncestorIds(activeNodeId, edges) : [];
  const ancestorLabels = ancestorIds.map(id => nodes.find(n => n.id === id)?.label).filter(Boolean);
  const activeDisplayMessages = activeNodeId ? (nodeHistories[activeNodeId]?.displayMessages || []) : [];

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (userPrompt) => {
    if (!activeNodeId) return;

    const userDisplayMsg = { id: Date.now(), role: "user", content: userPrompt };
    const userApiMsg = { role: "user", content: userPrompt };

    // Append user message to this node's display + api history immediately
    setNodeHistories(prev => {
      const existing = prev[activeNodeId] || { displayMessages: [], apiHistory: [] };
      return {
        ...prev,
        [activeNodeId]: {
          displayMessages: [...existing.displayMessages, userDisplayMsg],
          apiHistory: [...existing.apiHistory, userApiMsg],
        },
      };
    });

    setIsLoading(true);

    // Build the full messages array for the API:
    // [system] + ancestor api histories (oldest first) + this node's history + new user msg
    const systemPrompt = buildSystemPrompt(constraints, ancestorLabels);
    const ancestorHistory = buildAncestorApiHistory(ancestorIds, nodeHistories);
    const thisNodeHistory = (nodeHistories[activeNodeId]?.apiHistory || []);

    const messagesForApi = [
      { role: "system", content: systemPrompt },
      ...ancestorHistory,
      ...thisNodeHistory,
      userApiMsg,
    ];

    // Log what would be sent — useful for manual verification
    console.group(`[ResearchWorkbench] API call — node: ${activeNode?.label}`);
    console.log("Active node:", activeNodeId, activeNode?.label);
    console.log("Ancestors:", ancestorIds, ancestorLabels);
    console.log("Full messages array:", JSON.stringify(messagesForApi, null, 2));
    console.groupEnd();

    try {
      let assistantContent;

      if (mockMode) {
        // ── Mock mode: no API call, just echo a placeholder ──────────────────
        await new Promise(r => setTimeout(r, 600)); // simulate latency
        assistantContent =
          `[MOCK — node: ${activeNode?.label}]\n\n` +
          `Ancestor context: ${ancestorLabels.length > 0 ? ancestorLabels.join(" → ") : "none"}\n` +
          `Active constraints: ${constraints.filter(c => c.checked).map(c => c.label).join(", ") || "none"}\n\n` +
          `Your message was: "${userPrompt}"\n\n` +
          `(Set mockMode = false in the source to enable real API calls.)`;
      } else {
        // ── Real API call via Cloudflare Worker ──────────────────────────────
        const res = await fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: messagesForApi }),
        });
        if (!res.ok) throw new Error(`Worker returned ${res.status}`);
        const data = await res.json();
        assistantContent = data.choices[0].message.content;
      }

      const assistantDisplayMsg = {
        id: Date.now() + 1,
        role: "assistant",
        content: assistantContent,
        nodeLabel: activeNode?.label,
      };
      const assistantApiMsg = { role: "assistant", content: assistantContent };

      setNodeHistories(prev => {
        const existing = prev[activeNodeId] || { displayMessages: [], apiHistory: [] };
        return {
          ...prev,
          [activeNodeId]: {
            displayMessages: [...existing.displayMessages, assistantDisplayMsg],
            apiHistory: [...existing.apiHistory, assistantApiMsg],
          },
        };
      });

    } catch (err) {
      console.error("[ResearchWorkbench] API error:", err);
      const errMsg = { id: Date.now() + 1, role: "assistant", content: `Error: ${err.message}`, nodeLabel: "error" };
      setNodeHistories(prev => {
        const existing = prev[activeNodeId] || { displayMessages: [], apiHistory: [] };
        return { ...prev, [activeNodeId]: { ...existing, displayMessages: [...existing.displayMessages, errMsg] } };
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeNodeId, activeNode, constraints, ancestorIds, ancestorLabels, nodeHistories]);

  return (
    <div style={{ background: C.bg, padding: "12px", fontFamily: "monospace", color: C.text, boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.panelBorder}` }}>
        <span style={{ fontSize: 13, fontFamily: "monospace", letterSpacing: "0.15em", color: C.accent, fontWeight: 700 }}>◈ RESEARCH WORKBENCH</span>
        <span style={{ fontSize: 10, color: C.textDim }}>prototype · v0.1</span>
        {
          <button onClick={() => setMockMode(!mockMode)} style={{ fontSize: 10, color: C.warning, fontFamily: "monospace", padding: "2px 8px", background: mockMode ? "rgba(224,160,32,0.1)" : "rgba(38, 224, 32, 0.1)", borderRadius: 4, border: `1px solid rgba(224,160,32,0.3)` }}>
            {mockMode ? "MOCK MODE" : "REAL MODE"}
          </button>
        }
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {[["U1", C.accent, C.accentMuted], ["U2", C.success, "rgba(61,186,126,0.2)"], ["U3", C.warning, "rgba(224,160,32,0.2)"]].map(([u, col, bg]) => (
            <div key={u} style={{ width: 26, height: 26, borderRadius: "50%", background: bg, border: `1px solid ${col}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: col }}>{u}</div>
          ))}
        </div>
      </div>

      {/* Top row */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 200px", gap: 8, marginBottom: 8 }}>
        <ContextLock constraints={constraints} setConstraints={setConstraints} />
        <DialogueBoard
          activeNodeId={activeNodeId}
          activeNodeLabel={activeNode?.label || ""}
          ancestorLabels={ancestorLabels}
          displayMessages={activeDisplayMessages}
          isLoading={isLoading}
          onAnnotate={a => setAnnotations(p => [...p, a])}
          onSendMessage={handleSend}
        />
        <Annotations annotations={annotations} setAnnotations={setAnnotations} />
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 200px", gap: 8 }}>
        <GetStarted onSend={handleSend} activeNodeId={activeNodeId} isLoading={isLoading} />
        <ContextTree
          nodes={nodes} edges={edges}
          setNodes={setNodes} setEdges={setEdges}
          activeNodeId={activeNodeId}
          onNodeSelect={setActiveNodeId}
          nodeHistories={nodeHistories}
        />
        <ComparisonDesk suggestions={suggestions} setSuggestions={setSuggestions} />
      </div>
    </div>
  );
}
