import React from 'react';
import PropTypes from 'prop-types';
import { Button, FormGroup, Input, Label, Modal, ModalBody } from 'reactstrap';
import { gettext } from '@/constants';
import { Icon, Loading, ModalHeader } from '@/components';

const ConfluenceConfig = ({
  isConfluenceOauthConnected,
  isSubmitting,
  isCheckingConfluenceOauth,
  isWaitingConfluenceOAuth,
  setWaitingConfluenceOAuth,
  handleConnectConfluence,
  confluenceOauthError,
  config,
  name,
  onNameChange,
  basicCustomColumns,
  renderConnectionField,
  isLoadingConfluenceSpaces,
  confluenceSpaces,
  selectedSpaceKeys,
  toggleSpaceSelection,
}) => (
  <div className="seaqa-project-new-connection-config">
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
    <FormGroup>
      <Label>
        {gettext('Connection name')}
        <span className="required-tip" title={gettext('Required')}>{'*'}</span>
      </Label>
      <Input value={name} onChange={onNameChange} disabled={isSubmitting} />
    </FormGroup>
    {basicCustomColumns.map(renderConnectionField)}
    {isConfluenceOauthConnected && config.workspace_id && (
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
    <Modal
      isOpen={isWaitingConfluenceOAuth}
      toggle={() => setWaitingConfluenceOAuth(false)}
      centered
      backdrop="static"
      keyboard={false}
      className="seaqa-project-connection-oauth-modal"
    >
      <ModalHeader toggle={() => setWaitingConfluenceOAuth(false)}>
        {gettext('Confluence authorization')}
      </ModalHeader>
      <ModalBody>
        <div className="seaqa-project-connection-oauth-pending">
          <Loading />
          <div className="mt-3">{gettext('Waiting for Confluence authorization to complete...')}</div>
        </div>
      </ModalBody>
    </Modal>
  </div>
);

ConfluenceConfig.propTypes = {
  isConfluenceOauthConnected: PropTypes.bool.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  isCheckingConfluenceOauth: PropTypes.bool.isRequired,
  isWaitingConfluenceOAuth: PropTypes.bool.isRequired,
  setWaitingConfluenceOAuth: PropTypes.func.isRequired,
  handleConnectConfluence: PropTypes.func.isRequired,
  confluenceOauthError: PropTypes.string.isRequired,
  config: PropTypes.object.isRequired,
  name: PropTypes.string.isRequired,
  onNameChange: PropTypes.func.isRequired,
  basicCustomColumns: PropTypes.array.isRequired,
  renderConnectionField: PropTypes.func.isRequired,
  isLoadingConfluenceSpaces: PropTypes.bool.isRequired,
  confluenceSpaces: PropTypes.array.isRequired,
  selectedSpaceKeys: PropTypes.array.isRequired,
  toggleSpaceSelection: PropTypes.func.isRequired,
};

export default ConfluenceConfig;
