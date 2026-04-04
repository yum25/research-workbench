import { useState, useRef, useCallback, useEffect } from "react";
import { C, panel, lbl, btn, inp } from "./ResearchWorkbench.styles";

let idCounter = 1;
const nextId = (prefix) => `${prefix}_${idCounter++}`;

function ContextLock({ constraints, setConstraints }) {
  const [newLabel, setNewLabel] = useState("");
  const add = () => {
    const label = newLabel.trim() || `Constraint ${constraints.length + 1}`;
    setConstraints(p => [...p, { id: nextId("constraint"), label, checked: true }]);
    setNewLabel("");
  };
  const deleteLast = () => setConstraints(p => p.slice(0, -1));
  const toggle = id => setConstraints(p => p.map(c => c.id === id ? { ...c, checked: !c.checked } : c));
  const edit = (id, v) => setConstraints(p => p.map(c => c.id === id ? { ...c, label: v } : c));
  return (
    <div style={panel()}>
      <div style={lbl}>Context Lock · Pinned Constraints</div>
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

const MOCK_MSGS = [
  { id: 1, user: "AI", content: "Based on your accessibility and data privacy constraints, here are three research directions:\n\n1. Federated learning architectures that keep data on-device — addresses privacy without sacrificing model quality.\n\n2. Accessible AI interfaces using WCAG 2.2 as a design constraint, producing richer interaction logs for qualitative analysis.\n\n3. Differential privacy mechanisms for small-dataset research contexts, where traditional anonymisation breaks down." },
  { id: 2, user: "AI", content: "Following up on idea 1: federated learning in healthcare settings has shown promise detecting rare conditions. The key challenge is communication overhead — gradient compression via TopK sparsification can reduce this by 90% without meaningful accuracy loss." },
];

function DialogueBoard({ onAnnotate, constraints }) {
  const [messages, setMessages] = useState(MOCK_MSGS);
  const [sel, setSel] = useState(null);
  const bottomRef = useRef(null);
  const onUp = (msgId) => {
    const s = window.getSelection();
    if (!s || s.isCollapsed) return;
    const text = s.toString().trim();
    if (text) setSel({ text, msgId });
  };
  const annotate = () => {
    if (!sel) return;
    onAnnotate({ id: nextId("annotation"), source: sel.text, note: "", type: "highlight" });
    window.getSelection()?.removeAllRanges();
    setSel(null);
  };
  const simulate = () => {
    const active = constraints.filter(c => c.checked).map(c => c.label).join(", ");
    setMessages(p => [...p, { id: nextId("msg"), user: "AI", content: `[Simulated — active constraints: ${active || "none"}]\n\nThis placeholder replaces a real AI response. Connect your model backend to populate real content. Active constraints are injected into the system prompt.` }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };
  return (
    <div style={panel({ position: "relative" })}>
      <div style={lbl}>Dialogue Board</div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map(m => (
          <div key={m.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 6, border: `1px solid ${C.panelBorder}`, padding: "10px 12px", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: C.accent, marginBottom: 6 }}>{m.user}</div>
            <div onMouseUp={() => onUp(m.id)} style={{ fontSize: 12, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap", userSelect: "text", cursor: "text" }}>{m.content}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {sel && (
        <div style={{ position: "absolute", bottom: 52, left: "50%", transform: "translateX(-50%)", background: C.panel, border: `1px solid ${C.accent}`, borderRadius: 6, padding: "8px 12px", display: "flex", gap: 8, alignItems: "center", zIndex: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.6)" }}>
          <span style={{ fontSize: 11, color: C.textMuted, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{sel.text}"</span>
          <button style={btn("success")} onClick={annotate}>Annotate</button>
          <button style={btn("danger")} onClick={() => { window.getSelection()?.removeAllRanges(); setSel(null); }}>✕</button>
        </div>
      )}
      <button onClick={simulate} style={{ ...btn(), marginTop: 8, flexShrink: 0 }}>+ Simulate AI Response</button>
    </div>
  );
}

function Annotations({ annotations, setAnnotations }) {
  const [noteText, setNoteText] = useState("");
  const saveNote = () => {
    if (!noteText.trim()) return;
    setAnnotations(p => [...p, { id: nextId("note"), source: null, note: noteText, type: "note" }]);
    setNoteText("");
  };
  const del = id => setAnnotations(p => p.filter(a => a.id !== id));
  const upd = (id, v) => setAnnotations(p => p.map(a => a.id === id ? { ...a, note: v } : a));
  return (
    <div style={panel()}>
      <div style={lbl}>Annotations</div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {annotations.length === 0 && <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace", textAlign: "center", marginTop: 20 }}>Highlight text in dialogue to annotate</div>}
        {annotations.map(a => (
          <div key={a.id} style={{ background: a.type === "highlight" ? "rgba(79,142,247,0.08)" : "rgba(61,186,126,0.08)", border: `1px solid ${a.type === "highlight" ? C.accentMuted : "rgba(61,186,126,0.3)"}`, borderRadius: 6, padding: "8px 10px", flexShrink: 0 }}>
            {a.source && <div style={{ fontSize: 11, color: C.accent, fontFamily: "monospace", borderLeft: `2px solid ${C.accent}`, paddingLeft: 6, marginBottom: 6, fontStyle: "italic", lineHeight: 1.5 }}>"{a.source.slice(0, 80)}{a.source.length > 80 ? "…" : ""}"</div>}
            <textarea value={a.note} onChange={e => upd(a.id, e.target.value)} placeholder="Add note…" rows={2} style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${C.panelBorder}`, color: C.text, fontSize: 11, fontFamily: "monospace", resize: "none", outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button style={{ ...btn(), fontSize: 10 }} onClick={() => alert(`[Prototype] Move to tree node: "${(a.source || a.note || "").slice(0, 40)}"`)}>→ Tree</button>
              <button style={{ ...btn("danger"), fontSize: 10 }} onClick={() => del(a.id)}>Del</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, borderTop: `1px solid ${C.panelBorder}`, paddingTop: 8, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace", marginBottom: 4 }}>Independent note</div>
        <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Take a note…" rows={2} style={{ ...inp(), width: "100%", resize: "none", boxSizing: "border-box" }} />
        <button style={{ ...btn("success"), marginTop: 6, width: "100%" }} onClick={saveNote}>✓ Save Note</button>
      </div>
    </div>
  );
}

const QUICK = [
  { label: "Research Ideation", text: "Generate novel research directions based on my constraints." },
  { label: "Verify Ideas", text: "Critically evaluate the ideas discussed so far." },
  { label: "Refine Ideas", text: "Take the most promising ideas and suggest next steps." },
];

function GetStarted({ onSend }) {
  const [prompt, setPrompt] = useState("");
  const send = (text) => { const t = text || prompt.trim(); if (!t) return; onSend(t); setPrompt(""); };
  return (
    <div style={panel()}>
      <div style={lbl}>Prompt</div>
      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace", marginBottom: 8 }}>Get started…</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, flexShrink: 0 }}>
        {QUICK.map(q => <button key={q.label} style={{ ...btn(), fontSize: 10 }} onClick={() => send(q.text)}>{q.label}</button>)}
      </div>
      <div style={{ display: "flex", gap: 6, flex: 1, minHeight: 0 }}>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Enter prompt… (Enter to send)"
          style={{ ...inp(), flex: 1, resize: "none", lineHeight: 1.6 }} />
        <button onClick={() => send()} style={{ ...btn("success"), width: 36, height: 36, alignSelf: "flex-end", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>▶</button>
      </div>
    </div>
  );
}

const INIT_NODES = [
  { id: "idea", label: "Idea",       x: 100, y: 170 },
  { id: "p1",   label: "Path 1",    x: 260, y:  90 },
  { id: "p2",   label: "Path 2",    x: 260, y: 250 },
  { id: "t1a",  label: "Theory 1a", x: 420, y:  70 },
  { id: "p3",   label: "Path 3",    x: 420, y: 200 },
  { id: "p4",   label: "Path 4",    x: 420, y: 320 },
  { id: "end",  label: "End",       x: 570, y: 170 },
];
const INIT_EDGES = [
  ["idea","p1"],["idea","p2"],["p1","t1a"],["p1","p3"],
  ["p2","p3"],["p2","p4"],["t1a","end"],["p3","end"],["p4","end"],
];

// Ellipse radii for each node (uniform here, but could vary per node)
const RX = 36, RY = 22;

// Given two node centres, compute the point where the line exits the source
// ellipse and enters the target ellipse, so arrows land on the boundary.
function ellipseEdgePoints(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len, uy = dy / len;

  // Parametric intersection of line with ellipse: solve (ux*t/RX)^2 + (uy*t/RY)^2 = 1
  const denom = Math.sqrt((ux / RX) ** 2 + (uy / RY) ** 2) || 1;
  const tSrc = 1 / denom;
  const tTgt = 1 / denom;

  return {
    x1: x1 + ux * tSrc,
    y1: y1 + uy * tSrc,
    x2: x2 - ux * tTgt,
    y2: y2 - uy * tTgt,
  };
}

function ContextTree() {
  const [nodes, setNodes] = useState(INIT_NODES);
  const [edges, setEdges] = useState(INIT_EDGES);
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 20, y: 10 });
  const [menu, setMenu] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); // SVG-space cursor for rubber-band
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const panRef = useRef(null);

  const deleteNode = id => { setNodes(p => p.filter(n => n.id !== id)); setEdges(p => p.filter(([a, b]) => a !== id && b !== id)); setMenu(null); setSelected(null); };
  const deleteEdge = (a, b) => setEdges(p => p.filter(([ea, eb]) => !(ea === a && eb === b)));

  const splitNode = id => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const nid = nextId("split");
    setNodes(p => [...p, { id: nid, label: `${node.label}′`, x: node.x + 40, y: node.y + 90 }]);
    setEdges(p => [...p, [id, nid]]);
    setMenu(null);
  };

  const addNode = () => {
    const base = selected ? nodes.find(n => n.id === selected) : null;
    const nid = nextId("node");
    setNodes(p => [...p, { id: nid, label: "New", x: (base?.x || 300) + 100, y: (base?.y || 170) + 40 }]);
    if (selected) setEdges(p => [...p, [selected, nid]]);
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
    setSelected(id === selected ? null : id);
  };

  const onCtx = (e, id) => { e.preventDefault(); e.stopPropagation(); setMenu({ id, x: e.clientX, y: e.clientY }); };
  const onNodeDown = (e, id) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragRef.current = { id, mx: e.clientX, my: e.clientY };
    setDragging(id);
  };
  const onBgDown = (e) => {
    if (e.button !== 0) return;
    if (!connecting) panRef.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const onMove = useCallback((e) => {
    const svgPos = svgCoordsFromClient(e.clientX, e.clientY);
    setMousePos(svgPos);
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

  const onWheel = useCallback(e => {
    e.preventDefault();
    setZoom(z => Math.min(3, Math.max(0.25, z - e.deltaY * 0.001)));
  }, []);

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
        <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.12em", color: C.textMuted, textTransform: "uppercase" }}>Context Tree · Directed Graph</span>
        <button style={{ ...btn("success"), fontSize: 10, marginLeft: "auto" }} onClick={addNode}>＋ Node</button>
        {connecting && <button style={{ ...btn("danger"), fontSize: 10 }} onClick={() => setConnecting(null)}>✕ Cancel</button>}
        <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>scroll=zoom · drag=move · right-click=menu</span>
      </div>

      {connecting && (
        <div style={{ fontSize: 11, color: C.warning, fontFamily: "monospace", marginBottom: 4, flexShrink: 0, padding: "4px 8px", background: "rgba(224,160,32,0.08)", borderRadius: 4, border: `1px solid rgba(224,160,32,0.3)` }}>
          ↗ Drawing edge from <strong style={{ color: "#fff" }}>{connectingNode?.label}</strong> — click any node to set as child
        </div>
      )}

      <svg
        ref={svgRef}
        width="100%"
        style={{ flex: 1, minHeight: 0, cursor: dragging ? "grabbing" : connecting ? "crosshair" : "grab" }}
        onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        onMouseDown={onBgDown}
        onClick={() => { setMenu(null); if (!connecting) setSelected(null); }}
      >
        <defs>
          {/* Main arrow — solid, clearly visible */}
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L10,3.5 z" fill={C.accent} />
          </marker>
          {/* Rubber-band arrow — dashed preview colour */}
          <marker id="arrowhead-preview" markerWidth="10" markerHeight="10" refX="9" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L10,3.5 z" fill={C.warning} />
          </marker>
        </defs>

        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>

          {/* ── Edges ── */}
          {edges.map(([a, b], i) => {
            const na = nodes.find(n => n.id === a), nb = nodes.find(n => n.id === b);
            if (!na || !nb) return null;
            const pts = ellipseEdgePoints(na.x, na.y, nb.x, nb.y);
            const isHighlighted = selected === a || selected === b;
            return (
              <g key={`${a}-${b}-${i}`}>
                {/* Invisible wide hit area for clicking edge */}
                <line x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
                  stroke="transparent" strokeWidth={12}
                  style={{ cursor: "pointer" }}
                  onClick={e => { e.stopPropagation(); if (window.confirm(`Delete edge ${a} → ${b}?`)) deleteEdge(a, b); }}
                />
                <line
                  x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
                  stroke={isHighlighted ? C.accent : "#3a4a6e"}
                  strokeWidth={isHighlighted ? 2 : 1.5}
                  markerEnd="url(#arrowhead)"
                  opacity={isHighlighted ? 1 : 0.75}
                  pointerEvents="none"
                />
              </g>
            );
          })}

          {/* ── Rubber-band preview while connecting ── */}
          {connectingNode && (
            <line
              x1={connectingNode.x} y1={connectingNode.y}
              x2={mousePos.x} y2={mousePos.y}
              stroke={C.warning} strokeWidth={1.5} strokeDasharray="6 4"
              markerEnd="url(#arrowhead-preview)"
              pointerEvents="none" opacity={0.85}
            />
          )}

          {/* ── Nodes ── */}
          {nodes.map(node => {
            const isHov = hovered === node.id;
            const isSel = selected === node.id;
            const isSource = connecting === node.id;
            const strokeCol = isSource ? C.warning : isSel ? C.accent : isHov ? C.accent : "#2a3a5e";
            const fillCol   = isSource ? "rgba(224,160,32,0.18)" : isSel ? C.accentMuted : isHov ? "#1a2840" : "#0e1520";
            return (
              <g key={node.id} transform={`translate(${node.x},${node.y})`}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                onMouseDown={e => onNodeDown(e, node.id)}
                onClick={e => onNodeClick(e, node.id)}
                onContextMenu={e => onCtx(e, node.id)}
                style={{ cursor: connecting ? "pointer" : "grab" }}
              >
                {/* Outer glow ring when selected or source */}
                {(isSel || isSource) && (
                  <ellipse rx={RX + 5} ry={RY + 5} fill="none"
                    stroke={isSource ? C.warning : C.accent} strokeWidth={1} opacity={0.3} />
                )}
                <ellipse rx={RX} ry={RY} fill={fillCol} stroke={strokeCol} strokeWidth={isSource || isSel ? 2 : 1} />
                <text textAnchor="middle" dominantBaseline="middle"
                  fontSize={10} fill={isSource ? C.warning : isSel ? "#fff" : C.text}
                  fontFamily="monospace" pointerEvents="none" style={{ userSelect: "none" }}>
                  {node.label}
                </text>

                {/* Hover action badges */}
                {isHov && !dragging && !connecting && (
                  <g>
                    {/* Delete */}
                    <circle cx={RX - 2} cy={-(RY + 8)} r={10} fill={C.danger} opacity={0.92}
                      onClick={e => { e.stopPropagation(); deleteNode(node.id); }} style={{ cursor: "pointer" }} />
                    <text x={RX - 2} y={-(RY + 8)} textAnchor="middle" dominantBaseline="middle"
                      fontSize={12} fill="#fff" pointerEvents="none">✕</text>
                    {/* Connect (start drawing edge) */}
                    <circle cx={RX + 16} cy={0} r={10} fill={C.accent} opacity={0.92}
                      onClick={e => { e.stopPropagation(); setConnecting(node.id); setMenu(null); }}
                      style={{ cursor: "pointer" }} />
                    <text x={RX + 16} y={0} textAnchor="middle" dominantBaseline="middle"
                      fontSize={13} fill="#fff" pointerEvents="none">→</text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Context menu */}
      {menu && (
        <div
          style={{ position: "fixed", left: menu.x, top: menu.y, zIndex: 9999, background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 6, padding: 4, display: "flex", flexDirection: "column", gap: 2, minWidth: 160, boxShadow: "0 4px 24px rgba(0,0,0,0.8)" }}
          onClick={e => e.stopPropagation()}
        >
          {[
            { label: "→ Draw edge from here", action: () => { setConnecting(menu.id); setMenu(null); } },
            { label: "⊕ Split node", action: () => splitNode(menu.id) },
            { label: "✕ Delete node", action: () => deleteNode(menu.id), v: "danger" },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              style={{ ...btn(item.v), border: "none", textAlign: "left", borderRadius: 4 }}>
              {item.label}
            </button>
          ))}
          <div style={{ borderTop: `1px solid ${C.panelBorder}`, marginTop: 2, paddingTop: 4 }}>
            <input
              defaultValue={nodes.find(n => n.id === menu.id)?.label || ""}
              onBlur={e => renameNode(menu.id, e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { renameNode(menu.id, e.target.value); setMenu(null); } }}
              style={{ ...inp(), width: "100%", boxSizing: "border-box", borderColor: C.accent }}
              placeholder="Rename node…" autoFocus
            />
          </div>
        </div>
      )}
    </div>
  );
}

const MOCK_SUGG = [
  { id: 1, title: "AI Suggestion A", bullets: ["Deploy federated learning with gradient compression for privacy-preserving model updates.", "Use SecAgg protocol for secure aggregation across distributed research nodes."] },
  { id: 2, title: "AI Suggestion B", bullets: ["Implement k-anonymity at the data collection layer before any model training occurs.", "Augment small datasets with differential privacy noise calibrated to ε = 0.1."] },
];

function ComparisonDesk() {
  const [suggestions, setSuggestions] = useState(MOCK_SUGG);
  const [status, setStatus] = useState({});
  const del = id => setSuggestions(p => p.filter(s => s.id !== id));
  const copy = id => {
    const s = suggestions.find(x => x.id === id);
    if (s) navigator.clipboard.writeText(s.bullets.join("\n")).catch(() => {});
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
            {s.bullets.map((b, i) => <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}><span style={{ color: C.accent, fontSize: 10, marginTop: 2, flexShrink: 0 }}>◆</span><span style={{ fontSize: 11, color: C.text, lineHeight: 1.6 }}>{b}</span></div>)}
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

export default function ResearchWorkbench() {
  const [constraints, setConstraints] = useState([
    { id: 1, label: "Accessibility Focus", checked: true },
    { id: 2, label: "Data Privacy Focus", checked: true },
    { id: 3, label: "Budget", checked: false },
  ]);
  const [annotations, setAnnotations] = useState([]);

  return (
    <div style={{ background: C.bg, padding: "12px", fontFamily: "monospace", color: C.text, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.panelBorder}` }}>
        <span style={{ fontSize: 13, fontFamily: "monospace", letterSpacing: "0.15em", color: C.accent, fontWeight: 700 }}>◈ RESEARCH WORKBENCH</span>
        <span style={{ fontSize: 10, color: C.textDim }}>prototype · v0.1</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {[["U1", C.accent, C.accentMuted], ["U2", C.success, "rgba(61,186,126,0.2)"], ["U3", C.warning, "rgba(224,160,32,0.2)"]].map(([u, col, bg]) => (
            <div key={u} style={{ width: 26, height: 26, borderRadius: "50%", background: bg, border: `1px solid ${col}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: col }}>{u}</div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 200px", gap: 8, marginBottom: 8 }}>
        <ContextLock constraints={constraints} setConstraints={setConstraints} />
        <DialogueBoard onAnnotate={a => setAnnotations(p => [...p, a])} constraints={constraints} />
        <Annotations annotations={annotations} setAnnotations={setAnnotations} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 200px", gap: 8 }}>
        <GetStarted onSend={t => console.log("Prompt:", t)} />
        <ContextTree />
        <ComparisonDesk />
      </div>
    </div>
  );
}
