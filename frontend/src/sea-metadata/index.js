import ViewToolBar from './components/view-toolbar';
import { CellType, VIEW_TOOL, EVENT_BUS_TYPE } from './constants';
import {
  CollaboratorsProvider, useCollaborators,
  MetadataProvider, useMetadata,
  ViewsDataProvider, useViewsData,
  DataCacheProvider, useDataCache,
  CustomersDataProvider, useCustomersData,
} from './hooks';
import SeaMetadata from './render';
import View from './view';

import './index.css';

export default SeaMetadata;

export {
  CollaboratorsProvider, useCollaborators,
  MetadataProvider, useMetadata,
  ViewsDataProvider, useViewsData,
  DataCacheProvider, useDataCache,
  CustomersDataProvider, useCustomersData,
  ViewToolBar, View,
  CellType,
  VIEW_TOOL, EVENT_BUS_TYPE,
};

export { createSeaMetadataController } from './controller';
export { useSeaMetadataController, useMetadataController, SeaMetadataControllerProvider, withSeaMetadataController } from './controller-provider';

export { SeaMetadataScope } from './context-provider';
