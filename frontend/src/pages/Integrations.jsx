import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { API_BASE_URL, api } from '../lib/api';
import { INTEGRATION_LIBRARY, INTEGRATION_SECTIONS } from '../lib/constants';
import { getErrorMessage } from '../lib/utils';
import {
  Button,
  InlineNotice,
  PageHeader,
  PageShell,
  StatGrid,
  StatusPill,
  SurfaceCard,
  TextArea,
  TextInput,
} from '../components/ui';
import IntegrationLogo, { getIntegrationLogoPresentation } from '../components/IntegrationLogo';
import { useAppStore } from '../stores/useAppStore';

const TARGET_SETTING_KEYS = [
  'defaultChannelId',
  'defaultChatId',
  'authorUrn',
  'endpointUrl',
  'defaultRecipientEmail',
  'defaultFromEmail',
  'blueskyIdentifier',
];

export default function Integrations() {
  const [searchParams] = useSearchParams();
  const notify = useAppStore((state) => state.addNotification);
  const queryClient = useQueryClient();
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [cardPanels, setCardPanels] = useState({});
  const [connectionDrafts, setConnectionDrafts] = useState({});
  const [publishDrafts, setPublishDrafts] = useState({});

  const integrationsQuery = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.get('/integrations'),
  });

  const available = integrationsQuery.data?.available ?? [];
  const connected = integrationsQuery.data?.connected ?? [];

  const connectedMap = useMemo(
    () => Object.fromEntries(connected.map((entry) => [entry.service, entry])),
    [connected],
  );

  const providers = useMemo(
    () =>
      available.map((provider) => {
        const libraryEntry = INTEGRATION_LIBRARY[provider.id] ?? {};
        return {
          ...libraryEntry,
          ...provider,
          section: provider.section ?? libraryEntry.section ?? inferSectionId(provider.category),
          setupSteps: libraryEntry.setupSteps ?? [],
          setupLinks: libraryEntry.setupLinks ?? [],
          agentIds: libraryEntry.agentIds ?? [],
        };
      }),
    [available],
  );

  useEffect(() => {
    if (providers.length === 0) {
      return;
    }

    setConnectionDrafts((current) => {
      const next = { ...current };
      for (const provider of providers) {
        if (!next[provider.id]) {
          next[provider.id] = createConnectionDraft(connectedMap[provider.id]);
        }
      }
      return next;
    });

    setPublishDrafts((current) => {
      const next = { ...current };
      for (const provider of providers) {
        if (!next[provider.id]) {
          next[provider.id] = createPublishDraft(provider, connectedMap[provider.id]);
        }
      }
      return next;
    });
  }, [providers, connectedMap]);

  const sectionedProviders = useMemo(
    () =>
      INTEGRATION_SECTIONS.map((section) => ({
        ...section,
        providers: providers
          .filter((provider) => provider.section === section.id)
          .sort((left, right) => sortProviders(left, right, connectedMap)),
      })).filter((section) => section.providers.length > 0),
    [providers, connectedMap],
  );

  useEffect(() => {
    if (sectionedProviders.length === 0) {
      setActiveSectionId(null);
      return;
    }

    setActiveSectionId((current) =>
      sectionedProviders.some((section) => section.id === current) ? current : sectionedProviders[0].id,
    );
  }, [sectionedProviders]);

  const activeSection = useMemo(
    () => sectionedProviders.find((section) => section.id === activeSectionId) ?? sectionedProviders[0] ?? null,
    [activeSectionId, sectionedProviders],
  );

  const connectedProviders = useMemo(
    () =>
      providers
        .filter((provider) => connectedMap[provider.id])
        .sort((left, right) => sortProviders(left, right, connectedMap)),
    [providers, connectedMap],
  );

  const invalidateIntegrations = async () => {
    await queryClient.invalidateQueries({ queryKey: ['integrations'] });
  };

  const disconnectMutation = useMutation({
    mutationFn: (service) => api.delete(`/integrations/${service}`),
    onSuccess: async (_, service) => {
      await invalidateIntegrations();
      notify({
        type: 'success',
        title: 'Integration disconnected',
        message: `${INTEGRATION_LIBRARY[service]?.name ?? service} was marked inactive for this organisation.`,
      });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Disconnect failed', message: getErrorMessage(error) });
    },
  });

  const manualSaveMutation = useMutation({
    mutationFn: ({ service, payload }) => api.post(`/integrations/${service}/manual`, payload),
    onSuccess: async (result, variables) => {
      await invalidateIntegrations();
      setConnectionDrafts((current) => ({
        ...current,
        [variables.service]: createConnectionDraft(result.connection),
      }));
      notify({
        type: 'success',
        title: result.verified ? 'Integration verified' : 'Integration saved',
        message:
          result.test?.message
          ?? `${INTEGRATION_LIBRARY[variables.service]?.name ?? variables.service} is ready for this organisation.`,
      });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Connection failed', message: getErrorMessage(error) });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: ({ service, payload }) => api.patch(`/integrations/${service}/settings`, payload),
    onSuccess: async (result, variables) => {
      await invalidateIntegrations();
      setConnectionDrafts((current) => ({
        ...current,
        [variables.service]: createConnectionDraft(result.connection),
      }));
      notify({
        type: 'success',
        title: 'Defaults updated',
        message: `${INTEGRATION_LIBRARY[variables.service]?.name ?? variables.service} defaults were saved.`,
      });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Save failed', message: getErrorMessage(error) });
    },
  });

  const testMutation = useMutation({
    mutationFn: (service) => api.post(`/integrations/${service}/test`, {}),
    onSuccess: async (result, service) => {
      await invalidateIntegrations();
      notify({
        type: 'success',
        title: 'Connection healthy',
        message: result.test?.message ?? `${INTEGRATION_LIBRARY[service]?.name ?? service} responded successfully.`,
      });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Test failed', message: getErrorMessage(error) });
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ service, payload }) => api.post(`/integrations/${service}/publish`, payload),
    onSuccess: async (result, variables) => {
      await invalidateIntegrations();
      setPublishDrafts((current) => ({
        ...current,
        [variables.service]: {
          ...createPublishDraft(
            providers.find((entry) => entry.id === variables.service) ?? { id: variables.service },
            result.connection,
          ),
          targetId: current[variables.service]?.targetId ?? '',
        },
      }));
      notify({
        type: 'success',
        title: 'Delivery logged',
        message:
          result.delivery?.target
            ? `Published to ${result.delivery.target}.`
            : `${INTEGRATION_LIBRARY[variables.service]?.name ?? variables.service} accepted the delivery.`,
      });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Publish failed', message: getErrorMessage(error) });
    },
  });

  useEffect(() => {
    const connectedService = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connectedService) {
      notify({
        type: 'success',
        title: 'Integration connected',
        message: `${INTEGRATION_LIBRARY[connectedService]?.name ?? connectedService} is now available to the current organisation.`,
      });
    }

    if (error) {
      notify({ type: 'error', title: 'OAuth failed', message: formatIntegrationOauthError(error) });
    }
  }, [notify, searchParams]);

  const stats = [
    {
      label: 'Connected Accounts',
      value: connected.length,
      helper: 'Org-scoped integrations currently active',
      accent: '#00FFD1',
    },
    {
      label: 'Publish Lanes',
      value: providers.filter((provider) => provider.supportsPublish).length,
      helper: 'Providers with live outbound delivery routes',
      accent: '#4CC9F0',
    },
    {
      label: 'Sections Live',
      value: sectionedProviders.filter((section) =>
        section.providers.some((provider) => Boolean(connectedMap[provider.id])),
      ).length,
      helper: 'Categories with at least one linked account',
      accent: '#BDB4FE',
    },
    {
      label: 'Delivery Receipts',
      value: connected.reduce((total, entry) => total + Number(entry.meta?.publishStats?.total ?? 0), 0),
      helper: 'Recent outbound confirmations stored back inside Prymal',
      accent: '#F59E0B',
    },
  ];

  return (
    <PageShell>
      <div className="integrations-page">
        <PageHeader
          eyebrow="Integrations"
          title="Link the full account stack without losing the plot"
          description="The integrations layer is now organised into cleaner tabbed sections so teams can move through socials, messaging, emails, files, knowledge systems, and custom endpoints without fighting the interface."
          accent="#00FFD1"
        />

        <StatGrid items={stats} />

        <SurfaceCard accent="#00FFD1">
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <div style={sectionTitleStyle}>Recommended linking flow</div>
              <div style={helperTextStyle}>
                Start with the channels your team uses every day, save org defaults once, run a health check, then turn on live publishing only where the delivery path is already proven.
              </div>
            </div>

            <div className="integrations-flow-grid">
              <FlowStep number="1" title="Connect" text="Paste tokens or start OAuth from the right workspace." />
              <FlowStep number="2" title="Default" text="Save channels, chats, recipients, or author IDs once per org." />
              <FlowStep number="3" title="Test" text="Verify the exact account and health state before automation." />
              <FlowStep number="4" title="Publish" text="Send live posts or email and keep receipts inside Prymal." />
            </div>
          </div>
        </SurfaceCard>

        <InlineNotice tone="default">
          OAuth providers only appear as ready-to-connect when the server has the right credentials. Manual-token providers store secrets encrypted server-side, expose test actions, and keep default targets and delivery receipts scoped to the current organisation.
        </InlineNotice>

        {integrationsQuery.isError ? (
          <InlineNotice tone="danger">
            {getErrorMessage(integrationsQuery.error)}
          </InlineNotice>
        ) : null}

        {connectedProviders.length > 0 ? (
          <SurfaceCard title="Connected stack" accent="#4CC9F0">
            <div className="integrations-connected-grid">
              {connectedProviders.map((provider) => {
                const connection = connectedMap[provider.id];
                const logoTheme = getIntegrationLogoPresentation(provider.id, provider.color);
                return (
                  <div key={provider.id} className="integrations-connected-chip">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div className="integrations-logo-badge" style={createLogoBadgeVars(provider.color, logoTheme)}>
                        <IntegrationLogo
                          service={provider.id}
                          color={logoTheme.iconColor ?? provider.color}
                          size={18}
                          title={provider.name}
                        />
                      </div>
                      <div style={{ display: 'grid', gap: '2px', minWidth: 0 }}>
                        <span style={{ color: 'var(--text-strong)', fontSize: '13px' }}>{provider.name}</span>
                        <span className="integrations-secondary-text">
                          {connection.accountEmail || connection.meta?.profile?.handle || connection.accountId || 'Connected'}
                        </span>
                      </div>
                    </div>
                    <StatusPill color={resolveHealthColor(connection.meta?.health?.status)}>
                      {connection.meta?.health?.status ?? 'linked'}
                    </StatusPill>
                  </div>
                );
              })}
            </div>
          </SurfaceCard>
        ) : null}

        {sectionedProviders.length > 0 ? (
          <SurfaceCard accent={activeSection?.accent ?? '#4CC9F0'} className="integrations-tabs-card">
            <div className="integrations-tabs" role="tablist" aria-label="Integration sections">
              {sectionedProviders.map((section) => {
                const connectedCount = section.providers.filter((provider) => Boolean(connectedMap[provider.id])).length;
                const isActive = section.id === activeSection?.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`integrations-tab${isActive ? ' is-active' : ''}`}
                    onClick={() => setActiveSectionId(section.id)}
                    style={createTabVars(section.accent)}
                  >
                    <span className="integrations-tab__eyebrow">{section.label}</span>
                    <span className="integrations-tab__title">{section.description}</span>
                    <span className="integrations-tab__meta">
                      {section.providers.length} provider{section.providers.length === 1 ? '' : 's'} | {connectedCount} connected
                    </span>
                  </button>
                );
              })}
            </div>
          </SurfaceCard>
        ) : null}

        {activeSection ? (
          <IntegrationSection
            section={activeSection}
            connectedMap={connectedMap}
            cardPanels={cardPanels}
            setCardPanels={setCardPanels}
            connectionDrafts={connectionDrafts}
            setConnectionDrafts={setConnectionDrafts}
            publishDrafts={publishDrafts}
            setPublishDrafts={setPublishDrafts}
            manualSaveMutation={manualSaveMutation}
            settingsMutation={settingsMutation}
            testMutation={testMutation}
            publishMutation={publishMutation}
            disconnectMutation={disconnectMutation}
          />
        ) : null}

        <SurfaceCard title="What feeds back into Prymal?" accent="#BDB4FE">
          <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
            Every successful health check and outbound delivery writes an org-scoped receipt back onto the integration record. That gives the workspace a live view of defaults, account health, recent deliveries, and the last touchpoint instead of treating integrations like a one-time connect screen.
          </div>
        </SurfaceCard>
      </div>
    </PageShell>
  );
}

function IntegrationSection({
  section,
  connectedMap,
  cardPanels,
  setCardPanels,
  connectionDrafts,
  setConnectionDrafts,
  publishDrafts,
  setPublishDrafts,
  manualSaveMutation,
  settingsMutation,
  testMutation,
  publishMutation,
  disconnectMutation,
}) {
  const connectedCount = section.providers.filter((provider) => Boolean(connectedMap[provider.id])).length;
  const publishCount = section.providers.filter((provider) => provider.supportsPublish).length;

  return (
    <section className="integrations-section">
      <div className="integrations-section__header">
        <div style={{ display: 'grid', gap: '6px', minWidth: 0 }}>
          <div style={{ color: section.accent, fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            {section.label}
          </div>
          <div style={{ color: 'var(--muted)', lineHeight: 1.7 }}>{section.description}</div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <StatusPill color={section.accent}>{section.providers.length} providers</StatusPill>
          <StatusPill color="#00FFD1">{connectedCount} connected</StatusPill>
          {publishCount ? <StatusPill color="#F59E0B">{publishCount} live lanes</StatusPill> : null}
        </div>
      </div>

      <div className="integrations-section__grid">
        {section.providers.map((provider) => (
          <IntegrationProviderCard
            key={provider.id}
            provider={provider}
            connection={connectedMap[provider.id]}
            draft={connectionDrafts[provider.id] ?? createConnectionDraft(connectedMap[provider.id])}
            publishDraft={publishDrafts[provider.id] ?? createPublishDraft(provider, connectedMap[provider.id])}
            panelState={cardPanels[provider.id] ?? null}
            setCardPanels={setCardPanels}
            setConnectionDrafts={setConnectionDrafts}
            setPublishDrafts={setPublishDrafts}
            manualSaveMutation={manualSaveMutation}
            settingsMutation={settingsMutation}
            testMutation={testMutation}
            publishMutation={publishMutation}
            disconnectMutation={disconnectMutation}
          />
        ))}
      </div>
    </section>
  );
}

function IntegrationProviderCard({
  provider,
  connection,
  draft,
  publishDraft,
  panelState,
  setCardPanels,
  setConnectionDrafts,
  setPublishDrafts,
  manualSaveMutation,
  settingsMutation,
  testMutation,
  publishMutation,
  disconnectMutation,
}) {
  const isManual = provider.authMode === 'manual_token';
  const isConnected = Boolean(connection);
  const needsReconnect = Boolean(connection?.meta?.needsReconnect);
  const linkedInPostingNotReady = provider.id === 'linkedin' && Boolean(connection?.postingNotReady);
  const publishDisabled = Boolean(needsReconnect || connection?.publishDisabled || linkedInPostingNotReady);
  const logoTheme = getIntegrationLogoPresentation(provider.id, provider.color);
  const needsServerConfig = provider.authMode === 'oauth' && !provider.configured;
  const deliveryCount = Number(connection?.meta?.publishStats?.total ?? 0);
  const defaultTarget = resolveDefaultTarget(provider, connection?.meta?.settings ?? {});
  const pendingManualSave = manualSaveMutation.isPending && manualSaveMutation.variables?.service === provider.id;
  const pendingSettingsSave = settingsMutation.isPending && settingsMutation.variables?.service === provider.id;
  const pendingTest = testMutation.isPending && testMutation.variables === provider.id;
  const pendingPublish = publishMutation.isPending && publishMutation.variables?.service === provider.id;
  const pendingDisconnect = disconnectMutation.isPending && disconnectMutation.variables === provider.id;
  const isGuideOpen = panelState === 'guide';
  const isFormOpen = panelState === 'form';
  const isManageOpen = panelState === 'manage';
  const isExpanded = isGuideOpen || isFormOpen || (isManageOpen && isConnected);

  return (
    <SurfaceCard accent={provider.color}>
      <div style={{ display: 'grid', gap: '16px' }}>
        <div className="integrations-provider-header">
          <div className="integrations-provider-summary">
            <div className="integrations-provider-brand">
              <div className="integrations-logo-badge" style={createLogoBadgeVars(provider.color, logoTheme)}>
                <IntegrationLogo
                  service={provider.id}
                  color={logoTheme.iconColor ?? provider.color}
                  size={22}
                  title={provider.name}
                />
              </div>
              <div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
                <div style={{ color: provider.color, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                  {provider.category}
                </div>
                <div style={{ fontSize: '19px', color: 'var(--text-strong)' }}>{provider.name}</div>
              </div>
            </div>
            <div style={{ color: 'var(--muted)', lineHeight: 1.75, minWidth: 0 }}>{provider.description}</div>
          </div>

          <div className="integrations-provider-header__status">
            <StatusPill color={isConnected ? '#00FFD1' : '#98A2B3'}>
              {isConnected ? 'Connected' : 'Not linked'}
            </StatusPill>
          </div>
        </div>

        <div className="integrations-chip-row">
          <StatusPill color={needsServerConfig ? '#98A2B3' : '#4CC9F0'}>
            {resolveAuthModeLabel(provider, needsServerConfig)}
          </StatusPill>
          {needsReconnect ? <StatusPill color="#F59E0B">Reconnect required</StatusPill> : null}
          {linkedInPostingNotReady ? <StatusPill color="#F59E0B">Posting not ready</StatusPill> : null}
          {provider.supportsPublish ? <StatusPill color="#F59E0B">Live delivery</StatusPill> : null}
          {provider.supportsImagePublish ? <StatusPill color="#BDB4FE">Image-ready</StatusPill> : null}
        </div>

        {provider.capabilities?.length ? (
          <div className="integrations-chip-row">
            {provider.capabilities.map((capability) => (
              <span key={capability} style={capabilityChipStyle}>
                {capability.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        ) : null}

        {provider.agentIds?.length ? (
          <div className="integrations-chip-row">
            {provider.agentIds.map((agentId) => (
              <span key={agentId} style={agentChipStyle}>
                {agentId.toUpperCase()}
              </span>
            ))}
          </div>
        ) : null}

        {isConnected ? (
          <div style={{ display: 'grid', gap: '6px' }}>
            <IntegrationInfoRow
              label="Account"
              value={connection.accountEmail || connection.meta?.profile?.handle || connection.accountId || 'Connected'}
            />
            <IntegrationInfoRow label="Health" value={connection.meta?.health?.message || 'No recent connection check yet.'} />
            <IntegrationInfoRow label="Default target" value={defaultTarget || 'No org default saved'} />
            <IntegrationInfoRow
              label="Deliveries"
              value={`${deliveryCount} receipt${deliveryCount === 1 ? '' : 's'} stored`}
            />
            {needsReconnect ? (
              <InlineNotice tone="warning">
                {connection.meta?.reconnectMessage ?? 'This integration needs to be reconnected before Prymal can use it.'}
              </InlineNotice>
            ) : null}
            {linkedInPostingNotReady ? (
              <InlineNotice tone="warning">
                Connected for identity. Posting requires LinkedIn posting permissions.
              </InlineNotice>
            ) : null}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {needsServerConfig ? (
              <InlineNotice tone="default">
                This OAuth lane is hidden behind server credentials. Add the provider client ID and secret on the backend before linking it from the workspace.
              </InlineNotice>
            ) : null}
            <div className="integrations-connect-hint">
              Click <span style={{ color: 'var(--text-strong)' }}>Connect</span> to open setup guidance and the relevant portal links for this provider.
            </div>
          </div>
        )}

        <div className="integrations-action-row">
          {isManual ? (
            <Button
              tone={isExpanded ? 'ghost' : 'accent'}
              onClick={() => toggleCardPanel(provider.id, isConnected ? 'manage' : 'guide', setCardPanels)}
              aria-expanded={isExpanded}
              className="integrations-action-button"
            >
              {isExpanded ? 'Hide controls' : isConnected ? 'Manage' : 'Connect'}
            </Button>
          ) : isConnected ? (
            <Button
              tone={isExpanded ? 'ghost' : 'accent'}
              onClick={() => toggleCardPanel(provider.id, 'manage', setCardPanels)}
              aria-expanded={isExpanded}
              className="integrations-action-button"
            >
              {isExpanded ? 'Hide controls' : 'Manage'}
            </Button>
          ) : (
            <Button
              tone="accent"
              onClick={() => toggleCardPanel(provider.id, 'guide', setCardPanels)}
              disabled={needsServerConfig}
              aria-expanded={isGuideOpen}
              className="integrations-action-button"
            >
              {needsServerConfig ? 'Server config needed' : 'Connect'}
            </Button>
          )}

          {isConnected ? (
            <>
              <Button
                tone="ghost"
                onClick={() => testMutation.mutate(provider.id)}
                disabled={pendingTest || needsReconnect}
                className="integrations-action-button"
              >
                {pendingTest ? 'Testing...' : 'Test'}
              </Button>
              <Button
                tone="danger"
                onClick={() => disconnectMutation.mutate(provider.id)}
                disabled={pendingDisconnect}
                className="integrations-action-button"
              >
                {pendingDisconnect ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </>
          ) : null}
        </div>

        {isExpanded ? (
          <div className="integrations-expanded-panel">
            {!isConnected && isGuideOpen ? (
              <ConnectGuidePanel
                provider={provider}
                onContinue={() => {
                  if (provider.authMode === 'oauth') {
                    window.location.assign(`${API_BASE_URL}/integrations/${provider.id}/connect`);
                    return;
                  }
                  openCardPanel(provider.id, 'form', setCardPanels);
                }}
                onClose={() => closeCardPanel(provider.id, setCardPanels)}
              />
            ) : null}

            {isManual && (isConnected || isFormOpen || isManageOpen) ? (
              <ManualConnectionPanel
                provider={provider}
                connection={connection}
                draft={draft}
                pending={pendingManualSave}
                onDraftChange={(nextDraft) => setConnectionDraft(provider.id, nextDraft, setConnectionDrafts)}
                onSave={() =>
                  manualSaveMutation.mutate({
                    service: provider.id,
                    payload: {
                      accessToken: draft.accessToken?.trim() ?? '',
                      settings: draft.settings ?? {},
                      verifyOnSave: true,
                    },
                  })
                }
              />
            ) : null}

            {!isManual && isConnected && isManageOpen ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <div style={sectionTitleStyle}>OAuth controls</div>
                  <div style={helperTextStyle}>
                    Keep the connected workspace stable, save outbound defaults where the provider supports them, and reconnect only when you need to refresh the grant.
                  </div>
                </div>

                {provider.settingsFields?.length ? (
                  <OauthSettingsPanel
                    provider={provider}
                    connection={connection}
                    draft={draft}
                    pending={pendingSettingsSave}
                    onDraftChange={(nextDraft) => setConnectionDraft(provider.id, nextDraft, setConnectionDrafts)}
                    onSave={() =>
                      settingsMutation.mutate({
                        service: provider.id,
                        payload: { settings: draft.settings ?? {} },
                      })
                    }
                  />
                ) : null}

                <div className="integrations-action-row">
                  <Button
                    tone="ghost"
                    onClick={() => window.location.assign(`${API_BASE_URL}/integrations/${provider.id}/connect`)}
                    disabled={needsServerConfig}
                    className="integrations-action-button"
                  >
                    {provider.id === 'linkedin' ? 'Reconnect LinkedIn' : 'Reconnect OAuth'}
                  </Button>
                </div>
              </div>
            ) : null}

            {isConnected && provider.supportsPublish ? (
              <PublishPanel
                provider={provider}
                draft={publishDraft}
                connection={connection}
                pending={pendingPublish}
                onDraftChange={(nextDraft) => setPublishDraft(provider.id, nextDraft, setPublishDrafts)}
                onPublish={() =>
                  publishMutation.mutate({
                    service: provider.id,
                    payload: {
                      title: publishDraft.title || undefined,
                      text: publishDraft.text,
                      linkUrl: publishDraft.linkUrl || undefined,
                      imageUrl: publishDraft.imageUrl || undefined,
                      targetId: publishDraft.targetId || undefined,
                    },
                  })
                }
                disabled={publishDisabled}
              />
            ) : null}

            {isConnected && connection.meta?.recentDeliveries?.length ? (
              <DeliveryHistory deliveries={connection.meta.recentDeliveries} />
            ) : null}
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

function FlowStep({ number, title, text }) {
  return (
    <div className="integrations-flow-step">
      <div className="integrations-flow-step__number">{number}</div>
      <div style={{ display: 'grid', gap: '4px' }}>
        <div style={{ color: 'var(--text-strong)', fontSize: '14px', fontWeight: 700 }}>{title}</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.7 }}>{text}</div>
      </div>
    </div>
  );
}

function ConnectGuidePanel({ provider, onContinue, onClose }) {
  const hasPortalLinks = provider.setupLinks?.length > 0;
  const continueLabel = provider.id === 'linkedin'
    ? 'Connect LinkedIn'
    : provider.authMode === 'oauth'
      ? 'Continue to provider'
      : 'Open credential form';

  return (
    <div className="integrations-connect-guide">
      <div className="integrations-connect-guide__head">
        <div style={{ display: 'grid', gap: '4px' }}>
          <div style={sectionTitleStyle}>Connect guide</div>
          <div style={helperTextStyle}>
            Follow the provider setup from the correct workspace, then come back here to finish the link.
          </div>
        </div>

        <button type="button" className="integrations-connect-guide__dismiss" onClick={onClose} aria-label="Close guide">
          Close
        </button>
      </div>

      {provider.setupSteps?.length ? (
        <div style={{ display: 'grid', gap: '10px' }}>
          {provider.setupSteps.map((step, index) => (
            <div key={`${provider.id}-step-${index}`} style={stepRowStyle}>
              <div style={stepBadgeStyle}>{index + 1}</div>
              <div style={helperTextStyle}>{step}</div>
            </div>
          ))}
        </div>
      ) : null}

      {hasPortalLinks ? (
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={sectionTitleStyle}>Helpful links</div>
          <div className="integrations-connect-guide__links">
            {provider.setupLinks.map((link) => (
              <a
                key={`${provider.id}-${link.href}`}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="integrations-connect-guide__link"
              >
                <span className="integrations-connect-guide__link-label">{link.label}</span>
                {link.description ? (
                  <span className="integrations-connect-guide__link-description">{link.description}</span>
                ) : null}
              </a>
            ))}
          </div>
        </div>
      ) : (
        <InlineNotice tone="default">
          This provider does not need an external developer portal link. Continue to the form and save the credentials directly inside Prymal.
        </InlineNotice>
      )}

      <div className="integrations-connect-guide__actions">
        <Button tone="accent" onClick={onContinue} className="integrations-action-button">
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}

function ManualConnectionPanel({ provider, connection, draft, pending, onDraftChange, onSave }) {
  const secretPlaceholder = resolveSecretPlaceholder(provider, connection);

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div>
        <div style={sectionTitleStyle}>Credentials</div>
        <div style={helperTextStyle}>
          {connection
            ? `Leave the ${provider.secretLabel?.toLowerCase() ?? 'token'} blank to keep the current secret. Enter a new value to rotate it.`
            : `Paste the ${provider.secretLabel?.toLowerCase() ?? 'token'} you want Prymal to store for this organisation.`}
        </div>
      </div>

      <label style={fieldStackStyle}>
        <span style={fieldLabelStyle}>{provider.secretLabel ?? 'Access token'}</span>
        <TextInput
          type="password"
          value={draft.accessToken ?? ''}
          placeholder={secretPlaceholder}
          title={secretPlaceholder}
          className="integrations-page__field"
          onChange={(event) =>
            onDraftChange({
              ...draft,
              accessToken: event.target.value,
            })
          }
        />
      </label>

      {provider.settingsFields?.length ? (
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={sectionTitleStyle}>Defaults</div>
          {provider.settingsFields.map((field) => (
            <IntegrationSettingField
              key={field.key}
              provider={provider}
              field={field}
              value={draft.settings?.[field.key] ?? ''}
              onChange={(value) =>
                onDraftChange({
                  ...draft,
                  settings: {
                    ...(draft.settings ?? {}),
                    [field.key]: value,
                  },
                })
              }
            />
          ))}
        </div>
      ) : null}

      <div className="integrations-action-row">
        <Button tone="accent" onClick={onSave} disabled={pending} className="integrations-action-button">
          {pending ? 'Saving...' : connection ? 'Save settings' : 'Connect and verify'}
        </Button>
      </div>
    </div>
  );
}

function OauthSettingsPanel({ provider, connection, draft, pending, onDraftChange, onSave }) {
  const visibleFields = (provider.settingsFields ?? []).filter((field) => !field.key.startsWith('selectedOrganization'));

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div>
        <div style={sectionTitleStyle}>Outbound defaults</div>
        <div style={helperTextStyle}>
          Save an org-level target so workflow alerts or publish actions do not need the same channel or destination entered every time.
        </div>
      </div>

      {visibleFields.map((field) => (
        <IntegrationSettingField
          key={field.key}
          provider={provider}
          connection={connection}
          field={field}
          value={draft.settings?.[field.key] ?? ''}
          onChange={(value) =>
            onDraftChange({
              ...draft,
              settings: {
                ...(draft.settings ?? {}),
                [field.key]: value,
              },
            })
          }
        />
      ))}

      <Button tone="accent" onClick={onSave} disabled={pending} className="integrations-action-button">
        {pending ? 'Saving...' : 'Save defaults'}
      </Button>
    </div>
  );
}

function PublishPanel({ provider, draft, connection, pending, onDraftChange, onPublish, disabled = false }) {
  const deliverySummary = connection?.meta?.publishStats?.lastPublishedAt
    ? `Last delivery: ${new Date(connection.meta.publishStats.lastPublishedAt).toLocaleString()}`
    : 'No outbound deliveries logged yet.';

  const targetPlaceholder = resolveTargetPlaceholder(provider);
  const linkedInAuthors = provider.id === 'linkedin' ? getLinkedInAvailableAuthors(connection) : [];

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div>
        <div style={sectionTitleStyle}>Live delivery</div>
        <div style={helperTextStyle}>
          Send a real outbound post or email through {provider.name}. Prymal will write the receipt back onto this integration record.
        </div>
      </div>

      {provider.targetLabel ? (
        <label style={fieldStackStyle}>
          <span style={fieldLabelStyle}>{provider.targetLabel}</span>
          {linkedInAuthors.length > 0 ? (
            <select
              className="field integrations-page__field"
              value={draft.targetId ?? ''}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  targetId: event.target.value,
                })
              }
            >
              <option value="">Use saved default author</option>
              {linkedInAuthors.map((author) => (
                <option key={author.urn} value={author.urn}>
                  {author.name} ({author.type})
                </option>
              ))}
            </select>
          ) : (
            <TextInput
              value={draft.targetId ?? ''}
              placeholder={targetPlaceholder}
              title={targetPlaceholder}
              className="integrations-page__field"
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  targetId: event.target.value,
                })
              }
            />
          )}
          {provider.id === 'linkedin' ? (
            <span style={helperTextStyle}>
              Connected account must have permission to post as the selected author.
            </span>
          ) : null}
        </label>
      ) : null}

      <label style={fieldStackStyle}>
        <span style={fieldLabelStyle}>Title (optional)</span>
        <TextInput
          value={draft.title ?? ''}
          placeholder="Short title"
          title="Short title"
          className="integrations-page__field"
          onChange={(event) =>
            onDraftChange({
              ...draft,
              title: event.target.value,
            })
          }
        />
      </label>

      <label style={fieldStackStyle}>
        <span style={fieldLabelStyle}>Post copy</span>
        <TextArea
          rows={5}
          value={draft.text ?? ''}
          placeholder="Write the copy Prymal should send."
          className="integrations-page__field field--textarea"
          onChange={(event) =>
            onDraftChange({
              ...draft,
              text: event.target.value,
            })
          }
        />
      </label>

      <label style={fieldStackStyle}>
        <span style={fieldLabelStyle}>Link URL (optional)</span>
        <TextInput
          value={draft.linkUrl ?? ''}
          placeholder="https://prymal.io"
          title="https://prymal.io"
          className="integrations-page__field"
          onChange={(event) =>
            onDraftChange({
              ...draft,
              linkUrl: event.target.value,
            })
          }
        />
      </label>

      {provider.supportsImagePublish ? (
        <label style={fieldStackStyle}>
          <span style={fieldLabelStyle}>Image URL (optional)</span>
          <TextInput
            value={draft.imageUrl ?? ''}
            placeholder="https://image-url"
            title="https://image-url"
            className="integrations-page__field"
            onChange={(event) =>
              onDraftChange({
                ...draft,
                imageUrl: event.target.value,
              })
            }
          />
        </label>
      ) : null}

      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{deliverySummary}</div>

      <Button tone="accent" onClick={onPublish} disabled={disabled || pending || !draft.text?.trim()} className="integrations-action-button">
        {pending ? 'Publishing...' : provider.section === 'emails' ? 'Send live email' : 'Send live post'}
      </Button>
    </div>
  );
}

function DeliveryHistory({ deliveries }) {
  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      <div style={sectionTitleStyle}>Recent delivery receipts</div>
      {deliveries.map((delivery, index) => (
        <div
          key={`${delivery.publishedAt ?? 'delivery'}-${index}`}
          style={{
            padding: '12px',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            display: 'grid',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-strong)', fontSize: '13px' }}>{delivery.target || 'Default target'}</span>
            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
              {delivery.publishedAt ? new Date(delivery.publishedAt).toLocaleString() : 'Unknown time'}
            </span>
          </div>
          {delivery.preview ? <div style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{delivery.preview}</div> : null}
          {delivery.providerMessageId ? (
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Provider receipt: {delivery.providerMessageId}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function IntegrationSettingField({ provider, connection, field, value, onChange }) {
  const placeholder = resolveSettingPlaceholder(provider, field);
  const linkedInAuthors = provider.id === 'linkedin' && field.key === 'authorUrn'
    ? getLinkedInAvailableAuthors(connection)
    : [];

  return (
    <label style={fieldStackStyle}>
      <span style={fieldLabelStyle}>{field.label}</span>
      {linkedInAuthors.length > 0 ? (
        <select className="field integrations-page__field" value={value || ''} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose where Prymal should publish</option>
          {linkedInAuthors.map((author) => (
            <option key={author.urn} value={author.urn}>
              {author.name} ({author.type})
            </option>
          ))}
        </select>
      ) : field.input === 'select' ? (
        <select className="field integrations-page__field" value={value || ''} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select...</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <TextInput
          value={value || ''}
          placeholder={placeholder}
          title={placeholder}
          className="integrations-page__field"
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {field.helpText ? <span style={helperTextStyle}>{field.helpText}</span> : null}
    </label>
  );
}

function IntegrationInfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px' }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-strong)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function inferSectionId(category) {
  if (category === 'Email') return 'emails';
  if (category === 'Storage' || category === 'Files') return 'files';
  if (category === 'Knowledge') return 'knowledge';
  if (category === 'Communication' || category === 'Messaging') return 'messaging';
  if (category === 'Custom') return 'custom';
  return 'socials';
}

function sortProviders(left, right, connectedMap) {
  const leftConnected = Boolean(connectedMap[left.id]);
  const rightConnected = Boolean(connectedMap[right.id]);

  if (leftConnected !== rightConnected) {
    return leftConnected ? -1 : 1;
  }

  if (left.supportsPublish !== right.supportsPublish) {
    return left.supportsPublish ? -1 : 1;
  }

  if ((left.sortOrder ?? 999) !== (right.sortOrder ?? 999)) {
    return (left.sortOrder ?? 999) - (right.sortOrder ?? 999);
  }

  return left.name.localeCompare(right.name);
}

function createConnectionDraft(connection) {
  return {
    accessToken: '',
    settings: { ...(connection?.meta?.settings ?? {}) },
  };
}

function createPublishDraft(provider, connection) {
  return {
    title: '',
    text: '',
    linkUrl: '',
    imageUrl: '',
    targetId: resolveDefaultTarget(provider, connection?.meta?.settings ?? {}),
  };
}

function resolveDefaultTarget(provider, settings = {}) {
  for (const key of TARGET_SETTING_KEYS) {
    if (settings[key]) {
      return settings[key];
    }
  }

  if (provider?.targetLabel?.toLowerCase().includes('author') && settings.authorUrn) {
    return settings.authorUrn;
  }

  return '';
}

function resolveTargetPlaceholder(provider) {
  if (provider.id === 'slack') return 'C0123456789';
  if (provider.id === 'discord') return '123456789012345678';
  if (provider.id === 'telegram') return '@prymal_updates';
  if (provider.id === 'linkedin') return 'urn:li:organization:123456';
  if (provider.id === 'custom_webhook') return 'https://example.com/hook';
  if (provider.id === 'outlook') return 'founder@example.com';
  return 'Saved default target';
}

function resolveSecretPlaceholder(provider, connection) {
  if (connection) {
    return 'Keep existing token';
  }

  if (provider.id === 'discord') return 'Discord bot token';
  if (provider.id === 'telegram') return 'Telegram bot token';
  if (provider.id === 'x') return 'X OAuth 2.0 user access token';
  if (provider.id === 'mastodon') return 'Mastodon access token';
  if (provider.id === 'dropbox') return 'Dropbox access token';
  if (provider.id === 'box') return 'Box access token';
  if (provider.id === 'custom_webhook') return 'Bearer token (optional)';
  return provider.secretPlaceholder ?? 'Paste token';
}

function resolveSettingPlaceholder(provider, field) {
  if (field.key === 'authorUrn') return provider.id === 'linkedin' ? 'urn:li:organization:123456' : 'urn:li:person:123';
  if (field.key === 'defaultRecipientEmail') return 'founder@example.com';
  if (field.key === 'endpointUrl') return 'https://example.com/hook';
  if (field.key === 'instanceUrl') return 'https://mastodon.social';
  if (field.key === 'defaultChannelId' && provider.id === 'slack') return 'C0123456789';
  if (field.key === 'defaultChannelId' && provider.id === 'discord') return '123456789012345678';
  if (field.key === 'defaultChatId') return '@prymal_updates';
  return field.placeholder ?? '';
}

function getLinkedInAvailableAuthors(connection) {
  const authors = connection?.meta?.profile?.availableAuthors;
  return Array.isArray(authors)
    ? authors
        .filter((author) => author?.urn && author?.name)
        .map((author) => ({
          urn: author.urn,
          name: author.name,
          type: author.type ?? (author.urn.includes(':organization:') ? 'organization' : 'person'),
        }))
    : [];
}

function formatIntegrationOauthError(error) {
  if (error === 'linkedin_scope_not_approved' || error === 'unauthorized_scope_error') {
    return 'LinkedIn rejected one or more requested scopes. Remove unapproved scopes from LINKEDIN_SCOPES, start with openid profile email, and reconnect after LinkedIn approves posting access.';
  }

  return String(error).replace(/_/g, ' ');
}

function resolveAuthModeLabel(provider, needsServerConfig) {
  if (needsServerConfig) return 'Server config needed';
  if (provider.authMode === 'oauth') return 'OAuth';
  if (provider.integrationRuntime === 'webhook_alias' || provider.id.includes('webhook')) return 'Webhook bridge';
  return 'Manual credential';
}

function resolveHealthColor(status) {
  if (status === 'healthy') return '#00FFD1';
  if (status === 'degraded') return '#F59E0B';
  return '#98A2B3';
}

function toggleCardPanel(service, nextPanel, setCardPanels) {
  setCardPanels((current) => ({
    ...current,
    [service]: current[service] === nextPanel ? null : nextPanel,
  }));
}

function openCardPanel(service, nextPanel, setCardPanels) {
  setCardPanels((current) => ({
    ...current,
    [service]: nextPanel,
  }));
}

function closeCardPanel(service, setCardPanels) {
  setCardPanels((current) => ({
    ...current,
    [service]: null,
  }));
}

function setConnectionDraft(service, nextDraft, setDrafts) {
  setDrafts((current) => ({
    ...current,
    [service]: nextDraft,
  }));
}

function setPublishDraft(service, nextDraft, setDrafts) {
  setDrafts((current) => ({
    ...current,
    [service]: nextDraft,
  }));
}

function createLogoBadgeVars(color, theme = {}) {
  return {
    '--integration-logo-accent': theme.iconColor ?? color,
    background: theme.badgeBackground ?? '#D8DEE9',
    borderColor: theme.badgeBorder ?? 'rgba(255, 255, 255, 0.2)',
  };
}

function createTabVars(accent) {
  return {
    '--integration-tab-accent': accent,
  };
}

const capabilityChipStyle = {
  padding: '5px 10px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'var(--muted)',
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const agentChipStyle = {
  padding: '5px 10px',
  borderRadius: '999px',
  background: 'rgba(0,255,209,0.08)',
  border: '1px solid rgba(0,255,209,0.16)',
  color: '#9BFFF0',
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const stepRowStyle = {
  display: 'grid',
  gridTemplateColumns: '30px 1fr',
  gap: '10px',
  alignItems: 'start',
};

const stepBadgeStyle = {
  width: '30px',
  height: '30px',
  borderRadius: '10px',
  display: 'grid',
  placeItems: 'center',
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--text-strong)',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
};

const sectionTitleStyle = {
  color: 'var(--text-strong)',
  fontSize: '14px',
  fontWeight: 700,
};

const helperTextStyle = {
  color: 'var(--muted)',
  fontSize: '13px',
  lineHeight: 1.7,
};

const fieldStackStyle = {
  display: 'grid',
  gap: '6px',
};

const fieldLabelStyle = {
  color: 'var(--muted)',
  fontSize: '12px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};
