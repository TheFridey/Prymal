import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { db } = await import('../db/index.js');
const { getAgentMemory } = await import('./memory.js');

test('getAgentMemory prioritises user-scoped memory over org-scoped memory with the same key', async () => {
  const originalFindMany = db.query.agentMemory.findMany;
  const originalUpdate = db.update;

  db.query.agentMemory.findMany = async () => [
    { id: '1', scope: 'user', memoryType: 'preference', key: 'tone', value: 'casual', confidence: 0.9 },
    { id: '2', scope: 'org', memoryType: 'preference', key: 'tone', value: 'formal', confidence: 0.8 },
    { id: '3', scope: 'org', memoryType: 'fact', key: 'company', value: 'Prymal', confidence: 0.8 },
  ];
  db.update = () => ({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  });

  try {
    const result = await getAgentMemory({
      orgId: 'org_1',
      userId: 'user_1',
      agentId: 'cipher',
      limit: 10,
    });

    assert.equal(result.length, 2);
    assert.equal(result[0].value, 'casual');
    assert.equal(result[1].key, 'company');
  } finally {
    db.query.agentMemory.findMany = originalFindMany;
    db.update = originalUpdate;
  }
});

test('getAgentMemory prioritises temporary session memory over user and org memory', async () => {
  const originalFindMany = db.query.agentMemory.findMany;
  const originalUpdate = db.update;

  db.query.agentMemory.findMany = async () => [
    {
      id: 'temp_1',
      scope: 'temporary_session',
      scopeKey: 'session:conversation:abc',
      memoryType: 'instruction',
      key: 'session_goal',
      value: 'keep this response brief',
      confidence: 0.82,
      createdAt: new Date(),
      updatedAt: new Date(),
      sessionKey: 'conversation:abc',
    },
    {
      id: 'user_1',
      scope: 'user',
      scopeKey: 'user:user_1',
      memoryType: 'instruction',
      key: 'session_goal',
      value: 'default to full detail',
      confidence: 0.91,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'user_1',
    },
    {
      id: 'org_1',
      scope: 'org',
      scopeKey: 'org:org_1',
      memoryType: 'fact',
      key: 'company',
      value: 'Prymal',
      confidence: 0.8,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  db.update = () => ({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  });

  try {
    const result = await getAgentMemory({
      orgId: 'org_1',
      userId: 'user_1',
      agentId: 'cipher',
      sessionKey: 'conversation:abc',
      limit: 10,
    });

    assert.equal(result.length, 2);
    assert.equal(result[0].scope, 'temporary_session');
    assert.equal(result[0].value, 'keep this response brief');
    assert.equal(result[1].key, 'company');
  } finally {
    db.query.agentMemory.findMany = originalFindMany;
    db.update = originalUpdate;
  }
});

test('getAgentMemory includes workflow-run memory for agents permitted to read it', async () => {
  const originalFindMany = db.query.agentMemory.findMany;
  const originalUpdate = db.update;

  db.query.agentMemory.findMany = async () => [
    {
      id: 'workflow_1',
      scope: 'workflow_run',
      scopeKey: 'workflow:run_1',
      workflowRunId: 'run_1',
      memoryType: 'instruction',
      key: 'handoff_context',
      value: 'step 2 depends on the finance report',
      confidence: 0.87,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'org_1',
      scope: 'org',
      scopeKey: 'org:org_1',
      memoryType: 'fact',
      key: 'company',
      value: 'Prymal',
      confidence: 0.8,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  db.update = () => ({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  });

  try {
    const result = await getAgentMemory({
      orgId: 'org_1',
      userId: 'user_1',
      agentId: 'atlas',
      workflowRunId: 'run_1',
      limit: 10,
    });

    assert.equal(result.length, 2);
    assert.equal(result[0].scope, 'workflow_run');
    assert.equal(result[0].workflowRunId, 'run_1');
    assert.equal(result[1].scope, 'org');
  } finally {
    db.query.agentMemory.findMany = originalFindMany;
    db.update = originalUpdate;
  }
});


