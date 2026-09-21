import { useState } from "react";
import { MessageSquare, X, Send, CheckCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  // Simple keyword-based classification
  const classifyMessage = (text) => {
    const t = text.toLowerCase();
    if (/crash|error|bug|broken|fail/.test(t)) return { label: "🐛 Bug / Error", tag: "BUG" };
    if (/slow|lag|hang/.test(t)) return { label: "⚡ Performance", tag: "PERF" };
    if (/import|export|excel|xer|pdf/.test(t)) return { label: "📂 Import / Export", tag: "IO" };
    if (/suggest|improve|feature|wish|request/.test(t)) return { label: "💡 Suggestion", tag: "SUGGEST" };
    return { label: "💬 General Feedback", tag: "GENERAL" };
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    const { label, tag } = classifyMessage(message);
    const now = new Date().toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" });
    try {
      await base44.integrations.Core.SendEmail({
        to: "cwclaimsteam@gmail.com",
        subject: `[Gantt App Feedback] [${tag}] ${label}`,
        body: `Category: ${label}\nTime: ${now}\n\nUser Feedback:\n\n${message}`,
        from_name: "Gantt App Feedback",
      });
      setSent(true);
      setMessage("");
      setTimeout(() => { setSent(false); setOpen(false); }, 2500);
    } catch (e) {
      alert("Failed to send. Please try again later.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}>
      {open && (
        <div className="mb-3 bg-surface rounded-xl shadow-2xl border border-border flex flex-col" style={{ width: 320 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary-dark rounded-t-xl">
            <span className="text-sm font-semibold text-surface flex items-center gap-2">
              <MessageSquare size={15} /> Feedback / Report Issue
            </span>
            <button onClick={() => setOpen(false)} className="text-surface/70 hover:text-surface">
              <X size={15} />
            </button>
          </div>

          {sent ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-success">
              <CheckCircle size={32} />
              <span className="text-sm font-medium">Thank you for your feedback!</span>
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-3">
              <p className="text-xs text-text-muted">Encountered an issue, have a suggestion, or want to share your experience? Leave a message below:</p>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Describe your issue or suggestion…"
                className="w-full border border-border rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-focus"
                rows={5}
                autoFocus
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || sending}
                className="flex items-center justify-center gap-2 bg-primary-dark hover:bg-primary-dark disabled:opacity-40 text-surface text-sm font-medium py-2 rounded-lg transition-all"
              >
                <Send size={13} />
                {sending ? "Sending…" : "Submit Feedback"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-12 h-12 rounded-full bg-primary-dark hover:bg-primary-dark text-surface shadow-lg flex items-center justify-center transition-all"
        title="Feedback / Report Issue"
      >
        {open ? <X size={18} /> : <MessageSquare size={18} />}
      </button>
    </div>
  );
}