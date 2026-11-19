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
    const visibleVideos = new Set<HTMLVideoElement>();
    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let frame = 0;
    let lastFrame: number | undefined;

    const updateNavSize = () => root.style.setProperty("--uni-nav-size", `${header.offsetHeight}px`);
    const resizeObserver = new ResizeObserver(updateNavSize);
    updateNavSize();
    resizeObserver.observe(header);

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
    reducedMotion.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVideos);

    return () => {
      resetOrbit();
      observer.disconnect();
      resizeObserver.disconnect();
      sections.forEach((section) => section.classList.remove("uni-awaiting"));
      videos.forEach((video) => video.pause());
      hero.removeEventListener("pointermove", moveOrbit);
      hero.removeEventListener("pointerleave", releaseOrbit);
      hero.removeEventListener("pointercancel", releaseOrbit);
      reducedMotion.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVideos);
    };
  }, []);

  return null;
}
