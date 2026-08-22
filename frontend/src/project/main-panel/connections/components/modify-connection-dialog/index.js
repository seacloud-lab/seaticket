import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import copy from 'copy-to-clipboard';
import { Button, Modal, Input, ModalBody, ModalFooter, FormGroup, Label, Alert, Row } from 'reactstrap';
import { gettext } from '@/constants';
import { validateName } from '@/utils/validate';
import { CONNECTION_FIELDS, CONNECTION_FIELD_TYPE, CONNECTION_TYPE, EMAIL_SERVER_PROVIDER } from '../../constants';
import { getVisibleEmailFields, getEmailProvider, populateEmailOAuthDefaults, sanitizeEmailConfigByProvider, getEmailOAuthCallbackUrl, isOAuthEmailProvider } from '../../utils';
import { ModalHeader, toaster, Switch, Loading, Icon } from '@/components';
import ConnectionConfigEditor from '../connection-config-editor';
import { connectionsAPI } from '@/project/api';

import '../new-connection-dialog/index.css';

const { server, projectUuid } = window.app.pageOptions;

const getSelectedOptionValue = (value) => value?.value || value || '';

const withEditReadonlyDefaults = (fields) => {
  return fields.map((field) => {
    if (field.type !== CONNECTION_FIELD_TYPE.GROUP) {
      return {
        is_edit_readonly: false,
        ...field,
      };
    }

    return {
      is_edit_readonly: false,
      ...field,
      children: field.children.map((child) => ({
        is_edit_readonly: false,
        ...child,
      })),
    };
  });
};

const ModifyConnectionDialog = ({ record, onSubmit, onToggle }) => {
  const [name, setName] = useState(record?.name || '');
  const [config, setConfig] = useState(record?.config || {});
  const [isChanged, setChanged] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showEmailAdvancedOptions, setShowEmailAdvancedOptions] = useState(false);
  const [isFirebaseCrashOauthConnected, setFirebaseCrashOauthConnected] = useState(false);
  const [isCheckingFirebaseCrashOauth, setCheckingFirebaseCrashOauth] = useState(false);
  const [isWaitingFirebaseCrashOAuth, setWaitingFirebaseCrashOAuth] = useState(false);
  const [firebaseCrashOauthError, setFirebaseCrashOauthError] = useState('');
  const firebaseCrashOauthWindowRef = useRef(null);
  const firebaseCrashOauthIntervalRef = useRef(null);

  const type = useMemo(() => record.type, [record]);
  const isFirebaseCrash = useMemo(() => type === CONNECTION_TYPE.FIREBASE_CRASH, [type]);
  const firebaseProjectId = useMemo(
    () => getSelectedOptionValue(config.project_id),
    [config.project_id]
  );
  const columns = useMemo(() => {
    const _columns = CONNECTION_FIELDS[type] || [];
    if (type === CONNECTION_TYPE.GITHUB_ISSUE) return withEditReadonlyDefaults(_columns.filter(c => c.key !== 'repository'));
    if (type === CONNECTION_TYPE.DISCORD) {
      return withEditReadonlyDefaults(_columns.filter(c => c.key !== 'channel_id')).map((field) => {
        if (field.key !== 'guild_id') return field;
        return {
          ...field,
          is_edit_readonly: true,
        };
      });
    }
    if (type === CONNECTION_TYPE.EMAIL) return withEditReadonlyDefaults(getVisibleEmailFields(_columns, getEmailProvider(config), showEmailAdvancedOptions));
    return withEditReadonlyDefaults(_columns);
  }, [type, config, showEmailAdvancedOptions]);

  const customColumns = useMemo(() => columns.filter(c => {
    if (c.type === CONNECTION_FIELD_TYPE.GROUP) return c.children.find(children => children.is_custom);
    return c.is_custom;
  }), [columns]);

  const isMicrosoftEmailProvider = useMemo(() => {
    return type === CONNECTION_TYPE.EMAIL && getEmailProvider(config) === EMAIL_SERVER_PROVIDER.MICROSOFT;
  }, [type, config]);

  const basicCustomColumns = useMemo(() => {
    return customColumns.filter(column => !column.is_advanced_option);
  }, [customColumns]);

  const advancedCustomColumns = useMemo(() => {
    return customColumns.filter(column => column.is_advanced_option);
  }, [customColumns]);

  const callbackUrl = useMemo(() => getEmailOAuthCallbackUrl(window.app.pageOptions.projectUuid), []);

  const isOAuthEmail = useMemo(() => {
    return type === CONNECTION_TYPE.EMAIL && isOAuthEmailProvider(getEmailProvider(config));
  }, [type, config]);

  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (isFirebaseCrash && !isFirebaseCrashOauthConnected) return false;
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
  }, [name, config, customColumns, isFirebaseCrash, isFirebaseCrashOauthConnected]);

  const stopFirebaseCrashOAuthPolling = useCallback(() => {
    if (firebaseCrashOauthIntervalRef.current) {
      window.clearInterval(firebaseCrashOauthIntervalRef.current);
      firebaseCrashOauthIntervalRef.current = null;
    }
  }, []);

  const fetchFirebaseCrashOauthStatus = useCallback(() => {
    setCheckingFirebaseCrashOauth(true);
    return connectionsAPI.getFirebaseCrashOauthStatus(projectUuid).then(res => {
      setFirebaseCrashOauthConnected(Boolean(res?.data?.connected));
      setFirebaseCrashOauthError(res?.data?.oauth_error || '');
    }).catch(() => {
      setFirebaseCrashOauthConnected(false);
      setFirebaseCrashOauthError(gettext('Failed to check Firebase Crashlytics authorization status.'));
    }).finally(() => {
      setCheckingFirebaseCrashOauth(false);
    });
  }, []);

  const listFirebaseCrashProjects = useCallback(() => {
    if (!isFirebaseCrashOauthConnected) {
      return Promise.resolve({ data: { options: [] } });
    }
    return connectionsAPI.listFirebaseCrashProjects(projectUuid).then(res => {
      const projects = res?.data?.projects || [];
      return {
        data: {
          options: projects.map(project => ({
            value: project.project_id,
            project,
            label: project.name === project.project_id
              ? project.project_id
              : `${project.name} (${project.project_id})`,
            name: project.name,
          })),
        }
      };
    });
  }, [isFirebaseCrashOauthConnected]);

  const listFirebaseCrashDatasets = useCallback(() => {
    if (!isFirebaseCrashOauthConnected || !firebaseProjectId) {
      return Promise.resolve({ data: { options: [] } });
    }
    return connectionsAPI.listFirebaseCrashDatasets(projectUuid, firebaseProjectId).then(res => {
      const datasets = res?.data?.datasets || [];
      return {
        data: {
          options: datasets.map(dataset => ({
            value: dataset.dataset_id,
            dataset,
            label: dataset.name === dataset.dataset_id
              ? dataset.dataset_id
              : `${dataset.name} (${dataset.dataset_id})`,
            name: dataset.name,
          })),
        }
      };
    });
  }, [firebaseProjectId, isFirebaseCrashOauthConnected]);

  const handleConnectFirebaseCrash = useCallback(() => {
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const oauthUrl = `${server}/firebase-crash/oauth/?project_uuid=${projectUuid}&next=${encodeURIComponent(next)}`;
    stopFirebaseCrashOAuthPolling();
    if (firebaseCrashOauthWindowRef.current && !firebaseCrashOauthWindowRef.current.closed) {
      firebaseCrashOauthWindowRef.current.close();
    }
    setFirebaseCrashOauthError('');
    const oauthWindow = window.open(oauthUrl, 'firebase-crash-oauth', 'width=800,height=700');
    if (!oauthWindow) {
      setWaitingFirebaseCrashOAuth(false);
      setFirebaseCrashOauthError(gettext('Unable to open the Google authorization window.'));
      return;
    }
    firebaseCrashOauthWindowRef.current = oauthWindow;
    setWaitingFirebaseCrashOAuth(true);
    firebaseCrashOauthIntervalRef.current = window.setInterval(() => {
      if (oauthWindow.closed) {
        stopFirebaseCrashOAuthPolling();
        firebaseCrashOauthWindowRef.current = null;
        setWaitingFirebaseCrashOAuth(false);
        setFirebaseCrashOauthError(gettext('Google authorization was cancelled or failed.'));
        return;
      }
      connectionsAPI.getFirebaseCrashOauthStatus(projectUuid).then(res => {
        const oauthStatus = res?.data || {};
        if (oauthStatus.oauth_error) {
          stopFirebaseCrashOAuthPolling();
          setWaitingFirebaseCrashOAuth(false);
          setFirebaseCrashOauthConnected(false);
          setFirebaseCrashOauthError(oauthStatus.oauth_error);
          if (!oauthWindow.closed) {
            oauthWindow.close();
          }
          firebaseCrashOauthWindowRef.current = null;
        } else if (oauthStatus.connected && !oauthStatus.oauth_pending) {
          stopFirebaseCrashOAuthPolling();
          setWaitingFirebaseCrashOAuth(false);
          setFirebaseCrashOauthConnected(true);
          setFirebaseCrashOauthError('');
          if (!oauthWindow.closed) {
            oauthWindow.close();
          }
          firebaseCrashOauthWindowRef.current = null;
        }
      }).catch(() => {
        // Silently retry on next interval
      });
    }, 2000);
  }, [stopFirebaseCrashOAuthPolling]);

  useEffect(() => {
    if (!isFirebaseCrash) return undefined;
    fetchFirebaseCrashOauthStatus();
    return undefined;
  }, [isFirebaseCrash, fetchFirebaseCrashOauthStatus]);

  useEffect(() => {
    return () => {
      stopFirebaseCrashOAuthPolling();
      if (firebaseCrashOauthWindowRef.current && !firebaseCrashOauthWindowRef.current.closed) {
        firebaseCrashOauthWindowRef.current.close();
      }
    };
  }, [stopFirebaseCrashOAuthPolling]);

  const onNameChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === name) return;
    setName(newValue);
    setChanged(true);
  }, [name]);

  const onConfigChange = useCallback((key, value) => {
    if (config[key] === value) return;

    if (key === 'server_provider') {
      const nextProvider = value || EMAIL_SERVER_PROVIDER.GENERAL;
      setConfig(populateEmailOAuthDefaults({ ...config, [key]: nextProvider }, nextProvider));
      setShowEmailAdvancedOptions(false);
      setChanged(true);
      return;
    }

    if (isFirebaseCrash && key === 'project_id') {
      const previousProjectId = getSelectedOptionValue(config.project_id);
      const selectedProjectId = getSelectedOptionValue(value);
      setConfig({
        ...config,
        [key]: value,
        dataset_id: previousProjectId === selectedProjectId ? config.dataset_id : undefined,
      });
      setChanged(true);
      return;
    }

    setConfig({ ...config, [key]: value });
    setChanged(true);
  }, [config, isFirebaseCrash]);

  const handleSubmit = useCallback(() => {
    const { isValid, message } = validateName(name);
    if (!isValid) {
      setErrorMsg(message);
      return;
    }
    setSubmitting(true);
    let validConfig = { ...config };
    let connectionFields = CONNECTION_FIELDS[record.type] || [];
    if (record.type === CONNECTION_TYPE.EMAIL) {
      validConfig = sanitizeEmailConfigByProvider(validConfig);
      connectionFields = getVisibleEmailFields(connectionFields, getEmailProvider(config), showEmailAdvancedOptions).reduce((acc, item) => {
        if (item.type === CONNECTION_FIELD_TYPE.GROUP) {
          return [...acc, ...item.children];
        } else {
          return [...acc, item];
        }
      }, []);
    }
    if (record.type === CONNECTION_TYPE.FIREBASE_CRASH) {
      validConfig.project_id = getSelectedOptionValue(validConfig.project_id);
      validConfig.dataset_id = getSelectedOptionValue(validConfig.dataset_id);
    }
    Object.keys(validConfig).forEach((key) => {
      const field = connectionFields.find(f => f.key === key);
      const fieldType = field?.type;

      if (fieldType === CONNECTION_FIELD_TYPE.NUMBER) {
        validConfig[key] = validConfig[key] ? parseInt(validConfig[key], 10) : '';
      } else if (fieldType === CONNECTION_FIELD_TYPE.SELECT) {
        validConfig[key] = validConfig[key] || '';
      } else if (typeof validConfig[key] === 'string') {
        validConfig[key] = validConfig[key] ? validConfig[key].trim() : '';
      }
    });
    onSubmit({ name, config: validConfig }, () => setSubmitting(false));
  }, [record, name, config, showEmailAdvancedOptions, onSubmit]);

  const renderConnectionField = useCallback((column) => {
    const { type, key, children, is_edit_readonly, is_advanced_option } = column;
    if (type === CONNECTION_FIELD_TYPE.GROUP) {
      return (
        <Row className="mx-0 seaqa-project-connection-group-config" key={key}>
          {children.map((child, index) => (
            <ConnectionConfigEditor
              key={`${key}-${index}`}
              column={child}
              className="mx-0 px-0 width-half"
              row={config}
              readonly={isSubmitting || child.is_edit_readonly}
              canModifyPassword={false}
              onChange={onConfigChange}
            />
          ))}
        </Row>
      );
    }

    let api = null;
    let row = { ...config };
    let fieldColumn = column;
    if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && key === 'project_id' && isFirebaseCrash) {
      api = isFirebaseCrashOauthConnected ? listFirebaseCrashProjects : null;
      fieldColumn = {
        ...column,
        readonly: !isFirebaseCrashOauthConnected,
        placeholder: isFirebaseCrashOauthConnected
          ? gettext('Select a Firebase project')
          : gettext('Please connect Google first'),
      };
      row[key] = getSelectedOptionValue(row[key]);
    }
    if (type === CONNECTION_FIELD_TYPE.SYNC_SELECT && key === 'dataset_id' && isFirebaseCrash) {
      api = isFirebaseCrashOauthConnected && firebaseProjectId ? listFirebaseCrashDatasets : null;
      fieldColumn = {
        ...column,
        readonly: !isFirebaseCrashOauthConnected || !firebaseProjectId,
        placeholder: !isFirebaseCrashOauthConnected
          ? gettext('Please connect Google first')
          : firebaseProjectId
            ? gettext('Select a BigQuery dataset')
            : gettext('Select a Firebase project first'),
      };
      row[key] = getSelectedOptionValue(row[key]);
    }

    return (
      <ConnectionConfigEditor
        className={is_advanced_option ? 'seaqa-project-connection-advanced-options-field' : ''}
        column={fieldColumn}
        api={api}
        key={key}
        row={row}
        readonly={isSubmitting || is_edit_readonly || fieldColumn.readonly}
        canModifyPassword={false}
        onChange={onConfigChange}
      />
    );
  }, [
    config, isSubmitting, onConfigChange, isFirebaseCrash, isFirebaseCrashOauthConnected,
    firebaseProjectId, listFirebaseCrashProjects, listFirebaseCrashDatasets,
  ]);

  const onCopyCallbackUrl = useCallback(() => {
    copy(callbackUrl);
    toaster.success(gettext('Connection URL has been copied to clipboard'), { duration: 2 });
  }, [callbackUrl]);

  return (
    <Modal isOpen={true} toggle={onToggle} autoFocus={false} className="seaqa-project-connection-dialog" >
      <ModalHeader toggle={onToggle}>{gettext('Edit connection')}</ModalHeader>
      <ModalBody className="seaqa-project-connection-body">
        <FormGroup>
          <Label>
            {gettext('Connection name')}
            <span className="required-tip" title={gettext('Required')}>{'*'}</span>
          </Label>
          <Input value={name} onChange={onNameChange} autoFocus disabled={isSubmitting} />
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
        {isFirebaseCrash && (
          <FormGroup>
            <Label>{gettext('Authorization')}</Label>
            <div className="seaqa-project-jira-oauth">
              <span className={classnames('jira-oauth-status', { connected: isFirebaseCrashOauthConnected })}>
                <span className="jira-status-icon d-flex">
                  <Icon symbol={isFirebaseCrashOauthConnected ? 'check-circle-filled' : 'close-circle-filled'} />
                </span>
                {isFirebaseCrashOauthConnected ? gettext('Connected') : gettext('Not connected')}
              </span>
              <Button
                color={isFirebaseCrashOauthConnected ? 'secondary' : 'primary'}
                disabled={isSubmitting || isCheckingFirebaseCrashOauth || isWaitingFirebaseCrashOAuth}
                onClick={handleConnectFirebaseCrash}
              >
                {isFirebaseCrashOauthConnected ? gettext('Reconnect Google') : gettext('Connect Google')}
              </Button>
              {firebaseCrashOauthError && (<div className="text-danger">{firebaseCrashOauthError}</div>)}
            </div>
          </FormGroup>
        )}
        {isWaitingFirebaseCrashOAuth && (
          <div className="seaqa-project-connection-oauth-pending">
            <Loading />
            <div className="mt-3">{gettext('Waiting for Google authorization to complete...')}</div>
          </div>
        )}
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
        {errorMsg && (<Alert color="danger">{errorMsg}</Alert>)}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit} disabled={isSubmitting || !isValid || !isChanged}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
};

ModifyConnectionDialog.propTypes = {
  record: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired
};

export default ModifyConnectionDialog;
