import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Icon from '@/components/icon';
import { gettext } from '@/constants';

class SelectAll extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isSelectedAll: props.isSelectedAll,
    };
  }

  componentDidUpdate(prevProps) {
    const { isSelectedAll } = this.props;
    if (isSelectedAll !== prevProps.isSelectedAll) {
      this.setState({
        isSelectedAll,
      });
    }
  }

  onToggleSelectAll = (e) => {
    const { isMobile, hasSelectedRow } = this.props;
    const { isSelectedAll } = this.state;
    if (isMobile) {
      e.preventDefault();
    }
    if (hasSelectedRow || isSelectedAll) {
      this.setState({ isSelectedAll: false });
      this.props.selectNoneRows();
      return;
    }
    this.setState({ isSelectedAll: true });
    this.props.selectAllRows();
  };

  render() {
    const { isMobile, hasSelectedRow } = this.props;
    const { isSelectedAll } = this.state;
    const isSelectedParts = hasSelectedRow && !isSelectedAll;
    return (
      <div className="select-all-checkbox-container" onClick={this.onToggleSelectAll}>
        {isMobile ?
          <label className='mobile-select-all-container'>
            {isSelectedParts ?
              <Icon symbol="partially-selected" />
              :
              <>
                <input
                  className="mobile-select-all-checkbox"
                  name="mobile-select-all-checkbox"
                  type="checkbox"
                  checked={isSelectedAll}
                  readOnly
                />
                <div className='select-all-checkbox-show'></div>
              </>
            }
          </label> :
          <>
            {isSelectedParts ?
              (<Icon symbol="partially-selected" />) :
              (
                <input
                  id="select-all-checkbox"
                  className="select-all-checkbox"
                  type="checkbox"
                  name={gettext('Select all')}
                  title={gettext('Select all')}
                  aria-label={gettext('Select all')}
                  checked={isSelectedAll}
                  readOnly
                />
              )
            }
          </>
        }
        <label
          htmlFor="select-all-checkbox"
          name={gettext('Select all')}
          title={gettext('Select all')}
          aria-label={gettext('Select all')}
        >
        </label>
      </div>
    );
  }
}

SelectAll.propTypes = {
  isMobile: PropTypes.bool,
  hasSelectedRow: PropTypes.bool,
  isSelectedAll: PropTypes.bool,
  selectNoneRows: PropTypes.func,
  selectAllRows: PropTypes.func,
};

export default SelectAll;
