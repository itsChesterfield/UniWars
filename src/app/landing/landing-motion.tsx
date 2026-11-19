"use client";

import { useEffect } from "react";

export function LandingMotion() {
  useEffect(() => {
    const root = document.getElementById("uni-landing");
    const header = root?.querySelector<HTMLElement>(".uni-site-header");
    const hero = root?.querySelector<HTMLElement>(".uni-hero");
    const orbit = hero?.querySelector<SVGSVGElement>(".uni-login-orbit");
    if (!root || !header || !hero || !orbit) return;

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const videos = [...root.querySelectorAll<HTMLVideoElement>("video")];
    const sections = root.querySelectorAll("[data-uni-reveal]");
    const panels = [...root.querySelectorAll<HTMLElement>("[data-uni-panel]")];
    const visibleVideos = new Set<HTMLVideoElement>();
    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let frame = 0;
    let lastFrame: number | undefined;
    let lastWheel = -Infinity;
    let lastPageTurn = -Infinity;
    let wheelDirection = 0;
    let swipe: { x: number; y: number; decided: boolean; pageTurned: boolean } | null = null;

    const pageStyle = document.documentElement.style;
    const updateNavSize = () => pageStyle.setProperty("--uni-nav-size", `${header.offsetHeight}px`);
    const resizeObserver = new ResizeObserver(updateNavSize);
    updateNavSize();
    resizeObserver.observe(header);

    const turnPage = (direction: number) => {
      const top = header.getBoundingClientRect().bottom;
      const index = panels.findIndex((panel) => panel.getBoundingClientRect().bottom > top + 2);
      const active = panels[index];
      const next = panels[index + direction];
      if (!active || !next) return false;

      const bounds = active.getBoundingClientRect();
      // Lange Bereiche bleiben frei scrollbar, bis der sichtbare Rand erreicht ist.
      if (direction > 0 ? bounds.bottom > window.innerHeight + 2 : bounds.top < top - 2) return false;

      const previousOverflows = direction < 0 && next.offsetHeight > window.innerHeight - top + 2;
      next.scrollIntoView({ behavior: "smooth", block: previousOverflows ? "end" : "start" });
      return true;
    };

    const pageOnWheel = (event: WheelEvent) => {
      if (!event.cancelable || reducedMotion.matches || event.ctrlKey || event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      const direction = Math.sign(event.deltaY);
      const now = performance.now();
      const sameGesture = direction === wheelDirection && now - lastWheel < 160;
      lastWheel = now;
      if (sameGesture || now - lastPageTurn < 500) {
        event.preventDefault();
        return;
      }
      wheelDirection = 0;
      if (!turnPage(direction)) return;

      event.preventDefault();
      lastPageTurn = now;
      wheelDirection = direction;
    };

    const startSwipe = (event: TouchEvent) => {
      const touch = event.touches.length === 1 ? event.touches[0] : null;
      swipe = touch ? { x: touch.clientX, y: touch.clientY, decided: false, pageTurned: false } : null;
    };

    const pageOnSwipe = (event: TouchEvent) => {
      if (!swipe || reducedMotion.matches || !event.cancelable || event.touches.length !== 1) return;
      if (!swipe.decided) {
        const touch = event.touches[0];
        const x = swipe.x - touch.clientX;
        const y = swipe.y - touch.clientY;
        if (Math.max(Math.abs(x), Math.abs(y)) < 12) return;
        swipe.decided = true;
        swipe.pageTurned = Math.abs(y) > Math.abs(x) * 1.2 && turnPage(Math.sign(y));
      }
      if (swipe.pageTurned) event.preventDefault();
    };

    const endSwipe = () => {
      swipe = null;
    };

    for (const video of videos) {
      video.defaultPlaybackRate = 0.65;
      video.playbackRate = 0.65;
    }

    function updateVideos() {
      for (const video of videos) {
        if (!reducedMotion.matches && !document.hidden && visibleVideos.has(video)) {
          video.muted = true;
          if (video.paused) void video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    }

    const drawOrbit = (now: number) => {
      const elapsed = lastFrame === undefined ? 1000 / 60 : Math.min(now - lastFrame, 64);
      const progress = 1 - Math.exp(-elapsed / 400);
      let moving = false;
      for (const axis of ["x", "y"] as const) {
        const delta = target[axis] - pointer[axis];
        if (Math.abs(delta) < 0.002) {
          pointer[axis] = target[axis];
        } else {
          pointer[axis] += delta * progress;
          moving = true;
        }
      }
      orbit.style.setProperty("--pointer-shift-x", `${pointer.x * 110}px`);
      orbit.style.setProperty("--pointer-shift-y", `${pointer.y * 56}px`);
      lastFrame = moving ? now : undefined;
      frame = moving ? requestAnimationFrame(drawOrbit) : 0;
    };

    const moveOrbit = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || reducedMotion.matches) return;
      const bounds = hero.getBoundingClientRect();
      target.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      target.y = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(drawOrbit);
    };

    function releaseOrbit() {
      Object.assign(target, { x: 0, y: 0 });
      if (!frame) frame = requestAnimationFrame(drawOrbit);
    }

    const resetOrbit = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = undefined;
      Object.assign(target, { x: 0, y: 0 });
      Object.assign(pointer, target);
      orbit.style.removeProperty("--pointer-shift-x");
      orbit.style.removeProperty("--pointer-shift-y");
    };

    function updateMotion() {
      if (reducedMotion.matches) resetOrbit();
      updateVideos();
    }

    const observer = new IntersectionObserver((entries) => {
      for (const { target: element, isIntersecting, intersectionRatio } of entries) {
        if (element === hero) {
          if (!isIntersecting) resetOrbit();
        } else if (element instanceof HTMLVideoElement) {
          if (isIntersecting && intersectionRatio >= 0.15) visibleVideos.add(element);
          else visibleVideos.delete(element);
        } else if (!isIntersecting) {
          element.classList.add("uni-awaiting");
        } else if (intersectionRatio >= 0.15) {
          element.classList.remove("uni-awaiting");
        }
      }
      updateVideos();
    }, { threshold: [0, 0.15] });

    observer.observe(hero);
    videos.forEach((video) => observer.observe(video));
    sections.forEach((section) => {
      section.classList.add("uni-awaiting");
      observer.observe(section);
    });
    hero.addEventListener("pointermove", moveOrbit, { passive: true });
    hero.addEventListener("pointerleave", releaseOrbit);
    hero.addEventListener("pointercancel", releaseOrbit);
    root.addEventListener("wheel", pageOnWheel, { passive: false });
    root.addEventListener("touchstart", startSwipe, { passive: true });
    root.addEventListener("touchmove", pageOnSwipe, { passive: false });
    root.addEventListener("touchend", endSwipe);
    root.addEventListener("touchcancel", endSwipe);
    reducedMotion.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVideos);

    return () => {
      resetOrbit();
      pageStyle.removeProperty("--uni-nav-size");
      observer.disconnect();
      resizeObserver.disconnect();
      sections.forEach((section) => section.classList.remove("uni-awaiting"));
      videos.forEach((video) => video.pause());
      hero.removeEventListener("pointermove", moveOrbit);
      hero.removeEventListener("pointerleave", releaseOrbit);
      hero.removeEventListener("pointercancel", releaseOrbit);
      root.removeEventListener("wheel", pageOnWheel);
      root.removeEventListener("touchstart", startSwipe);
      root.removeEventListener("touchmove", pageOnSwipe);
      root.removeEventListener("touchend", endSwipe);
      root.removeEventListener("touchcancel", endSwipe);
      reducedMotion.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVideos);
    };
  }, []);

  return null;
}
