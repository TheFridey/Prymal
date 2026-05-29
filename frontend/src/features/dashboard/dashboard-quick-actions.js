import {
  TbBrain,
  TbMessageCircle,
  TbPlugConnected,
  TbRoute,
  TbChartBar,
  TbSparkles,
} from 'react-icons/tb';

export const DASHBOARD_QUICK_ACTIONS = [
  {
    id: 'ask_agent',
    title: 'Ask a specialist',
    benefit: 'Get a draft, plan, or answer in one thread.',
    route: '/app/agents/nexus?new=1',
    icon: TbMessageCircle,
  },
  {
    id: 'run_workflow',
    title: 'Run a workflow',
    benefit: 'Repeatable business process, not one-off chat.',
    route: '/app/workflows',
    icon: TbRoute,
  },
  {
    id: 'business_memory',
    title: 'Business Memory',
    benefit: 'Powered by LORE — ground agents in your context.',
    route: '/app/lore',
    icon: TbBrain,
  },
  {
    id: 'create_campaign',
    title: 'Create content or campaign',
    benefit: 'Brief-to-draft with specialist teammates.',
    route: '/app/workflows/catalogue',
    icon: TbSparkles,
  },
  {
    id: 'review_reporting',
    title: 'Review strategy & reporting',
    benefit: 'Turn data into decisions and client-ready output.',
    route: '/app/agents/cipher',
    icon: TbChartBar,
  },
  {
    id: 'connect_stack',
    title: 'Integrations & settings',
    benefit: 'Link tools and workspace controls.',
    route: '/app/integrations',
    icon: TbPlugConnected,
  },
];
