import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  group: PropTypes.object,
  onDeleteGroup: PropTypes.func.isRequired,
};

class GroupSelectionItem extends React.Component {

  onDeleteGroup = (event) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
    let group = this.props.group;
    this.props.onDeleteGroup(group);
  };

  getGroup = () => {
    let { group } = this.props;
    return group;
  };

  getContainerStyle = () => {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      margin: '0 10px 5px 0px',
      padding: '0 8px',
      height: '20px',
      fontSize: '13px',
      borderRadius: '10px',
      background: '#eaeaea',
    };
  };

  getOperationStyle = () => {
    return {
      display: 'inline-block',
      width: '16px',
      height: '20px',
      lineHeight: '20px',
      cursor: 'pointer',
      color: '#909090',
      transform: 'scale(.8)',
      textAlign: 'center'
    };
  };

  render() {
    let group = this.getGroup();
    let containerStyle = this.getContainerStyle();
    let operationStyle = this.getOperationStyle();

    return (
      <div className="group-selection-item" style={containerStyle}>
        <span className="group-name">{group.name}</span>
        <span className="group-remove" style={operationStyle} onClick={this.onDeleteGroup}>
          <i className="dtable-font dtable-icon-fork-number" style={{fontSize: '12px', height: '20px', lineHeight: '20px'}}></i>
        </span>
      </div>
    );
  }
}

GroupSelectionItem.propTypes = propTypes;

export default GroupSelectionItem;
