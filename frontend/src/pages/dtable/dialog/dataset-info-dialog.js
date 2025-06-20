import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { gettext } from '../../../utils/constants';
import { seaQAAPI } from '../../../api/web-api';
import Loading from '../../../components/loading';
import { Utils } from '../../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  dataset: PropTypes.object,
  toggle: PropTypes.func
};

class DatasetInfoDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      datasetInfo: {},
      importGroups: [],
      importDtables: [],
      isLoading: true,
    };
  }

  componentDidMount() {
    seaQAAPI.getCommonDatasetInfo(this.props.dataset.id).then(res => {
      const { data: { dataset_info: datasetInfo } } = res;
      const { import_groups: importGroups } = datasetInfo;
      const importDtables = this.getImportTables(importGroups);
      this.setState({
        datasetInfo,
        importGroups,
        importDtables,
        isLoading: false,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      this.setState({
        isLoading: false,
      });
    });
  }

  getImportTables = (groups) => {
    const dtables = [];
    groups.forEach(group => {
      const { import_dtables: importDtables } = group;
      importDtables.forEach(dtable => {
        const { dtable_name: dtableName, dtable_uuid: dtableId } = dtable;
        dtables.push({ dtableName, dtableId });
      });
    });
    return dtables;
  };

  toggle = () => {
    this.props.toggle();
  };

  renderCitedOptions = (options, type) => {
    if (Array.isArray(options) && options.length === 0) {
      return null;
    }
    const isGroups = (type === 'groups') ? true : false;
    return options.map((option, index) => {
      const isLastOption = (index === options.length - 1) ? true : false;
      return (
        <span
          key={isGroups ? option.group_id : option.dtableId}
          className="mr-1 text-truncate"
        >
          { isLastOption ? (isGroups ? option.group_name : option.dtableName) : (isGroups ? option.group_name + ',' : option.dtableName + ',') }
        </span>
      );
    });
  };

  render() {
    let { isLoading, datasetInfo, importGroups, importDtables } = this.state;
    const sharedGroups = this.renderCitedOptions(importGroups, 'groups');
    const referencedBases = this.renderCitedOptions(importDtables, 'bases');
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>
          {gettext('Common dataset details')}
        </DTableModalHeader>
        <ModalBody>
          {isLoading ?
            <Loading />
            :
            <div className="public-dataset-container">
              <div className="public-dataset-item">
                <div className="public-dataset-title tr-highlight">
                  {gettext('Table name')}
                </div>
                <div className="public-dataset-info text-truncate">
                  {datasetInfo.table_name}
                </div>
              </div>
              <div className="public-dataset-item">
                <div className="public-dataset-title tr-highlight">
                  {gettext('View name')}
                </div>
                <div className="public-dataset-info text-truncate">
                  {datasetInfo.view_name}
                </div>
              </div>
              {sharedGroups &&
                <div className="public-dataset-item">
                  <div className="public-dataset-title tr-highlight">
                    {gettext('Shared groups')}
                  </div>
                  <div className="public-dataset-info text-truncate">
                    {sharedGroups}
                  </div>
                </div>
              }
              {referencedBases &&
                <div className="public-dataset-item">
                  <div className="public-dataset-title tr-highlight">
                    {gettext('Referenced bases')}
                  </div>
                  <div className="public-dataset-info">
                    {referencedBases}
                  </div>
                </div>
              }
            </div>
          }
        </ModalBody>
      </Modal>
    );
  }
}

DatasetInfoDialog.propTypes = propTypes;

export default DatasetInfoDialog;
