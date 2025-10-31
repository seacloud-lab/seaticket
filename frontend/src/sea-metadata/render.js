import { forwardRef, useEffect, useState, useImperativeHandle, useRef } from 'react';
import classnames from 'classnames';
import View from './view';
import {
  MetadataProvider,
  ViewsDataProvider, useViewsData,
  TagsDataProvider,
  TypesDataProvider,
  SubstatesDataProvider,
  SelectedRowsProvider,
} from './hooks';
import ViewToolBar from './components/view-toolbar';
import context from './context';
import { CenteredLoading } from '@/components';
import { getRowsByIds } from '@/sea-metadata/utils/row/core';
import { getValidGroupbys } from '@/sea-metadata/utils/group';
import { lang, mediaUrl, server, username, PERMISSION_TYPES } from '@/constants';

const Main = forwardRef(({
  className,
  viewTools,
  fixedColumnCount = 1,
  tagsData,
  createTag,
  toggleAllTags,
  typesData,
  createType,
  toggleAllTypes,
  substatesData,
  createSubstate,
  toggleAllSubstates,
  expandRow,
  toggleView,
  createRowsTools,
  children,
  ...params
}, ref) => {
  const { isLoading } = useViewsData();
  const metadataRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getData: () => metadataRef.current.getData(),
  }), []);

  useEffect(() => {
    return () => {
      context.destroy();
    };
  }, []);

  if (isLoading) {
    return (
      <div className={classnames('sea-metadata', className)}>
        <CenteredLoading />
      </div>
    );
  }

  return (
    <TagsDataProvider tagsData={tagsData} createTag={createTag} toggleAllTags={toggleAllTags} >
      <TypesDataProvider typesData={typesData} createType={createType} toggleAllTypes={toggleAllTypes} >
        <SubstatesDataProvider substatesData={substatesData} createSubstate={createSubstate} toggleAllSubstates={toggleAllSubstates}>
          <MetadataProvider ref={metadataRef} tagsData={tagsData} typesData={typesData} { ...params }>
            <SelectedRowsProvider>
              <div className={classnames('sea-metadata', className)}>
                <ViewToolBar fixedColumnCount={fixedColumnCount} tools={viewTools} createRowsTools={createRowsTools} toggleView={toggleView} />
                <View fixedColumnCount={fixedColumnCount} expandRow={expandRow} children={children} />
              </div>
            </SelectedRowsProvider>
          </MetadataProvider>
        </SubstatesDataProvider>
      </TypesDataProvider>
    </TagsDataProvider>
  );
});

const SeaMetadata = forwardRef(({
  toggleView,
  api,
  viewID,
  permission = PERMISSION_TYPES.READ_ONLY,
  isViewComputedOnServer = true,
  settings,
  t,
  ...params
}, ref) => {
  const [isLoading, setLoading] = useState(true);
  const viewsDataRef = useRef(null);
  const mainRef = useRef(null);

  useEffect(() => {
    context.init({
      username,
      settings: { lang, server, mediaUrl, ...settings, },
      permission,
      isViewComputedOnServer,
      api,
      t,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    context.re_set({ t, api });
  }, [t, api]);

  useImperativeHandle(ref, () => ({
    getData: () => {
      const viewsData = viewsDataRef.current.getData();
      const metadata = mainRef.current.getData();
      return {
        views: viewsData,
        rows: metadata.rows,
        columns: metadata.columns,
        view: {
          ...metadata.view,
          available_columns: [],
          columns: [],
          groups: [],
        }
      };
    },
    getOrderRows: () => {
      const metadata = mainRef.current.getData();
      const validGroupbys = getValidGroupbys(metadata.view.groupbys, metadata.columns);
      if (validGroupbys.length > 0) {
        const groupMetrics = window.seaTableBody.getGroupMetrics();
        const { groupRows } = groupMetrics;
        const ids = groupRows.filter(r => r.type === 'row').map(r => r.rowId);
        return getRowsByIds(metadata, ids);
      }
      return metadata.rows;
    }
  }), []);

  if (isLoading) return null;

  return (
    <ViewsDataProvider ref={viewsDataRef} viewID={viewID} toggleView={toggleView}>
      <Main ref={mainRef} viewID={viewID} toggleView={toggleView} { ...params } />
    </ViewsDataProvider>
  );
});

export default SeaMetadata;
