import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Utils } from '../../../../utils/utils';
import { gettext } from '../../../../constants';
import dayjs from '../../../../utils/dayjs';
import ProjectOpMenu from '../../projects/project-op-menu';
import DTableAllExternalLinksDialog from '../../../dtable/dialog/all-external-links-dialog';
import { ProjectIcon, CommonOperationConfirmationDialog } from '../../../../components';
import { formatWithTimezone } from '@/sea-metadata/constants/column/format';

const propTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteProject: PropTypes.func.isRequired
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

  deleteProject = () => {
    const { item } = this.props;
    this.props.deleteProject(item);
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
            title={gettext('Delete project')}
            message={dialogMsg}
            confirmBtnText={gettext('Delete')}
            executeOperation={this.deleteProject}
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

    return (
      <Fragment>
        <tr onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td className="org-project-icon">
            <ProjectIcon size="small" bgColor={item.color} icon={item.icon} />
          </td>
          <td>{item.name}</td>
          <td>{item.uuid}</td>
          <td>{item.rows_count}</td>
          <td>{item.owner}</td>
          <td title={formatWithTimezone(item.created_at)}>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>
            {isOpIconShown &&
              <ProjectOpMenu
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
