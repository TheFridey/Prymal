import { vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import Trust from './Trust';

vi.mock('@clerk/clerk-react', () => ({
  SignedIn: () => null,
  SignedOut: ({ children }) => children,
}));

vi.mock('../features/marketing/MagicalCanvas', () => ({
  MagicalCanvas: () => null,
}));

test('public trust centre describes readiness without overclaiming certification', () => {
  const { container } = renderWithProviders(<Trust />);
  const text = container.textContent ?? '';

  expect(text).toContain('Trust Centre');
  expect(text).toContain('not a certification claim');
  expect(text).toContain('What Prymal stores');
  expect(text).toContain('WARDEN');
  expect(text).toContain('SENTINEL');
  expect(text).toContain('LORE memory and deletion controls');
  expect(text).toContain('Cyber Essentials');
  expect(text).toContain('ISO 27001');
  expect(text).toContain('privacy@prymal.io');
  expect(document.getElementById('schema-trust-faq')).toBeTruthy();
  expect(text).not.toMatch(/Prymal is (Cyber Essentials|Cyber Essentials Plus|ISO\/IEC 27001|ISO 27001) certified/i);
  expect(text).not.toMatch(/OpenAI|Anthropic|Gemini|Veo/i);
});
