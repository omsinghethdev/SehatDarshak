import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HeartPulse } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation";
import "./IntroAnimation.css";
import NurseTrolleyAnimation from "./NurseTrolleyAnimation";

// Let the logo and title settle before the nurse walks in.
const WALK_DELAY_MS = 1100;
const WALK_MS = 6500;
// Reduced motion: a still scene shown for this long instead of the walk.
const CALM_HOLD_MS = 3500;
// Safety net: never hold the app back if the image is slow to load.
const MAX_WAIT_MS = 5000;
const FADE_MS = 600;
// Width of the soft edge between the intro and the website being revealed.
const REVEAL_SOFTNESS = 120;
const MESSAGE_KEYS = ["intro.message1", "intro.message2", "intro.message3"];
const MESSAGE_MS = 1500;

const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Opening overlay drawn over the already-loaded website. A nurse pushing a patient walks in
 * from the right, and the intro is wiped away behind her, so as she leaves on the left the
 * website underneath is fully uncovered. With reduced motion the nurse stands still in the
 * corridor for a few seconds and the intro fades out instead.
 */
export default function IntroAnimation({ onComplete }) {
  const { t } = useTranslation();
  const screenRef = useRef(null);
  const walkerRef = useRef(null);
  const [imageState, setImageState] = useState("loading"); // loading | ready | failed
  const [leaving, setLeaving] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [calm] = useState(prefersReducedMotion);
  const handleImageLoad = useCallback(() => setImageState("ready"), []);
  const handleImageError = useCallback(() => setImageState("failed"), []);

  // The page behind must not scroll while the intro covers it. Keeping the scrollbar's space
  // reserved stops the website from shifting sideways when scrolling is unlocked again.
  useEffect(() => {
    const root = document.documentElement;
    const previous = { overflow: root.style.overflow, gutter: root.style.scrollbarGutter };
    root.style.scrollbarGutter = "stable";
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous.overflow;
      root.style.scrollbarGutter = previous.gutter;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(
      () => setMessageIndex((index) => Math.min(index + 1, MESSAGE_KEYS.length - 1)),
      MESSAGE_MS,
    );
    return () => clearInterval(timer);
  }, []);

  // If the image never arrives, fade out rather than keep people waiting.
  useEffect(() => {
    if (imageState === "failed") setLeaving(true);
    if (imageState !== "loading") return undefined;
    const timer = setTimeout(() => setLeaving(true), MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, [imageState]);

  // Reduced motion: stand the nurse in the middle of the corridor, then fade out.
  useLayoutEffect(() => {
    if (!calm || imageState !== "ready") return undefined;
    function centre() {
      const walker = walkerRef.current;
      if (walker) walker.style.transform = `translate3d(${(window.innerWidth - walker.offsetWidth) / 2}px, 0, 0)`;
    }
    centre();
    window.addEventListener("resize", centre);
    return () => window.removeEventListener("resize", centre);
  }, [calm, imageState]);

  useEffect(() => {
    if (!calm) return undefined;
    const timer = setTimeout(() => setLeaving(true), CALM_HOLD_MS);
    return () => clearTimeout(timer);
  }, [calm]);

  // The walk: one animation frame loop moves the nurse and the reveal edge together.
  useEffect(() => {
    if (calm || imageState !== "ready" || leaving) return undefined;
    let frame = 0;
    let start = 0;

    function step(now) {
      const screen = screenRef.current;
      const walker = walkerRef.current;
      if (!screen || !walker) return;
      start ||= now + WALK_DELAY_MS;
      const progress = Math.min(Math.max((now - start) / WALK_MS, 0), 1);

      const viewport = window.innerWidth;
      const width = walker.offsetWidth;
      // The soft edge begins just behind the nurse's back foot (about 95% across the box).
      const revealOffset = width * 0.95 + REVEAL_SOFTNESS;
      const from = viewport + 20; // just past the right edge
      const to = -revealOffset; // far enough left that the reveal edge has left the screen too
      const x = from + (to - from) * easeInOutSine(progress);

      walker.style.transform = `translate3d(${x}px, 0, 0)`;
      // The website shows through everything to the right of the nurse's back.
      screen.style.setProperty("--reveal-x", `${x + revealOffset}px`);

      if (progress < 1) frame = requestAnimationFrame(step);
      else onComplete?.();
    }

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [calm, imageState, leaving, onComplete]);

  // Skip / fallback: a short fade, then hand over to the website.
  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(() => onComplete?.(), FADE_MS);
    return () => clearTimeout(timer);
  }, [leaving, onComplete]);

  return (
    <div
      ref={screenRef}
      className={`intro-screen${leaving ? " is-leaving" : ""}`}
      role="dialog"
      aria-label={t("intro.label")}
      style={{ "--reveal-softness": `${REVEAL_SOFTNESS}px` }}
    >
      <button type="button" className="intro-skip" onClick={() => setLeaving(true)}>
        {t("intro.skip")}
      </button>

      <div className="intro-heading">
        <span className="intro-logo">
          <HeartPulse aria-hidden="true" />
        </span>
        <h1>SehatDarsak</h1>
        <p>{t("intro.tagline")}</p>
      </div>

      <NurseTrolleyAnimation
        walkerRef={walkerRef}
        onImageLoad={handleImageLoad}
        onImageError={handleImageError}
      />

      <p key={messageIndex} className="intro-message">
        {t(MESSAGE_KEYS[messageIndex])}
      </p>
    </div>
  );
}
