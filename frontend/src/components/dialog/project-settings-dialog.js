import React, { Fragment, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, TabContent, TabPane, Nav, NavItem, NavLink } from 'reactstrap';
import { gettext } from '../../constants';
import { TAB } from '../../constants/project-setting-tabs';
import Loading from '../loading';
import ModalHeader from '../modal-header';
import DeveloperModeDialog from './developer-mode-dialog';
import './project-settings.css';

const propTypes = {
  toggleDialog: PropTypes.func.isRequired,
  projectUuid: PropTypes.string.isRequired,
  currentProjectInfo: PropTypes.object,
};

const ProjectSettingsDialog = ({ projectUuid, projectName , workspaceID, isProjectAdmin, currentProjectInfo, toggleDialog, tab }) => {
  const [activeTab, setActiveTab] = useState(tab || TAB.DEVELOPER_MODE);
  const [isMigrating, setIsMigrating] = useState(false);

  const toggleTab = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  const onTabKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.target.click();
    }
  }, []);

  const enableDeveloperMode = isProjectAdmin;

  const handleSubmitDeveloperMode = useCallback((newValue) => {
    console.log('Save developer mode setting for project', projectUuid, newValue);
  }, [projectUuid]);

  return (
    <div>
      <Modal isOpen={true} className="lib-settings-dialog" toggle={toggleDialog}>
        {isMigrating && (
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1050,
            }}
          >
            <Loading />
          </div>
        )}

        <ModalHeader toggle={toggleDialog}>
          {gettext('Settings')}
        </ModalHeader>

        <ModalBody className="d-md-flex p-md-0" role="tablist">
          <Fragment>
            <div className="lib-setting-nav p-4">
              <Nav pills className="flex-column">
                {enableDeveloperMode && (
                  <NavItem
                    role="tab"
                    aria-selected={activeTab === TAB.DEVELOPER_MODE}
                    aria-controls="developer-mode-setting-panel"
                  >
                    <NavLink
                      className={activeTab === TAB.DEVELOPER_MODE ? 'active' : ''}
                      onClick={() => toggleTab(TAB.DEVELOPER_MODE)}
                      tabIndex="0"
                      onKeyDown={onTabKeyDown}
                    >
                      {gettext('Developer mode')}
                    </NavLink>
                  </NavItem>
                )}
              </Nav>
            </div>
            <TabContent activeTab={activeTab} className="flex-fill">
              {(enableDeveloperMode && activeTab === TAB.DEVELOPER_MODE) && (
                <TabPane tabId={TAB.DEVELOPER_MODE} role="tabpanel" id="developer-mode-setting-panel">
                  <DeveloperModeDialog
                    value={currentProjectInfo?.enable_developer_mode}
                    workspaceID={workspaceID}
                    projectName={projectName}
                    toggleDialog={toggleDialog}
                    submit={handleSubmitDeveloperMode}
                  />
                </TabPane>
              )}
            </TabContent>
          </Fragment>
        </ModalBody>
      </Modal>
    </div>
  );
};

ProjectSettingsDialog.propTypes = propTypes;
export default ProjectSettingsDialog;
