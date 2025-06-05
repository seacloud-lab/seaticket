import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'reactstrap';

const propTypes = {
  id: PropTypes.string.isRequired,
  description: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.node
  ]).isRequired,
  type: PropTypes.string.isRequired,
};

class FiltersTooltip extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      tooltipOpen: false,
    };
  }

  tooltipToggle = () => {
    this.setState({ tooltipOpen: !this.state.tooltipOpen });
  };

  getTooltipIcon = (type) => {
    switch (type) {
      case 'success': {
        return 'dtable-font dtable-icon-exclamation-circle tooltip-success-icon';
      }
      case 'warning': {
        return 'dtable-font dtable-icon-exclamation-triangle tooltip-warning-icon';
      }
      default: {
        return '';
      }
    }
  };

  render() {
    const { id, description, type } = this.props;
    let { tooltipOpen } = this.state;
    let tooltipIcon = this.getTooltipIcon(type);
    return (
      <div className="filters-tips">
        <i className={tooltipIcon} id={id}></i>
        <Tooltip
          placement="bottom"
          isOpen={tooltipOpen}
          toggle={this.tooltipToggle}
          target={id}
          innerClassName="form-edit-tooltip-inner"
        >
          {description}
        </Tooltip>
      </div>
    );
  }
}

FiltersTooltip.propTypes = propTypes;

export default FiltersTooltip;
