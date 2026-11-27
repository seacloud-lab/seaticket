import { forwardRef, useEffect, useLayoutEffect, useState, useImperativeHandle, useRef, useId, useMemo } from 'react';
import classnames from 'classnames';
import { CenteredLoading } from '@/components';
import { lang, mediaUrl, server, username, PERMISSION_TYPES } from '@/constants';
import { getValidGroupbys } from '@/sea-metadata/utils/group';
import { getRowsByIds } from '@/sea-metadata/utils/row/core';
import ViewToolBar from './components/view-toolbar';
import { createMetadataContext } from './context';
import { SeaMetadataContextProvider } from './context-provider';
import { bindMetadataController, normalizeMetadataID } from './controller';
import { useSeaMetadataController, SeaMetadataControllerProvider } from './controller-provider';
import {
  MetadataProvider,
  ViewsDataProvider, useViewsData,
  TagsDataProvider,
  TypesDataProvider,
  SubstatesDataProvider,
  SelectedRowsProvider,
  CustomersDataProvider,
} from './hooks';
import View from './view';

let nextControllerKey = 0;
const controllerKeys = new WeakMap();

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
  customersData,
  substatesData,
  createSubstate,
  toggleAllSubstates,
  expandRow,
  createRowsTools,
  CustomView,
  viewTabs,
  onCustomViewRowClick,
  isMobileView = false,
  children,
  ...params
}, ref) => {
  const { isLoading, viewID, toggleView } = useViewsData();
  const metadataRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getData: () => metadataRef.current?.getData() ?? null,
    getSelectedRowIds: () => metadataRef.current?.getSelectedRowIds() ?? [],
    createMoreOptions: (...args) => metadataRef.current?.createMoreOptions(...args) || [],
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
        <CustomersDataProvider customersData={customersData} >
          <SubstatesDataProvider substatesData={substatesData} createSubstate={createSubstate} toggleAllSubstates={toggleAllSubstates}>
            <SelectedRowsProvider>
              <MetadataProvider ref={metadataRef} viewID={viewID} tagsData={tagsData} typesData={typesData} customersData={customersData} { ...params }>
                <div className={classnames('sea-metadata', className)}>
                  <ViewToolBar
                    fixedColumnCount={fixedColumnCount}
                    tools={viewTools}
                    viewTabs={viewTabs}
                    createRowsTools={createRowsTools}
                    toggleView={toggleView}
                    isMobileView={isMobileView}
                  />
                  <View
                    expandRow={expandRow}
                    CustomView={CustomView}
                    onCustomViewRowClick={onCustomViewRowClick}
                    children={children}
                  />
                </div>
              </MetadataProvider>
            </SelectedRowsProvider>
          </SubstatesDataProvider>
        </CustomersDataProvider>
      </TypesDataProvider>
    </TagsDataProvider>
  );
});

const MetadataInstance = forwardRef(({
  toggleView,
  api,
  metadataID,
  controller,
  storageNamespace,
  permission = PERMISSION_TYPES.READ_ONLY,
  settings,
  t,
  isShowViewInURL = false,
  viewURLParam = 'view',
  ...params
}, ref) => {
  const [context] = useState(createMetadataContext);
  const instanceId = useId();
  context.id = `sea-metadata-${instanceId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  context.useLegacyStorage = storageNamespace === 'primary';
  context.storageNamespace = JSON.stringify([metadataID, storageNamespace || (metadataID === null ? context.id : 'default')]);
  const [ready, setReady] = useState(false);
  const viewsDataRef = useRef(null);
  const mainRef = useRef(null);
  const rootRef = useRef(null);

  const methods = useMemo(() => ({
    context,
    createMoreOptions: (...args) => mainRef.current?.createMoreOptions(...args) || [],
    getSelectedRowIds: () => mainRef.current?.getSelectedRowIds() || [],
    getData: () => {
      const metadata = mainRef.current?.getData();
      if (!metadata) return null;
      return {
        views: viewsDataRef.current?.getData(),
        rows: metadata.rows,
        columns: metadata.columns,
        view: { ...metadata.view, columns: [], groups: [] },
      };
    },
    getOrderRows: () => {
      const metadata = mainRef.current?.getData();
      if (!metadata) return [];
      const validGroupbys = getValidGroupbys(metadata.view.groupbys, metadata.columns);
      if (validGroupbys.length > 0) {
        const groupRows = context.body?.getGroupMetrics()?.groupRows || [];
        const ids = groupRows.filter(r => r.type === 'row').map(r => r.rowId);
        return getRowsByIds(metadata, ids);
      }
      return metadata.rows;
    },
  }), [context]);

  useLayoutEffect(() => {
    context.configure({ username, settings: { lang, server, mediaUrl, ...settings }, permission, api, t });
  }, [context, settings, permission, api, t]);

  useLayoutEffect(() => {
    context.root = rootRef.current;
    const unbind = bindMetadataController(controller, methods, metadataID);
    setReady(true);
    return () => {
      unbind();
      context.root = null;
    };
  }, [context, controller, methods, metadataID]);

  // Class-based cell editors commit pending changes during their unmount.
  // Keep the old API available through that phase, after detaching the handle.
  useEffect(() => () => context.destroy(), [context]);

  useImperativeHandle(ref, () => methods, [methods]);

  return (
    <div ref={rootRef} id={context.id} className="sea-metadata-instance" data-sea-metadata-instance={context.id} data-sea-metadata-primary={context.useLegacyStorage || undefined} style={{ display: 'contents' }}>
      {ready && (
        <SeaMetadataControllerProvider controller={controller}>
          <SeaMetadataContextProvider context={context}>
            <ViewsDataProvider ref={viewsDataRef} isShowViewInURL={isShowViewInURL} viewURLParam={viewURLParam}>
              <Main ref={mainRef} {...params} />
            </ViewsDataProvider>
          </SeaMetadataContextProvider>
        </SeaMetadataControllerProvider>
      )}
    </div>
  );
});

const SeaMetadata = forwardRef(({ metadataID, controller, storageNamespace, ...props }, ref) => {
  const id = normalizeMetadataID(metadataID ?? controller?.metadataID);
  const own = useSeaMetadataController(id);
  const selected = controller || own;
  if (!controllerKeys.has(selected)) controllerKeys.set(selected, ++nextControllerKey);
  return <MetadataInstance key={JSON.stringify([id, storageNamespace, controllerKeys.get(selected)])} {...props} metadataID={id} controller={selected} storageNamespace={storageNamespace} ref={ref} />;
});

export default SeaMetadata;
