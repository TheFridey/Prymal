import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { API_BASE_URL } from '../../lib/api';

export const FOUNDING_ACCESS_STORAGE_KEYS = {
  dismissed: 'prymal_founding_access_dismissed',
  shownSession: 'prymal_founding_access_shown_session',
  submitted: 'prymal_founding_access_lead_submitted',
};

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

export function useFoundingAccessOffer() {
  const { getToken, isLoaded } = useAuth();
  const [offer, setOffer] = useState(null);

  useEffect(() => {
    if (!isLoaded) {
      return undefined;
    }

    let active = true;

    fetchFoundingAccessOffer({ getToken })
      .then((result) => {
        if (active) {
          setOffer(result);
        }
      })
      .catch(() => {
        if (active) {
          setOffer({ active: false, offerKey: 'FOUNDING_ACCESS' });
        }
      });

    return () => {
      active = false;
    };
  }, [getToken, isLoaded]);

  return offer;
}

export function shouldShowFoundingAccessPopup({
  offer,
  sessionStorageRef = sessionStorage,
  localStorageRef = localStorage,
} = {}) {
  if (!offer?.active) {
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
