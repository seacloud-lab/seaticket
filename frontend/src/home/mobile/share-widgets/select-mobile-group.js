import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import Loading from '../../../components/loading';
import { seaQAAPI } from '../../../api/web-api';
import { gettext } from '../../../constants';

const propTypes = {
  selectedOptions: PropTypes.array,
  toggle: PropTypes.func,
  setGroup: PropTypes.func,
};

class SelectGroup extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      selectedOptions: this.getInitSelectedOptions(),
      groups: [],
      isLoading: true,
      isSelectGroupModalShow: true,
    };
  }

  componentDidMount() {
    seaQAAPI.listWorkspaces(true).then((res) => {
      let groups = [];
      res.data.workspace_list.forEach(item => {
        if (item.type === 'group') {
          const groupItem = { value: Number(item.group_id), label: item.name };
          groups.push(groupItem);
        }
      });
      this.setState({ groups: groups, isLoading: false });
    }).catch(error => {
      this.setState({ isLoading: false });
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  }

  getInitSelectedOptions = () => {
    const { selectedOptions } = this.props;
    let existedGroups = [];
    if (selectedOptions && selectedOptions.length > 0) {
      existedGroups = selectedOptions.map(group => {
        return {
          value: group.group_id,
          label: group.group_name
        };
      });
    }
    return existedGroups;
  };

  toggle = () => {
    this.props.toggle();
  };

  selectGroupChange = (event, groupItem) => {
    event.stopPropagation();
    const { selectedOptions } = this.props;
    let selectedOptionsIdList = [];
    if (selectedOptions && selectedOptions.length > 0) {
      selectedOptionsIdList = selectedOptions.map(group => group.group_id);
    }
    if (selectedOptionsIdList.indexOf(groupItem.value) > -1) return;
    let newSelectedOptions = this.state.selectedOptions.slice(0);
    const groupItemIndex = newSelectedOptions.findIndex(item => item.value === groupItem.value);
    if (groupItemIndex > -1) {
      newSelectedOptions.splice(groupItemIndex, 1);
    } else {
      newSelectedOptions.push(groupItem);
    }

    this.setState({ selectedOptions: newSelectedOptions });
  };

  setGroup = () => {
    const { selectedOptions } = this.state;
    this.props.setGroup(selectedOptions);
    this.props.toggle();
  };

  onSelectGroupModalToggle = () => {
    this.setState({
      isSelectGroupModalShow: !this.state.isSelectGroupModalShow
    }, () => {
      this.props.toggle();
    });
  };

  renderHeader = () => {
    return (
      <div className="modal-select-user-header">
        <span>{gettext('Select groups')}</span>
        <span className="select-user-close-btn" onClick={this.setGroup}>{gettext('Done')}</span>
      </div>
    );
  };

  renderList = () => {
    const { groups, selectedOptions, isLoading } = this.state;
    if (isLoading) return <div className="none-search-result"><Loading /></div>;
    return (
      <div className="options-container">
        {groups.map((groupItem) => {
          const selectedGroupIndex = selectedOptions.findIndex(item => item.value === groupItem.value);
          return (
            <div
              key={`groupItem${groupItem.value}`}
              onClick={(event) => this.selectGroupChange(event, groupItem)}
              className="mobile-list-item"
            >
              <div className="select-container">
                <span className="selected-item-name">{groupItem.label}</span>
                {selectedGroupIndex > -1 &&
                  <span className='select-check-icon'>
                    <i className="dtable-font dtable-icon-check-mark"></i>
                  </span>
                }
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  render() {
    const { isSelectGroupModalShow, groups } = this.state;
    return (
      <div className={isSelectGroupModalShow ? '' : 'd-none'} onClick={this.onSelectGroupModalToggle}>
        <div className="mobile-operation-menu-bg-layer"></div>
        <div className="mobile-operation-menu select-user-modal">
          {this.renderHeader()}
          {groups.length > 0 &&
            <div className="mobile-list">
              {this.renderList()}
            </div>
          }
        </div>
      </div>
    );
  }
}

SelectGroup.propTypes = propTypes;

export default SelectGroup;
