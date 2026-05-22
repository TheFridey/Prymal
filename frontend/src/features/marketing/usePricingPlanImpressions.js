import { useEffect, useRef } from 'react';
import { trackPricingPlanViewed } from '../../lib/analytics';

export function usePricingPlanImpressions(activeIntervalId) {
  const seenRef = useRef(new Set());

  useEffect(() => {
    seenRef.current.clear();
  }, [activeIntervalId]);

  useEffect(() => {
    const cards = document.querySelectorAll('[data-pricing-plan-id]');
    if (!cards.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
            return;
          }

          const planId = entry.target.getAttribute('data-pricing-plan-id');
          if (!planId || seenRef.current.has(planId)) {
            return;
          }

          seenRef.current.add(planId);
          trackPricingPlanViewed({ plan_id: planId, interval: activeIntervalId });
        });
      },
      { threshold: [0.5] },
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [activeIntervalId]);
}
