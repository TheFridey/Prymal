import { Link } from 'react-router-dom';
import { TbBrain, TbCircleCheck, TbRoute, TbShieldCheck, TbSparkles } from 'react-icons/tb';
import { FIRST_RUN_OUTCOMES } from '../../lib/first-run-outcomes';

const WORKFLOW_PREVIEW = [
  { label: 'Brief', detail: 'Goal or trigger lands', Icon: TbSparkles, color: '#9cf5e0' },
  { label: 'Agents', detail: 'Specialists coordinate', Icon: TbSparkles, color: '#c77dff' },
  { label: 'Memory', detail: 'LORE adds context', Icon: TbBrain, color: '#ffd166' },
  { label: 'Validate', detail: 'SENTINEL reviews', Icon: TbShieldCheck, color: '#ff6b9a' },
];

const TRUST_LAYERS = [
  'WARDEN input screening',
  'LORE scoped memory',
  'SENTINEL output validation',
  'Tenant-isolated workspaces',
];

const FIVE_MINUTE_IDS = ['create_content', 'get_more_leads', 'analyse_data', 'automate_task'];

const FIVE_MINUTE_WINS = FIRST_RUN_OUTCOMES.filter((outcome) => FIVE_MINUTE_IDS.includes(outcome.id));

export function HomeProofStrip() {
  return (
    <section className="pm-proof-strip" aria-labelledby="home-proof-strip-heading">
      <div className="pm-proof-strip__intro">
        <div className="pm-section__eyebrow" style={{ '--section-accent': '#9cf5e0' }}>
          Proof in the product
        </div>
        <h2 id="home-proof-strip-heading" className="pm-section__title">
          From first task to validated output — without prompt chaos
        </h2>
        <p className="pm-section__sub">
          Prymal is an execution layer: workspace UI, workflow paths, trust controls, and quick wins you can reach in minutes.
        </p>
      </div>

      <div className="pm-proof-strip__grid">
        <article className="pm-proof-strip__panel">
          <span className="pm-proof-strip__label">Product workspace</span>
          <div className="pm-proof-strip__mock" aria-hidden="true">
            <div className="pm-proof-strip__mock-bar">
              <span />
              <span />
              <span />
            </div>
            <div className="pm-proof-strip__mock-body">
              <div className="pm-proof-strip__mock-sidebar">
                <span>Agents</span>
                <span>LORE</span>
                <span>NEXUS</span>
              </div>
              <div className="pm-proof-strip__mock-main">
                <div className="pm-proof-strip__mock-line pm-proof-strip__mock-line--short" />
                <div className="pm-proof-strip__mock-line" />
                <div className="pm-proof-strip__mock-bubble">Validated client-ready output</div>
              </div>
            </div>
          </div>
          <p>One workspace for agents, memory, workflows, and reviewed outputs — not a stack of disconnected chats.</p>
        </article>

        <article className="pm-proof-strip__panel">
          <span className="pm-proof-strip__label">Execution workflow</span>
          <ol className="pm-proof-strip__flow">
            {WORKFLOW_PREVIEW.map(({ label, detail, Icon, color }) => (
              <li key={label} style={{ '--flow-color': color }}>
                <span className="pm-proof-strip__flow-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
              </li>
            ))}
          </ol>
          <p>
            <TbRoute aria-hidden="true" />
            NEXUS orchestrates multi-step runs so work repeats safely instead of restarting in chat each time.
          </p>
        </article>

        <article className="pm-proof-strip__panel">
          <span className="pm-proof-strip__label">Trust layer</span>
          <ul className="pm-proof-strip__trust">
            {TRUST_LAYERS.map((item) => (
              <li key={item}>
                <TbCircleCheck aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <p>
            Readiness-first controls and evidence preparation — precise language, not premature certification claims.
            {' '}
            <Link to="/trust" className="pm-proof-strip__link">Open Trust Centre</Link>
          </p>
        </article>

        <article className="pm-proof-strip__panel">
          <span className="pm-proof-strip__label">What you can do in 5 minutes</span>
          <ul className="pm-proof-strip__wins">
            {FIVE_MINUTE_WINS.map((outcome) => (
              <li key={outcome.id}>
                <span className="pm-proof-strip__win-time">{outcome.timeToResult}</span>
                <span>
                  <strong>{outcome.title}</strong>
                  <small>{outcome.plainOutcome}</small>
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
