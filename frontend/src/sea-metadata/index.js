import classnames from 'classnames';
import View from './view';
import {
  CollaboratorsProvider, useCollaborators,
  MetadataProvider, useMetadata,
} from './hooks';
import ViewToolBar from './components/view-toolbar';
import { CellType } from './constants';

import './index.css';

const SeaMetadata = ({ className, expandRow, toggleView, ...params }) => {
  return (
    <MetadataProvider { ...params }>
      <div className={classnames('sea-metadata', className)}>
        <ViewToolBar toggleView={toggleView} />
        <View expandRow={expandRow} />
      </div>
    </MetadataProvider>
  );
};

export default SeaMetadata;

export {
  CollaboratorsProvider, useCollaborators,
  MetadataProvider, useMetadata,
  ViewToolBar, View,
  CellType,
};
