import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Dropdown, DropdownToggle, DropdownItem } from 'reactstrap';
import DatasetInfoDialog from '../../dialog/dataset-info-dialog';
import RenameDatasetDialog from '../../dialog/rename-dataset-dialog';
import CommonOperationConfirmationDialog from '../../../../components/dialog/common-operation-confirmation-dialog';
import DatasetView from './dataset-view';
import DatasetAccessGroupDialog from '../../dialog/dataset-access-group-dialog';
import { gettext } from '../../../../utils/constants';

class CommonDatasetItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isDropdownOpen: false,
      isDatasetViewOpen: false,
      isDatasetInfoDialogOpen: false,
      isRenameDatasetDialogOpen: false,
      isDeleteDatasetDialogOpen: false,

      isDatasetAccessGroupDialogOpen: false,
    };
  }

  toggleDatasetView = () => {
    this.setState({ isDatasetViewOpen: !this.state.isDatasetViewOpen });
  };

  toggleDatasetInfoDialog = () => {
    this.setState({ isDatasetInfoDialogOpen: !this.state.isDatasetInfoDialogOpen });
  };

  toggleRenameDatasetDialog = () => {
    this.setState({ isRenameDatasetDialogOpen: !this.state.isRenameDatasetDialogOpen });
  };

  toggleDatasetAccessGroupDialog = () => {
    this.setState({ isDatasetAccessGroupDialogOpen: !this.state.isDatasetAccessGroupDialogOpen });
  };

  toggleDeleteDatasetDialog = () => {
    this.setState({ isDeleteDatasetDialogOpen: !this.state.isDeleteDatasetDialogOpen });
  };

  handleClickDatasetName = (e) => {
    e.preventDefault();
    this.toggleDatasetView();
  };

  renameDataset = (datasetName) => {
    this.props.renameDataset(this.props.dataset.id, datasetName);
    this.toggleRenameDatasetDialog();
  };

  deleteDataset = () => {
    this.props.deleteDataset(this.props.dataset);
  };

  dropdownToggle = () => {
    this.setState({ isDropdownOpen: !this.state.isDropdownOpen });
  };

  render() {
    let dataset = this.props.dataset;
    let publishGroupId = this.props.publishGroupId;
    let { isDropdownOpen, isDatasetViewOpen, isDatasetInfoDialogOpen, isRenameDatasetDialogOpen,
      isDatasetAccessGroupDialogOpen, isDeleteDatasetDialogOpen } = this.state;
    return (
      <Fragment>
        <div className="dataset-item dataset-mobile-item">
          <div className="dataset-mobile-icon">
            <span className="dtable-font dtable-icon-database"></span>
          </div>
          <div className="dataset-mobile-name">
            <div>
              <a href="#" onClick={this.handleClickDatasetName} className="text-truncate d-block">{dataset.dataset_name}</a>
            </div>
            <div className="dataset-mobile-description">
              <span className='dataset-dtable-name'>{dataset.dtable_name}</span>
              <span className="px-2">|</span>
              <span>{dayjs(dataset.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
            </div>
          </div>
          {dataset.can_manage &&
            <div className="dataset-mobile-dropdown-menu">
              <Dropdown isOpen={isDropdownOpen} toggle={this.dropdownToggle} direction="down" className="table-item-more-operation">
                <DropdownToggle
                  tag='i'
                  role="button"
                  className='dtable-font dtable-icon-more-level table-dropdown-menu-icon'
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                  data-toggle="dropdown"
                  aria-expanded={isDropdownOpen}
                  aria-haspopup={true}
                >
                </DropdownToggle>
                <div className={isDropdownOpen ? '' : 'd-none'} onClick={this.dropdownToggle}>
                  <div className="mobile-operation-menu-bg-layer"></div>
                  <div className="mobile-operation-menu">
                    <DropdownItem onClick={this.toggleDatasetInfoDialog} className="mobile-dropdown-item">
                      <span className="dtable-font dtable-icon-list-view mr-2"></span>
                      <span>{gettext('Details')}</span>
                    </DropdownItem>
                    <DropdownItem onClick={this.toggleRenameDatasetDialog} className="mobile-dropdown-item">
                      <span className="dtable-font dtable-icon-rename mr-2"></span>
                      <span>{gettext('Rename')}</span>
                    </DropdownItem>
                    <DropdownItem onClick={this.toggleDatasetAccessGroupDialog} className="mobile-dropdown-item">
                      <span className="dtable-font dtable-icon-set-up mr-2"></span>
                      <span>{gettext('Manage permissions')}</span>
                    </DropdownItem>
                    <DropdownItem onClick={this.toggleDeleteDatasetDialog} className="mobile-dropdown-item">
                      <span className="dtable-font dtable-icon-delete mr-2"></span>
                      <span>{gettext('Delete')}</span>
                    </DropdownItem>
                  </div>
                </div>
              </Dropdown>
            </div>
          }
        </div>
        {isDatasetViewOpen &&
          <DatasetView
            dataset={dataset}
            toggle={this.toggleDatasetView}
          />
        }
        {isDatasetInfoDialogOpen &&
          <DatasetInfoDialog
            toggle={this.toggleDatasetInfoDialog}
            dataset={dataset}
          />
        }
        {isRenameDatasetDialogOpen &&
          <RenameDatasetDialog
            toggle={this.toggleRenameDatasetDialog}
            dataset={dataset}
            submit={this.renameDataset}
          />
        }
        {isDatasetAccessGroupDialogOpen &&
          <DatasetAccessGroupDialog
            toggle={this.toggleDatasetAccessGroupDialog}
            datasetId={dataset.id}
            publishGroupId={publishGroupId}
          />
        }
        {isDeleteDatasetDialogOpen && (
          <CommonOperationConfirmationDialog
            title={gettext('Delete common dataset')}
            message={gettext('Are you sure you want to delete common dataset {placeholder} ?').replace('{placeholder}', `<b>${dataset.dataset_name}</b>`)}
            executeOperation={this.deleteDataset}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteDatasetDialog}
          />
        )}
      </Fragment>
    );
  }
}

const propTypes = {
  dataset: PropTypes.object.isRequired,
  deleteDataset: PropTypes.func.isRequired,
  publishGroupId: PropTypes.number.isRequired,
  renameDataset: PropTypes.func,
};

CommonDatasetItem.propTypes = propTypes;

export default CommonDatasetItem;
