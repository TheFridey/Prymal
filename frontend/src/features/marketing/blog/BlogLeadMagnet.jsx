import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { InlineNotice, TextInput } from '../../../components/ui';
import { api } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/utils';
import { PublicCtaButton } from '../../../components/PublicCta';

export function BlogLeadMagnet({ slug }) {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);

  const mutation = useMutation({
    mutationFn: async (nextEmail) =>
      api.post('/waitlist', { email: nextEmail, source: 'blog_lead_magnet' }),
    onSuccess: () => {
      setResult({
        tone: 'success',
        message: 'Template pack request received. We will email the workflow pack when the next wave goes out.',
      });
      setEmail('');
    },
    onError: (error) => {
      setResult({
        tone: 'danger',
        message: getErrorMessage(error, 'Unable to save your request right now.'),
      });
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    mutation.mutate(email.trim());
  };

  return (
    <section className="public-blog-lead-magnet" aria-labelledby="blog-lead-magnet-heading">
      <div className="public-section-block__eyebrow">Lead magnet</div>
      <h2 id="blog-lead-magnet-heading">AI workflow template pack</h2>
      <p>
        Get Prymal&apos;s starter workflow pack — reporting, outreach, launch, and support paths you can adapt inside
        NEXUS after signup.
      </p>
      <ul className="public-bullet-list public-blog-lead-magnet__list">
        <li>Weekly client reporting chain</li>
        <li>Lead intake to proposal handoff</li>
        <li>Support triage and response lane</li>
        <li>Launch campaign war-room pattern</li>
      </ul>
      <form className="public-blog-lead-magnet__form" onSubmit={handleSubmit}>
        <TextInput
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          inputMode="email"
          aria-label="Email for workflow template pack"
        />
        <PublicCtaButton
          type="submit"
          cta="lead-magnet"
          surface={`blog-${slug}-lead-magnet`}
          intent="convert"
          className="pm-btn pm-btn--primary"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Sending…' : 'Send me the pack'}
        </PublicCtaButton>
      </form>
      {result?.tone ? (
        <InlineNotice tone={result.tone} style={{ marginTop: 10 }}>
          {result.message}
        </InlineNotice>
      ) : null}
    </section>
  );
}
