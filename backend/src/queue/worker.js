import { hasTriggerDevConfig } from './trigger.js';

if (hasTriggerDevConfig()) {
  console.log('Trigger.dev is configured. Run the Trigger.dev worker for remote workflow execution.');
} else {
  console.log('Trigger.dev is not configured. Prymal will execute workflow runs inline for local development.');
}
