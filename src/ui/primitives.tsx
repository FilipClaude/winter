import type { LucideIcon } from 'lucide-react';
import { Settings2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { navigate } from '../router';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'warn';
  size?: 'm' | 's';
  block?: boolean;
  icon?: LucideIcon;
};

export function Button({ variant = 'secondary', size = 'm', block, icon: Icon, className, children, ...rest }: ButtonProps) {
  const cls = ['btn', `btn--${variant}`, size === 's' && 'btn--s', block && 'btn--block', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {Icon && <Icon size={size === 's' ? 16 : 18} strokeWidth={1.75} aria-hidden />}
      {children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  variant?: 'plain' | 'outline' | 'accent';
  iconSize?: number;
};

export function IconButton({ icon: Icon, label, variant = 'plain', iconSize = 20, className, ...rest }: IconButtonProps) {
  const cls = ['icon-btn', variant === 'outline' && 'icon-btn--outline', variant === 'accent' && 'icon-btn--accent', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} aria-label={label} title={label} {...rest}>
      <Icon size={iconSize} strokeWidth={1.5} aria-hidden />
    </button>
  );
}

interface CardProps {
  label?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  children?: ReactNode;
  warn?: boolean;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
  testId?: string;
}

export function Card({ label, icon: Icon, action, children, warn, onClick, className, ariaLabel, testId }: CardProps) {
  const cls = ['card', warn && 'card--warn', onClick && 'card--button', className].filter(Boolean).join(' ');
  const head = (label || action) && (
    <div className="card__head">
      {label ? (
        <span className="label">
          {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden />}
          {label}
        </span>
      ) : (
        <span />
      )}
      {action}
    </div>
  );
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={ariaLabel} data-testid={testId}>
        {head}
        {children}
      </button>
    );
  }
  return (
    <section className={cls} aria-label={ariaLabel} data-testid={testId}>
      {head}
      {children}
    </section>
  );
}

export function ScreenHeader({ eyebrow, right }: { eyebrow?: ReactNode; right?: ReactNode }) {
  return (
    <header className="screen-header">
      <span className="screen-header__eyebrow">{eyebrow}</span>
      <div className="row" style={{ gap: 0 }}>
        {right}
        <IconButton icon={Settings2} label="Einstellungen" onClick={() => navigate('einstellungen')} />
      </div>
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <h2 className="section-title">
      <span>{children}</span>
      {action}
    </h2>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon size={28} strokeWidth={1.25} aria-hidden />
      <p className="empty__title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Banner({
  icon: Icon,
  tone = 'plain',
  children,
  action,
  testId,
}: {
  icon: LucideIcon;
  tone?: 'plain' | 'accent' | 'warn';
  children: ReactNode;
  action?: ReactNode;
  testId?: string;
}) {
  return (
    <div className={`banner ${tone !== 'plain' ? `banner--${tone}` : ''}`} role={tone === 'warn' ? 'alert' : undefined} data-testid={testId}>
      <Icon size={18} strokeWidth={1.75} aria-hidden />
      <div className="grow">{children}</div>
      {action}
    </div>
  );
}

export function ProgressBar({ value, warn, label }: { value: number; warn?: boolean; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={`bar ${warn ? 'bar--warn' : ''}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="bar__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Badge({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'warn' | 'muted' }) {
  return <span className={`badge ${tone !== 'accent' ? `badge--${tone}` : ''}`}>{children}</span>;
}
