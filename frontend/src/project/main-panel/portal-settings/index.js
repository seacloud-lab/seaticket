import React from 'react';
import { CenteredLoading } from '@/components';
import TopBar from '../top-bar';
import ChatSettings from './chat-settings';
import CustomDomainSettings from './custom-domain-settings';
import CustomUrlSettings from './custom-url-settings';
import DomainSettings from './domain-settings';
import EmailNotificationsSettings from './email-notifications-settings';
import { usePortalSettings } from './hooks';
import OpenAccessSettings from './open-access-settings';

import './index.css';

const PortalSettings = ({ title }) => {
  const { isLoading } = usePortalSettings();
  const enablePortalDomain = window.app.pageOptions.enablePortalDomain !== false;
  return (
    <>
      <TopBar title={title}>
        <div className="w-100 text-truncate">{title}</div>
      </TopBar>
      {isLoading ? (
        <CenteredLoading />
      ) : (
        <div className="seaqa-project-settings-body seaqa-project-portal-settings p-4 d-flex flex-column flex-1 w-100">
          <OpenAccessSettings />
          {enablePortalDomain ? (
            <>
              <DomainSettings />
              <CustomDomainSettings />
            </>
          ) : (
            <CustomUrlSettings />
          )}
          <ChatSettings />
          <EmailNotificationsSettings />
        </div>
      )}
    </>
  );
};

export default PortalSettings;
