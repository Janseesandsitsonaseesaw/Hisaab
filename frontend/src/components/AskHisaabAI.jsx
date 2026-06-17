import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, Bot, RotateCcw, BellRing, X } from "lucide-react";
import { api } from "../services/api";

const SUGGESTED_PROMPTS = [
  "Which products need restocking?",
  "What are my top-selling products?",
  "Show customers with highest udhaar.",
  "Summarize today's sales.",
];

export default function AskHisaabAI({ dashboard }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stockNotifs, setStockNotifs] = useState([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Generate AI stock notifications on mount
  useEffect(() => {
    fetchStockNotifications();
  }, []);

  async function fetchStockNotifications() {
    setNotifsLoading(true);
    try {
      const data = await api("/ai/ask", {
        method: "POST",
        body: JSON.stringify({
          question:
            "Based on current stock levels and sales velocity, give me 3-5 short, specific stock alerts like 'Milk will run out in ~2 days', 'Bread is critically low (3 left)', etc. Format as a plain list, one alert per line, no bullet symbols, no preamble.",
        }),
      });
      const lines = (data.answer || "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 5 && l.length < 150);
      setStockNotifs(lines);
    } catch {
      setStockNotifs(["Could not load stock notifications."]);
    } finally {
      setNotifsLoading(false);
    }
  }

  async function sendMessage(text) {
    const question = text.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const data = await api("/ai/ask", {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function resetChat() {
    setMessages([]);
    setInput("");
    setError("");
  }


  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            width: "56px",
            height: "56px",
            borderRadius: "28px",
            background: "var(--brand-primary)",
            color: "white",
            border: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 9999,
            transition: "transform 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
        >
          <Sparkles size={24} />
          {stockNotifs.length > 0 && (
            <span style={{
              position: "absolute", top: "0px", right: "0px", width: "14px", height: "14px",
              borderRadius: "50%", background: "var(--danger)", border: "2px solid white"
            }} />
          )}
        </button>
      )}

      {/* Floating Chat Widget */}
      {isOpen && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          width: "360px",
          maxWidth: "calc(100vw - 48px)",
          zIndex: 9999,
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          borderRadius: "16px",
          overflow: "hidden"
        }}>
          <div className="card ai-advisor-card" style={{ margin: 0, border: "none", height: "500px", maxHeight: "calc(100vh - 100px)" }}>

      <div className="card-header">
        <h3
          className="card-title"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <span className="ai-advisor-icon">
            <Sparkles size={15} />
          </span>
          Ask Hisaab AI
        </h3>
        <div style={{ display: "flex", gap: "6px" }}>
          {/* Stock Notifications toggle */}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Stock Notifications"
            onClick={() => setShowNotifs((v) => !v)}
            style={{ position: "relative" }}
          >
            <BellRing size={15} />
            {stockNotifs.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "2px",
                  right: "2px",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "var(--danger, #ef4444)",
                  display: "block",
                }}
              />
            )}
          </button>
          {/* Reset chat — always visible */}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Reset chat"
            onClick={resetChat}
            style={{ opacity: messages.length === 0 ? 0.35 : 1, transition: "opacity 0.2s" }}
          >
            <RotateCcw size={15} />
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Close"
            onClick={() => setIsOpen(false)}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Stock Notifications Panel */}
      {showNotifs && (
        <div
          style={{
            background: "var(--warning-soft, #fef3c7)",
            borderBottom: "1px solid var(--border-color, #e2e8f0)",
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: "0.8125rem",
                color: "var(--warning-dark, #92400e)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <BellRing size={13} /> AI Stock Alerts
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={fetchStockNotifications}
              disabled={notifsLoading}
              style={{ fontSize: "11px", padding: "2px 6px" }}
            >
              <RotateCcw size={12} className={notifsLoading ? "spin" : ""} />{" "}
              Refresh
            </button>
          </div>
          {notifsLoading ? (
            <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              <Loader2 size={12} className="spin" /> Analysing stock…
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {stockNotifs.map((n, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text, #1e293b)",
                    padding: "3px 0",
                    borderBottom:
                      i < stockNotifs.length - 1
                        ? "1px solid rgba(0,0,0,0.06)"
                        : "none",
                  }}
                >
                  ⚠️ {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card-body ai-advisor-body">
        <div className="ai-advisor-messages" ref={scrollRef} style={{ maxHeight: "150px", minHeight: "80px" }}>
          {messages.length === 0 ? (
            <div className="ai-advisor-suggestions">
              <p className="ai-advisor-hint">Try asking:</p>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className="ai-suggestion-chip"
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={`ai-chat-bubble ${m.role === "user" ? "ai-chat-user" : "ai-chat-assistant"}`}
              >
                {m.role === "assistant" && (
                  <Bot size={14} className="ai-chat-bot-icon" />
                )}
                <span>{m.content}</span>
              </div>
            ))
          )}

          {loading && (
            <div className="ai-chat-bubble ai-chat-assistant ai-chat-loading">
              <Loader2 size={14} className="spin" />
              <span>Thinking…</span>
            </div>
          )}

          {error && <div className="ai-chat-error">{error}</div>}
        </div>

        <form
          className="ai-advisor-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
        >
          <input
            type="text"
            className="form-input ai-advisor-input"
            placeholder="Ask about your store…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="btn btn-primary ai-advisor-send"
            disabled={loading || !input.trim()}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
        </div>
      )}
    </>
  );
}