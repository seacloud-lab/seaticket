import React from 'react';
import PropTypes from 'prop-types';
import CommonDatasetItemView from './dataset-item-view';

class CommonDatasetListView extends React.Component {

  render() {
    let { datasetList } = this.props;
    return (
      datasetList.map((groupDatasets) => {
        let { group_name, datasets } = groupDatasets;
        return (
          <React.Fragment key={groupDatasets.group_id}>
            <div className='table-heading mt-3'>
              <span className="table-workspace-icon dtable-font dtable-icon-collaborator"></span>
              <span>{group_name}</span>
            </div>
            <div className="w-100 dataset-mobile-items">
              {datasets.map((dataset) => {
                return (
                  <CommonDatasetItemView
                    key={dataset.id}
                    dataset={dataset}
                    deleteDataset={this.props.deleteDataset}
                    publishGroupId={groupDatasets.group_id}
                    renameDataset={this.props.renameDataset}
                  />
                );
              })}
            </div>
          </React.Fragment>
        );
      })
    );
  }
}

const propTypes = {
  datasetList: PropTypes.array.isRequired,
  deleteDataset: PropTypes.func.isRequired,
  renameDataset: PropTypes.func,
};

CommonDatasetListView.propTypes = propTypes;

export default CommonDatasetListView;
