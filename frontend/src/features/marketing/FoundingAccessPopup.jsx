import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Button, InlineNotice, TextInput } from '../../components/ui';
import {
  FOUNDING_ACCESS_STORAGE_KEYS,
  shouldShowFoundingAccessPopup,
  submitFoundingAccessLead,
} from './founding-access';

export function FoundingAccessPopup({ offer, surface = 'pricing' }) {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [triggerSource, setTriggerSource] = useState('delayed_popup');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);

  const ctaHref = isSignedIn ? '/app/settings?tab=Billing&offer=founding-access' : '/signup?offer=founding-access';
  const canShow = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return shouldShowFoundingAccessPopup({ offer });
  }, [offer]);

  useEffect(() => {
    if (!canShow) {
      return undefined;
    }

    const delayMs = 30_000 + Math.round(Math.random() * 15_000);
    const delayedId = window.setTimeout(() => {
      showPopup('delayed_popup');
    }, delayMs);

    const onMouseOut = (event) => {
      const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (!isDesktop || event.clientY > 24 || event.relatedTarget) {
        return;
      }
      showPopup('exit_intent');
    };

    document.addEventListener('mouseout', onMouseOut);

    return () => {
      window.clearTimeout(delayedId);
      document.removeEventListener('mouseout', onMouseOut);
    };
  }, [canShow]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function showPopup(source) {
    if (!shouldShowFoundingAccessPopup({ offer })) {
      return;
    }

    sessionStorage.setItem(FOUNDING_ACCESS_STORAGE_KEYS.shownSession, 'true');
    setTriggerSource(source);
    setOpen(true);
  }

  function dismiss() {
    sessionStorage.setItem(FOUNDING_ACCESS_STORAGE_KEYS.dismissed, 'true');
    setOpen(false);
  }

  async function submitLead(event) {
    event.preventDefault();
    if (!email.trim()) {
      setStatus({ tone: 'warning', message: 'Enter your email to join the Founding Access list.' });
      return;
    }

    try {
      const result = await submitFoundingAccessLead({
        email: email.trim(),
        source: triggerSource,
      });
      localStorage.setItem(FOUNDING_ACCESS_STORAGE_KEYS.submitted, 'true');
      setEmail('');
      setStatus({
        tone: 'success',
        message: result.message || 'You are on the Founding Access list. Create your account to claim it while access remains open.',
      });
    } catch (error) {
      setStatus({ tone: 'danger', message: error.message });
    }
  }

  if (!open || !offer?.active) {
    return null;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="founding-access-modal" role="dialog" aria-modal="true" aria-labelledby={`founding-access-${surface}-title`}>
      <div className="founding-access-modal__backdrop" onClick={dismiss} />
      <div className="founding-access-modal__panel">
        <button type="button" className="founding-access-modal__close" aria-label="Close" onClick={dismiss}>
          x
        </button>
        <div className="founding-access-modal__eyebrow">Founding Access</div>
        <h2 id={`founding-access-${surface}-title`}>Unlock Founding Access</h2>
        <p>
          Prymal Founding Access includes discounted subscription pricing during the founding window, a one-time onboarding
          execution bonus, a founder badge, and priority onboarding — standard monthly usage allowances still apply.
        </p>
        <form className="founding-access-modal__form" onSubmit={submitLead}>
          <TextInput
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            inputMode="email"
          />
          <Button tone="accent" type="submit">Join list</Button>
        </form>
        {status ? <InlineNotice tone={status.tone}>{status.message}</InlineNotice> : null}
        <div className="founding-access-modal__actions">
          <Link to={ctaHref} className="button button--accent" onClick={() => {
            sessionStorage.setItem(FOUNDING_ACCESS_STORAGE_KEYS.shownSession, 'true');
          }}>
            Unlock Founding Access
          </Link>
          <button type="button" className="founding-access-modal__secondary" onClick={dismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
