import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import copy from 'copy-to-clipboard';
import { Button, Modal, Input, ModalBody, FormGroup, Label, Row } from 'reactstrap';
import { gettext } from '@/constants';
import { CONNECTION_TYPES, CONNECTION_FIELDS, CONNECTION_FIELD_TYPE, CONNECTION_TYPE, STEP, STEPS, EMAIL_SERVER_PROVIDER, getAvailableConnectionTypes } from '../../constants';
import { getVisibleEmailFields, getEmailProvider, populateEmailOAuthDefaults, sanitizeEmailConfigByProvider, isOAuthEmailProvider, getEmailOAuthCallbackUrl } from '../../utils';
import { ModalHeader, Loading, toaster, Icon } from '@/components';
import ConnectionConfigEditor from '../connection-config-editor';
import ConnectionDialogFooter from './connection-dialog-footer';
import GithubConnectionConfig from './github-connection-config';
import ConnectionTypeSections from './connection-type-sections';
import SelectedConnectionHeader from './selected-connection-header';
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
  const availableConnectionTypes = useMemo(() => getAvailableConnectionTypes(enableGeneralTask), []);
  const [stepIndex, setStepIndex] = useState(0);
  const [type, setType] = useState(availableConnectionTypes[0]?.type || CONNECTION_TYPES[0].type);
  const [name, setName] = useState('');
  const [config, setConfig] = useState(initializeConfig(availableConnectionTypes[0]?.type || CONNECTION_TYPES[0].type));
  const [isSubmitting, setSubmitting] = useState(false);
  const [githubRepositories, setGithubRepositories] = useState([]);
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(false);
  const [showEmailAdvancedOptions, setShowEmailAdvancedOptions] = useState(false);
  const [isWaitingEmailOAuth, setWaitingEmailOAuth] = useState(false);
  const [isWaitingConfluenceOAuth, setWaitingConfluenceOAuth] = useState(false);
  // eslint-disable-next-line no-unused-vars
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
  // eslint-disable-next-line no-unused-vars
  const [linearTeamsVersion, setLinearTeamsVersion] = useState(0);
  const [isLinearOauthConnected, setLinearOauthConnected] = useState(false);
  const [isCheckingLinearOauth, setCheckingLinearOauth] = useState(false);
  const [linearOauthError, setLinearOauthError] = useState('');
  const confluenceOauthIntervalRef = useRef(null);
  const confluenceOauthWindowRef = useRef(null);
  const [isWaitingJiraOAuth, setWaitingJiraOAuth] = useState(false);
  const [isJiraOauthConnected, setJiraOauthConnected] = useState(false);
  const [jiraSitesVersion, setJiraSitesVersion] = useState(0);
  const [jiraProjectsVersion, setJiraProjectsVersion] = useState(0);
  const [isCheckingJiraOauth, setCheckingJiraOauth] = useState(false);
  const [jiraOauthError, setJiraOauthError] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connection-type') === 'github') {
      onTypeChange(CONNECTION_TYPE.GITHUB_ISSUE);
      setStepIndex(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, []);

  const columns = useMemo(() => {
    const _columns = CONNECTION_FIELDS[type] || [];
    if (type === CONNECTION_TYPE.GITHUB_ISSUE) return _columns;
    if (type !== CONNECTION_TYPE.EMAIL) return _columns;
    return getVisibleEmailFields(_columns, getEmailProvider(config), showEmailAdvancedOptions);
  }, [type, config, showEmailAdvancedOptions]);

  const customColumns = useMemo(() => columns.filter(c => {
    if (c.type === CONNECTION_FIELD_TYPE.GROUP) return c.children.find(children => children.is_custom);
    return c.is_custom;
  }), [columns]);

  const isGithub = useMemo(() => type === CONNECTION_TYPE.GITHUB_ISSUE, [type]);

  const isEmail = useMemo(() => type === CONNECTION_TYPE.EMAIL, [type]);
  const isLinear = useMemo(() => type === CONNECTION_TYPE.LINEAR, [type]);
  const isConfluence = useMemo(() => type === CONNECTION_TYPE.CONFLUENCE, [type]);
  const isDiscord = useMemo(() => type === CONNECTION_TYPE.DISCORD, [type]);
  const isJira = useMemo(() => type === CONNECTION_TYPE.JIRA_ISSUE, [type]);

  const isMicrosoftEmailProvider = useMemo(() => {
    return isEmail && getEmailProvider(config) === EMAIL_SERVER_PROVIDER.MICROSOFT;
  }, [isEmail, config]);

  const isOAuthEmail = useMemo(() => {
    return isEmail && isOAuthEmailProvider(getEmailProvider(config));
  }, [isEmail, config]);

  const basicCustomColumns = useMemo(() => {
    return customColumns.filter(column => !column.is_advanced_option);
  }, [customColumns]);

  const advancedCustomColumns = useMemo(() => {
    return customColumns.filter(column => column.is_advanced_option);
  }, [customColumns]);

  const step = useMemo(() => {
    return STEPS[stepIndex];
  }, [stepIndex]);

  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (isLinear && !isLinearOauthConnected) return false;
    if (isConfluence && !isConfluenceOauthConnected) return false;
    if (isDiscord && !config.guild_id) return false;
    if (isJira && !isJiraOauthConnected) return false;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, config, customColumns, isLinear, isLinearOauthConnected, isConfluence, isConfluenceOauthConnected, isDiscord]);

  useEffect(() => {
    const handleDiscordOAuthMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type !== 'discord-oauth-success' || !data.guild_id) return;

      setConfig(prevConfig => ({
        ...prevConfig,
        guild_id: String(data.guild_id),
        guild_name: data.guild_name || '',
      }));
      if (oauthWindowRef.current && !oauthWindowRef.current.closed) {
        oauthWindowRef.current.close();
      }
    };

    window.addEventListener('message', handleDiscordOAuthMessage);
    return () => window.removeEventListener('message', handleDiscordOAuthMessage);
  }, []);

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
    if (isDiscord) {
      const channel = _config.channel_id;
      if (channel && channel.value) {
        _config['channel_id'] = channel.value;
      }
    }
    if (isJira) {
      const site = _config.site_id;
      if (site && site.site) {
        _config['site_id'] = site.site.id;
        _config['site_name'] = site.site.name;
        _config['site_url'] = site.site.url;
      }
      const project = _config.project_key;
      if (project && project.project) {
        _config['project_key'] = project.project.key;
        _config['project_name'] = project.project.name;
      }
    }

    onSubmit({ type, name: name.trim(), config: _config }, () => {
      setSubmitting(false);
    });
    return;
  }, [name, type, config, isJira, isLinear, onSubmit, stopEmailOAuthPolling, isConfluence, isGithub, selectedSpaceKeys, isDiscord]);

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
  }, [isConfluenceOauthConnected]);

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
  }, [config.workspace_id, isConfluenceOauthConnected]);

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
  }, [stopConfluenceOAuthPolling]);

  const listDiscordChannels = useCallback(() => {
    const guildId = config.guild_id;
    if (!guildId) return Promise.resolve({ data: { channels: [] } });
    return connectionsAPI.listDiscordChannels(projectUuid, guildId).then(res => {
      const channels = (res && res.data && res.data.channels) || [];
      return {
        data: {
          options: channels.map(c => ({ value: c.id, label: c.name, name: c.name })),
        }
      };
    });
  }, [config.guild_id]);

  const typeOption = availableConnectionTypes.find(i => i.type === type) || availableConnectionTypes[0];
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
  }, []);

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
  }, []);

  const handleConnectDiscord = useCallback(() => {
    const next = window.location.href;
    const oauthUrl = `${server}/discord/oauth/?project_uuid=${projectUuid}&next=${encodeURIComponent(next)}`;
    oauthWindowRef.current = window.open(oauthUrl, 'discord-oauth', 'width=800,height=700');

  }, []);

  useEffect(() => {
    if (!isLinear) return;
    fetchLinearOauthStatus();
  }, [isLinear, fetchLinearOauthStatus]);

  const fetchJiraOauthStatus = useCallback(() => {
    setCheckingJiraOauth(true);
    return connectionsAPI.getJiraOauthStatus(projectUuid).then(res => {
      setJiraOauthConnected(Boolean(res?.data?.connected));
      setJiraOauthError('');
    }).catch(() => {
      setJiraOauthConnected(false);
      setJiraOauthError(gettext('Failed to check Jira authorization status.'));
    }).finally(() => {
      setCheckingJiraOauth(false);
    });
  }, []);

  const handleConnectJira = useCallback(() => {
    const next = window.location.href;
    const oauthUrl = `${server}/jira/oauth/?project_uuid=${projectUuid}&next=${encodeURIComponent(next)}`;
    oauthWindowRef.current = window.open(oauthUrl, 'jira-oauth', 'width=800,height=700');
    setWaitingJiraOAuth(true);
    clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(() => {
      connectionsAPI.getJiraOauthStatus(projectUuid).then(res => {
        if (res?.data?.connected) {
          clearInterval(pollingIntervalRef.current);
          setWaitingJiraOAuth(false);
          setJiraOauthConnected(true);
          setJiraOauthError('');
          setJiraSitesVersion(v => v + 1);
          if (oauthWindowRef.current && !oauthWindowRef.current.closed) {
            oauthWindowRef.current.close();
          }
        }
      }).catch(() => {
        // Silently retry on next interval
      });
    }, 2000);
  }, []);

  const listJiraSites = useCallback(() => {
    if (!isJiraOauthConnected) {
      return Promise.resolve({ data: { options: [] } });
    }
    void jiraSitesVersion;
    return connectionsAPI.listJiraSites(projectUuid).then(res => {
      const sites = res?.data?.sites || [];
      return {
        data: {
          options: sites.map(site => ({
            value: site.id,
            site,
            label: site.name,
            name: site.name,
          })),
        }
      };
    });
  }, [jiraSitesVersion, isJiraOauthConnected]);

  const listJiraProjects = useCallback(() => {
    const siteId = config.site_id;
    const actualSiteId = siteId?.site?.id || siteId?.id || siteId;
    if (!isJiraOauthConnected || !actualSiteId) {
      return Promise.resolve({ data: { options: [] } });
    }
    void jiraProjectsVersion;
    return connectionsAPI.listJiraProjects(projectUuid, actualSiteId).then(res => {
      const projects = res?.data?.projects || [];
      return {
        data: {
          options: projects.map(p => ({
            value: p.id,
            project: p,
            label: `${p.name} (${p.key})`,
            name: p.name,
          })),
        }
      };
    });
  }, [config.site_id, isJiraOauthConnected, jiraProjectsVersion]);

  useEffect(() => {
    if (!isJira) return;
    fetchJiraOauthStatus();
  }, [isJira, fetchJiraOauthStatus]);

  // Reset project_key when site_id changes
  useEffect(() => {
    if (!isJira || !isJiraOauthConnected) return;
    const siteId = config.site_id;
    if (siteId && (siteId.site || siteId.id)) {
      setJiraProjectsVersion(v => v + 1);
      // Clear previous project selection when site changes
      setConfig(prev => {
        if (prev.project_key) {
          return { ...prev, project_key: undefined };
        }
        return prev;
      });
    }
  }, [isJira, isJiraOauthConnected, config.site_id]);

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
    let fieldColumn = column;
    if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && column.key === 'repository' && isGithub) {
      api = listGitHubRepositories;
      if (row[key]) {
        row[key] = row[key].value;
      }
    }
    if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && column.key === 'team_id' && isLinear) {
      api = isLinearOauthConnected ? listLinearTeams : null;
      fieldColumn = {
        ...column,
        readonly: !isLinearOauthConnected,
        placeholder: isLinearOauthConnected ? gettext('Select a team') : gettext('Please connect Linear first'),
      };
      if (row[key]) {
        row[key] = row[key].value || row[key];
      }
    }
    if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && column.key === 'workspace_id' && isConfluence) {
      api = isConfluenceOauthConnected ? listConfluenceWorkspaces : null;
      fieldColumn = {
        ...column,
        readonly: !isConfluenceOauthConnected,
        placeholder: isConfluenceOauthConnected ? gettext('Select a workspace') : gettext('Please connect Confluence first'),
      };
      if (row[key]) {
        row[key] = row[key].value || row[key];
      }
    }
    if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && column.key === 'channel_id' && isDiscord) {
      api = config.guild_id ? listDiscordChannels : null;
      fieldColumn = {
        ...column,
        readonly: !config.guild_id,
        placeholder: config.guild_id ? gettext('Select a channel') : gettext('Please install Discord Bot first'),
      };
      if (row[key]) {
        row[key] = row[key].value || row[key];
      }
    }
    if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && column.key === 'site_id' && isJira) {
      api = isJiraOauthConnected ? listJiraSites : null;
      if (row[key]) {
        row[key] = row[key].value || row[key];
      }
    }
    if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && column.key === 'project_key' && isJira) {
      api = isJiraOauthConnected ? listJiraProjects : null;
      if (row[key]) {
        row[key] = row[key].value || row[key];
      }
    }

    return (
      <ConnectionConfigEditor
        className={is_advanced_option ? 'seaqa-project-connection-advanced-options-field' : ''}
        column={fieldColumn}
        api={api}
        key={key}
        row={row}
        readonly={isSubmitting || fieldColumn.readonly}
        onChange={onConfigChange}
      />
    );

    return editor;
  }, [
    config, isJira, isSubmitting, isGithub, isConfluence, isConfluenceOauthConnected, isLinear,
    onConfigChange, isJiraOauthConnected, listGitHubRepositories, listConfluenceWorkspaces, listLinearTeams,
    isDiscord, listDiscordChannels, isLinearOauthConnected, listJiraProjects, listJiraSites,
  ]);

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
        {stepIndex === 0 && (
          <ConnectionTypeSections
            availableConnectionTypes={availableConnectionTypes}
            selectedType={type}
            onSelectType={onTypeChange}
          />
        )}
        {stepIndex === 1 && (
          <SelectedConnectionHeader
            connection={typeOption}
            hasGithubRepositories={githubRepositories.length > 0}
            installGitHubAppURL={installGitHubAppURL}
          />
        )}
        {step.key === STEP.CONFIG && isGithub && (
          <GithubConnectionConfig
            isLoadingRepositories={isLoadingRepositories}
            githubRepositories={githubRepositories}
            installGitHubAppURL={installGitHubAppURL}
            name={name}
            isSubmitting={isSubmitting}
            onNameChange={onNameChange}
            customColumns={customColumns}
            renderConnectionField={renderConnectionField}
          />
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
            {isOAuthEmail ? basicCustomColumns.slice(0, 1).map(renderConnectionField) : (
              isDiscord
                ? basicCustomColumns.filter(column => column.key !== 'channel_id').map(renderConnectionField)
                : basicCustomColumns.map(renderConnectionField)
            )}
            {isDiscord && (
              <FormGroup>
                <Label>{gettext('Authorization')}</Label>
                <div className="seaqa-project-discord-oauth">
                  {config.guild_id && (
                    <span className="oauth-status-text mr-3">
                      {config.guild_name || config.guild_id}
                    </span>
                  )}
                  <Button
                    color='primary'
                    disabled={isSubmitting}
                    onClick={handleConnectDiscord}
                  >
                    {config.guild_id ? gettext('Reinstall Discord') : gettext('Install Discord Bot')}
                  </Button>
                </div>
              </FormGroup>
            )}
            {isDiscord && basicCustomColumns.filter(column => column.key === 'channel_id').map(renderConnectionField)}
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
                  <span className="oauth-status-badge d-flex align-items-center">
                    <Icon symbol={isConfluenceOauthConnected ? 'check-circle-filled' : 'close-circle-filled'} />
                    <span className="oauth-status-text">{isConfluenceOauthConnected ? gettext('Connected') : gettext('Not connected')}</span>
                  </span>
                  <Button
                    color={isConfluenceOauthConnected ? 'secondary' : 'primary'}
                    className="oauth-status-button"
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
            {isJira && (
              <FormGroup>
                <Label>{gettext('Authorization')}</Label>
                <div className="seaqa-project-connection-oauth-status">
                  <span className={classnames('oauth-status-badge', { connected: isJiraOauthConnected })}>
                    {isJiraOauthConnected ? gettext('Connected') : gettext('Not connected')}
                  </span>
                  <Button
                    color="primary"
                    className="ml-2"
                    disabled={isSubmitting || isCheckingJiraOauth || isWaitingJiraOAuth}
                    onClick={handleConnectJira}
                  >
                    {isJiraOauthConnected ? gettext('Reconnect Jira') : gettext('Connect Jira')}
                  </Button>
                </div>
                {jiraOauthError && <div className="text-danger mt-2">{jiraOauthError}</div>}
              </FormGroup>
            )}
            {isWaitingJiraOAuth && (
              <div className="seaqa-project-connection-oauth-pending">
                <Loading />
                <div className="mt-3">{gettext('Waiting for Jira authorization to complete...')}</div>
              </div>
            )}
          </div>
        )}
      </ModalBody>
      <ConnectionDialogFooter
        stepIndex={stepIndex}
        isSubmitDisabled={isSubmitting || isWaitingEmailOAuth || isWaitingConfluenceOAuth || isWaitingJiraOAuth || !isValid || !name}
        onToggle={onToggle}
        setStepIndex={setStepIndex}
        onSubmit={handleSubmit}
      />
    </Modal>
  );
};

NewConnectionDialog.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired
};

export default NewConnectionDialog;
