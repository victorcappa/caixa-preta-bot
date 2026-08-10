import BlinkingCursor from "./BlinkingCursor";
import styles from "./Terminal.module.css";

export default function Terminal({ title, children, footer }) {
  return (
    <main className={styles.terminal}>
      <header className={styles.header}>
        <h1>{title}</h1>
        <BlinkingCursor />
      </header>
      <section className={styles.body}>{children}</section>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </main>
  );
}
