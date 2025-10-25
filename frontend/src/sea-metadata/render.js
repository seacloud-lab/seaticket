import { forwardRef, useEffect, useState, useImperativeHandle, useRef } from 'react';
import classnames from 'classnames';
import View from './view';
import {
  MetadataProvider,
  ViewsDataProvider, useViewsData,
  TagsDataProvider,
  TypesDataProvider,
  SelectedRowsProvider,
} from './hooks';
import ViewToolBar from './components/view-toolbar';
import context from './context';
import { CenteredLoading } from '@/components';
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
        <MetadataProvider ref={metadataRef} tagsData={tagsData} typesData={typesData} { ...params }>
          <SelectedRowsProvider>
            <div className={classnames('sea-metadata', className)}>
              <ViewToolBar fixedColumnCount={fixedColumnCount} tools={viewTools} createRowsTools={createRowsTools} toggleView={toggleView} />
              <View fixedColumnCount={fixedColumnCount} expandRow={expandRow} children={children} />
            </div>
          </SelectedRowsProvider>
        </MetadataProvider>
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
        view: {
          ...metadata.view,
          available_columns: [],
          columns: [],
          groups: [],
        }
      };
    },
    getGroupRows: () => {
      if (!window.seaTableBody || !window.seaTableBody.getGroupMetrics) {
        return [];
      }
      const metadata = mainRef.current.getData();
      const groupMetrics = window.seaTableBody.getGroupMetrics();
      const { groupRows } = groupMetrics;
      return groupRows.filter(r => r.type === 'row').map(r => metadata.rows.find(row => row._id === r.rowId));
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
