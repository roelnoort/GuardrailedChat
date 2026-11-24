"use client";

import { useEffect, useRef, useState } from "react";
import {
  EXAMPLE_PROMPTS,
  GUARDRAILS,
  SECRET,
  type ChatRequest,
  type ChatResponse,
  type ChatTurn,
  type EnabledGuardrails,
  type GuardrailId,
  type Outcome,
  type Verdicts,
} from "@/lib/domain";

type BadgeState = { status: "pass" | "block" | "error" | "off" | "checking"; reason: string };

type Entry =
  | { kind: "user"; text: string; badges: Record<GuardrailId, BadgeState>; outcome: Outcome | "pending" }
  | { kind: "chatbot"; text: string }
  | { kind: "refusal"; by: GuardrailId; reason: string }
  | { kind: "guardrail-error"; by: GuardrailId; reason: string }
  | { kind: "request-error"; reason: string };

const BADGE_ICON: Record<BadgeState["status"], string> = {
  pass: "✅",
  block: "❌",
  error: "⚠",
  off: "off",
  checking: "…",
};

const guardrail = (id: GuardrailId) => GUARDRAILS.find((g) => g.id === id)!;

export default function Home() {
  const [enabled, setEnabled] = useState<EnabledGuardrails>({ injection: true, harmful: true });
  const [entries, setEntries] = useState<Entry[]>([]);
  // What the Chatbot remembers: passed messages and its replies only.
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: mainRef.current.scrollHeight });
  }, [entries]);

  useEffect(() => {
    if (!pending) inputRef.current?.focus();
  }, [pending]);

  async function send(text: string) {
    text = text.trim();
    if (!text || pending) return;
    const snapshot = { ...enabled }; // badges reflect the toggles at send time
    const checking = Object.fromEntries(
      GUARDRAILS.map((g) => [
        g.id,
        snapshot[g.id] ? { status: "checking", reason: "" } : { status: "off", reason: "Guardrail disabled" },
      ]),
    ) as Record<GuardrailId, BadgeState>;

    setInput("");
    setPending(true);
    setEntries((prev) => [...prev, { kind: "user", text, badges: checking, outcome: "pending" }]);

    const replaceLast = (...next: Entry[]) => setEntries((prev) => [...prev.slice(0, -1), ...next]);

    try {
      const body: ChatRequest = { message: text, history, enabled: snapshot };
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as ChatResponse;
      const userEntry: Entry = { kind: "user", text, badges: data.verdicts as Verdicts, outcome: data.outcome };
      const { outcome } = data;

      if (outcome.kind === "blocked") {
        replaceLast(userEntry, { kind: "refusal", by: outcome.by, reason: data.verdicts[outcome.by].reason });
      } else if (outcome.kind === "guardrail-error") {
        replaceLast(userEntry, { kind: "guardrail-error", by: outcome.by, reason: data.verdicts[outcome.by].reason });
      } else if (data.reply !== undefined) {
        replaceLast(userEntry, { kind: "chatbot", text: data.reply });
        setHistory((h) => [...h, { role: "user", content: text }, { role: "assistant", content: data.reply! }]);
      } else {
        replaceLast(userEntry, { kind: "request-error", reason: `Chatbot failed: ${data.chatbotError}` });
      }
    } catch (err) {
      replaceLast(
        { kind: "user", text, badges: checking, outcome: { kind: "guardrail-error", by: GUARDRAILS[0].id } },
        { kind: "request-error", reason: err instanceof Error ? err.message : String(err) },
      );
    } finally {
      setPending(false);
    }
  }

  function newChat() {
    setEntries([]);
    setHistory([]);
    setInput("");
  }

  const disabledGuardrails = GUARDRAILS.filter((g) => !enabled[g.id]);

  return (
    <>
      <header>
        <h1>
          🏋 Barbell &amp; Box Supply <small>— Chatbot with Guardrails</small>
        </h1>
        {GUARDRAILS.map((g) => (
          <label className="toggle" key={g.id}>
            <input
              type="checkbox"
              checked={enabled[g.id]}
              onChange={(e) => setEnabled((prev) => ({ ...prev, [g.id]: e.target.checked }))}
            />
            <span className="switch" />
            {g.name}
          </label>
        ))}
        <button onClick={newChat} disabled={pending}>
          New chat
        </button>
      </header>

      <main ref={mainRef}>
        <div className="transcript">
          {entries.length === 0 && (
            <div className="empty">Ask about our gear, or click one of the example prompts below.</div>
          )}
          {entries.map((e, i) => (
            <EntryView key={i} entry={e} />
          ))}
        </div>
      </main>

      <footer>
        <div className="footer-inner">
          {disabledGuardrails.length > 0 && (
            <div className="off-banner">
              ⚠ {disabledGuardrails.map((g) => g.name).join(" and ")} off — messages are not checked for that
            </div>
          )}
          <div className="examples">
            <span className="label">Try:</span>
            {EXAMPLE_PROMPTS.map((p) => (
              <button key={p.text} className={`ex ${p.kind}`} title={p.kind} disabled={pending} onClick={() => send(p.text)}>
                {p.text}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={pending ? "Checking guardrails…" : "Ask about our gear…"}
              disabled={pending}
              autoComplete="off"
            />
            <button type="submit" disabled={pending || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      </footer>
    </>
  );
}

function EntryView({ entry: e }: { entry: Entry }) {
  switch (e.kind) {
    case "user": {
      const cls =
        e.outcome === "pending"
          ? "pending"
          : e.outcome.kind === "blocked"
            ? "blocked"
            : e.outcome.kind === "guardrail-error"
              ? "error"
              : "";
      return (
        <div className={`row user ${cls}`}>
          <div className="bubble">{e.text}</div>
          <div className="badges">
            {GUARDRAILS.map((g) => {
              const b = e.badges[g.id];
              return (
                <span key={g.id} className={`badge ${b.status}`} title={`${g.name}: ${b.reason}`}>
                  {g.short} {BADGE_ICON[b.status]}
                </span>
              );
            })}
          </div>
          {e.outcome === "pending" && <div className="checking-line">checking guardrails…</div>}
          {cls === "blocked" && <div className="debug">Blocked message — never sent to the Chatbot</div>}
        </div>
      );
    }
    case "chatbot":
      return (
        <div className="row other chatbot">
          <div className="who">💬 Chatbot</div>
          <div className="bubble">
            <HighlightSecret text={e.text} />
          </div>
        </div>
      );
    case "refusal": {
      const g = guardrail(e.by);
      return (
        <div className="row other refusal">
          <div className="who">🛡 Refusal — {g.name}</div>
          <div className="bubble">{g.refusal}</div>
          <div className="debug">
            debug · {g.short} Verdict: block — {e.reason}
          </div>
        </div>
      );
    }
    case "guardrail-error": {
      const g = guardrail(e.by);
      return (
        <div className="row other guardrail-error">
          <div className="who">Guardrail error — {g.name}</div>
          <div className="bubble">⚠ Guardrail unavailable — message not sent</div>
          <div className="debug">debug · {e.reason} (fail closed)</div>
        </div>
      );
    }
    case "request-error":
      return (
        <div className="row other guardrail-error">
          <div className="who">Error</div>
          <div className="bubble">⚠ Something went wrong</div>
          <div className="debug">debug · {e.reason}</div>
        </div>
      );
  }
}

/** Makes a leaked Secret impossible to miss. */
function HighlightSecret({ text }: { text: string }) {
  const parts = text.split(SECRET);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <span className="leak">{SECRET}</span>}
        </span>
      ))}
    </>
  );
}
