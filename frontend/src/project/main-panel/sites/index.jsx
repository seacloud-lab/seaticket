import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Table from '../table';
import CenteredLoading from '../../../components/centered-loading';
import toaster from '../../../components/toaster';
import { seaQAAPI } from '../../../api/web-api';
import { Site } from '../../models';
import { gettext } from '../../../constants';
import SiteDialog from '../../components/site-dialog';
import { Utils } from '../../../utils/utils';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';

import './index.css';

const {
  projectName, workspaceID
} = window.app.pageOptions;

const Sites = () => {

  const [isLoading, setLoading] = useState(true);
  const [sites, setSites] = useState([]);
  const [activeSite, setActiveSite] = useState(null);
  const [isShowSiteDialog, setIsShowSiteDialog] = useState(false);
  const [isShowConfirmDialog, setIsShowConfirmDialog] = useState(false);

  const columns = useMemo(() => {
    return [
      { key: 'name', name: gettext('Name'), width: '25%' },
      { key: 'url', name: gettext('Url'), width: '25%' },
      { key: 'ctime', name: gettext('Create time'), width: '15%' },
      { key: 'last_crawled', name: gettext('Last crawled'), width: '15%' },
      { key: 'status', name: gettext('Status'), width: '10%' },
      { key: 'op', name: '', width: '10%' },
    ];
  });

  const btns = useMemo(() => {
    return [
      { name: gettext('Add site'), func: () => {
        setActiveSite(null);
        setIsShowSiteDialog(true);
      } }
    ];
  }, []);

  const pageRef = useRef(1);
  const pageCountRef = useRef(Math.max(parseInt(window.innerHeight / 41) + 1, 100));
  const hasMoreRef = useRef(true);

  const closeSiteDialog = useCallback(() => {
    setIsShowSiteDialog(false);
  }, []);

  const addSite = useCallback(({ name, url, sitemapUrl }, resetSubmittingState) => {
    seaQAAPI.createSite(workspaceID, projectName, { name, url, sitemapUrl }).then(res => {
      const site = res.data.site;
      const newSites = [...sites, new Site(site)];
      setSites(newSites);
      setIsShowSiteDialog(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      resetSubmittingState && resetSubmittingState();
    });
  }, [sites]);

  const deleteSite = useCallback(() => {
    seaQAAPI.deleteSite(workspaceID, projectName, activeSite.id).then(res => {
      const activeSiteIndex = sites.findIndex(site => site.id === activeSite.id);
      let newSites = sites.slice(0);
      if (activeSiteIndex > -1) {
        newSites.splice(activeSiteIndex, 1);
      }
      setSites(newSites);
      setActiveSite(null);
      setIsShowSiteDialog(false);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [activeSite, sites]);

  const closeDeleteConfirmDialog = useCallback(() => {
    setIsShowConfirmDialog(false);
    setActiveSite(null);
  }, []);

  const openDeleteConfirmDialog = useCallback((site) => {
    setActiveSite(site);
    setIsShowConfirmDialog(true);
  }, []);

  const modifySite = useCallback(({ name, url, sitemapUrl }, resetSubmittingState) => {
    seaQAAPI.modifySite(workspaceID, projectName, activeSite.id, { name, url, sitemapUrl }).then(res => {
      const activeSiteIndex = sites.findIndex(site => site.id === activeSite.id);
      let newSites = sites.slice(0);
      if (activeSiteIndex === -1) {
        newSites.push(new Site(res.data.site));
      } else {
        newSites[activeSiteIndex] = new Site(res.data.site);
      }
      setSites(newSites);
      setActiveSite(null);
      setIsShowSiteDialog(false);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      resetSubmittingState && resetSubmittingState();
    });
  }, [activeSite, sites]);

  const openModifySiteDialog = useCallback((site) => {
    setActiveSite(site);
    setIsShowSiteDialog(true);
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current) return;
    setLoading(true);
    seaQAAPI.listSites(workspaceID, projectName, pageRef.current, pageCountRef.current).then(res => {
      const _sites = res.data.sites.map(s => new Site(s));
      if (_sites.length < pageCountRef.current) {
        hasMoreRef.current = false;
      } else {
        pageRef.current = pageRef.current + 1;
      }
      let newSites = sites.slice(0);
      let sitesMap = sites.reduce((pre, cur) => {
        if (pre[cur.id]) return pre;
        pre[cur.id] = true;
        return pre;
      }, {});
      _sites.forEach(site => {
        if (!sitesMap[site.id]) {
          newSites.push(site);
        }
      });
      setSites(newSites);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [sites, isLoading]);

  useEffect(() => {
    loadMore();
  }, []);

  if (isLoading && sites.length === 0) return (<CenteredLoading />);

  return (
    <>
      <Table
        columns={columns}
        rows={sites}
        title={gettext('Sites')}
        btns={btns}
        emptyTip={gettext('There are no sites yet')}
        isLoading={isLoading}
        loadMore={loadMore}
        onDelete={openDeleteConfirmDialog}
        onModify={openModifySiteDialog}
      />
      {isShowSiteDialog && (<SiteDialog site={activeSite} onToggle={closeSiteDialog} onSubmit={activeSite ? modifySite : addSite} />)}
      {isShowConfirmDialog && (
        <CommonOperationConfirmationDialog
          title={gettext('Delete website')}
          message={gettext('Are you sure you want to delete {placeholder} ?').replace('{placeholder}', activeSite.name)}
          executeOperation={deleteSite}
          confirmBtnText={gettext('Delete')}
          toggleDialog={closeDeleteConfirmDialog}
        />
      )}
    </>
  );
};

export default Sites;
