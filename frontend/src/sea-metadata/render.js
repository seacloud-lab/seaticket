import { forwardRef, useEffect, useState, useImperativeHandle, useRef } from 'react';
import classnames from 'classnames';
import View from './view';
import {
  MetadataProvider,
  ViewsDataProvider, useViewsData,
  TagsDataProvider,
  TypesDataProvider,
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
  children,
  ...params
}, ref) => {
  const { isLoading } = useViewsData();
  const metadataRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getData: () => metadataRef.current.getData(),
  }), []);

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
          <div className={classnames('sea-metadata', className)}>
            <ViewToolBar fixedColumnCount={fixedColumnCount} tools={viewTools} toggleView={toggleView} />
            <View fixedColumnCount={fixedColumnCount} expandRow={expandRow} children={children} />
          </div>
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
  settings = { lang, server, mediaUrl },
  t,
  ...params
}, ref) => {
  const [isLoading, setLoading] = useState(true);
  const viewsDataRef = useRef(null);
  const mainRef = useRef(null);

  useEffect(() => {
    context.init({
      username,
      settings,
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
  }), []);

  if (isLoading) return null;

  return (
    <ViewsDataProvider ref={viewsDataRef} viewID={viewID} toggleView={toggleView}>
      <Main ref={mainRef} viewID={viewID} toggleView={toggleView} { ...params } />
    </ViewsDataProvider>
  );
});

export default SeaMetadata;
