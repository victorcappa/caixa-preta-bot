"use client";

import { useEffect } from 'react';

// Measure the complete text, so the typewriter does not resize on each character.
export function useProjectionTextFit(ref, text, configuredSize, surface = 'tarot') {
  useEffect(() => {
    const element = ref.current;
    const root = element?.closest('[data-projection-readability]');
    const moduleElement = element?.closest('[data-public-module]');
    const area = surface === 'bot' ? element?.closest('[data-projection-text-area]') : element;
    if (!element || !root || !moduleElement || !area) return undefined;
    let frame = 0, disposed = false;
    function fit() {
      frame = 0;
      if (root.dataset.projectionFit !== 'true' || !text) {
        element.style.removeProperty('font-size');
        delete element.dataset.textFit;
        return;
      }
      const width = element.clientWidth;
      let height = element.clientHeight;
      if (surface === 'bot') {
        const areaStyle = getComputedStyle(area);
        const siblings = [...element.parentElement.children].filter(child => child !== element);
        const occupied = siblings.reduce((sum, child) => sum + child.getBoundingClientRect().height, 0);
        const frameStyle = getComputedStyle(element.parentElement);
        const gap = parseFloat(frameStyle.rowGap) || 0;
        const frameInset = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
          .reduce((sum, key) => sum + (parseFloat(frameStyle[key]) || 0), 0);
        height = area.clientHeight - (parseFloat(areaStyle.paddingTop) || 0) - (parseFloat(areaStyle.paddingBottom) || 0) - frameInset - occupied - siblings.length * gap;
      }
      if (!width || !height) return;
      const fitHeight = Math.max(0, height - 2);
      const probe = element.cloneNode(false);
      probe.textContent = text;
      probe.setAttribute('aria-hidden', 'true');
      Object.assign(probe.style, { position: 'absolute', inset: 'auto', visibility: 'hidden',
        pointerEvents: 'none', width: `${width}px`, height: 'auto', minHeight: '0', maxHeight: 'none', overflow: 'visible' });
      probe.style.removeProperty('font-size');
      element.parentElement.appendChild(probe);
      const target = parseFloat(getComputedStyle(probe).fontSize);
      let low = Math.min(24, target), high = target;
      if (probe.scrollHeight <= fitHeight) low = target;
      else {
        for (let i = 0; i < 10; i += 1) {
          const size = (low + high) / 2;
          probe.style.fontSize = `${size}px`;
          if (probe.scrollHeight <= fitHeight) low = size; else high = size;
        }
      }
      probe.style.fontSize = `${low}px`;
      element.style.fontSize = `${Math.floor(low * 10) / 10}px`;
      element.dataset.textFit = probe.scrollHeight <= fitHeight ? 'fits' : 'overflow';
      if (element.dataset.textFit === 'fits') element.scrollTop = 0;
      probe.remove();
    }
    function schedule() { if (!disposed && !frame) frame = requestAnimationFrame(fit); }
    const resize = new ResizeObserver(schedule);
    resize.observe(area);
    const changes = new MutationObserver(schedule);
    changes.observe(root, { attributes: true, attributeFilter: ['style', 'data-projection-fit', 'data-projection-font'] });
    changes.observe(moduleElement, { attributes: true, attributeFilter: ['style'] });
    if (surface === 'bot') changes.observe(element.parentElement, { attributes: true, attributeFilter: ['data-warmup-effect'] });
    document.fonts?.addEventListener('loadingdone', schedule);
    document.fonts?.ready.then(schedule);
    schedule();
    return () => { disposed = true; cancelAnimationFrame(frame); resize.disconnect(); changes.disconnect();
      document.fonts?.removeEventListener('loadingdone', schedule); element.style.removeProperty('font-size'); delete element.dataset.textFit; };
  }, [ref, text, configuredSize, surface]);
}
