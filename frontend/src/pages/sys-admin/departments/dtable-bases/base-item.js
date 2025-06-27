import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Utils } from '../../../../utils/utils';
import { gettext } from '../../../../constants';
import dayjs from '../../../../utils/dayjs';
import DTableOpMenu from '../../dtables/dtable-op-menu';
import CommonOperationConfirmationDialog from '../../../../components/dialog/common-operation-confirmation-dialog';
import DTableAllExternalLinksDialog from '../../../dtable/dialog/dtable-all-external-links-dialog';

const propTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteDTable: PropTypes.func.isRequired
};

class BaseItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      isDeleteDTableDialogOpen: false,
      isExternalLinkDialogOpen: false,
      highlight: false,
    };
  }

  handleMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: true,
        highlight: true
      });
    }
  };

  handleMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: false,
        highlight: false
      });
    }
  };

  onUnfreezedItem = () => {
    this.setState({
      highlight: false,
      isOpIconShown: false
    });
    this.props.onUnfreezedItem();
  };

  toggleDeleteDTableDialog = (e) => {
    e && e.preventDefault();
    this.setState({ isDeleteDTableDialogOpen: !this.state.isDeleteDTableDialogOpen });
  };

  deleteDTable = () => {
    const { item } = this.props;
    this.props.deleteDTable(item);
    this.toggleDeleteDTableDialog();
  };

  toggleExternalLinkDialog = () => {
    this.setState({ isExternalLinkDialogOpen: !this.state.isExternalLinkDialogOpen });
  };

  onMenuItemClick = (operation) => {
    switch (operation) {
      case 'Delete':
        this.toggleDeleteDTableDialog();
        break;
      case 'External links':
        this.toggleExternalLinkDialog();
        break;
      default:
        break;
    }
  };

  renderDialogOperations = () => {
    const { item } = this.props;
    const tableName = '<span class="op-target">' + Utils.HTMLescape(item.name) + '</span>';
    const dialogMsg = gettext('Are you sure you want to delete {placeholder} ?').replace('{placeholder}', tableName);

    const { isDeleteDTableDialogOpen, isExternalLinkDialogOpen } = this.state;
    return (
      <Fragment>
        {isDeleteDTableDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete base')}
            message={dialogMsg}
            confirmBtnText={gettext('Delete')}
            executeOperation={this.deleteDTable}
            toggleDialog={this.toggleDeleteDTableDialog}
          />
        }
        {isExternalLinkDialogOpen &&
          <DTableAllExternalLinksDialog
            currentProject={item}
            toggle={this.toggleExternalLinkDialog}
          />
        }
      </Fragment>
    );
  };

  render() {
    const { isOpIconShown } = this.state;
    const { item } = this.props;
    const iconClass = 'dtable-font dtable-icon-table system-dtable-font';

    return (
      <Fragment>
        <tr onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td className="org-project-icon"><span className={iconClass} /></td>
          <td>{item.name}</td>
          <td>{item.uuid}</td>
          <td>{item.rows_count}</td>
          <td>{item.owner}</td>
          <td>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>
            {isOpIconShown &&
              <DTableOpMenu
                onFreezedItem={this.props.onFreezedItem}
                onMenuItemClick={this.onMenuItemClick}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            }
          </td>
        </tr>
        {this.renderDialogOperations()}
      </Fragment>
    );
  }
}

BaseItem.propTypes = propTypes;

export default BaseItem;
