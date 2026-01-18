import React, { useCallback, useContext } from 'react';
import { CollaboratorsProvider } from '@/sea-metadata';
import { ConnectionsProvider } from '../main-panel/connections/hooks';
import { AIChatToolsProvider } from '../main-panel/ask/hooks';
import { AnalyzeTaskProvider } from '../main-panel/analyze/hooks/analyze-task';
import { MetadataProvider } from '../main-panel/tickets/hooks';
import { NotificationProvider } from '@/components/common/notification/hooks/notification';
import projectAPI from '../api/project-api';
import userAPI from '@/api/user-api';

const DataContext = React.createContext(null);

export const DataProvider = ({ projectUuid, activeBar, children }) => {

  const listUserInfo = useCallback((...params) => {
    return userAPI.listUserInfo(...params);
  }, []);

  const getCollaborators = useCallback(() => {
    return projectAPI.listProjectRelatedUsers(projectUuid);
  }, [projectUuid]);

  return (
    <DataContext.Provider value={{
    }}>
      <AIChatToolsProvider>
        <NotificationProvider projectUuid={projectUuid} activeBar={activeBar}>
          <CollaboratorsProvider listUserInfo={listUserInfo} getCollaborators={getCollaborators}>
            <MetadataProvider projectUuid={projectUuid}>
              <ConnectionsProvider projectUuid={projectUuid} >
                <AnalyzeTaskProvider>
                  {children}
                </AnalyzeTaskProvider>
              </ConnectionsProvider>
            </MetadataProvider>
          </CollaboratorsProvider>
        </NotificationProvider>
      </AIChatToolsProvider>
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('\'DataContext\' is null');
  }
  return context;
};
