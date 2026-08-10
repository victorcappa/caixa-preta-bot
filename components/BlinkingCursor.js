import styles from "./BlinkingCursor.module.css";

export default function BlinkingCursor() {
  return <span className={styles.cursor} aria-hidden="true">_</span>;
}
