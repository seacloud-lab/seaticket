/* eslint-disable react/prop-types */
import React, { forwardRef, useCallback, useContext, useEffect, useRef, useState, useImperativeHandle } from 'react';
import { toaster } from '@/components';
import { Utils } from '@/utils/utils';
import { useSeaMetadataContext } from '../context-provider';

const ViewsDataContext = React.createContext(null);

export const ViewsDataProvider = forwardRef(({ isShowViewInURL = false, viewURLParam = 'view', children }, ref) => {
  const context = useSeaMetadataContext();
  const [isLoading, setLoading] = useState(true);
  const [viewsData, setViewsData] = useState({});
  const [viewID, toggleView] = useState('');
  const hasLoadedViews = useRef(false);

  const getViewById = useCallback((viewID) => {
    return viewsData.views.find(v => v._id === viewID);
  }, [viewsData]);

  const insertView = useCallback((name) => {
    return context.insertView(name).then(res => {
      const view = res.data.view;
      let newViewsData = { ...viewsData };
      newViewsData.navigation.push({ _id: view._id, type: 'view' });
      newViewsData.views.push(view);
      setViewsData(newViewsData);
      toggleView(view._id);
      return view;
    });
  }, [viewsData, context]);

  const deleteView = useCallback((viewID) => {
    return context.deleteView(viewID).then(res => {
      let newViewsData = { ...viewsData };
      const viewIndex = newViewsData.views.findIndex(v => v._id === viewID);
      newViewsData.views.splice(viewIndex, 1);
      const navigationIndex = newViewsData.navigation.findIndex(v => v._id === viewID);
      newViewsData.navigation.splice(navigationIndex, 1);
      let nextView = newViewsData.views[viewIndex];
      if (!nextView) {
        nextView = newViewsData.views[viewIndex - 1];
      }
      setViewsData(newViewsData);
      toggleView(nextView._id);
    });
  }, [viewsData, context]);

  const modifyView = useCallback((viewID, update) => {
    return context.modifyView(viewID, update).then(res => {
      let newViewsData = { ...viewsData };
      const viewIndex = newViewsData.views.findIndex(v => v._id === viewID);
      newViewsData.views[viewIndex] = { ...newViewsData.views[viewIndex], ...update };
      setViewsData(newViewsData);
    });
  }, [viewsData, context]);

  const duplicateView = useCallback((viewID) => {
    return context.duplicateView(viewID).then(res => {
      const view = res.data.view;
      let newViewsData = { ...viewsData };
      newViewsData.views.push(view);
      newViewsData.navigation.push({ _id: view._id, type: 'view' });
      setViewsData(newViewsData);
      toggleView(view._id);
      return view;
    });
  }, [viewsData, context]);

  const moveView = useCallback((sourceViewID, targetViewID, relativePosition) => {
    const newViewsData = { ...viewsData };
    const sourceViewIndex = newViewsData.navigation.findIndex(n => n._id === sourceViewID);
    const sourceViewNav = newViewsData.navigation[sourceViewIndex];
    let targetViewIndex = newViewsData.navigation.findIndex(n => n._id === targetViewID);
    if (relativePosition === 'after') {
      targetViewIndex = targetViewIndex + 1;
    }
    const targetViewNav = newViewsData.navigation[targetViewIndex];
    if (sourceViewNav._id === targetViewNav._id) return;

    context.moveView(sourceViewNav._id, targetViewNav._id).then(res => {
      newViewsData.navigation.splice(sourceViewIndex, 1);
      const newTargetViewIndex = newViewsData.navigation.findIndex(n => n._id === targetViewNav._id);
      newViewsData.navigation.splice(newTargetViewIndex, 0, sourceViewNav);
      setViewsData(newViewsData);
    });
  }, [viewsData, context]);

  useEffect(() => {
    let active = true;
    // Block URL writes in this effect pass, before setLoading takes effect.
    hasLoadedViews.current = false;
    setLoading(true);
    context.getViews().then(res => {
      if (!active) return;
      const viewsData = res.data;
      setViewsData(viewsData);
      const { search } = window.location;
      const currentUrlParams = new URLSearchParams(search);
      const currentViewID = isShowViewInURL ? currentUrlParams.get(viewURLParam) : null;
      let view = viewsData.views.find(v => v._id === currentViewID);
      if (!view) {
        const viewsNavigation = viewsData.navigation.filter(v => v.type === 'view');
        view = viewsNavigation[0];
      }
      toggleView(view?._id);
      hasLoadedViews.current = true;
    }).catch(error => {
      if (!active) return;
      const errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [context, isShowViewInURL, viewURLParam]);

  useEffect(() => {
    if (isLoading || !hasLoadedViews.current || !viewID || !isShowViewInURL) return;
    const { search, origin, pathname } = window.location;
    const currentUrlParams = new URLSearchParams(search);
    currentUrlParams.set(viewURLParam, viewID);
    const queryString = currentUrlParams.toString();
    const url = origin + pathname + (queryString ? '?' + queryString : '');
    history.replaceState(null, null, url);
  }, [isLoading, isShowViewInURL, viewID, viewURLParam]);

  useImperativeHandle(ref, () => ({
    getData: () => viewsData,
  }), [viewsData]);

  return (
    <ViewsDataContext.Provider
      value={{
        isLoading,
        viewID,
        viewsData,
        insertView,
        deleteView,
        modifyView,
        duplicateView,
        moveView,
        toggleView,
        getViewById,
      }}
    >
      {children}
    </ViewsDataContext.Provider>
  );
});

export const useViewsData = () => {
  const context = useContext(ViewsDataContext);
  if (!context) {
    throw new Error('\'ViewsDataContext\' is null');
  }
  return context;
};
