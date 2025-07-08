import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import CustomizePopover from '../../../components/customize-popover';
import { gettext } from '../../../constants';
import SysFiltersItem from './filter-widgets/filters-item';
import '../../../css/system-filter.css';

const propTypes = {
  filters: PropTypes.object,
  updateSysFilter: PropTypes.func,
  hideFilterPopover: PropTypes.func
};

const { availableRoles } = window.sysadmin.pageOptions;

class SysOrgFilterPopover extends Component {

  constructor(props) {
    super(props);
    const { orgRole } = props.filters;
    this.state = {
      orgRole: orgRole || ''
    };
  }

  updateRoleFilter = (selectedType) => {
    const { orgRole } = this.state;
    if (orgRole === selectedType) {
      this.setState({ orgRole: '' });
      return;
    }
    this.setState({ orgRole: selectedType });
  };

  handleSubmit = () => {
    const { orgRole } = this.state;
    this.props.updateSysFilter({ orgRole });
    this.props.hideFilterPopover();
  };

  onClearFilter = () => {
    this.setState({ orgRole: '' });
  };

  render() {
    const { orgRole } = this.state;
    return (
      <CustomizePopover
        target="dtable-filter-popover"
        popoverClassName="sys-filter-popover"
        hidePopover={this.props.hideFilterPopover}
        placement="bottom-end"
      >
        <div className="sys-filters-container">
          <div className="sys-filter-body">
            <div className="sys-filter-list">
              <SysFiltersItem
                filterTitle={gettext('Role')}
                selectedOptions={availableRoles}
                selectedChecked={orgRole}
                updatedFilerCheckedSelected={this.updateRoleFilter}
                isShowClearBtn={true}
                onClearFilter={this.onClearFilter}
              />
            </div>
          </div>
          <div className="sys-filter-footer">
            <Button color="secondary" className="mr-2" onClick={this.props.hideFilterPopover}>{gettext('Cancel')}</Button>
            <Button color="primary" onClick={this.handleSubmit}>{gettext('Submit')}</Button>
          </div>
        </div>
      </CustomizePopover>
    );
  }
}

SysOrgFilterPopover.propTypes = propTypes;

export default SysOrgFilterPopover;
