import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { Button, Modal, Input, ModalBody, ModalFooter, FormGroup, Label, Row } from 'reactstrap';
import { gettext } from '@/constants';
import { CONNECTION_TYPES, CONNECTION_FIELDS, CONNECTION_FIELD_TYPE, CONNECTION_TYPE, STEP, STEPS, getAvailableConnectionTypes } from '../../constants';
import { ModalHeader, Loading, SecondaryBtn, toaster } from '@/components';
import ConnectionConfigEditor from '../connection-config-editor';
import { getConnectionIcon } from '../../utils';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { useConnections } from '../../hooks/connections';

import './index.css';

const { server, projectUuid, workspaceID, projectName } = window.app.pageOptions;
const { enableGeneralTask } = window.app.pageOptions;

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

const NewConnectionDialog = ({ onSubmit, onToggle, modifyConnection }) => {
  const availableConnectionTypes = useMemo(() => getAvailableConnectionTypes(enableGeneralTask), [enableGeneralTask]);
  const [stepIndex, setStepIndex] = useState(0);
  const [type, setType] = useState(availableConnectionTypes[0]?.type || CONNECTION_TYPES[0].type);
  const [name, setName] = useState('');
  const [config, setConfig] = useState(initializeConfig(availableConnectionTypes[0]?.type || CONNECTION_TYPES[0].type));
  const [isSubmitting, setSubmitting] = useState(false);
  const [githubRepositories, setGithubRepositories] = useState([]);
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(false);
  const { updateUrlParams } = useConnections();
  const prevStepIndexRef = useRef(stepIndex);
  const oauthWindowRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const [linearTeamsVersion, setLinearTeamsVersion] = useState(0);
  const [isLinearOauthConnected, setLinearOauthConnected] = useState(false);
  const [isCheckingLinearOauth, setCheckingLinearOauth] = useState(false);
  const [linearOauthError, setLinearOauthError] = useState('');

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
    return _columns;
  }, [type]);

  const customColumns = useMemo(() => columns.filter(c => {
    if (c.type === CONNECTION_FIELD_TYPE.GROUP) return c.children.find(children => children.is_custom);
    return c.is_custom;
  }), [columns]);

  const isGithub = useMemo(() => type === CONNECTION_TYPE.GITHUB_ISSUE, [type]);
  const isEmail = useMemo(() => type === CONNECTION_TYPE.EMAIL, [type]);
  const isLinear = useMemo(() => type === CONNECTION_TYPE.LINEAR, [type]);

  const step = useMemo(() => {
    return STEPS[stepIndex];
  }, [STEPS, stepIndex]);

  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (isLinear && !isLinearOauthConnected) return false;
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
  }, [name, config, customColumns, isLinear, isLinearOauthConnected]);

  const onNameChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === name) return;
    setName(newValue);
  }, [name]);

  const onTypeChange = useCallback((newType) => {
    if (type === newType) return;
    setConfig(initializeConfig(newType));
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

  const onConfigChange = useCallback((key, value) => {
    if (config[key] === value) return;
    setConfig({ ...config, [key]: value });
  }, [config]);

  const handleSubmit = useCallback(() => {
    setSubmitting(true);
    let _config = { ...config };
    if (isGithub) {
      const repository = _config.repository.repository;
      delete _config['repository'];
      _config['repository'] = repository['html_url'];
      _config['installation_id'] = repository['installation_id'];
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
  }, [name, type, config, onSubmit, onToggle, modifyConnection]);

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
        <div className="seaqa-project-selected-connection">
          {stepIndex === 0 ?
            <div className="seaqa-project-selected-no-type">{gettext('Select connection type')}</div>
            :
            <>
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
                    style={{ width: 20, height: 20 }}
                  />
                  <span className="seaqa-project-new-connection-name">{typeOption.name}</span>
                </div>
                {(typeOption.type === CONNECTION_TYPE.GITHUB_ISSUE && githubRepositories.length > 0) && (
                  <SecondaryBtn text={gettext('Manage GitHub app')} onClick={() => window.open(installGitHubAppURL, '_blank')} />
                )}
              </div>
            </>
          }
        </div>
        {step.key === STEP.TYPE && (
          <div className="seaqa-project-new-connection-types">
            {availableConnectionTypes.map(connection => {
              const { type: key, name } = connection;
              const isActive = key === type;
              return (
                <div className={classnames('seaqa-project-new-connection-type', { 'selected': isActive })} key={key} onClick={() => onTypeChange(key)}>
                  <img src={getConnectionIcon(key)} alt={name} className="seaqa-project-new-connection-icon" />
                  <span className="seaqa-project-new-connection-name">{name}</span>
                </div>
              );
            })}
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
            {customColumns.map(c => {
              const { type, key, children } = c;
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
              if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && c.key === 'repository' && isGithub) {
                api = listGitHubRepositories;
                if (row[key]) {
                  row[key] = row[key].value;
                }
              }
              if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && c.key === 'team_id' && isLinear) {
                api = listLinearTeams;
                if (row[key]) {
                  row[key] = row[key].value || row[key];
                }
              }
              return ((
                <ConnectionConfigEditor column={c} api={api} key={key} row={row} readonly={isSubmitting} onChange={onConfigChange} />
              ));
            })}
            {isLinear && (
              <FormGroup>
                <Label>{gettext('Authorization')}</Label>
                <div className="seaqa-project-linear-oauth">
                  <span className={classnames('linear-oauth-status', { connected: isLinearOauthConnected })}>
                    {isLinearOauthConnected ? gettext('Connected') : gettext('Not connected')}
                  </span>
                  <Button
                    color="primary"
                    className="ml-2"
                    disabled={isSubmitting || isCheckingLinearOauth}
                    onClick={handleConnectLinear}
                  >
                    {isLinearOauthConnected ? gettext('Reconnect Linear') : gettext('Connect Linear')}
                  </Button>
                  {linearOauthError && (<div className="text-danger mt-2">{linearOauthError}</div>)}
                </div>
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
            {customColumns.map(c => {
              const { type, key, children } = c;
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
              if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && c.key === 'repository' && isGithub) {
                api = listGitHubRepositories;
                if (row[key]) {
                  row[key] = row[key].value;
                }
              }
              if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && c.key === 'team_id' && isLinear) {
                api = listLinearTeams;
                if (row[key]) {
                  row[key] = row[key].value || row[key];
                }
              }
              return ((
                <ConnectionConfigEditor column={c} api={api} key={key} row={row} readonly={isSubmitting} onChange={onConfigChange} />
              ));
            })}
          </div>
        )}
      </ModalBody>
      {stepIndex === 0 && (
        <ModalFooter>
          <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={() => setStepIndex(1)}>{gettext('Next')}</Button>
        </ModalFooter>
      )}
      {stepIndex === 1 && (
        <ModalFooter>
          <Button color="secondary" onClick={() => setStepIndex(0)}>{gettext('Previous')}</Button>
          <Button color="primary" onClick={handleSubmit} disabled={isSubmitting || !isValid || !name}>{gettext('Submit')}</Button>
        </ModalFooter>
      )}
    </Modal>
  );
};

NewConnectionDialog.propTypes = {
  connection: PropTypes.object,
  connections: PropTypes.array,
  onSubmit: PropTypes.func.isRequired,
  modifyConnection: PropTypes.func,
  onToggle: PropTypes.func.isRequired
};

export default NewConnectionDialog;
