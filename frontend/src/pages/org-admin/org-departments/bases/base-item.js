import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import CommonOperationConfirmationDialog from '../../../../components/dialog/common-operation-confirmation-dialog';
import dayjs from '../../../../utils/dayjs';
import { Utils } from '../../../../utils/utils';
import { gettext } from '../../../../constants';

const propTypes = {
  item: PropTypes.object.isRequired,
  deleteDTable: PropTypes.func.isRequired,
};

class BaseItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      highlight: false,
      isOpIconShown: false,
      isDeleteDTableDialogOpen: false,
    };
  }

  handleMouseEnter = () => {
    this.setState({
      highlight: true,
      isOpIconShown: true,
    });
  };

  handleMouseLeave = () => {
    this.setState({
      highlight: false,
      isOpIconShown: false,
    });
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

  renderDialogOperations = () => {
    const { item } = this.props;
    const { isDeleteDTableDialogOpen } = this.state;
    const tableName = '<span class="op-target">' + Utils.HTMLescape(item.name) + '</span>';
    const dialogMsg = gettext('Are you sure you want to delete {placeholder} ?').replace('{placeholder}', tableName);

    return (
      <Fragment>
        {isDeleteDTableDialogOpen && (
          <CommonOperationConfirmationDialog
            title={gettext('Delete base')}
            message={dialogMsg}
            confirmBtnText={gettext('Delete')}
            executeOperation={this.deleteDTable}
            toggleDialog={this.toggleDeleteDTableDialog}
          />
        )}
      </Fragment>
    );
  };

  render() {
    const { item } = this.props;
    const { isOpIconShown } = this.state;

    return (
      <Fragment>
        <tr onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td className="org-table-icon"><span className="dtable-font dtable-icon-table system-dtable-font" /></td>
          <td>{item.name}</td>
          <td>{item.uuid}</td>
          <td>{item.rows_count}</td>
          <td>{item.owner}</td>
          <td>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>
            <span
              className={`dtable-font dtable-icon-x action-icon ${isOpIconShown ? '' : 'invisible'}`}
              title={gettext('Delete')}
              aria-label={gettext('Delete')}
              onClick={this.toggleDeleteDTableDialog}
            />
          </td>
        </tr>
        {this.renderDialogOperations()}
      </Fragment>
    );
  }
}

BaseItem.propTypes = propTypes;

export default BaseItem;
