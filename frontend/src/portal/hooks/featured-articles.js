import React, { useCallback, useContext, useEffect, useState } from 'react';
import { portalAPI } from '../api';

const PortalFeaturedArticlesContext = React.createContext(null);

export const PortalFeaturedArticlesProvider = ({
  projectUuid,
  children,
}) => {
  const [featuredArticles, setFeaturedArticles] = useState(null);
  const [isFeaturedArticlesLoading, setIsFeaturedArticlesLoading] = useState(true);

  const updateHomeSetting = useCallback((newSetting) => {
    return portalAPI.updateSettings(projectUuid, { 'portal_home_settings': newSetting });
  }, [projectUuid]);

  useEffect(() => {
    setIsFeaturedArticlesLoading(true);
    portalAPI.listFeaturedArticles(projectUuid).then(res => {
      setFeaturedArticles(res.data || { columns: [], records: [] });
    }).catch(() => {
      setFeaturedArticles({ columns: [], records: [] });
    }).finally(() => {
      setIsFeaturedArticlesLoading(false);
    });
  }, [projectUuid]);

  return (
    <PortalFeaturedArticlesContext.Provider value={{
      updateHomeSetting,
      featuredArticles,
      isFeaturedArticlesLoading,
    }}>
      {children}
    </PortalFeaturedArticlesContext.Provider>
  );
};

export const usePortalFeaturedArticles = () => {
  const context = useContext(PortalFeaturedArticlesContext);
  if (!context) {
    throw new Error('\'PortalFeaturedArticlesContext\' is null');
  }
  return context;
};
