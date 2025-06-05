import React from 'react';
import PropTypes from 'prop-types';

const gettext = window.gettext;

class GroupItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isShowDelete: false
    };
  }

  onMouseEnter = () => {
    this.setState({ isShowDelete: true });
  };

  onMouseLeave = () => {
    this.setState({ isShowDelete: false });
  };

  deleteGroup = () => {
    const group = this.props.group;
    if (group && group.group_id) {
      this.props.deleteGroup(group.group_id);
    }
  };

  render() {
    let { group } = this.props;
    return (
      <tr onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        <td className="pl-2 text-truncate">{group.group_name}</td>
        <td>
          <span
            className={`dtable-font dtable-icon-x action-icon ${this.state.isShowDelete ? '' : 'hide'}`}
            onClick={this.deleteGroup}
            title={gettext('Delete')}
            aria-label={gettext('Delete')}
          />
        </td>
      </tr>
    );
  }
}

GroupItem.propTypes = {
  group: PropTypes.object,
  deleteGroup: PropTypes.func
};

export default GroupItem;
