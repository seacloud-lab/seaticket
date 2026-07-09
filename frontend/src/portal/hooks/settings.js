import React, { useCallback, useContext, useEffect, useState } from 'react';
import { portalAPI } from '../api';
import { hasOwnProperty } from '@/utils/object-utils';
import { Utils } from '@/utils/utils';
import { toaster } from '@/components';
import { gettext } from '@/constants';

const PortalSettingsContext = React.createContext(null);

export const PortalSettingsProvider = ({
  logo: propsLogo,
  name: propsName,
  projectUuid,
  children,
}) => {
  const [logo, setLogo] = useState(propsLogo);
  const [name, setName] = useState(propsName);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUpdatingNameOrLogo, setIsUpdatingNameOrLogo] = useState(false);

  const updateNameOrLogo = useCallback((update, callback) => {
    if (isUploadingLogo || isUpdatingNameOrLogo) return;
    let serverData = {};
    let uploadRes = () => new Promise((resolve, reject) => {
      resolve({
        data: {}
      });
    });
    setIsUpdatingNameOrLogo(true);
    if (hasOwnProperty(update, 'logo')) {
      setIsUploadingLogo(true);
      uploadRes = () => portalAPI.uploadPortalLogo(projectUuid, update['logo']);
    }
    if (hasOwnProperty(update, 'name')) {
      serverData['portal_name'] = update['name'];
    }
    uploadRes().then(res => {
      if (hasOwnProperty(update, 'logo')) {
        const newLogo = res.data?.file_url || res.data?.url || '';
        serverData['portal_logo'] = newLogo;
      }
      setIsUploadingLogo(false);
      return portalAPI.updateSettings(projectUuid, serverData);
    }).then(res => {
      if (hasOwnProperty(serverData, 'portal_name')) {
        setName(serverData['portal_name']);
      }
      if (hasOwnProperty(serverData, 'portal_logo')) {
        setLogo(serverData['portal_logo']);
      }
      callback && callback(serverData);
      setIsUpdatingNameOrLogo(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsUploadingLogo(false);
      setIsUpdatingNameOrLogo(false);
    });
  }, [projectUuid, isUploadingLogo, isUpdatingNameOrLogo]);

  useEffect(() => {
    window.app.pageOptions.portalName = name;
    document.title = `${name} - ${gettext('Portal')}`;
  }, [name]);

  useEffect(() => {
    window.app.pageOptions.portalLogo = logo;
    const existingFavicon = document.querySelector('link[rel~="icon"]');
    if (existingFavicon) {
      existingFavicon.href = logo;
    }
  }, [logo]);

  return (
    <PortalSettingsContext.Provider value={{
      logo,
      name,
      isUploadingLogo,
      isUpdatingNameOrLogo,
      updateNameOrLogo,
    }}>
      {children}
    </PortalSettingsContext.Provider>
  );
};

export const usePortalSettings = () => {
  const context = useContext(PortalSettingsContext);
  if (!context) {
    throw new Error('\'PortalSettingsContext\' is null');
  }
  return context;
};
