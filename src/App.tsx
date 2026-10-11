export function App() {
  return (
    <main style={{ padding: 'calc(var(--safe-top) + var(--space-8)) var(--space-5)', position: 'relative' }}>
      <p style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>Winter</p>
      <h1 className="num" style={{ fontSize: 'var(--text-hero)', letterSpacing: 'var(--tracking-display)' }}>
        11.10.
      </h1>
      <p style={{ color: 'var(--color-accent)' }}>Grundgerüst steht.</p>
    </main>
  );
}
