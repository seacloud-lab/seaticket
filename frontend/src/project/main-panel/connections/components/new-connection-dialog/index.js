import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import copy from 'copy-to-clipboard';
import { Button, Modal, Input, ModalBody, ModalFooter, FormGroup, Label, Row } from 'reactstrap';
import { gettext } from '@/constants';
import { CONNECTION_TYPES, CONNECTION_FIELDS, CONNECTION_FIELD_TYPE, CONNECTION_TYPE, CONNECTION_SUB_TYPE_MAP, STEP, STEPS, EMAIL_SERVER_PROVIDER, getAvailableConnectionTypes } from '../../constants';
import { getVisibleEmailFields, getEmailProvider, populateEmailOAuthDefaults, sanitizeEmailConfigByProvider, getConnectionIcon, isOAuthEmailProvider, getEmailOAuthCallbackUrl } from '../../utils';
import { ModalHeader, Loading, SecondaryBtn, toaster, IconButton, Icon } from '@/components';
import ConnectionConfigEditor from '../connection-config-editor';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import Connection from '../../models/connection';
import { useConnections } from '../../hooks/connections';
import Switch from '@/components/switch';

import './index.css';

const { server, projectUuid, workspaceID, projectName, enableGeneralTask } = window.app.pageOptions;

const initializeConfig = (newType) => {
  const fields = CONNECTION_FIELDS[newType] || [];
  const defaultConfig = {};
  fields.forEach(field => {
    if (field.type === CONNECTION_FIELD_TYPE.GROUP) {
      field.children.forEach(children => {
        if (children.default_value !== undefined) {
          defaultConfig[children.key] = children.default_value;
        }
      });
    } else {
      if (field.default_value !== undefined) {
        defaultConfig[field.key] = field.default_value;
      }
    }
  });
  return defaultConfig;
};

const NewConnectionDialog = ({ onSubmit, onToggle }) => {
  const availableConnectionTypes = useMemo(() => getAvailableConnectionTypes(enableGeneralTask), [enableGeneralTask]);
  const [stepIndex, setStepIndex] = useState(0);
  const [type, setType] = useState(availableConnectionTypes[0]?.type || CONNECTION_TYPES[0].type);
  const [name, setName] = useState('');
  const [config, setConfig] = useState(initializeConfig(availableConnectionTypes[0]?.type || CONNECTION_TYPES[0].type));
  const [isSubmitting, setSubmitting] = useState(false);
  const [githubRepositories, setGithubRepositories] = useState([]);
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(false);
  const [showEmailAdvancedOptions, setShowEmailAdvancedOptions] = useState(false);
  const [isWaitingEmailOAuth, setWaitingEmailOAuth] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState([]);
  const [isWaitingConfluenceOAuth, setWaitingConfluenceOAuth] = useState(false);
  const [confluenceWorkspacesVersion, setConfluenceWorkspacesVersion] = useState(0);
  const [isConfluenceOauthConnected, setConfluenceOauthConnected] = useState(false);
  const [isCheckingConfluenceOauth, setCheckingConfluenceOauth] = useState(false);
  const [confluenceOauthError, setConfluenceOauthError] = useState('');
  const [confluenceSpaces, setConfluenceSpaces] = useState([]);
  const [isLoadingConfluenceSpaces, setLoadingConfluenceSpaces] = useState(false);
  const [selectedSpaceKeys, setSelectedSpaceKeys] = useState([]);
  const { updateUrlParams } = useConnections();
  const prevStepIndexRef = useRef(stepIndex);
  const emailOAuthIntervalRef = useRef(null);
  const oauthWindowRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const [linearTeamsVersion, setLinearTeamsVersion] = useState(0);
  const [isLinearOauthConnected, setLinearOauthConnected] = useState(false);
  const [isCheckingLinearOauth, setCheckingLinearOauth] = useState(false);
  const [linearOauthError, setLinearOauthError] = useState('');
  const confluenceOauthIntervalRef = useRef(null);
  const confluenceOauthWindowRef = useRef(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connection-type') === 'github') {
      onTypeChange(CONNECTION_TYPE.GITHUB_ISSUE);
      setStepIndex(1);
    }
  }, []);

  useEffect(() => {
    if (prevStepIndexRef.current === 1 && stepIndex === 0) {
      updateUrlParams({ 'connection-type': null });
    }
    prevStepIndexRef.current = stepIndex;
  }, [stepIndex, updateUrlParams]);

  const installGitHubAppURL = useMemo(() => {
    const url = new URL(`${server}/workspace/${workspaceID}/project/${projectName}/connections/?connection-dialog=open&connection-type=github`);
    const newPath = url.href;
    return `${server}/github/install/?next=${encodeURIComponent(newPath)}&project_uuid=${projectUuid}`;
  }, [server, projectUuid]);

  const columns = useMemo(() => {
    const _columns = CONNECTION_FIELDS[type] || [];
    if (type === CONNECTION_TYPE.GITHUB_ISSUE) return _columns;
    if (type !== CONNECTION_TYPE.EMAIL) return _columns;
    return getVisibleEmailFields(_columns, getEmailProvider(config), showEmailAdvancedOptions);
  }, [type, config.server_provider, showEmailAdvancedOptions]);

  const customColumns = useMemo(() => columns.filter(c => {
    if (c.type === CONNECTION_FIELD_TYPE.GROUP) return c.children.find(children => children.is_custom);
    return c.is_custom;
  }), [columns]);

  const isGithub = useMemo(() => type === CONNECTION_TYPE.GITHUB_ISSUE, [type]);

  const isEmail = useMemo(() => type === CONNECTION_TYPE.EMAIL, [type]);
  const isLinear = useMemo(() => type === CONNECTION_TYPE.LINEAR, [type]);
  const isConfluence = useMemo(() => type === CONNECTION_TYPE.CONFLUENCE, [type]);

  const isMicrosoftEmailProvider = useMemo(() => {
    return isEmail && getEmailProvider(config) === EMAIL_SERVER_PROVIDER.MICROSOFT;
  }, [isEmail, config.server_provider]);

  const isOAuthEmail = useMemo(() => {
    return isEmail && isOAuthEmailProvider(getEmailProvider(config));
  }, [isEmail, config.server_provider]);

  const basicCustomColumns = useMemo(() => {
    return customColumns.filter(column => !column.is_advanced_option);
  }, [customColumns]);

  const advancedCustomColumns = useMemo(() => {
    return customColumns.filter(column => column.is_advanced_option);
  }, [customColumns]);

  const step = useMemo(() => {
    return STEPS[stepIndex];
  }, [STEPS, stepIndex]);

  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (isLinear && !isLinearOauthConnected) return false;
    if (isConfluence && !isConfluenceOauthConnected) return false;
    return customColumns.length > 0 ? customColumns.every(c => {
      if (c.type === CONNECTION_FIELD_TYPE.GROUP) {
        return c.children.every(child => {
          if (child.is_required) return Boolean(config[child.key]);
          return true;
        });
      }
      if (c.is_required) return Boolean(config[c.key]);
      return true;
    }) : true;
  }, [name, config, customColumns, isLinear, isLinearOauthConnected, isConfluence, isConfluenceOauthConnected]);

  const callbackUrl = useMemo(() => {
    return getEmailOAuthCallbackUrl(projectUuid);
  }, []);

  const stopEmailOAuthPolling = useCallback(() => {
    if (emailOAuthIntervalRef.current) {
      window.clearInterval(emailOAuthIntervalRef.current);
      emailOAuthIntervalRef.current = null;
    }
  }, []);

  const stopConfluenceOAuthPolling = useCallback(() => {
    if (confluenceOauthIntervalRef.current) {
      window.clearInterval(confluenceOauthIntervalRef.current);
      confluenceOauthIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopEmailOAuthPolling();
      stopConfluenceOAuthPolling();
      if (confluenceOauthWindowRef.current && !confluenceOauthWindowRef.current.closed) {
        confluenceOauthWindowRef.current.close();
      }
    };
  }, [stopEmailOAuthPolling, stopConfluenceOAuthPolling]);

  const onNameChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === name) return;
    setName(newValue);
  }, [name]);

  const onTypeChange = useCallback((newType) => {
    if (type === newType) return;
    let nextConfig = initializeConfig(newType);
    if (newType === CONNECTION_TYPE.EMAIL) {
      nextConfig = populateEmailOAuthDefaults(nextConfig, getEmailProvider(nextConfig));
    }
    setConfig(nextConfig);
    setType(newType);
    setShowEmailAdvancedOptions(false);

    if (newType === CONNECTION_TYPE.GITHUB_ISSUE) {
      setIsLoadingRepositories(true);
      connectionsAPI.listGitHubRepositories(projectUuid).then(res => {
        const { repositories } = res.data;
        setGithubRepositories(repositories);
        setIsLoadingRepositories(false);
      }).catch(error => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
        setIsLoadingRepositories(false);
      });
    } else {
      setGithubRepositories([]);
    }
  }, [type]);

  const fetchConfluenceOauthStatus = useCallback(() => {
    setCheckingConfluenceOauth(true);
    return connectionsAPI.getConfluenceOauthStatus(projectUuid).then((res) => {
      setConfluenceOauthConnected(Boolean(res?.data?.connected));
      setConfluenceOauthError('');
    }).catch(() => {
      setConfluenceOauthConnected(false);
      setConfluenceOauthError(gettext('Failed to check Confluence authorization status.'));
    }).finally(() => {
      setCheckingConfluenceOauth(false);
    });
  }, []);

  useEffect(() => {
    if (!isConfluence) return;
    fetchConfluenceOauthStatus();
  }, [isConfluence, fetchConfluenceOauthStatus]);

  const onConfigChange = useCallback((key, value) => {
    if (config[key] === value) return;

    if (key === 'server_provider') {
      const nextProvider = value || EMAIL_SERVER_PROVIDER.GENERAL;
      setConfig(populateEmailOAuthDefaults({ ...config, [key]: nextProvider }, nextProvider));
      setShowEmailAdvancedOptions(false);
      return;
    }

    setConfig({ ...config, [key]: value });
  }, [config]);

  const handleSubmit = useCallback(() => {
    setSubmitting(true);
    let _config = { ...config };
    if (type === CONNECTION_TYPE.EMAIL) {
      _config = sanitizeEmailConfigByProvider(_config);
    }
    if (isGithub) {
      const repository = _config.repository.repository;
      delete _config['repository'];
      _config['repository'] = repository['html_url'];
      _config['installation_id'] = repository['installation_id'];
    }
    if (isConfluence) {
      const workspace = _config.workspace_id;
      if (workspace && workspace.workspace) {
        _config['workspace_id'] = workspace.workspace.id;
        _config['workspace_name'] = workspace.workspace.name;
        _config['workspace_url'] = workspace.workspace.url;
      }
      _config['space_keys'] = selectedSpaceKeys;
    }
    if (type === CONNECTION_TYPE.EMAIL && isOAuthEmailProvider(_config.server_provider)) {
      connectionsAPI.startEmailOAuth(projectUuid, { name: name.trim(), config: _config }).then((res) => {
        const authorizationUrl = res.data?.auth_url;
        if (!authorizationUrl) {
          setSubmitting(false);
          toaster.danger(gettext('Failed to fetch authorization url'));
          return;
        }

        window.open(authorizationUrl, '_blank', 'width=600,height=700');
        setWaitingEmailOAuth(true);
        stopEmailOAuthPolling();
        emailOAuthIntervalRef.current = window.setInterval(() => {
          connectionsAPI.queryEmailOAuth(projectUuid).then((progressRes) => {
            if (progressRes.data?.status !== 'success') return;
            stopEmailOAuthPolling();
            setWaitingEmailOAuth(false);
            setSubmitting(false);
            const connection = new Connection(progressRes.data.record);
            onSubmit({ type, name: name.trim(), config: _config }, null, false, null, connection);
          }).catch((error) => {
            stopEmailOAuthPolling();
            setWaitingEmailOAuth(false);
            setSubmitting(false);
            toaster.danger(Utils.getErrorMsg(error));
          });
        }, 2000);
      }).catch((error) => {
        setSubmitting(false);
        toaster.danger(Utils.getErrorMsg(error));
      });
      return;
    }
    if (isLinear) {
      const team = _config.team_id;
      if (team && team.team) {
        _config['team_id'] = team.team.id;
        _config['team_name'] = team.team.name;
        _config['team_key'] = team.team.key;
        _config['workspace_name'] = team.team.workspace_name;
      }
    }

    onSubmit({ type, name: name.trim(), config: _config }, () => {
      setSubmitting(false);
    });
    return;
  }, [name, type, config, onSubmit, stopEmailOAuthPolling, isConfluence, isGithub, selectedSpaceKeys]);

  const onCopyCallbackUrl = useCallback(() => {
    copy(callbackUrl);
    toaster.success(gettext('Connection URL has been copied to clipboard'), { duration: 2 });
  }, [callbackUrl]);

  const listGitHubRepositories = useCallback(() => {
    return connectionsAPI.listGitHubRepositories(projectUuid).then(res => {
      const { repositories } = res.data;
      return {
        data: {
          options: repositories.map(r => ({ value: r.id, repository: r, label: r.name, name: r.name })),
        }
      };
    });
  }, []);

  const listConfluenceWorkspaces = useCallback(() => {
    if (!isConfluenceOauthConnected) {
      return Promise.resolve({ data: { options: [] } });
    }
    return connectionsAPI.listConfluenceWorkspaces(projectUuid).then((res) => {
      const workspaces = res?.data?.workspaces || [];
      return {
        data: {
          options: workspaces.map((workspace) => ({
            value: workspace.id,
            workspace,
            label: workspace.name,
            name: workspace.name,
          })),
        }
      };
    });
  }, [projectUuid, confluenceWorkspacesVersion, isConfluenceOauthConnected]);

  const fetchConfluenceSpaces = useCallback(() => {
    const workspaceId = config.workspace_id;
    const actualWorkspaceId = workspaceId?.workspace?.id || workspaceId?.id || workspaceId;
    const actualWorkspaceUrl = workspaceId?.workspace?.url || workspaceId?.url || '';
    if (!isConfluenceOauthConnected || !actualWorkspaceId || !actualWorkspaceUrl) {
      setConfluenceSpaces([]);
      return;
    }
    setLoadingConfluenceSpaces(true);
    connectionsAPI.listConfluenceSpaces(projectUuid, actualWorkspaceId, actualWorkspaceUrl).then((res) => {
      setConfluenceSpaces(res?.data?.spaces || []);
    }).catch(() => {
      setConfluenceSpaces([]);
    }).finally(() => {
      setLoadingConfluenceSpaces(false);
    });
  }, [projectUuid, config.workspace_id, isConfluenceOauthConnected]);

  // Reload spaces when workspace changes
  useEffect(() => {
    if (!isConfluence) return;
    setSelectedSpaceKeys([]);
    fetchConfluenceSpaces();
  }, [config.workspace_id, isConfluence, fetchConfluenceSpaces]);

  const toggleSpaceSelection = useCallback((spaceKey) => {
    setSelectedSpaceKeys(prev => {
      if (prev.includes(spaceKey)) {
        return prev.filter(key => key !== spaceKey);
      }
      return [...prev, spaceKey];
    });
  }, []);

  const handleConnectConfluence = useCallback(() => {
    const next = window.location.href;
    const oauthUrl = `${server}/confluence/oauth/?project_uuid=${projectUuid}&next=${encodeURIComponent(next)}`;
    confluenceOauthWindowRef.current = window.open(oauthUrl, 'confluence-oauth', 'width=800,height=700');
    setWaitingConfluenceOAuth(true);
    stopConfluenceOAuthPolling();
    confluenceOauthIntervalRef.current = window.setInterval(() => {
      connectionsAPI.getConfluenceOauthStatus(projectUuid).then((res) => {
        if (!res?.data?.connected) return;
        stopConfluenceOAuthPolling();
        setWaitingConfluenceOAuth(false);
        setConfluenceOauthConnected(true);
        setConfluenceOauthError('');
        setConfluenceWorkspacesVersion((value) => value + 1);
        if (confluenceOauthWindowRef.current && !confluenceOauthWindowRef.current.closed) {
          confluenceOauthWindowRef.current.close();
        }
      }).catch(() => {
        // Keep polling
      });
    }, 2000);
  }, [projectUuid, stopConfluenceOAuthPolling]);

  const typeOption = availableConnectionTypes.find(i => i.type === type) || availableConnectionTypes[0];
  const connectionSections = useMemo(() => {
    const sectionOrder = ['issues', 'documents', 'tasks'];
    return sectionOrder
      .map(subTypeKey => {
        const subType = CONNECTION_SUB_TYPE_MAP[subTypeKey];
        if (!subType) return null;
        const items = availableConnectionTypes.filter(connection => {
          const connectionSubType = connection.sub_types || connection.subTypes;
          const connectionSubTypeName = connectionSubType?.name;
          return connectionSubTypeName === subType.name || connectionSubTypeName === subTypeKey;
        });
        return items.length > 0 ? { key: subTypeKey, title: subType.text, items } : null;
      })
      .filter(Boolean);
  }, [availableConnectionTypes]);

  useEffect(() => {
    setCollapsedSections(prev => prev.filter(sectionKey => connectionSections.some(section => section.key === sectionKey)));
  }, [connectionSections]);

  const toggleConnectionSection = useCallback((sectionKey) => {
    setCollapsedSections(prev => {
      if (prev.includes(sectionKey)) {
        return prev.filter(key => key !== sectionKey);
      }
      return [...prev, sectionKey];
    });
  }, []);

  const listLinearTeams = useCallback(() => {
    return connectionsAPI.listLinearTeams(projectUuid).then(res => {
      const teams = res?.data?.teams || [];
      return {
        data: {
          options: teams.map(t => ({
            value: t.id,
            team: t,
            label: t.name,
            name: t.name
          })),
        }
      };
    });
  }, [projectUuid, linearTeamsVersion]);

  const fetchLinearOauthStatus = useCallback(() => {
    setCheckingLinearOauth(true);
    return connectionsAPI.getLinearOauthStatus(projectUuid).then(res => {
      setLinearOauthConnected(Boolean(res?.data?.connected));
      setLinearOauthError('');
    }).catch(() => {
      setLinearOauthConnected(false);
      setLinearOauthError(gettext('Failed to check Linear authorization status.'));
    }).finally(() => {
      setCheckingLinearOauth(false);
    });
  }, []);

  const handleConnectLinear = useCallback(() => {
    const next = window.location.href;
    const oauthUrl = `${server}/linear/oauth/?project_uuid=${projectUuid}&next=${encodeURIComponent(next)}`;
    oauthWindowRef.current = window.open(oauthUrl, 'linear-oauth', 'width=800,height=700');

    // Start polling for OAuth status
    clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(() => {
      connectionsAPI.getLinearOauthStatus(projectUuid).then(res => {
        if (res?.data?.connected) {
          setLinearOauthConnected(true);
          setLinearOauthError('');
          setLinearTeamsVersion(v => v + 1);
          clearInterval(pollingIntervalRef.current);
          if (oauthWindowRef.current && !oauthWindowRef.current.closed) {
            oauthWindowRef.current.close();
          }
        }
      }).catch(() => {
        // Silently retry on next interval
      });
    }, 2000);
  }, [projectUuid]);

  useEffect(() => {
    if (!isLinear) return;
    fetchLinearOauthStatus();
  }, [isLinear, fetchLinearOauthStatus]);

  // Cleanup polling and popup on unmount or when Linear type changes
  useEffect(() => {
    return () => {
      clearInterval(pollingIntervalRef.current);
      if (oauthWindowRef.current && !oauthWindowRef.current.closed) {
        oauthWindowRef.current.close();
      }
    };
  }, []);

  const renderConnectionField = useCallback((column) => {
    const { type, key, children, is_advanced_option } = column;
    if (type === CONNECTION_FIELD_TYPE.GROUP) {
      return (
        <Row className="mx-0 seaqa-project-connection-group-config" key={key}>
          {children.map((child, index) => (
            <ConnectionConfigEditor
              className="mx-0 px-0 width-half"
              column={child}
              key={`${key}-${index}`}
              row={config}
              readonly={isSubmitting}
              onChange={onConfigChange}
            />
          ))}
        </Row>
      );
    }

    let api = null;
    let row = { ...config };
    if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && column.key === 'repository' && isGithub) {
      api = listGitHubRepositories;
      if (row[key]) {
        row[key] = row[key].value;
      }
    }
    if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && column.key === 'team_id' && isLinear) {
      api = listLinearTeams;
      if (row[key]) {
        row[key] = row[key].value || row[key];
      }
    }
    if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && column.key === 'workspace_id' && isConfluence) {
      api = isConfluenceOauthConnected ? listConfluenceWorkspaces : null;
      if (row[key]) {
        row[key] = row[key].value || row[key];
      }
    }

    return (
      <ConnectionConfigEditor
        className={is_advanced_option ? 'seaqa-project-connection-advanced-options-field' : ''}
        column={column}
        api={api}
        key={key}
        row={row}
        readonly={isSubmitting}
        onChange={onConfigChange}
      />
    );
  }, [config, isSubmitting, onConfigChange, isGithub, listGitHubRepositories, isLinearOauthConnected, isConfluence, isConfluenceOauthConnected]);

  return (
    <Modal
      isOpen={true}
      toggle={onToggle}
      autoFocus={false}
      className="seaqa-project-connection-dialog"
      style={{ height: (stepIndex === 1 && isEmail) ? 'calc(100% - 56px)' : 'fit-content' }}
    >
      <ModalHeader toggle={onToggle}>{gettext('New connection')}</ModalHeader>
      <ModalBody className="seaqa-project-connection-body">
        {stepIndex > 0 &&
          <div className="seaqa-project-selected-connection">
            <div className='seaqa-project-connection-help'>
              {typeOption.help_text}
              <a className="ml-1" href={typeOption.help_link} target="_blank" rel="noopener noreferrer">{gettext('Help Docs')}</a>
            </div>
            <div className='seaqa-project-new-connection-type'>
              <div className="d-flex align-items-center">
                <img
                  src={getConnectionIcon(typeOption.type)}
                  alt={typeOption.name}
                  className="seaqa-project-new-connection-icon"
                />
                <span className="seaqa-project-new-connection-name">{typeOption.name}</span>
              </div>
              {(typeOption.type === CONNECTION_TYPE.GITHUB_ISSUE && githubRepositories.length > 0) && (
                <SecondaryBtn text={gettext('Manage GitHub app')} onClick={() => window.open(installGitHubAppURL, '_blank')} />
              )}
            </div>
          </div>
        }
        {step.key === STEP.TYPE && (
          <div className="seaqa-project-new-connection-type-sections">
            {connectionSections.map(section => (
              <div key={section.key} className="seaqa-project-new-connection-section">
                <div className="seaqa-project-new-connection-section-header">
                  <div className="seaqa-project-new-connection-section-title">{section.title}</div>
                  <IconButton
                    icon="arrow-down-b"
                    className={classnames('seaqa-project-new-connection-section-toggle', {
                      'rotate-icon-90': collapsedSections.includes(section.key),
                    })}
                    iconClassName="seaqa-project-new-connection-section-toggle-icon"
                    role="button"
                    tabIndex={0}
                    aria-expanded={!collapsedSections.includes(section.key)}
                    aria-label={collapsedSections.includes(section.key) ? gettext('Expand section') : gettext('Collapse section')}
                    onClick={() => toggleConnectionSection(section.key)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleConnectionSection(section.key);
                      }
                    }}
                  />
                </div>
                {!collapsedSections.includes(section.key) && (
                  <div className="seaqa-project-new-connection-grid">
                    {section.items.map(connection => {
                      const { type: key, name } = connection;
                      const isActive = key === type;
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => onTypeChange(key)}
                          className={classnames('seaqa-project-new-connection-card', { selected: isActive })}
                        >
                          <span className="seaqa-project-new-connection-card-icon-wrap">
                            <img src={getConnectionIcon(key)} alt={name} className="seaqa-project-new-connection-card-icon" />
                          </span>
                          <span className="seaqa-project-new-connection-card-name">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {step.key === STEP.CONFIG && !isGithub && (
          <div className="seaqa-project-new-connection-config">
            <FormGroup>
              <Label>
                {gettext('Connection name')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
              <Input value={name} onChange={onNameChange} disabled={isSubmitting} />
            </FormGroup>
            {isOAuthEmail ? basicCustomColumns.slice(0, 1).map(renderConnectionField) : basicCustomColumns.map(renderConnectionField)}
            {isOAuthEmail && (
              <FormGroup>
                <Label>{gettext('OAuth callback URL')}</Label>
                <div className="seaqa-project-connection-oauth-tip">{gettext('Use this callback URL in your email provider OAuth app configuration. It is read-only and must match exactly.')}</div>
                <div className="input-group">
                  <Input value={callbackUrl} disabled={true} />
                  <div className="input-group-append">
                    <Button type="button" onClick={onCopyCallbackUrl}>{gettext('Copy')}</Button>
                  </div>
                </div>
              </FormGroup>
            )}
            {isOAuthEmail ? basicCustomColumns.slice(1, 4).map(renderConnectionField) : null}
            {isMicrosoftEmailProvider && (
              <div className="seaqa-project-connection-advanced-options mb-3">
                <Switch
                  checked={showEmailAdvancedOptions}
                  onChange={() => setShowEmailAdvancedOptions(!showEmailAdvancedOptions)}
                  placeholder={gettext('Advanced options')}
                  textPosition="right"
                />
              </div>
            )}
            {advancedCustomColumns.map(renderConnectionField)}
            {isConfluence && (
              <FormGroup>
                <Label>{gettext('Authorization')}</Label>
                <div className="seaqa-project-connection-oauth-status">
                  <span className={classnames('oauth-status-badge', { connected: isConfluenceOauthConnected })}>
                    {isConfluenceOauthConnected ? gettext('Connected') : gettext('Not connected')}
                  </span>
                  <Button
                    color="primary"
                    className="ml-2"
                    disabled={isSubmitting || isCheckingConfluenceOauth || isWaitingConfluenceOAuth}
                    onClick={handleConnectConfluence}
                  >
                    {isConfluenceOauthConnected ? gettext('Reconnect Confluence') : gettext('Connect Confluence')}
                  </Button>
                </div>
                {confluenceOauthError && <div className="text-danger mt-2">{confluenceOauthError}</div>}
              </FormGroup>
            )}
            {isWaitingEmailOAuth && (
              <div className="seaqa-project-connection-oauth-pending">
                <Loading />
                <div className="mt-3">{gettext('Waiting for OAuth authorization to complete...')}</div>
              </div>
            )}
            {isLinear && (
              <FormGroup>
                <Label>{gettext('Authorization')}</Label>
                <div className="seaqa-project-linear-oauth">
                  <span className={classnames('linear-oauth-status', { connected: isLinearOauthConnected })}>
                    <span className="linear-status-icon d-flex">
                      <Icon symbol={isLinearOauthConnected ? 'check-circle-filled' : 'close-circle-filled'} />
                    </span>
                    {isLinearOauthConnected ? gettext('Connected') : gettext('Not connected')}
                  </span>
                  <Button
                    color={isLinearOauthConnected ? 'secondary' : 'primary'}
                    disabled={isSubmitting || isCheckingLinearOauth}
                    onClick={handleConnectLinear}
                  >
                    {isLinearOauthConnected ? gettext('Reconnect Linear') : gettext('Connect Linear')}
                  </Button>
                  {linearOauthError && (<div className="text-danger mt-2">{linearOauthError}</div>)}
                </div>
              </FormGroup>
            )}
            {isWaitingConfluenceOAuth && (
              <div className="seaqa-project-connection-oauth-pending">
                <Loading />
                <div className="mt-3">{gettext('Waiting for Confluence authorization to complete...')}</div>
              </div>
            )}
            {isConfluence && isConfluenceOauthConnected && config.workspace_id && (
              <FormGroup>
                <Label>{gettext('Spaces (optional)')}</Label>
                <div className="text-muted mb-2" style={{ fontSize: '0.85em' }}>
                  {gettext('Select specific spaces to sync. Leave empty to sync all spaces in the workspace.')}
                </div>
                {isLoadingConfluenceSpaces ? (
                  <div className="d-flex align-items-center" style={{ gap: 8 }}>
                    <Loading /><span>{gettext('Loading spaces...')}</span>
                  </div>
                ) : confluenceSpaces.length === 0 ? (
                  <div className="text-muted">{gettext('No spaces found in this workspace.')}</div>
                ) : (
                  <div className="seaqa-confluence-spaces-list" style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: 4, padding: '4px 0' }}>
                    {confluenceSpaces.map(space => (
                      <div
                        key={space.key || space.id}
                        className="seaqa-confluence-space-item d-flex align-items-center"
                        style={{ padding: '6px 12px', cursor: 'pointer' }}
                        onClick={() => toggleSpaceSelection(space.key)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSpaceKeys.includes(space.key)}
                          onChange={() => toggleSpaceSelection(space.key)}
                          style={{ marginRight: 8 }}
                        />
                        <div className="d-flex flex-column">
                          <span>{space.name}</span>
                          <span className="text-muted" style={{ fontSize: '0.8em' }}>{space.key} · {space.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </FormGroup>
            )}
          </div>
        )}

        {step.key === STEP.CONFIG && isGithub && isLoadingRepositories &&
          <div className="seaqa-project-connection-github-tip d-flex flex-column align-items-center justify-content-center">
            <Loading />
            <h4 className="mt-5">{gettext('Checking GitHub App installation status...')}</h4>
            <p>{gettext('Install GitHub app to your repositories to enable SeaTicket to sync issues from these repositories')}</p>
          </div>
        }

        {step.key === STEP.CONFIG && isGithub && !isLoadingRepositories && githubRepositories.length === 0 &&
          <div className="seaqa-project-connection-github-tip d-flex flex-column align-items-center justify-content-center">
            <h4>{gettext('GitHub app not installed')}</h4>
            <p>{gettext('Install GitHub app to your repositories to enable SeaTicket to sync issues from these repositories')}</p>
            <Button color="primary" outline onClick={() => window.open(installGitHubAppURL, '_blank')} >{gettext('Install GitHub app')}</Button>
          </div>
        }

        {step.key === STEP.CONFIG && isGithub && !isLoadingRepositories && githubRepositories.length > 0 && (
          <div className="seaqa-project-new-connection-config">
            <FormGroup>
              <Label>
                {gettext('Connection name')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
              <Input value={name} onChange={onNameChange} disabled={isSubmitting} />
            </FormGroup>
            {customColumns.map(renderConnectionField)}
          </div>
        )}
      </ModalBody>
      {stepIndex === 0 && (
        <ModalFooter className="seaqa-project-new-connection-footer">
          <Button
            type="button"
            color="secondary"
            onClick={onToggle}
          >
            {gettext('Cancel')}
          </Button>
          <Button
            type="button"
            color="primary"
            onClick={() => setStepIndex(1)}
          >
            {gettext('Next')}
          </Button>
        </ModalFooter>
      )}
      {stepIndex === 1 && (
        <ModalFooter>
          <Button color="secondary" onClick={() => setStepIndex(0)}>{gettext('Previous')}</Button>
          <Button color="primary" onClick={handleSubmit} disabled={isSubmitting || isWaitingEmailOAuth || isWaitingConfluenceOAuth || !isValid || !name}>{gettext('Submit')}</Button>
        </ModalFooter>
      )}
    </Modal>
  );
};

NewConnectionDialog.propTypes = {
  connection: PropTypes.object,
  connections: PropTypes.array,
  onSubmit: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired
};

export default NewConnectionDialog;
