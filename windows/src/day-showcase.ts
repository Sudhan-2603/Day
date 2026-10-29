import { BotEngine } from "./mochi/engine";
import type { Outfit } from "./mochi/wardrobe";
import type { BotEmoteName } from "./core/layout";

interface ExpressionItem {
  name: string;
  emote: BotEmoteName;
  sound?: string;
}

interface OutfitItem {
  name: string;
  outfit: Outfit;
}

const EXPRESSIONS: ExpressionItem[] = [
  { name: "Idle", emote: "idle" },
  { name: "Smile", emote: "smile" },
  { name: "Wink", emote: "wink" },
  { name: "Happy", emote: "happy" },
  { name: "Surprised", emote: "surprised" },
  { name: "Sad", emote: "sad" },
  { name: "Angry", emote: "angry" },
  { name: "Sleep", emote: "sleep" },
  { name: "Confused", emote: "confused" },
  { name: "Love", emote: "love" },
  { name: "Laughing", emote: "laughing" },
  { name: "Shy", emote: "shy" },
];

const OUTFITS: OutfitItem[] = [
  { name: "Beanie", outfit: "beanie" },
  { name: "Party Hat", outfit: "partyHat" },
  { name: "Crown", outfit: "crown" },
  { name: "Santa", outfit: "santaHat" },
  { name: "Witch Hat", outfit: "witchHat" },
  { name: "Sunglasses", outfit: "sunglasses" },
  { name: "Round Glasses", outfit: "roundGlasses" },
  { name: "Scarf", outfit: "scarf" },
  { name: "Bow", outfit: "bow" },
  { name: "Headphones", outfit: "headphones" },
  { name: "Cap", outfit: "cap" },
  { name: "Idea", outfit: "idea" },
];

function initShowcase() {
  const exprGrid = document.getElementById("expressions-grid");
  const outfitGrid = document.getElementById("outfits-grid");
  const circleCanvas = document.getElementById("circle-avatar-canvas") as HTMLCanvasElement | null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = 104;

  interface LiveItem {
    engine: BotEngine;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    size: number;
  }
  const liveItems: LiveItem[] = [];

  // Live Circle Hero Avatar
  if (circleCanvas) {
    const heroSize = 130;
    circleCanvas.width = heroSize * dpr;
    circleCanvas.height = heroSize * dpr;
    circleCanvas.style.width = `${heroSize}px`;
    circleCanvas.style.height = `${heroSize}px`;
    const heroEngine = new BotEngine();
    heroEngine.setState("idle", true);
    const heroCtx = circleCanvas.getContext("2d");
    if (heroCtx) {
      liveItems.push({ engine: heroEngine, canvas: circleCanvas, ctx: heroCtx, size: heroSize });
      circleCanvas.addEventListener("click", () => {
        heroEngine.triggerEmote("happy", 1.5);
      });
    }
  }

  // Render Expressions inside Circular Avatar Pods with live animation
  if (exprGrid) {
    for (const item of EXPRESSIONS) {
      const card = document.createElement("div");
      card.className = "character-card";

      const circleFrame = document.createElement("div");
      circleFrame.className = "card-avatar-circle";

      const canvas = document.createElement("canvas");
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      const engine = new BotEngine();
      engine.setState("idle", true);
      engine.setPermanentEmote(item.emote);

      const ctx = canvas.getContext("2d");
      if (ctx) {
        liveItems.push({ engine, canvas, ctx, size });
      }

      circleFrame.append(canvas);

      const label = document.createElement("span");
      label.className = "card-label";
      label.textContent = item.name;

      card.append(circleFrame, label);
      card.addEventListener("click", () => {
        engine.triggerEmote(item.emote, 1.4);
      });
      card.addEventListener("mouseenter", () => {
        engine.blink();
      });

      exprGrid.append(card);
    }
  }

  // Render Outfits inside Circular Avatar Pods with live animation
  if (outfitGrid) {
    for (const item of OUTFITS) {
      const card = document.createElement("div");
      card.className = "character-card";

      const circleFrame = document.createElement("div");
      circleFrame.className = "card-avatar-circle";

      const canvas = document.createElement("canvas");
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      const engine = new BotEngine();
      engine.setState("idle", true);
      engine.setPermanentEmote(item.outfit === "idea" ? "happy" : "idle");
      engine.outfit = item.outfit;
      engine.outfitPresence = 1;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        liveItems.push({ engine, canvas, ctx, size });
      }

      circleFrame.append(canvas);

      const label = document.createElement("span");
      label.className = "card-label";
      label.textContent = item.name;

      card.append(circleFrame, label);
      card.addEventListener("click", () => {
        engine.triggerEmote("happy", 1.4);
      });
      card.addEventListener("mouseenter", () => {
        engine.blink();
      });

      outfitGrid.append(card);
    }
  }

  // Master live animation loop for all circular avatar cards
  let lastT = performance.now();
  const loop = (t: number) => {
    const dt = Math.min(0.04, (t - lastT) / 1000);
    lastT = t;
    for (const item of liveItems) {
      item.engine.update(dt);
      item.ctx.setTransform(1, 0, 0, 1, 0, 0);
      item.ctx.clearRect(0, 0, item.canvas.width, item.canvas.height);
      item.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      item.engine.draw(item.ctx, item.size, item.size);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initShowcase);
} else {
  initShowcase();
}
