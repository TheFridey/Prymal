import { vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import Changelog from './Changelog';

vi.mock('@clerk/clerk-react', () => ({
  SignedIn: () => null,
  SignedOut: ({ children }) => children,
}));

vi.mock('../features/marketing/MagicalCanvas', () => ({
  MagicalCanvas: () => null,
}));

test('public changelog keeps provider and model internals out of customer-facing copy', () => {
  const { container } = renderWithProviders(<Changelog />);
  const text = container.textContent ?? '';

  expect(text).toContain('Agent Contract Intelligence + Shared Memory');
  expect(text).not.toMatch(/OpenAI|Anthropic|Gemini|Veo/i);
  expect(text).not.toMatch(/provider fallback|policy key|route reason/i);
});
