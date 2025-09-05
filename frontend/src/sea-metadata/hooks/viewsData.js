/* eslint-disable react/prop-types */
import { toaster } from '@/components';
import { Utils } from '@/utils/utils';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import context from '../context';

const ViewsDataContext = React.createContext(null);

export const ViewsDataProvider = ({
  viewID,
  toggleView,
  children,
}) => {
  const [isLoading, setLoading] = useState(true);
  const [viewsData, setViewsData] = useState({});

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
  }, [viewsData]);

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
  }, [viewsData]);

  const modifyView = useCallback((viewID, update) => {
    return context.modifyView(viewID, update).then(res => {
      let newViewsData = { ...viewsData };
      const viewIndex = newViewsData.views.findIndex(v => v._id === viewID);
      newViewsData.views[viewIndex] = { ...newViewsData.views[viewIndex], ...update };
      setViewsData(newViewsData);
    });
  }, [viewsData]);

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
  }, [viewsData]);

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
  }, [viewsData]);

  useEffect(() => {
    setLoading(true);
    context.getViews().then(res => {
      const viewsData = res.data;
      setViewsData(viewsData);
      const view = viewsData.views.find(v => v._id === viewID);
      if (view) return;
      toggleView(viewsData.views[0]._id);
    }).catch(error => {
      const errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    }).finally(() => {
      setTimeout(() => setLoading(false), 1);
    });
  }, []);

  return (
    <ViewsDataContext.Provider
      value={{
        isLoading,
        viewsData,
        insertView,
        deleteView,
        modifyView,
        duplicateView,
        moveView,
        toggleView,
      }}
    >
      {children}
    </ViewsDataContext.Provider>
  );
};

export const useViewsData = () => {
  const context = useContext(ViewsDataContext);
  if (!context) {
    throw new Error('\'ViewsDataContext\' is null');
  }
  return context;
};
