import { renderWithProviders } from '../test/renderWithProviders';
import { FAQSection } from './PublicContent';

test('FAQSection renders FAQPage JSON-LD', () => {
  renderWithProviders(
    <FAQSection
      title="FAQ"
      schemaId="faq-schema"
      items={[
        { question: 'What is Prymal?', answer: 'An AI operating system for business execution.' },
        { question: 'Does Prymal remember context?', answer: 'Yes, through shared business memory.' },
      ]}
    />,
  );

  const script = document.getElementById('faq-schema');
  expect(script).not.toBeNull();
  const schema = JSON.parse(script.textContent);
  expect(schema['@type']).toBe('FAQPage');
  expect(schema.mainEntity).toHaveLength(2);
  expect(schema.mainEntity[0].acceptedAnswer.text).toContain('AI operating system');
});
