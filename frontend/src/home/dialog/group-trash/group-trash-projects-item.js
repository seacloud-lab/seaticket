import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { toaster, ModalPortal, ProjectIcon } from '../../../components';
import { Utils } from '../../../utils/utils';
import { gettext } from '../../../constants/config';
import { seaQAAPI } from '../../../api/web-api';
import RestoreProjectDialog from '../restore-project-dialog';
import { formatWithTimezone } from '@/sea-metadata/utils/column';

const propTypes = {
  item: PropTypes.object.isRequired,
  groupID: PropTypes.number.isRequired,
  restoreProject: PropTypes.func.isRequired,
};

class GroupTrashProjectsItem extends React.PureComponent {

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
    const { name, uuid } = item;
    this.setState({ isRestoring: true });
    seaQAAPI.restoreGroupTrashProject(uuid, groupID).then(() => {
      this.setState({ isRestoring: false });
      this.props.restoreProject(item);
      const msg = gettext('Successfully restored {name}.').replace('{name}', name);
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
          <td><ProjectIcon bgColor={item.color} icon={item.icon}/></td>
          <td>
            <div className="trash-project-name text-truncate" onClick={this.toggleRestoreDialog}>{item.name}</div>
          </td>
          <td title={formatWithTimezone(item.delete_time)}>{dayjs(item.delete_time).format('YYYY-MM-DD HH:mm:ss')}</td>
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
            <RestoreProjectDialog
              currentProject={item}
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

GroupTrashProjectsItem.propTypes = propTypes;

export default GroupTrashProjectsItem;
