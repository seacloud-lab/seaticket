import React, { Component } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import PropTypes from 'prop-types';
import deepCopy from 'deep-copy';
import { toaster } from 'dtable-ui-component';
import { setLocale } from 'dtable-ui-component/lib/lang';
import { CellType, FILTER_COLUMN_OPTIONS, getValidFilters } from 'dtable-utils';
import { enableAddressBookV2 } from '../../../../utils/constants';
import { Utils } from '../../../../utils/utils';
import { dtableWebAPI } from '../../../../api/dtable-web-api';
import Department from '../../../../models/department';
import ObjectUtils from '../../../../utils/object-utils';
import FiltersPopover from '../../../../pages/dtable/dialog/dataset-widgets/filter-popover';

const gettext = window.gettext;

const { lang } = window.app.config;

const propTypes = {
  target: PropTypes.string,
  column: PropTypes.object,
  columns: PropTypes.array,
  onColumnChanged: PropTypes.func,
};

class PreFilterSetting extends Component {

  constructor(props) {
    super(props);
    const { columns, column } = props;
    const filters = column.link_filters || [];
    const filterConjunction = column.link_filter_conjunction;
    const validFilters = deepCopy(getValidFilters(filters, columns));
    this.state = {
      isFiltersPopoverShow: false,
      validFilters,
      filterConjunction,
      departments: [],
    };
    this.filteredColumns = this.getFilteredColumns(columns);
  }

  componentDidMount() {
    setLocale(lang);
    this.initDepartmentsList();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.column.key !== this.props.column.key) {
      const { columns, column } = nextProps;
      const filters = column.link_filters || [];
      const filterConjunction = column.link_filter_conjunction;
      const validFilters = deepCopy(getValidFilters(filters, columns));
      this.setState({ validFilters, filterConjunction });
      this.filteredColumns = this.getFilteredColumns(columns);
    }
  }

  initDepartmentsList = () => {
    const departmentColumn = this.filteredColumns.find(column => column.type === CellType.DEPARTMENT_SINGLE_SELECT);
    if (!departmentColumn) return;
    let listDepartmentsAPIName;
    if (enableAddressBookV2) {
      listDepartmentsAPIName = 'listAddressBookV2Departments';
    } else {
      listDepartmentsAPIName = 'listAddressBookDepartments';
    }
    dtableWebAPI[listDepartmentsAPIName]().then((res) => {
      let departments = res.data.departments.map(item => {
        return new Department(item);
      });
      this.setState({ departments: departments });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  getFilteredColumns = (columns) => {
    let filterColumns = [];
    // The data of the column before the current column determines whether the current column is displayed or not
    columns.forEach((column) => {
      if (column.editable && column.type !== CellType.LINK && FILTER_COLUMN_OPTIONS[column.type]) {
        filterColumns.push(column);
      }
    });
    return filterColumns;
  };

  onFilterToggle = () => {
    this.setState({ isFiltersPopoverShow: !this.state.isFiltersPopoverShow });
  };

  update = (update) => {
    const { column: editColumn, columns } = this.props;
    const { filters, filter_conjunction } = update || {};
    let { link_filters: old_filters, filter_conjunction: old_filter_conjunction } = editColumn;
    const old_valid_filters = getValidFilters(old_filters, columns);
    const valid_filters = getValidFilters(filters, columns);
    const isFiltersChanged = ObjectUtils.isObjectChanged(old_valid_filters, valid_filters);
    if (filter_conjunction !== old_filter_conjunction || isFiltersChanged) {
      const link_filters = valid_filters;
      const link_filter_conjunction = filter_conjunction;
      this.setState({ validFilters: link_filters, filterConjunction: link_filter_conjunction }, () => {
        this.props.onColumnChanged(editColumn.key, { link_filters, link_filter_conjunction });
      });
    }
  };

  renderLabel = () => {
    return (
      <div className="filed-label-filter d-flex align-items-center">
        {gettext('Preset filter')}
        <div className="filters-tips ml-1">
          <i className="dtable-font dtable-icon-use-help" id="link-pre-filter-tip"></i>
          <UncontrolledTooltip
            target='link-pre-filter-tip'
            placement="top"
            innerClassName="form-edit-tooltip-inner"
          >
            {gettext('When linking existing records, only records that meet the filters will be shown as candidates.')}
          </UncontrolledTooltip>
        </div>
      </div>
    );
  };

  render() {
    const { target } = this.props;
    const { validFilters, filterConjunction, departments } = this.state;
    const filtersLength = validFilters ? validFilters.length : 0;
    let filterMessage = gettext('Add filter');
    if (filtersLength === 1) {
      filterMessage = gettext('Added') + ' ' + gettext('1 filter');
    } else if (filtersLength > 1) {
      filterMessage = gettext('Added') + ' ' + filtersLength + ' ' + gettext('filters');
    }
    return (
      <>
        <div className="filed-setting-item ml-2">
          {this.renderLabel()}
          <div className={filtersLength === 0 ? 'add-filter' : 'edit-filter'} id={target || 'dtable-filter-popover'} onClick={this.onFilterToggle}>
            {filtersLength === 0 ?
              <>
                <i className="dtable-font dtable-icon-add-table"></i>
                <span className="add-new-option ml-2">{filterMessage}</span>
              </>
              :
              <>
                <span className="add-new-option">{filterMessage}</span>
                <i className="dtable-font dtable-icon-rename"></i>
              </>
            }
          </div>
        </div>
        {this.state.isFiltersPopoverShow &&
          <FiltersPopover
            target={target}
            columns={this.filteredColumns}
            collaborators={[]} // form module is not support edit collaborators column
            filterConjunction={filterConjunction}
            filters={validFilters}
            update={this.update}
            hideFilterPopover={this.onFilterToggle}
            departments={departments}
          />
        }
      </>
    );
  }
}

PreFilterSetting.propTypes = propTypes;

export default PreFilterSetting;
