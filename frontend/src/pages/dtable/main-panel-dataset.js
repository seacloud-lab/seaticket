import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import Loading from '../../components/loading';
import { gettext, mediaUrl } from '../../utils/constants';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { Utils } from '../../utils/utils';
import CommonDatasetList from './dataset/dataset-list';
import CommonDatasetListView from './dataset/mobile/dataset-list-view';

import '../../css/dtable-dataset.css';

const propTypes = {
  loadWorkspaceList: PropTypes.func.isRequired,
};

class MainPanelDataset extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      datasetList: [],
      errorMsg: null,
      loading: true,
    };
  }

  componentDidMount() {
    dtableWebAPI.listCommonDatasets(null, true).then(res => {
      this.setState({
        datasetList: res.data.dataset_list,
        loading: false,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }

  deleteDataset = (dataset) => {
    dtableWebAPI.deleteCommonDataset(dataset.id).then(res => {
      let newDatasetList = this.state.datasetList.map(groupDatasets => {
        let { datasets } = groupDatasets;
        datasets = datasets.filter(item => item.id !== dataset.id);
        groupDatasets.datasets = datasets;
        return groupDatasets;
      });
      this.setState({
        datasetList: newDatasetList,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  renameDataset = (datasetId, datasetName) => {
    dtableWebAPI.renameCommonDataset(datasetId, datasetName).then(() => {
      let newDatasetList = this.state.datasetList.map(groupDatasets => {
        groupDatasets.datasets.forEach(dataset => {
          if (dataset.id === datasetId) {
            dataset.dataset_name = datasetName;
          }
        });
        return groupDatasets;
      });
      this.setState({
        datasetList: newDatasetList,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  renameGroupName = () => {
    this.props.loadWorkspaceList();
  };

  render() {
    let { loading, datasetList } = this.state;
    if (loading) {
      return <Loading />;
    }
    return (
      <Fragment>
        <div className="main-panel-center dtable-center main-panel-dataset">
          <div className="cur-view-container d-flex flex-1 flex-column">
            <div className="cur-view-content">
              {datasetList.length === 0 ?
                <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={''} >
                  <h2>{gettext('You don’t have common datasets yet.')}</h2>
                  <p>{gettext('Common datasets can be created from a view of a table. It enable you to share a part of a table to other users.')}</p>
                  <p>{gettext('For example, the sales department maintains a customer list table and makes it into a common dataset. Support team cannot directly access the customer table, but can access the exported dataset and import the records to their support table.')}</p>
                </DTableEmptyTip>
                :
                <div className="workspace mt-0">
                  <div className="datasets-title">{gettext('Common datasets')}</div>
                  <div className="table-item-container">
                    <MediaQuery query="(min-width: 767.8px)">
                      <header className="dataset-header">
                        <span className='dataset-header-name'>{gettext('Name')}</span>
                        <span className='dataset-header-base'>{gettext('Base')}</span>
                        <span className='dataset-header-create-time'>{gettext('Create time')}</span>
                        <span>{/* Operations */}</span>
                      </header>
                      <CommonDatasetList
                        datasetList={datasetList}
                        deleteDataset={this.deleteDataset}
                        renameDataset={this.renameDataset}
                      />
                    </MediaQuery>
                    <MediaQuery query="(max-width: 767.8px)">
                      <CommonDatasetListView
                        datasetList={datasetList}
                        deleteDataset={this.deleteDataset}
                        renameDataset={this.renameDataset}
                      />
                    </MediaQuery>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

MainPanelDataset.propTypes = propTypes;

export default MainPanelDataset;
