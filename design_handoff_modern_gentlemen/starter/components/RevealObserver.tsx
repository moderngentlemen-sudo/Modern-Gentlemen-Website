"use client";

import { useEffect } from "react";

const SELECTOR = "[data-mg-reveal]";

function numberProperty(element: Element, property: string): number {
  const parsed = Number.parseFloat(getComputedStyle(element).getPropertyValue(property));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function revealElements(root: ParentNode | Element): HTMLElement[] {
  const elements = Array.from(root.querySelectorAll<HTMLElement>(SELECTOR));
  if (root instanceof HTMLElement && root.matches(SELECTOR)) elements.unshift(root);
  return elements;
}

/**
 * One observer for every visual reveal on the page.
 *
 * Reveal configuration is emitted as bounded CSS custom properties. That lets
 * a published global style class supply the behavior without copying its
 * settings into every block, and keeps this runtime ignorant of theme data.
 * Elements remain visible in the server HTML; only this enhancement marks a
 * configured element pending, so no JavaScript never means no content.
 */
export function RevealObserver() {
  useEffect(() => {
    const observed = new WeakMap<Element, string>();
    const settleTimers = new Map<Element, ReturnType<typeof setTimeout>>();
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    function clearSettle(element: Element) {
      const timer = settleTimers.get(element);
      if (timer) clearTimeout(timer);
      settleTimers.delete(element);
    }

    const intersection =
      !reduceMotion && "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                const element = entry.target as HTMLElement;
                const repeat =
                  getComputedStyle(element).getPropertyValue("--mg-reveal-repeat").trim() === "1";

                if (entry.isIntersecting) {
                  clearSettle(element);
                  element.dataset.mgRevealState = "visible";
                  const wait =
                    numberProperty(element, "--mg-reveal-delay") +
                    numberProperty(element, "--mg-reveal-duration");
                  settleTimers.set(
                    element,
                    setTimeout(() => {
                      element.dataset.mgRevealState = "settled";
                      settleTimers.delete(element);
                    }, wait)
                  );
                  if (!repeat) intersection?.unobserve(element);
                } else if (repeat) {
                  clearSettle(element);
                  element.dataset.mgRevealState = "pending";
                }
              }
            },
            { threshold: 0.12, rootMargin: "0px 0px -5%" }
          )
        : null;

    function prepare(root: ParentNode | Element) {
      for (const element of revealElements(root)) {
        const reveal = getComputedStyle(element).getPropertyValue("--mg-reveal").trim();
        const signature = [
          reveal,
          numberProperty(element, "--mg-reveal-delay"),
          numberProperty(element, "--mg-reveal-duration"),
          getComputedStyle(element).getPropertyValue("--mg-reveal-repeat").trim(),
        ].join(":");

        if (!reveal || reveal === "none") {
          if (observed.has(element)) {
            intersection?.unobserve(element);
            clearSettle(element);
            delete element.dataset.mgRevealState;
            observed.delete(element);
          }
          continue;
        }
        if (observed.get(element) === signature) continue;

        if (observed.has(element)) {
          intersection?.unobserve(element);
          clearSettle(element);
        }

        observed.set(element, signature);
        if (!intersection) {
          element.dataset.mgRevealState = "settled";
          continue;
        }
        element.dataset.mgRevealState = "pending";
        intersection.observe(element);
      }
    }

    prepare(document);
    const mutations = new MutationObserver((records) => {
      let stylesChanged = false;
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof Element) {
          prepare(record.target);
          continue;
        }
        if (
          record.target instanceof HTMLStyleElement &&
          record.target.hasAttribute("data-mg-visual-style")
        ) {
          stylesChanged = true;
        }
        for (const node of record.addedNodes) {
          if (node instanceof Element) prepare(node);
        }
      }
      if (stylesChanged) prepare(document);
    });
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-mg-style", "data-mg-visual", "style"],
    });

    return () => {
      mutations.disconnect();
      intersection?.disconnect();
      for (const timer of settleTimers.values()) clearTimeout(timer);
    };
  }, []);

  return null;
}
