import React from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem, UncontrolledTooltip } from 'reactstrap';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import DatasetDialog from '../dialog/dataset-dialog';
import DatasetAccessGroupDialog from '../dialog/dataset-access-group-dialog';
import { gettext, isPro } from '../../../utils/constants';
import DTableItem from '../dtable-item';
import RenameDatasetDialog from '../dialog/rename-dataset-dialog';
import DatasetInfoDialog from '../dialog/dataset-info-dialog';
import ForceSyncCommonDatasetDialog from '../dialog/force-sync-common-dataset-dialog';

class CommonDatasetItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isDropdownOpen: false,
      isItemActive: false,
      isDeleteDatasetDialogOpen: false,
      isDatasetDialogOpen: false,
      isDatasetAccessGroupDialogOpen: false,
      isDatasetInfoDialogOpen: false,
      isRenameDatasetDialogOpen: false,
      isForceSyncDatasetDialogOpen: false
    };
  }

  onMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isItemActive: true });
    }
  };

  onMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isItemActive: false });
    }
  };

  toggleDatasetDialog = () => {
    this.setState({ isDatasetDialogOpen: !this.state.isDatasetDialogOpen });
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

  toggleForceSyncDatasetDialog = () => {
    this.setState({ isForceSyncDatasetDialogOpen: !this.state.isForceSyncDatasetDialogOpen });
  };

  handleClickDatasetName = (e) => {
    e.preventDefault();
    this.toggleDatasetDialog();
  };

  renameDataset = (datasetName) => {
    this.props.renameDataset(this.props.dataset.id, datasetName);
    this.toggleRenameDatasetDialog();
  };

  deleteDataset = () => {
    this.props.deleteDataset(this.props.dataset);
    this.setState({ isDeleteDatasetDialogOpen: false });
  };

  dropdownToggle = () => {
    if (this.state.isDropdownOpen) {
      this.setState({ isItemActive: false });
      this.props.onUnfreezedItem();
    } else {
      this.props.onFreezedItem();
    }
    this.setState({ isDropdownOpen: !this.state.isDropdownOpen });
  };

  render() {
    let dataset = this.props.dataset;
    let publishGroupId = this.props.publishGroupId;
    let { isItemActive, isDropdownOpen, isDatasetDialogOpen, isDatasetInfoDialogOpen, isRenameDatasetDialogOpen,
      isDatasetAccessGroupDialogOpen, isDeleteDatasetDialogOpen, isForceSyncDatasetDialogOpen } = this.state;
    return (
      <div
        className={`table-item dataset-item w-100 ${isItemActive ? 'tr-highlight' : ''}`}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        <div className="dataset-icon">
          <span className="dtable-font dtable-icon-database"></span>
        </div>
        <div className="dataset-name">
          <a href="#" onClick={this.handleClickDatasetName}>{dataset.dataset_name}</a>
        </div>
        <div className="dataset-dtable">
          <DTableItem dtableColor={dataset.dtable_color} dtableIcon={dataset.dtable_icon} />
          <span className='dataset-dtable-name'>{dataset.dtable_name}</span>
        </div>
        <div className="dataset-publish-time">
          <span>{dayjs(dataset.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
        </div>
        <div className="dataset-dropdown-menu">
          {dataset.can_manage && (
            <Dropdown isOpen={isDropdownOpen} toggle={this.dropdownToggle} direction="down" className="table-item-more-operation">
              <DropdownToggle
                tag='i'
                role="button"
                className='dtable-font dtable-icon-more-level cursor-pointer attr-action-icon table-dropdown-menu-icon'
                title={gettext('More operations')}
                aria-label={gettext('More operations')}
                data-toggle="dropdown"
                aria-expanded={isDropdownOpen}
                aria-haspopup={true}
              />
              <DropdownMenu className="dtable-dropdown-menu dropdown-menu drop-list" right={true}>
                <DropdownItem onClick={this.toggleDatasetInfoDialog}>
                  <span>{gettext('Details')}</span>
                </DropdownItem>
                <DropdownItem onClick={this.toggleRenameDatasetDialog}>
                  <span>{gettext('Rename')}</span>
                </DropdownItem>
                <DropdownItem onClick={this.toggleDatasetAccessGroupDialog}>
                  <span>{gettext('Manage permissions')}</span>
                </DropdownItem>
                {isPro &&
                  <DropdownItem onClick={this.toggleForceSyncDatasetDialog}>
                    <span>{gettext('Force sync')}</span>
                  </DropdownItem>
                }
                {!isPro &&
                  <DropdownItem disabled>
                    <span>{gettext('Force sync')}</span>
                    <span className="dtable-font dtable-icon-member-free dtable-font-gold ml-1" id='dtable-icon-gold-tip-1'>
                      <UncontrolledTooltip
                        placement="bottom"
                        target='dtable-icon-gold-tip-1'
                      >
                        {gettext('This is an enterprise version feature')}
                      </UncontrolledTooltip>
                    </span>
                  </DropdownItem>
                }
                <DropdownItem onClick={this.toggleDeleteDatasetDialog}>
                  <span>{gettext('Delete')}</span>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          )}
        </div>
        {isDatasetDialogOpen &&
          <DatasetDialog
            dataset={dataset}
            toggle={this.toggleDatasetDialog}
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
        {isDeleteDatasetDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete common dataset')}
            message={gettext('Are you sure you want to delete common dataset {placeholder} ?').replace('{placeholder}', `<b>${dataset.dataset_name}</b>`)}
            executeOperation={this.deleteDataset}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteDatasetDialog}
          />
        }
        {isForceSyncDatasetDialogOpen &&
          <ForceSyncCommonDatasetDialog
            toggle={this.toggleForceSyncDatasetDialog}
            dataset={dataset}
          />
        }
      </div>
    );
  }
}

const propTypes = {
  dataset: PropTypes.object.isRequired,
  deleteDataset: PropTypes.func.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  publishGroupId: PropTypes.number.isRequired,
  renameDataset: PropTypes.func
};

CommonDatasetItem.propTypes = propTypes;

export default CommonDatasetItem;
