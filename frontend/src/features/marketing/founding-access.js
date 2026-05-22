import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { API_BASE_URL } from '../../lib/api';

export const FOUNDING_ACCESS_STORAGE_KEYS = {
  dismissed: 'prymal_founding_access_dismissed',
  shownSession: 'prymal_founding_access_shown_session',
  submitted: 'prymal_founding_access_lead_submitted',
};

/** When true (build env), `/pricing` always shows founding-tier amounts from constants (checkout still validates server-side). */
export function isFoundingPricingUiForced() {
  return import.meta.env.VITE_FORCE_FOUNDING_PRICING_UI === 'true';
}

/**
 * Whether the marketing site should render founding prices (cards, banner).
 * In development, treats loading as founder-pricing-visible so localhost without a cold API does not flash list prices.
 */
export function shouldShowFoundingPricingUi({ status, offer }) {
  if (import.meta.env.DEV && status === 'loading') {
    return true;
  }
  if (status !== 'ready') {
    return isFoundingPricingUiForced();
  }
  if (!offer) {
    return isFoundingPricingUiForced();
  }
  return Boolean(offer.active) || isFoundingPricingUiForced();
}

export async function fetchFoundingAccessOffer({ getToken } = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  const token = await getToken?.();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}/public/offers/founding-access`, { headers });

  if (!response.ok) {
    throw new Error('Unable to load Founding Access.');
  }

  return response.json();
}

export async function submitFoundingAccessLead({ email, source }) {
  const response = await fetch(`${API_BASE_URL}/public/offers/founding-access/leads`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, source }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || 'Unable to save Founding Access lead.');
  }

  return data;
}

export function useFoundingAccessOffer({ delayMs = 0 } = {}) {
  const { getToken, isLoaded } = useAuth();
  const [state, setState] = useState({ status: 'idle', offer: null });

  useEffect(() => {
    if (!isLoaded) {
      return undefined;
    }

    let cancelled = false;
    let delayId = 0;

    setState({ status: 'loading', offer: null });

    const loadOffer = () => fetchFoundingAccessOffer({ getToken })
      .then((result) => {
        if (!cancelled) {
          setState({ status: 'ready', offer: result });
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (import.meta.env.DEV) {
            setState({
              status: 'ready',
              offer: {
                active: true,
                offerKey: 'FOUNDING_ACCESS',
                devPricingUnavailable: true,
              },
            });
          } else {
            setState({
              status: 'ready',
              offer: isFoundingPricingUiForced()
                ? { active: true, offerKey: 'FOUNDING_ACCESS', pricingUiForced: true }
                : { active: false, offerKey: 'FOUNDING_ACCESS' },
            });
          }
        }
      });

    if (delayMs > 0) {
      delayId = window.setTimeout(loadOffer, delayMs);
    } else {
      loadOffer();
    }

    return () => {
      cancelled = true;
      if (delayId) {
        window.clearTimeout(delayId);
      }
    };
  }, [delayMs, getToken, isLoaded]);

  return state;
}

export function shouldShowFoundingAccessPopup({
  offer,
  sessionStorageRef = sessionStorage,
  localStorageRef = localStorage,
} = {}) {
  if (!offer?.active) {
    return false;
  }

  if (offer.devPricingUnavailable) {
    return false;
  }

  if (offer.viewer?.isPayingSubscriber) {
    return false;
  }

  if (sessionStorageRef.getItem(FOUNDING_ACCESS_STORAGE_KEYS.shownSession) === 'true') {
    return false;
  }

  if (sessionStorageRef.getItem(FOUNDING_ACCESS_STORAGE_KEYS.dismissed) === 'true') {
    return false;
  }

  if (localStorageRef.getItem(FOUNDING_ACCESS_STORAGE_KEYS.submitted) === 'true') {
    return false;
  }

  return true;
}
