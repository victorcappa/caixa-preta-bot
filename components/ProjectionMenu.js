"use client";

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { PUBLIC_LAYOUT_CHANGE_EVENT } from '@/lib/projectionScreens';
import PublicCompositionControls from './PublicCompositionControls';
import styles from './PublicComposition.module.css';

export default function ProjectionMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  const [display, setDisplay] = useState('');
  const title = useRef(null), previousFocus = useRef(null);
  useEffect(() => {
    function readUrl() {
      const next = new URLSearchParams(window.location.search).has('menu');
      setOpen(next);
      if (next) setVisited(true);
    }
    function changeMenu(next) {
      const url = new URL(window.location.href);
      if (next) url.searchParams.set('menu', ''); else url.searchParams.delete('menu');
      window.history.replaceState(window.history.state, '', url);
      readUrl();
    }
    function keydown(event) {
      if (event.key === 'Escape' && new URLSearchParams(window.location.search).has('menu')) {
        event.preventDefault(); changeMenu(false);
      } else if (event.altKey && event.key.toLowerCase() === 'm') {
        event.preventDefault(); changeMenu(!new URLSearchParams(window.location.search).has('menu'));
      }
    }
    function measure() { setDisplay(`${window.innerWidth} × ${window.innerHeight} px CSS · densidade ${window.devicePixelRatio}×`); }
    readUrl(); measure();
    window.addEventListener('popstate', readUrl);
    window.addEventListener(PUBLIC_LAYOUT_CHANGE_EVENT, readUrl);
    window.addEventListener('keydown', keydown);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('popstate', readUrl);
      window.removeEventListener(PUBLIC_LAYOUT_CHANGE_EVENT, readUrl);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('resize', measure);
    };
  }, [pathname]);
  useEffect(() => {
    if (open) { previousFocus.current = document.activeElement; title.current?.focus(); }
    else previousFocus.current?.focus?.();
  }, [open]);
  function close() {
    const url = new URL(window.location.href);
    url.searchParams.delete('menu');
    window.history.replaceState(window.history.state, '', url);
    setOpen(false);
  }
  return <aside className={styles.drawer} aria-label="Ajustes da projeção" hidden={!open}>
    <header className={styles.drawerHeader}>
      <h2 ref={title} tabIndex={-1}>AJUSTAR PROJEÇÃO</h2>
      <button type="button" onClick={close}>FECHAR MENU</button>
    </header>
    <p>Abra <code>/?menu</code> em uma aba de controle e mantenha a janela projetada sem <code>?menu</code>. Os ajustes se aplicam às telas públicas conectadas e ficam salvos.</p>
    <p>{display}. Confira o resultado em tela cheia no tecido. Alt+M abre o menu; Esc fecha.</p>
    {visited ? <PublicCompositionControls initiallyOpen /> : null}
  </aside>;
}
