import { renderWithProviders } from '../../test/renderWithProviders';
import { HomeProofStrip } from './HomeProofStrip';
import { PricingPageContent } from './PricingPageContent';
import { PLAN_DECISION_HELPERS, PRICING_OBJECTION_CARDS } from '../../lib/pricing-conversion';

vi.mock('@clerk/clerk-react', () => ({
  SignedIn: () => null,
  SignedOut: ({ children }) => children,
  useAuth: () => ({ isSignedIn: false }),
}));

test('HomeProofStrip renders proof panels and five-minute wins', () => {
  const { container } = renderWithProviders(<HomeProofStrip />);
  const text = container.textContent ?? '';

  expect(text).toContain('Product workspace');
  expect(text).toContain('Execution workflow');
  expect(text).toContain('Trust layer');
  expect(text).toContain('What you can do in 5 minutes');
  expect(text).toContain('Create content');
  expect(text).toContain('Validated client-ready output');
});

test('PricingPageContent renders plan decision helpers and objection cards', () => {
  const { container } = renderWithProviders(<PricingPageContent foundingAccessState={{ status: 'idle', offer: null }} />);
  const text = container.textContent ?? '';

  expect(text).toContain('Recommended starter plan');
  expect(text).toContain('Best for');
  expect(text).toContain(PLAN_DECISION_HELPERS.pro.bestFor);
  expect(text).toContain('Questions before you choose');

  PRICING_OBJECTION_CARDS.forEach((item) => {
    expect(text).toContain(item.title);
  });
});

test('pricing CTAs expose tracking attributes', () => {
  const { container } = renderWithProviders(
    <PricingPageContent foundingAccessState={{ status: 'idle', offer: null }} />,
  );

  const heroCta = container.querySelector('[data-surface="pricing-hero"][data-cta="signup"]');
  expect(heroCta).not.toBeNull();
  expect(heroCta).toHaveAttribute('data-intent', 'convert');
});
