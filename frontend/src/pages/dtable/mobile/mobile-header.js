import React, { Component } from 'react';
import { Popover, Icon } from 'antd-mobile';
import PropTypes from 'prop-types';
import DtableMenuToolbar from '../toolbar/dtable-menu-toolbar';
import SearchDtable from '../search/search-dtable';
import SearchWorkflow from '../search/search-workflow';
import SearchApp from '../search/search-app';
import { gettext, workflowHelpLink } from '../../../utils/constants';
import MobileCommonHeader from './mobile-common-header';
import MobileNotifications from './mobile-notifications';

const Item = Popover.Item;

const MOBILE_HEADER_TITLE = {
  templates: 'Templates',
  workflow: 'Workflow',
  apps: 'Apps',
  mine: 'Mine'
};

export default class MobileHeader extends Component {

  static propTypes = {
    selectedTab: PropTypes.string.isRequired,
    isWorkflowHeaderPopoverVisible: PropTypes.bool.isRequired,
    searchPlaceholder: PropTypes.string,
    onShowSidePanel: PropTypes.func.isRequired,
    onWorkflowToolSelect: PropTypes.func.isRequired,
    toggleWorkflowHeaderPopoverVisible: PropTypes.func.isRequired,
    loadWorkspaceList: PropTypes.func.isRequired,
    onOpenWorkflowTaskByNotification: PropTypes.func.isRequired,
    onSearchedClick: PropTypes.func.isRequired,
  };

  renderWorkflowHeader = () => {
    const { selectedTab, isWorkflowHeaderPopoverVisible } = this.props;
    const title = MOBILE_HEADER_TITLE[selectedTab];
    if (!workflowHelpLink) {
      return (<MobileCommonHeader title={gettext(title)}/>);
    }
    const rightName = (
      <Popover
        mask
        overlayClassName="dtable-antd-mobile"
        overlayStyle={{ color: 'currentColor' }}
        visible={isWorkflowHeaderPopoverVisible}
        overlay={[
          (
            <Item
              key="0"
              value="using-help"
              className="mobile-popover-item"
              icon={(<i className="dtable-font dtable-icon-use-help"></i>)}
            >
              {gettext('Help')}
            </Item>
          )
        ]}
        align={{ overflow: { adjustY: 0, adjustX: 0 }, offset: [0, 4] }}
        onVisibleChange={this.props.toggleWorkflowHeaderPopoverVisible}
        onSelect={this.props.onWorkflowToolSelect}
        placement={'bottomRight'}
      >
        <div className="mobile-header-tools-icon">
          <Icon type="ellipsis"/>
        </div>
      </Popover>
    );
    return (
      <>
        <SearchWorkflow placeholder={gettext('Search workflow')} />
        <MobileCommonHeader title={gettext(title)} rightName={rightName} />
      </>
    );
  };

  renderUniversalAppsHeader = () => {
    const { selectedTab } = this.props;
    const title = MOBILE_HEADER_TITLE[selectedTab];
    return (
      <>
        <SearchApp placeholder={gettext('Search app')}/>
        <MobileCommonHeader title={gettext(title)}/>
      </>
    );
  };

  renderBasesHeader = () => {
    return (
      <header className="main-panel-north dtable-header">
        <DtableMenuToolbar
          onShowSidePanel={this.props.onShowSidePanel}
          loadWorkspaceList={this.props.loadWorkspaceList}
        />
        <div className="common-toolbar">
          <MobileNotifications onOpenWorkflowTaskByNotification={this.props.onOpenWorkflowTaskByNotification}/>
          <SearchDtable
            placeholder={this.props.searchPlaceholder || gettext('Search bases')}
            onSearchedClick={this.props.onSearchedClick}
          />
        </div>
      </header>
    );
  };

  render(){
    const { selectedTab } = this.props;
    if (selectedTab === 'bases') {
      return this.renderBasesHeader();
    }
    if (selectedTab === 'workflow') {
      return this.renderWorkflowHeader();
    }
    if (selectedTab === 'apps') {
      return this.renderUniversalAppsHeader();
    }
    const title = MOBILE_HEADER_TITLE[selectedTab];
    return (
      <MobileCommonHeader title={gettext(title)} />
    );
  }
}
