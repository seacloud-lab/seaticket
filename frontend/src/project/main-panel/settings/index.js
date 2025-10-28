import { ModalHeader } from '@/components';
import { gettext } from '@/constants';
import React, { useCallback, useState } from 'react';
import { Modal, ModalBody, TabContent, TabPane, Nav, NavItem, NavLink } from 'reactstrap';
import { TAB } from './constants';
import { isEnter, isSpace } from '@/utils/hotkey';
import DeveloperModeSettings from './developer-mode-settings';

import './index.css';

const Settings = ({
  settings,
  modifySettings,
  onToggle,
}) => {
  const [activeTab, setActiveTab] = useState(TAB.DEV_MODE);

  const toggleTab = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  const onTabKeyDown = useCallback((e) => {
    if (isEnter(e) || isSpace(e)) {
      e.target.click();
    }
  }, []);

  return (
    <Modal isOpen={true} className="project-settings-dialog" toggle={onToggle} >
      <ModalHeader toggle={onToggle}>{gettext('Settings')}</ModalHeader>
      <ModalBody className="d-md-flex p-md-0" role="tablist">
        <div className="project-setting-nav p-4">
          <Nav pills className="flex-column">
            <NavItem
              role="tab"
              aria-selected={activeTab === TAB.DEV_MODE}
              aria-controls="developer-mode-setting-panel"
              className="p-0"
            >
              <NavLink
                className={activeTab === TAB.DEV_MODE ? 'active' : ''}
                onClick={toggleTab.bind(this, TAB.DEV_MODE)}
                tabIndex="0"
                onKeyDown={onTabKeyDown}
              >
                {gettext('Developer mode')}
              </NavLink>
            </NavItem>
          </Nav>
        </div>
        <TabContent activeTab={activeTab} className="flex-fill">
          {(activeTab === TAB.DEV_MODE) && (
            <TabPane tabId={TAB.DEV_MODE} role="tabpanel" id="developer-mode-setting-panel">
              <DeveloperModeSettings
                value={settings.developer_mode}
                onChange={(value, callback) => modifySettings({ developer_mode: value }, callback)}
                onToggle={onToggle}
              />
            </TabPane>
          )}
        </TabContent>
      </ModalBody>
    </Modal>
  );
};

export default Settings;
