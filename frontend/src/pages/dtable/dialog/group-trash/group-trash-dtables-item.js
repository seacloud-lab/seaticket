import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { toaster } from 'dtable-ui-component';
import { Utils } from '../../../../utils/utils';
import { gettext } from '../../../../constants/config';
import { seaQAAPI } from '../../../../api/web-api';
import ModalPortal from '../../../../components/modal-portal';
import RestoreTableDialog from '../restore-table-dialog';
import DTableItem from '../../dtable-item';

const propTypes = {
  item: PropTypes.object.isRequired,
  groupID: PropTypes.number.isRequired,
  restoreDTable: PropTypes.func.isRequired,
};

class GroupTrashDTablesItem extends React.PureComponent {

  constructor(props) {
    super(props);
    this.state = {
      highlight: false,
      isRestoreDialogOpen: false,
      isRestoring: false,
    };
  }

  handleMouseOver = () => {
    this.setState({ highlight: true });
  };

  handleMouseOut = () => {
    this.setState({ highlight: false });
  };

  toggleRestoreDialog = () => {
    this.setState({ isRestoreDialogOpen: !this.state.isRestoreDialogOpen });
  };

  onRestoreGroupDTable = () => {
    const { item, groupID } = this.props;
    const { name: dtableName, uuid } = item;
    this.setState({ isRestoring: true });
    seaQAAPI.restoreGroupTrashDTable(uuid, groupID).then(() => {
      this.setState({ isRestoring: false });
      this.props.restoreDTable(item);
      const msg = gettext('Successfully restored {name}.').replace('{name}', dtableName);
      toaster.success(msg);
    }).catch((error) => {
      this.setState({ isRestoring: false });
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
    this.toggleRestoreDialog();
  };

  render() {
    const { item } = this.props;
    const { isRestoring, highlight } = this.state;

    return (
      <Fragment>
        <tr className={highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver} onMouseLeave={this.handleMouseOut}>
          <td><DTableItem dtableColor={item.color} dtableIcon={item.icon}/></td>
          <td>
            <div className="trash-table-name text-truncate" onClick={this.toggleRestoreDialog}>{item.name}</div>
          </td>
          <td>{dayjs(item.delete_time).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>
            {isRestoring ? (
              <span className="loading-icon loading-tip" />
            ) : (
              highlight && (
                <span
                  onClick={this.toggleRestoreDialog}
                  className="trash-table-restore"
                >
                  {gettext('Restore')}
                </span>
              )
            )}
          </td>
        </tr>
        {this.state.isRestoreDialogOpen &&
          <ModalPortal>
            <RestoreTableDialog
              currentTable={item}
              handleSubmit={this.onRestoreGroupDTable}
              restoreCancel={this.toggleRestoreDialog}
              owner_deleted={item.owner_deleted}
            />
          </ModalPortal>
        }
      </Fragment>
    );
  }
}

GroupTrashDTablesItem.propTypes = propTypes;

export default GroupTrashDTablesItem;
