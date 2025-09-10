import { useEffect, useState } from 'react';
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

const Main = ({
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
}) => {
  const { isLoading } = useViewsData();

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
        <MetadataProvider tagsData={tagsData} typesData={typesData} { ...params }>
          <div className={classnames('sea-metadata', className)}>
            <ViewToolBar tools={viewTools} toggleView={toggleView} />
            <View fixedColumnCount={fixedColumnCount} expandRow={expandRow} children={children} />
          </div>
        </MetadataProvider>
      </TypesDataProvider>
    </TagsDataProvider>
  );
};

const SeaMetadata = ({
  toggleView,
  api,
  viewID,
  permission = PERMISSION_TYPES.READ_ONLY,
  isViewComputedOnServer = true,
  settings = { lang, server, mediaUrl },
  t,
  ...params
}) => {
  const [isLoading, setLoading] = useState(true);

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

  if (isLoading) return null;

  return (
    <ViewsDataProvider viewID={viewID} toggleView={toggleView}>
      <Main viewID={viewID} toggleView={toggleView} { ...params } />
    </ViewsDataProvider>
  );
};

export default SeaMetadata;
