import { Link } from 'react-router-dom';
import { bindPublicCtaClick, publicCtaDataAttrs } from '../lib/public-analytics';

export function PublicCtaLink({
  to,
  cta,
  surface,
  intent,
  plan_id,
  className,
  children,
  onClick,
  ...rest
}) {
  const attrs = publicCtaDataAttrs({ cta, surface, intent });
  const meta = { cta, surface, intent, ...(plan_id ? { plan_id } : {}) };

  return (
    <Link
      to={to}
      className={className}
      onClick={bindPublicCtaClick(onClick, meta)}
      {...attrs}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function PublicCtaButton({
  cta,
  surface,
  intent,
  plan_id,
  className,
  children,
  onClick,
  type = 'button',
  ...rest
}) {
  const attrs = publicCtaDataAttrs({ cta, surface, intent });
  const meta = { cta, surface, intent, ...(plan_id ? { plan_id } : {}) };

  return (
    <button
      type={type}
      className={className}
      onClick={bindPublicCtaClick(onClick, meta)}
      {...attrs}
      {...rest}
    >
      {children}
    </button>
  );
}

export function PublicCtaAnchor({
  href,
  cta,
  surface,
  intent,
  plan_id,
  className,
  children,
  onClick,
  ...rest
}) {
  const attrs = publicCtaDataAttrs({ cta, surface, intent });
  const meta = { cta, surface, intent, ...(plan_id ? { plan_id } : {}) };

  return (
    <a
      href={href}
      className={className}
      onClick={bindPublicCtaClick(onClick, meta)}
      {...attrs}
      {...rest}
    >
      {children}
    </a>
  );
}
