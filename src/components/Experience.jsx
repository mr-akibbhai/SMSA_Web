import { useLanguage } from "../lib/i18n";
import { Children, cloneElement, isValidElement, useEffect, useRef, useState } from 'react';
export const MANUAL_PAUSE_MS = 7000;
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=() => setReduced(media.matches);
    update(); media.addEventListener('change',update);
    return () => media.removeEventListener('change',update);
  }, []);
  return reduced;
}
export function interactionPauseUntil(now) {
  return now + MANUAL_PAUSE_MS;
}
export function AutoRail({
  children,
  label
}) {
  const {
    t
  } = useLanguage();
  const [loop, setLoop] = useState(false);
  const reducedMotion = useReducedMotion();
  const count = Children.count(children);
  const ref = useRef(null),
    pause = useRef(0),
    drag = useRef(null),
    travel = useRef(1),
    held = useRef({ hover:false, focus:false }),
    moved = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setLoop(el.firstElementChild.scrollWidth > el.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(el.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, [count]);
  function stop() {
    pause.current = interactionPauseUntil(Date.now());
  }
  useEffect(() => {
    if (!count || reducedMotion) return;
    let id,
      last = 0;
    const tick = time => {
      const el = ref.current;
      const dt = Math.min(time - last || 0, 50);
      last = time;
      if (el && Date.now() > pause.current && !document.hidden && !drag.current && !held.current.hover && !held.current.focus) {
        const cycle = el.firstElementChild.scrollWidth + 20;
        if (loop) {
          if (Math.abs(el.scrollLeft - travel.current) > 2) travel.current = el.scrollLeft;
          travel.current += dt * .025;
          if (travel.current >= cycle) travel.current -= cycle;
          el.scrollLeft = travel.current;
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [loop, count, reducedMotion]);
  if (!count) return null;
  return <div className="auto-rail-wrap"><div className="rail-controls"><button type="button" disabled={!loop} aria-label={t("Previous cards")} onClick={() => {
        stop();
        ref.current.scrollBy({
          left: -300,
          behavior: 'smooth'
        });
      }}>{t("\u2190")}</button><button type="button" disabled={!loop} aria-label={t("Next cards")} onClick={() => {
        stop();
        ref.current.scrollBy({
          left: 300,
          behavior: 'smooth'
        });
      }}>{t("\u2192")}</button></div>
    <div ref={ref} className="auto-rail" role="region" aria-label={label} tabIndex={0} onMouseEnter={() => { held.current.hover=true; stop(); }} onMouseLeave={() => { held.current.hover=false; stop(); }} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) { held.current.focus=false; stop(); } }} onWheel={stop} onKeyDown={stop} onFocusCapture={() => { held.current.focus=true; stop(); }} onTouchStart={stop} onTouchEnd={stop} onPointerDown={e => {
      stop();
      moved.current = false;
      if (e.pointerType === 'mouse') drag.current = {
        x: e.clientX,
        left: ref.current.scrollLeft
      };
    }} onPointerMove={e => {
      if (drag.current) {
        const delta = e.clientX - drag.current.x;
        if (Math.abs(delta) > 5) {
          moved.current = true;
          ref.current.scrollLeft = drag.current.left - delta;
        }
      }
    }} onPointerUp={() => {
      drag.current = null;
      stop();
    }} onPointerLeave={() => {
      drag.current = null;
    }} onClickCapture={e => {
      if (moved.current) {
        e.preventDefault();
        e.stopPropagation();
        moved.current = false;
      }
    }}><div className="rail-cycle">{children}</div>{loop && <div className="rail-cycle" aria-hidden="true" onMouseDown={e => e.preventDefault()}>{Children.map(children, child => isValidElement(child) ? cloneElement(child, {
          tabIndex: -1
        }) : child)}</div>}</div></div>;
}
export function AboutSlideshow({
  items
}) {
  const {
    t
  } = useLanguage();
  const slides = items.filter(i => i.kind === 'about' && i.enabled && i.image_url);
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || slides.length < 2 || reducedMotion) return;
    const timer = setInterval(() => setIndex(i => (i + 1) % slides.length), 2000);
    return () => clearInterval(timer);
  }, [slides.length, paused, reducedMotion]);
  if (!slides.length) return null;
  return <div className="about-slideshow" aria-label={t("About SMSA images")}>{slides.map((slide, i) => <figure key={slide.id} className={i === index % slides.length ? 'visible' : ''} aria-hidden={i !== index % slides.length}><img src={slide.image_url} alt={slide.title} /><figcaption>{slide.title}</figcaption></figure>)}<button className="slideshow-pause" onClick={() => setPaused(!paused)}>{paused ? t("Play") : t("Pause")}</button></div>;
}
