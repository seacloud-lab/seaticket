import React from 'react';
import PropTypes from 'prop-types';
import CommonDatasetItem from './dataset-item';

class CommonDatasetList extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
    };
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  render() {
    let { datasetList } = this.props;
    return (
      datasetList.map((groupDatasets) => {
        let { group_name, datasets } = groupDatasets;
        return (
          <React.Fragment key={groupDatasets.group_id}>
            <div className='table-heading mt-3 p-0'>
              <span className="table-workspace-icon dtable-font dtable-icon-collaborator"></span>
              <span>{group_name}</span>
            </div>
            <div className="w-100">
              {datasets.map((dataset) => {
                return (
                  <CommonDatasetItem
                    key={dataset.id}
                    dataset={dataset}
                    deleteDataset={this.props.deleteDataset}
                    isItemFreezed={this.state.isItemFreezed}
                    onFreezedItem={this.onFreezedItem}
                    onUnfreezedItem={this.onUnfreezedItem}
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
  renameDataset: PropTypes.func
};

CommonDatasetList.propTypes = propTypes;

export default CommonDatasetList;
