import { vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import Trust from './Trust';

vi.mock('@clerk/clerk-react', () => ({
  SignedIn: ({ children }) => null,
  SignedOut: ({ children }) => children,
}));

vi.mock('../features/marketing/MagicalCanvas', () => ({
  MagicalCanvas: () => null,
}));

test('public trust page describes readiness without overclaiming certification', () => {
  const { container } = renderWithProviders(<Trust />);
  const text = container.textContent ?? '';

  expect(text).toContain('How Prymal handles trust in production');
  expect(text).toContain('not a certification claim');
  expect(text).not.toMatch(/Prymal is (Cyber Essentials|Cyber Essentials Plus|ISO\/IEC 27001|ISO 27001) certified/i);
  expect(text).not.toMatch(/OpenAI|Anthropic|Gemini|Veo/i);
});
