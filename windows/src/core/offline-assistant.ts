// Offline Assistant & Local Intelligence for Day
// Handles local system actions, calculations, notes, clipboard queries,
// and helpful offline assistant responses when no internet is available.

import { SystemAccess } from "../island/system-access";

interface OfflineResult {
  handled: boolean;
  reply: string;
}

const LOCAL_STORAGE_KEY_NOTES = "Day_offline_notes";

let inMemoryNotes: string[] = [];

function getLocalNotes(): string[] {
  try {
    if (typeof localStorage === "undefined") return inMemoryNotes;
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_NOTES);
    return raw ? JSON.parse(raw) : inMemoryNotes;
  } catch {
    return inMemoryNotes;
  }
}

function saveLocalNotes(notes: string[]): void {
  inMemoryNotes = notes;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY_NOTES, JSON.stringify(notes));
    }
  } catch {}
}

/** Safely evaluate basic math expressions (+, -, *, /, %, ^, sqrt, etc.) without eval() */
function safeEvalMath(expr: string): number | null {
  try {
    // Clean string, support common words like "plus", "minus", "times", "divided by"
    let sanitized = expr
      .toLowerCase()
      .replace(/plus/g, "+")
      .replace(/minus/g, "-")
      .replace(/times|\bx\b/g, "*")
      .replace(/divided\s*by/g, "/")
      .replace(/\^/g, "**")
      .replace(/sqrt\(([^)]+)\)/g, "Math.sqrt($1)")
      .replace(/abs\(([^)]+)\)/g, "Math.abs($1)")
      .replace(/pow\(([^,]+),([^)]+)\)/g, "Math.pow($1,$2)")
      .replace(/(\d+)%/g, "($1/100)");

    // Only allow digits, Math functions, arithmetic operators, parentheses, commas, whitespace, and decimals
    if (!/^[\d\s+\-*/().,%Math.sqrtabspow]+$/.test(sanitized)) {
      return null;
    }

    // Evaluate in a restricted Function scope
    const fn = new Function(`"use strict"; return (${sanitized});`);
    const val = fn();
    return typeof val === "number" && !isNaN(val) && isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

export function handleOfflineQuery(rawQuery: string): OfflineResult {
  const query = rawQuery.trim();
  const lower = query.toLowerCase();

  // ── 1. Greetings & Identity ───────────────────────────────────────────────
  if (/^(hi|hello|hey|greetings|howdy|good\s*(morning|afternoon|evening))\b/i.test(lower)) {
    return {
      handled: true,
      reply: "👋 **Hello!** I'm **Day**, running completely **offline on your device**.\n\n"
        + "Even without internet connection, I can help you with:\n"
        + "• 🎵 **Media controls** (*play, pause, next, volume*)\n"
        + "• 📋 **Clipboard tracker** (*check copied text, format content*)\n"
        + "• 🧮 **Calculator & Math** (*e.g. 15% of 320, 24 * 7, sqrt(144)*)\n"
        + "• 📝 **Offline Notes** (*note: buy coffee, show notes, clear notes*)\n"
        + "• ⏱️ **Date & Time** (*current time, today's date*)\n"
        + "• 🧠 **Local LLM Models** (*via Ollama or LM Studio on localhost*)",
    };
  }

  if (/(who are you|what are you|what is Day)/i.test(lower)) {
    return {
      handled: true,
      reply: "✨ **Day — Personal Intelligence**\n\n"
        + "I am your native desktop Dynamic Island assistant designed to work **100% locally** on your system.\n\n"
        + "- **Privacy**: No data leaves your machine.\n"
        + "- **System Access**: Clipboard monitoring, media tracker, notifications, and device connection alerts.\n"
        + "- **Offline First**: All core tools, widgets, and local LLM integrations (Ollama, LM Studio) work seamlessly without an internet connection.",
    };
  }

  // ── 2. Time & Date ────────────────────────────────────────────────────────
  if (/^(what time is it|time|current time|clock)\??$/i.test(lower)) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return {
      handled: true,
      reply: `🕒 **Local Time**: \`${timeStr}\``,
    };
  }

  if (/^(what is the date|what date is it|date|today|what day is it)\??$/i.test(lower)) {
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return {
      handled: true,
      reply: `📅 **Today is**: **${dateStr}**`,
    };
  }

  // ── 3. System & Connectivity Status ──────────────────────────────────────
  if (/(system status|network status|device status|offline status|is offline)/i.test(lower)) {
    const isOnline = typeof navigator !== "undefined" && navigator.onLine;
    const notesCount = getLocalNotes().length;
    const track = SystemAccess.audioTrack;
    return {
      handled: true,
      reply: "🖥️ **System Status Overview**:\n\n"
        + `• **Network**: ${isOnline ? "🟢 Online" : "🟠 Offline (Local Mode Active)"}\n`
        + `• **Audio Tracker**: ${track.playing ? `▶ Playing "${track.title}"` : `⏸ Paused (${track.title})`}\n`
        + `• **Saved Local Notes**: ${notesCount} note(s)\n`
        + `• **Recent Clipboard**: ${SystemAccess.activeClipboard ? `"${SystemAccess.activeClipboard.text.slice(0, 40)}..."` : "Empty"}\n`
        + `• **Platform**: Windows Native (MSVC Release)`,
    };
  }

  // ── 4. Media & Audio Controls ─────────────────────────────────────────────
  if (/^(play|resume|unpause)\b/i.test(lower)) {
    if (!SystemAccess.audioTrack.playing) {
      SystemAccess.togglePlayPause();
    }
    return {
      handled: true,
      reply: `▶ **Playing**: **${SystemAccess.audioTrack.title}** by ${SystemAccess.audioTrack.artist}`,
    };
  }

  if (/^(pause|stop)\b/i.test(lower)) {
    if (SystemAccess.audioTrack.playing) {
      SystemAccess.togglePlayPause();
    }
    return {
      handled: true,
      reply: `⏸ **Paused**: **${SystemAccess.audioTrack.title}**`,
    };
  }

  if (/^(next|skip|forward track|next song)\b/i.test(lower)) {
    SystemAccess.forward();
    return {
      handled: true,
      reply: `⏭ **Fast Forward / Next Track** (${SystemAccess.audioTrack.title})`,
    };
  }

  if (/^(previous|prev|rewind|back track|previous song)\b/i.test(lower)) {
    SystemAccess.reverse();
    return {
      handled: true,
      reply: `⏮ **Rewind / Previous Track** (${SystemAccess.audioTrack.title})`,
    };
  }

  // ── 5. Clipboard Integration ──────────────────────────────────────────────
  if (/^(clipboard|what did i copy|show clipboard|paste)\??$/i.test(lower)) {
    const item = SystemAccess.activeClipboard;
    if (!item) {
      return {
        handled: true,
        reply: "📋 **Clipboard is currently empty** or hasn't captured any recent copied text yet.",
      };
    }
    return {
      handled: true,
      reply: `📋 **Current Clipboard (${item.type})**:\n\n\`\`\`\n${item.text}\n\`\`\``,
    };
  }

  // ── 6. Local Offline Notes ────────────────────────────────────────────────
  const noteMatch = query.match(/^(?:note|remember|save note):\s*(.+)$/i);
  if (noteMatch && noteMatch[1]) {
    const text = noteMatch[1].trim();
    const notes = getLocalNotes();
    notes.push(`${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: ${text}`);
    saveLocalNotes(notes);
    return {
      handled: true,
      reply: `📝 **Note saved locally**:\n> "${text}"\n\n(Type \`show notes\` anytime to view them.)`,
    };
  }

  if (/^(show notes|my notes|list notes|view notes)\??$/i.test(lower)) {
    const notes = getLocalNotes();
    if (notes.length === 0) {
      return {
        handled: true,
        reply: "📝 **No saved notes yet**.\n\nTo save a note, type:\n`note: Buy groceries` or `remember: Check meeting link`",
      };
    }
    return {
      handled: true,
      reply: "📝 **Your Saved Offline Notes**:\n\n" + notes.map((n, i) => `${i + 1}. ${n}`).join("\n"),
    };
  }

  if (/^(clear notes|delete notes|empty notes)$/i.test(lower)) {
    saveLocalNotes([]);
    return {
      handled: true,
      reply: "🗑️ **All saved offline notes have been cleared.**",
    };
  }

  // ── 7. Text Utilities ─────────────────────────────────────────────────────
  const wordCountMatch = query.match(/^count\s+(?:words|characters|chars)\s+in\s+[:"']?([\s\S]+?)["']?$/i);
  if (wordCountMatch && wordCountMatch[1]) {
    const str = wordCountMatch[1].trim();
    const words = str ? str.split(/\s+/).length : 0;
    const chars = str.length;
    return {
      handled: true,
      reply: `📊 **Text Analysis**:\n• **Words**: ${words}\n• **Characters**: ${chars}\n• **Characters (no spaces)**: ${str.replace(/\s/g, "").length}`,
    };
  }

  const uppercaseMatch = query.match(/^uppercase\s+[:"']?([\s\S]+?)["']?$/i);
  if (uppercaseMatch && uppercaseMatch[1]) {
    return {
      handled: true,
      reply: `🔠 **Uppercase**:\n\`\`\`\n${uppercaseMatch[1].toUpperCase()}\n\`\`\``,
    };
  }

  const lowercaseMatch = query.match(/^lowercase\s+[:"']?([\s\S]+?)["']?$/i);
  if (lowercaseMatch && lowercaseMatch[1]) {
    return {
      handled: true,
      reply: `🔡 **Lowercase**:\n\`\`\`\n${lowercaseMatch[1].toLowerCase()}\n\`\`\``,
    };
  }

  // ── 8. Math / Calculator ──────────────────────────────────────────────────
  const mathPrefixMatch = query.match(/^(?:calculate|calc|what is|compute)?\s*([0-9\s+\-*/().,%^x]+|sqrt\([^)]+\)|pow\([^)]+\))$/i);
  if (mathPrefixMatch && mathPrefixMatch[1]) {
    const exprCandidate = mathPrefixMatch[1].trim();
    if (/[0-9]/.test(exprCandidate) && /[+\-*/%^x]|sqrt|pow/.test(exprCandidate)) {
      const res = safeEvalMath(exprCandidate);
      if (res !== null) {
        return {
          handled: true,
          reply: `🧮 **Calculation**:\n\`${exprCandidate}\` = **${res.toLocaleString()}**`,
        };
      }
    }
  }

  // Direct percentage calculation: "15% of 250"
  const percentMatch = query.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/i);
  if (percentMatch) {
    const pct = parseFloat(percentMatch[1]);
    const total = parseFloat(percentMatch[2]);
    const res = (pct / 100) * total;
    return {
      handled: true,
      reply: `🧮 **${pct}% of ${total}** = **${res.toLocaleString()}**`,
    };
  }

  // ── 9. Offline Fallback for general queries ────────────────────────────────
  return {
    handled: false,
    reply: "⚡ **Offline Assistant**\n\n"
      + "I'm operating in **Local Offline Mode**.\n\n"
      + "I can help with local tasks directly:\n"
      + "• Type `time` or `date` for current system time\n"
      + "• Type `system status` for device & island status\n"
      + "• Type `calculate 12 * 85` or `20% of 450` for math\n"
      + "• Type `note: Your text here` to save offline notes\n"
      + "• Type `clipboard` to inspect copied text\n"
      + "• Type `play`, `pause`, or `next` to control music\n\n"
      + "> 💡 **Want full AI generation offline?**\n"
      + "> Install **Ollama** (`ollama.com`) and run `ollama run llama3.2` — Day connects to `http://localhost:11434` completely offline without requiring any internet connection!",
  };
}
