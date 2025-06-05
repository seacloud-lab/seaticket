import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import dayjs from 'dayjs';
import { Button } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { gettext } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import RestoreTableDialog from '../../dtable/dialog/restore-table-dialog';
import DTableItem from '../dtable-item';

const propTypes = {
  item: PropTypes.object.isRequired,
  restoreDTable: PropTypes.func
};

class DTableTrashItem extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isRestoreDialogOpen: false,
    };
  }

  toggleRestoreDialog = () => {
    this.setState({ isRestoreDialogOpen: !this.state.isRestoreDialogOpen });
  };

  onRestoreDTable = () => {
    const item = this.props.item;
    const dtableName = item.name;
    dtableWebAPI.restoreTrashDTable(item.id).then(() => {
      this.props.restoreDTable(item);
      const msg = gettext('Successfully restored {name}.').replace('{name}', dtableName);
      toaster.success(msg);
    }).catch((error) => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
    this.toggleRestoreDialog();
  };

  render() {
    const item = this.props.item;
    const delete_time = dayjs(item.delete_time).format('YYYY-MM-DD HH:mm:ss');
    return (
      <Fragment>
        <MediaQuery query="(min-width: 767.8px)">
          <tr className="trash-table-base-detail">
            <td>
              <div className="trash-table-base-content" aria-hidden="true">
                <DTableItem dtableColor={item.color} dtableIcon={item.icon}/>
              </div>
            </td>
            <td>
              <div className="trash-table-name text-truncate" onClick={this.toggleRestoreDialog} aria-label={item.name} title={item.name}>{item.name}</div>
            </td>
            <td title={delete_time} aria-label={delete_time}>{delete_time}</td>
            <td>
              <Button
                className="trash-table-restore btn btn-link"
                onClick={this.toggleRestoreDialog}
                title={gettext('Restore')}
                aria-label={gettext('Restore')}
              >{gettext('Restore')}
              </Button>
            </td>
          </tr>
          {this.state.isRestoreDialogOpen &&
            <RestoreTableDialog
              currentTable={item}
              handleSubmit={this.onRestoreDTable}
              restoreCancel={this.toggleRestoreDialog}
            />
          }
        </MediaQuery>
        <MediaQuery query="(max-width: 767.8px)">
          <tr className="trash-table-base-detail">
            <td>
              <div className="trash-table-base-content">
                <DTableItem dtableColor={item.color} dtableIcon={item.icon}/>
              </div>
            </td>
            <td>
              <div className="trash-table-name-mobile text-truncate">{item.name}</div>
              <div className="text-secondary text-truncate">
                {gettext('Deleted at')}:{dayjs(item.delete_time).format('YYYY-MM-DD')}
              </div>
            </td>
            <td>
              <div className="trash-table-restore-mobile">
                <span onClick={this.toggleRestoreDialog}>{gettext('Restore')}</span>
              </div>
            </td>
          </tr>
          {this.state.isRestoreDialogOpen &&
            <RestoreTableDialog
              currentTable={item}
              handleSubmit={this.onRestoreDTable}
              restoreCancel={this.toggleRestoreDialog}
            />
          }
        </MediaQuery>
      </Fragment>
    );
  }
}

DTableTrashItem.propTypes = propTypes;

export default DTableTrashItem;
