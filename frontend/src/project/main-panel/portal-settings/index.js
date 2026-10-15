import React from 'react';
import { CenteredLoading } from '@/components';
import TopBar from '../top-bar';
import BasicSettings from './basic-settings';
import ChatSettings from './chat-settings';
import CustomDomainSettings from './custom-domain-settings';
import DomainSettings from './domain-settings';
import EmailNotificationsSettings from './email-notifications-settings';
import { usePortalSettings } from './hooks';
import OpenAccessSettings from './open-access-settings';

import './index.css';

const PortalSettings = ({ title }) => {
  const { isLoading } = usePortalSettings();
  return (
    <>
      <TopBar title={title}>
        <div className="w-100 text-truncate">{title}</div>
      </TopBar>
      {isLoading ? (
        <CenteredLoading />
      ) : (
        <div className="seaqa-project-settings-body seaqa-project-portal-settings p-4 d-flex flex-column flex-1 w-100">
          <BasicSettings />
          <OpenAccessSettings />
          <DomainSettings />
          <CustomDomainSettings />
          <ChatSettings />
          <EmailNotificationsSettings />
        </div>
      )}
    </>
  );
};

export default PortalSettings;
