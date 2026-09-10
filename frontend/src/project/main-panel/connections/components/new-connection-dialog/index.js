import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Button, Modal, Input, ModalBody, FormGroup, Label, Row } from 'reactstrap';
import PropTypes from 'prop-types';
import { ModalHeader, Loading, toaster, Icon } from '@/components';
import { gettext } from '@/constants';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { CONNECTION_TYPES, CONNECTION_FIELDS, CONNECTION_FIELD_TYPE, CONNECTION_TYPE, STEP, STEPS, EMAIL_SERVER_PROVIDER, getAvailableConnectionTypes } from '../../constants';
import { useConnections } from '../../hooks/connections';
import { getVisibleEmailFields, getEmailProvider, isOAuthEmailProvider, hasValidMicrosoftOAuthUrls, sanitizeEmailConfigByProvider } from '../../utils';
import ConnectionConfigEditor from '../connection-config-editor';
import { ConfluenceConfig, DiscordConfig, GithubConfig, JiraConfig, LinearConfig, NotionConfig } from './connection-config';
import ConnectionDialogFooter from './connection-dialog-footer';
import ConnectionTypeSections from './connection-type-sections';
import SelectedConnectionHeader from './selected-connection-header';

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
  const [showEmailAdvancedOptions] = useState(false);
  const [isWaitingEmailOAuth, setWaitingEmailOAuth] = useState(false);
  const [emailOAuthState, setEmailOAuthState] = useState('');
  const [emailOAuthSender, setEmailOAuthSender] = useState(null);
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
  const emailOauthWindowRef = useRef(null);
  const oauthWindowRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  // eslint-disable-next-line no-unused-vars
  const [linearTeamsVersion, setLinearTeamsVersion] = useState(0);
  const [isLinearOauthConnected, setLinearOauthConnected] = useState(false);
  const [isWaitingLinearOAuth, setWaitingLinearOAuth] = useState(false);
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
  const [isWaitingNotionOAuth, setWaitingNotionOAuth] = useState(false);
  const [isNotionOauthConnected, setNotionOauthConnected] = useState(false);
  const [isCheckingNotionOauth] = useState(false);
  const [notionOauthError, setNotionOauthError] = useState('');
  const notionOauthWindowRef = useRef(null);

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
    return getVisibleEmailFields(_columns, getEmailProvider(config), showEmailAdvancedOptions, config.account_type);
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
  const isNotion = useMemo(() => type === CONNECTION_TYPE.NOTION, [type]);

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
    if (isOAuthEmail && !emailOAuthState) return false;
    if (isNotion && !isNotionOauthConnected) return false;
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
  }, [name, config, customColumns, isLinear, isLinearOauthConnected, isConfluence, isConfluenceOauthConnected, isDiscord, isOAuthEmail, emailOAuthState, isJira, isJiraOauthConnected, isNotion, isNotionOauthConnected]);

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
      if (emailOauthWindowRef.current && !emailOauthWindowRef.current.closed) {
        emailOauthWindowRef.current.close();
      }
      if (confluenceOauthWindowRef.current && !confluenceOauthWindowRef.current.closed) {
        confluenceOauthWindowRef.current.close();
      }
      if (notionOauthWindowRef.current && !notionOauthWindowRef.current.closed) {
        notionOauthWindowRef.current.close();
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
    setConfig(nextConfig);
    setType(newType);

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
      setConfig({
        ...config,
        [key]: nextProvider,
        ...(isOAuthEmailProvider(nextProvider) ? { account_type: 'personal' } : { account_type: undefined }),
      });
      setEmailOAuthState('');
      setEmailOAuthSender(null);
      return;
    }

    setConfig({ ...config, [key]: value });
  }, [config]);

  const handleEmailOAuthLogin = useCallback(() => {
    let _config = { ...config };
    _config = sanitizeEmailConfigByProvider(_config);
    if (!hasValidMicrosoftOAuthUrls(_config)) {
      toaster.danger(gettext('Microsoft OAuth URLs must start with https://login.microsoftonline.com/.'));
      return;
    }
    setSubmitting(true);
    connectionsAPI.startEmailOAuth(projectUuid, { name: name.trim(), config: _config }).then((res) => {
      const authorizationUrl = res.data?.auth_url;
      const oauthState = res.data?.state;
      if (!authorizationUrl || !oauthState) {
        setSubmitting(false);
        toaster.danger(gettext('Failed to fetch authorization url'));
        return;
      }

      emailOauthWindowRef.current = window.open(authorizationUrl, '_blank', 'width=600,height=700');
      if (!emailOauthWindowRef.current) {
        setSubmitting(false);
        toaster.danger(gettext('Failed to open authorization window. Please allow pop-ups and try again.'));
        return;
      }

      setWaitingEmailOAuth(true);
      stopEmailOAuthPolling();
      emailOAuthIntervalRef.current = window.setInterval(() => {
        connectionsAPI.queryEmailOAuth(projectUuid, oauthState).then((progressRes) => {
          const oauthStatus = progressRes.data?.status;
          if (oauthStatus === 'in-progress') {
            if (!emailOauthWindowRef.current.closed) return;
            stopEmailOAuthPolling();
            setWaitingEmailOAuth(false);
            setSubmitting(false);
            toaster.danger(gettext('OAuth authorization was cancelled.'));
            return;
          }

          stopEmailOAuthPolling();
          setWaitingEmailOAuth(false);
          setSubmitting(false);
          if (oauthStatus !== 'authorized') {
            toaster.danger(progressRes.data?.error_msg || gettext('OAuth authorization failed.'));
            return;
          }
          setEmailOAuthState(oauthState);
          setEmailOAuthSender({
            sender_name: progressRes.data?.sender_name || '',
            sender_email: progressRes.data?.sender_email || '',
          });
        }).catch((error) => {
          stopEmailOAuthPolling();
          setWaitingEmailOAuth(false);
          setSubmitting(false);
          toaster.danger(emailOauthWindowRef.current?.closed
            ? gettext('OAuth authorization was cancelled.')
            : Utils.getErrorMsg(error));
        });
      }, 2000);
    }).catch((error) => {
      setSubmitting(false);
      toaster.danger(Utils.getErrorMsg(error));
    });
  }, [config, name, stopEmailOAuthPolling]);

  const handleSubmit = useCallback(() => {
    setSubmitting(true);
    let _config = { ...config };
    if (type === CONNECTION_TYPE.EMAIL) {
      _config = sanitizeEmailConfigByProvider(_config);
      if (isOAuthEmailProvider(_config.server_provider)) {
        onSubmit({ type, name: name.trim(), config: _config, oauthState: emailOAuthState }, () => {
          setSubmitting(false);
        });
        return;
      }
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
  }, [name, type, config, isJira, isLinear, onSubmit, isConfluence, isGithub, selectedSpaceKeys, isDiscord, emailOAuthState]);

  const listGitHubRepositories = useCallback((signal) => {
    return connectionsAPI.listGitHubRepositories(projectUuid, signal).then(res => {
      const { repositories } = res.data;
      return {
        data: {
          options: repositories.map(r => ({ value: r.id, repository: r, label: r.name, name: r.name })),
        }
      };
    });
  }, []);

  const listConfluenceWorkspaces = useCallback((signal) => {
    if (!isConfluenceOauthConnected) {
      return Promise.resolve({ data: { options: [] } });
    }
    return connectionsAPI.listConfluenceWorkspaces(projectUuid, signal).then((res) => {
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

  const listDiscordChannels = useCallback((signal) => {
    const guildId = config.guild_id;
    if (!guildId) return Promise.resolve({ data: { channels: [] } });
    return connectionsAPI.listDiscordChannels(projectUuid, guildId, signal).then(res => {
      const channels = (res && res.data && res.data.channels) || [];
      return {
        data: {
          options: channels.map(c => ({ value: c.id, label: c.name, name: c.name })),
        }
      };
    });
  }, [config.guild_id]);

  const typeOption = availableConnectionTypes.find(i => i.type === type) || availableConnectionTypes[0];
  const listLinearTeams = useCallback((signal) => {
    return connectionsAPI.listLinearTeams(projectUuid, signal).then(res => {
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
    setWaitingLinearOAuth(true);

    // Start polling for OAuth status
    clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(() => {
      connectionsAPI.getLinearOauthStatus(projectUuid).then(res => {
        if (res?.data?.connected) {
          setLinearOauthConnected(true);
          setLinearOauthError('');
          setWaitingLinearOAuth(false);
          setLinearTeamsVersion(v => v + 1);
          clearInterval(pollingIntervalRef.current);
          if (oauthWindowRef.current && !oauthWindowRef.current.closed) {
            oauthWindowRef.current.close();
          }
        }
      }).catch(() => {
        // Silently retry on next interval
        setWaitingLinearOAuth(false);
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

  const handleConnectNotion = useCallback(() => {
    const next = window.location.href;
    const oauthUrl = `${server}/notion/oauth/?project_uuid=${projectUuid}&next=${encodeURIComponent(next)}`;
    notionOauthWindowRef.current = window.open(oauthUrl, 'notion-oauth', 'width=800,height=700');
    setWaitingNotionOAuth(true);
  }, []);

  useEffect(() => {
    const handleNotionOAuthMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type !== 'notion-oauth-success') return;

      setWaitingNotionOAuth(false);
      setNotionOauthConnected(true);
      setNotionOauthError('');
      setConfig(prevConfig => ({
        ...prevConfig,
        workspace_id: data.workspace_id || '',
        workspace_name: data.workspace_name || '',
        workspace_icon: data.workspace_icon || '',
      }));
      if (notionOauthWindowRef.current && !notionOauthWindowRef.current.closed) {
        notionOauthWindowRef.current.close();
      }
    };

    window.addEventListener('message', handleNotionOAuthMessage);
    return () => window.removeEventListener('message', handleNotionOAuthMessage);
  }, []);

  const listJiraSites = useCallback((signal) => {
    if (!isJiraOauthConnected) {
      return Promise.resolve({ data: { options: [] } });
    }
    void jiraSitesVersion;
    return connectionsAPI.listJiraSites(projectUuid, signal).then(res => {
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

  const listJiraProjects = useCallback((signal) => {
    const siteId = config.site_id;
    const actualSiteId = siteId?.site?.id || siteId?.id || siteId;
    if (!isJiraOauthConnected || !actualSiteId) {
      return Promise.resolve({ data: { options: [] } });
    }
    void jiraProjectsVersion;
    return connectionsAPI.listJiraProjects(projectUuid, actualSiteId, signal).then(res => {
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
      fieldColumn = {
        ...column,
        readonly: !isJiraOauthConnected,
        placeholder: isJiraOauthConnected ? gettext('Select a Jira site') : gettext('Please connect Jira first'),
      };
      if (row[key]) {
        row[key] = row[key].value || row[key];
      }
    }
    if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && column.key === 'project_key' && isJira) {
      api = isJiraOauthConnected ? listJiraProjects : null;
      fieldColumn = {
        ...column,
        readonly: !isJiraOauthConnected,
        placeholder: isJiraOauthConnected ? gettext('Select a Jira project') : gettext('Please connect Jira first'),
      };
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
        {step.key === STEP.TYPE && (
          <ConnectionTypeSections
            availableConnectionTypes={availableConnectionTypes}
            selectedType={type}
            onSelectType={onTypeChange}
          />
        )}
        {step.key === STEP.CONFIG && (
          <SelectedConnectionHeader
            connection={typeOption}
            hasGithubRepositories={githubRepositories.length > 0}
            installGitHubAppURL={installGitHubAppURL}
          />
        )}
        {step.key === STEP.CONFIG && isGithub && (
          <GithubConfig
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
        {step.key === STEP.CONFIG && isJira && (
          <JiraConfig
            isJiraOauthConnected={isJiraOauthConnected}
            isSubmitting={isSubmitting}
            isCheckingJiraOauth={isCheckingJiraOauth}
            isWaitingJiraOAuth={isWaitingJiraOAuth}
            setWaitingJiraOAuth={setWaitingJiraOAuth}
            jiraOauthError={jiraOauthError}
            handleConnectJira={handleConnectJira}
            name={name}
            onNameChange={onNameChange}
            basicCustomColumns={basicCustomColumns}
            renderConnectionField={renderConnectionField}
          />
        )}
        {step.key === STEP.CONFIG && isConfluence && (
          <ConfluenceConfig
            isConfluenceOauthConnected={isConfluenceOauthConnected}
            isSubmitting={isSubmitting}
            isCheckingConfluenceOauth={isCheckingConfluenceOauth}
            isWaitingConfluenceOAuth={isWaitingConfluenceOAuth}
            setWaitingConfluenceOAuth={setWaitingConfluenceOAuth}
            handleConnectConfluence={handleConnectConfluence}
            confluenceOauthError={confluenceOauthError}
            config={config}
            name={name}
            onNameChange={onNameChange}
            basicCustomColumns={basicCustomColumns}
            renderConnectionField={renderConnectionField}
            isLoadingConfluenceSpaces={isLoadingConfluenceSpaces}
            confluenceSpaces={confluenceSpaces}
            selectedSpaceKeys={selectedSpaceKeys}
            toggleSpaceSelection={toggleSpaceSelection}
          />
        )}
        {step.key === STEP.CONFIG && isLinear && (
          <LinearConfig
            isLinearOauthConnected={isLinearOauthConnected}
            isWaitingLinearOAuth={isWaitingLinearOAuth}
            setWaitingLinearOAuth={setWaitingLinearOAuth}
            isSubmitting={isSubmitting}
            isCheckingLinearOauth={isCheckingLinearOauth}
            handleConnectLinear={handleConnectLinear}
            linearOauthError={linearOauthError}
            name={name}
            onNameChange={onNameChange}
            basicCustomColumns={basicCustomColumns}
            renderConnectionField={renderConnectionField}
          />
        )}
        {step.key === STEP.CONFIG && isDiscord && (
          <DiscordConfig
            isSubmitting={isSubmitting}
            config={config}
            name={name}
            onNameChange={onNameChange}
            basicCustomColumns={basicCustomColumns}
            renderConnectionField={renderConnectionField}
            handleConnectDiscord={handleConnectDiscord}
          />
        )}
        {step.key === STEP.CONFIG && isNotion && (
          <NotionConfig
            isNotionOauthConnected={isNotionOauthConnected}
            isWaitingNotionOAuth={isWaitingNotionOAuth}
            setWaitingNotionOAuth={setWaitingNotionOAuth}
            isSubmitting={isSubmitting}
            isCheckingNotionOauth={isCheckingNotionOauth}
            handleConnectNotion={handleConnectNotion}
            notionOauthError={notionOauthError}
            name={name}
            onNameChange={onNameChange}
            basicCustomColumns={basicCustomColumns}
            renderConnectionField={renderConnectionField}
          />
        )}
        {step.key === STEP.CONFIG && !isGithub && !isJira && !isConfluence && !isLinear && !isDiscord && !isNotion && (
          <div className="seaqa-project-new-connection-config">
            <FormGroup>
              <Label>
                {gettext('Connection name')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
              <Input value={name} onChange={onNameChange} disabled={isSubmitting} />
            </FormGroup>
            {isOAuthEmail ? basicCustomColumns.filter(column => column.key !== 'account_type').map(renderConnectionField) : (
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
            {false && isOAuthEmail && basicCustomColumns.filter(column => column.key === 'account_type').map(renderConnectionField)}
            {advancedCustomColumns.map(renderConnectionField)}
            {isOAuthEmail && (
              <FormGroup>
                <Label>{gettext('Authorization')}</Label>
                <div className="seaqa-project-connection-oauth-status">
                  <span className="oauth-status-text mr-3">
                    {emailOAuthSender
                      ? (emailOAuthSender.sender_name
                        ? `${emailOAuthSender.sender_name} <${emailOAuthSender.sender_email}>`
                        : emailOAuthSender.sender_email)
                      : gettext('Not logged in')}
                  </span>
                  <Button
                    color={emailOAuthSender ? 'secondary' : 'primary'}
                    disabled={isSubmitting || isWaitingEmailOAuth || !name.trim()}
                    onClick={handleEmailOAuthLogin}
                  >
                    {gettext('Login')}
                  </Button>
                </div>
              </FormGroup>
            )}

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
          </div>
        )}
      </ModalBody>
      <ConnectionDialogFooter
        stepIndex={stepIndex}
        isSubmitDisabled={isSubmitting || isWaitingEmailOAuth || isWaitingConfluenceOAuth || isWaitingJiraOAuth || isWaitingLinearOAuth || isWaitingNotionOAuth || !isValid || !name}
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
