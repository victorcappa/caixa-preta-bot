import BlinkingCursor from "./BlinkingCursor";
import styles from "./Terminal.module.css";

export default function Terminal({ title, children, footer, className = "" }) {
  return (
    <main className={`${styles.terminal} ${className}`.trim()}>
      <header className={styles.header}>
        <h1>{title}</h1>
        <BlinkingCursor />
      </header>
      <section className={styles.body}>{children}</section>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </main>
  );
}
