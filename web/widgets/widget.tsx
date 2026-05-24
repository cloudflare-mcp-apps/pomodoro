import { StrictMode, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts,
} from "@modelcontextprotocol/ext-apps";
import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";

import type {
  TodayStatus, ActiveSession, TaskItem, DistractionType,
  StartPomodoroResult, CompletePomodoroResult,
  PersistedWidgetState,
} from "../lib/types";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import "../styles/globals.css";

const SERVER_NAME = "Pomodoro Focus";
const SERVER_ID = "pomodoro";

const log = {
  info: console.log.bind(console, "[Pomodoro]"),
  warn: console.warn.bind(console, "[Pomodoro]"),
  error: console.error.bind(console, "[Pomodoro]"),
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function remainingSeconds(endsAtIso: string | null | undefined, now: number): number {
  if (!endsAtIso) return 0;
  const ends = new Date(endsAtIso).getTime();
  return Math.max(0, Math.ceil((ends - now) / 1000));
}

function fmtMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function progressDots(planned: number, completed: number): string {
  const filled = Math.min(planned, completed);
  return "●".repeat(filled) + "○".repeat(Math.max(0, planned - completed));
}

// Persisted widget state via window.openai.setWidgetState (survives remount).
function readPersistedState(): PersistedWidgetState | null {
  try {
    const w = window as unknown as { openai?: { widgetState?: PersistedWidgetState } };
    return w.openai?.widgetState ?? null;
  } catch {
    return null;
  }
}

function writePersistedState(state: PersistedWidgetState): void {
  try {
    const w = window as unknown as { openai?: { setWidgetState?: (s: PersistedWidgetState) => void } };
    w.openai?.setWidgetState?.(state);
  } catch (e) {
    log.warn("setWidgetState unavailable:", e);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Distraction modal
// ────────────────────────────────────────────────────────────────────────────

interface DistractionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (type: DistractionType, description: string) => Promise<void>;
}

function DistractionModal({ open, onClose, onSubmit }: DistractionModalProps) {
  const [type, setType] = useState<DistractionType>("internal");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(type, description.trim());
      setDescription("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 space-y-3">
          <div className="text-sm font-medium">Zapisz rozproszenie (nie przerywaj pracy)</div>
          <div className="flex gap-2">
            <Button
              variant={type === "internal" ? "default" : "outline"}
              size="sm"
              className="h-11 flex-1"
              onClick={() => setType("internal")}
            >
              Wewnętrzne
            </Button>
            <Button
              variant={type === "external" ? "default" : "outline"}
              size="sm"
              className="h-11 flex-1"
              onClick={() => setType("external")}
            >
              Zewnętrzne
            </Button>
          </div>
          <input
            type="text"
            maxLength={200}
            placeholder="Zapisz myśl (max 200 znaków)…"
            aria-label="Opis rozproszenia"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-11 px-3 rounded border bg-background text-foreground"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="h-11" onClick={onClose}>Anuluj</Button>
            <Button size="sm" className="h-11" disabled={submitting || !description.trim()} onClick={handleSubmit}>
              {submitting ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Timer ring (SVG countdown)
// ────────────────────────────────────────────────────────────────────────────

function TimerRing({ remaining, total }: { remaining: number; total: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? remaining / total : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative flex items-center justify-center">
      <svg width="170" height="170" viewBox="0 0 170 170" className="-rotate-90">
        <circle
          cx="85" cy="85" r={radius}
          stroke="currentColor"
          className="text-muted-foreground/20"
          strokeWidth="6" fill="none"
        />
        <circle
          cx="85" cy="85" r={radius}
          stroke="currentColor"
          className="text-foreground transition-[stroke-dashoffset] duration-500"
          strokeWidth="6" fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-3xl font-semibold tabular-nums">{fmtMMSS(remaining)}</div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Active session view
// ────────────────────────────────────────────────────────────────────────────

interface ActiveSessionViewProps {
  active: ActiveSession;
  totalSeconds: number;
  remainingSecs: number;
  onStop: () => void;
  onLogDistraction: () => void;
}

function ActiveSessionView({
  active, totalSeconds, remainingSecs, onStop, onLogDistraction,
}: ActiveSessionViewProps) {
  const label = active.session_type === "focus"
    ? `Skupienie: ${active.task}`
    : active.session_type === "short_break" ? "Krótka przerwa" : "Długa przerwa";

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <TimerRing remaining={remainingSecs} total={totalSeconds} />
      <div className="text-sm text-muted-foreground truncate max-w-full px-2" title={label}>
        {label}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="h-11 min-w-11" onClick={onLogDistraction}>
          Rozproszenie
        </Button>
        <Button size="sm" variant="destructive" className="h-11 min-w-11" onClick={onStop}>
          Stop
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Start form (no active session)
// ────────────────────────────────────────────────────────────────────────────

interface StartFormProps {
  onStart: (task: string, duration: 15 | 25 | 45 | 50) => Promise<void>;
  tasks: TaskItem[];
}

function StartForm({ onStart, tasks }: StartFormProps) {
  const [task, setTask] = useState("");
  const [duration, setDuration] = useState<15 | 25 | 45 | 50>(25);
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    if (!task.trim()) return;
    setStarting(true);
    try {
      await onStart(task.trim(), duration);
      setTask("");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 py-2">
      <input
        type="text"
        placeholder="Na czym chcesz się skupić?"
        value={task}
        onChange={(e) => setTask(e.target.value)}
        maxLength={200}
        className="w-full h-11 px-3 rounded border bg-background text-foreground"
        list="recent-tasks"
      />
      <datalist id="recent-tasks">
        {tasks.map((t) => <option key={t.id} value={t.label} />)}
      </datalist>
      <div className="flex gap-2">
        {([15, 25, 45, 50] as const).map((d) => (
          <Button
            key={d}
            variant={duration === d ? "default" : "outline"}
            size="sm"
            className="h-11 flex-1"
            onClick={() => setDuration(d)}
          >
            {d}m
          </Button>
        ))}
      </div>
      <Button
        size="sm"
        className="h-11"
        disabled={starting || !task.trim()}
        onClick={handleStart}
      >
        {starting ? "Uruchamianie…" : `Rozpocznij sesję ${duration} min`}
      </Button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Widget
// ────────────────────────────────────────────────────────────────────────────

function Widget() {
  const [app, setApp] = useState<App | null>(null);
  const [appError, setAppError] = useState<Error | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();

  const [status, setStatus] = useState<TodayStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [distractionOpen, setDistractionOpen] = useState(false);
  const [completing, setCompleting] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [docVisible, setDocVisible] = useState(true);

  // Persist active session info across remount.
  const persistedRef = useRef<PersistedWidgetState | null>(null);

  // ──── App initialization ────
  useEffect(() => {
    const appInstance = new App(
      { name: `${SERVER_ID}-mcp`, version: "1.0.0" },
      {},
      { autoResize: false },
    );

    appInstance.ontoolresult = (result) => {
      try {
        const data = (result.structuredContent ?? null) as Record<string, unknown> | null;
        if (!data) return;
        // If a tool returned a full TodayStatus shape (only get_today_status does), apply directly.
        if ("today_completed" in data && "tasks" in data && "active_session" in data) {
          setStatus(data as unknown as TodayStatus);
          return;
        }
        // Side-effect tools (complete_pomodoro, log_distraction, start_pomodoro
        // from chat) don't carry the full dashboard payload — but their result
        // is the signal that server state changed. Trigger a fresh
        // get_today_status so the widget catches up immediately instead of
        // waiting for the 30s poll.
        if ("session_id" in data || "today_completed" in data) {
          appInstance.callServerTool({ name: "get_today_status", arguments: {} })
            .then((r) => {
              const fresh = r.structuredContent as unknown as TodayStatus | undefined;
              if (fresh) setStatus(fresh);
            })
            .catch((e) => log.warn("Background refresh after side-effect failed:", e));
        }
      } catch (e) {
        log.error("Failed to parse tool result", e);
      }
    };

    appInstance.onerror = (err) => {
      // The host occasionally echoes a widget-initiated tool response twice:
      // the SDK consumes the first copy to resolve the callServerTool promise,
      // then surfaces the second copy here as "unknown message ID". The data
      // flow already completed — treat as non-fatal log, do NOT replace UI
      // with an error card.
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("unknown message ID")) {
        log.warn("Ignoring duplicate response echo:", message);
        return;
      }
      log.error("App error:", err);
      setAppError(err instanceof Error ? err : new Error(message));
    };

    appInstance.onhostcontextchanged = (ctx) => {
      setHostContext((prev) => ({ ...prev, ...ctx }));
      if (ctx.theme) applyDocumentTheme(ctx.theme);
      if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
      if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
    };

    appInstance.onteardown = async () => {
      if (status?.active_session) {
        writePersistedState({
          active_session_id: status.active_session.session_id,
          active_ends_at: status.active_session.ends_at,
          last_hydrated_at: new Date().toISOString(),
        });
      }
      return {};
    };

    appInstance.connect()
      .then(() => {
        setApp(appInstance);
        setHostContext(appInstance.getHostContext());
        appInstance.sendSizeChanged({ height: 500 });
        persistedRef.current = readPersistedState();
      })
      .catch((e) => {
        log.error("connect() failed:", e);
        setAppError(e instanceof Error ? e : new Error(String(e)));
      });

    return () => appInstance.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ──── Hydrate from server on connect ────
  const refreshStatus = useCallback(async () => {
    if (!app) return;
    try {
      const result = await app.callServerTool({ name: "get_today_status", arguments: {} });
      const data = result.structuredContent as unknown as TodayStatus | undefined;
      if (data) {
        setStatus(data);
        setStatusError(null);
      }
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : String(e));
    }
  }, [app]);

  useEffect(() => {
    if (!app) return;
    refreshStatus();
  }, [app, refreshStatus]);

  // ──── Visibility gating (IntersectionObserver + document.visibilityState) ────
  useEffect(() => {
    const target = rootRef.current;
    if (!target) return;
    const io = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.01 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVisChange = () => setDocVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, []);

  const active = status?.active_session ?? null;

  // ──── Local tick (1Hz) — gated on visibility + active session ────
  useEffect(() => {
    if (!active || !isVisible || !docVisible) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, isVisible, docVisible]);

  // ──── Periodic server resync every 30s (countdown drift safety) ────
  useEffect(() => {
    if (!app || !active || !isVisible || !docVisible) return;
    const id = window.setInterval(() => refreshStatus(), 30_000);
    return () => window.clearInterval(id);
  }, [app, active, isVisible, docVisible, refreshStatus]);

  // ──── Auto-complete when timer hits zero ────
  const remainingSecs = useMemo(
    () => (active ? remainingSeconds(active.ends_at, nowMs) : 0),
    [active, nowMs],
  );

  useEffect(() => {
    if (!app || !active || completing) return;
    if (remainingSecs > 0) return;
    setCompleting(true);
    (async () => {
      try {
        const result = await app.callServerTool({
          name: "complete_pomodoro",
          arguments: { session_id: active.session_id },
        });
        const _r = result.structuredContent as unknown as CompletePomodoroResult | undefined;
        void _r;
      } catch (e) {
        log.error("complete_pomodoro auto failed:", e);
      } finally {
        await refreshStatus();
        setCompleting(false);
      }
    })();
  }, [remainingSecs, app, active, completing, refreshStatus]);

  // ──── Actions ────
  const handleStart = useCallback(async (task: string, duration: 15 | 25 | 45 | 50) => {
    if (!app) return;
    try {
      const result = await app.callServerTool({
        name: "start_pomodoro",
        arguments: { task, duration_minutes: duration, session_type: "focus" },
      });
      const r = result.structuredContent as unknown as StartPomodoroResult | undefined;
      if (r) {
        writePersistedState({
          active_session_id: r.session_id,
          active_ends_at: r.ends_at,
          last_hydrated_at: new Date().toISOString(),
        });
      }
      await refreshStatus();
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : String(e));
    }
  }, [app, refreshStatus]);

  const handleStop = useCallback(async () => {
    if (!app || !active) return;
    try {
      await app.callServerTool({
        name: "complete_pomodoro",
        arguments: { session_id: active.session_id },
      });
    } catch (e) {
      log.error("stop failed:", e);
    } finally {
      await refreshStatus();
    }
  }, [app, active, refreshStatus]);

  const handleLogDistractionSubmit = useCallback(async (type: DistractionType, description: string) => {
    if (!app || !active) return;
    try {
      await app.callServerTool({
        name: "log_distraction",
        arguments: { session_id: active.session_id, type, description },
      });
      await refreshStatus();
    } catch (e) {
      log.error("log_distraction failed:", e);
    }
  }, [app, active, refreshStatus]);

  // ──── Render ────
  const safeAreaStyle = {
    paddingTop: hostContext?.safeAreaInsets?.top,
    paddingRight: hostContext?.safeAreaInsets?.right,
    paddingBottom: hostContext?.safeAreaInsets?.bottom,
    paddingLeft: hostContext?.safeAreaInsets?.left,
  };

  if (appError) {
    return (
      <div ref={rootRef} className="h-[500px] flex items-center justify-center p-4" style={safeAreaStyle}>
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-sm text-red-500">
            Błąd widgetu: {appError.message}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!app) {
    return (
      <div ref={rootRef} className="h-[500px] flex items-center justify-center p-4" style={safeAreaStyle}>
        <div className="text-sm text-muted-foreground">Łączenie…</div>
      </div>
    );
  }

  const showStreak = (status?.current_streak ?? 0) >= 3;
  const distractionsToday = status?.distractions_today ?? 0;

  return (
    <div ref={rootRef} className="relative h-[500px] flex flex-col p-3 gap-3" style={safeAreaStyle}>
      {/* Header */}
      <div className="flex items-center justify-between text-sm">
        <div className="font-medium">
          Dzisiaj: {status?.today_completed ?? 0}/{status?.today_target ?? 8} pomodoro
          {showStreak && <span className="ml-2">🔥 {status!.current_streak}</span>}
        </div>
        <div className="text-muted-foreground text-xs">
          {distractionsToday} {distractionsToday === 1 ? "rozproszenie" : "rozproszeń"} dzisiaj
        </div>
      </div>

      {/* Active timer OR start form */}
      <div className="flex justify-center">
        {active ? (
          <ActiveSessionView
            active={active}
            totalSeconds={active.duration_minutes * 60}
            remainingSecs={remainingSecs}
            onStop={handleStop}
            onLogDistraction={() => setDistractionOpen(true)}
          />
        ) : (
          <div className="w-full max-w-sm">
            <StartForm onStart={handleStart} tasks={status?.tasks ?? []} />
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1 px-1">
          {SERVER_NAME} · zadania
        </div>
        {status && status.tasks.length > 0 ? (
          <ul className="space-y-1">
            {status.tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded hover:bg-muted/50">
                <span className="truncate max-w-[60%]" title={t.label}>{t.label}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {progressDots(t.planned_pomodoros, t.completed_pomodoros)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-muted-foreground px-2">
            Brak zadań — rozpocznij sesję, by stworzyć pierwsze.
          </div>
        )}
      </div>

      {statusError && (
        <div className="text-xs text-red-500 px-2">{statusError}</div>
      )}

      <DistractionModal
        open={distractionOpen}
        onClose={() => setDistractionOpen(false)}
        onSubmit={handleLogDistractionSubmit}
      />
    </div>
  );
}

// Mount
const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Widget />
    </StrictMode>,
  );
}
