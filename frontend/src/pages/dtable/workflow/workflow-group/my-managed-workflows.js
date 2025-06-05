import React from 'react';
import PropTypes from 'prop-types';
import { DTableEmptyTip } from 'dtable-ui-component';
import { Dropdown, DropdownToggle, DropdownItem, DropdownMenu } from 'reactstrap';
import WorkflowItem from './workflow-item';
import WorkflowFolder from './workflow-folder';
import { emptyWorkflowImageSrc, MANAGED_WORKFLOW_FOLDER } from '../../../../workflow/constants/workflow-folder';

const gettext = window.gettext;

class MyManagedWorkflows extends React.Component {

  constructor(props) {
    super(props);
    const { workflows, numberOfWorkflowsShown, managedWorkflowFolders } = this.props;
    const total = workflows.length + managedWorkflowFolders.length;
    this.state = {
      isShowAll: total > numberOfWorkflowsShown ? false : true,
      isShowDropdownMenu: false,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.state.isShowAll) return;
    const { numberOfWorkflowsShown, workflows, managedWorkflowFolders } = nextProps;
    const total = workflows.length + managedWorkflowFolders.length;
    this.setState({ isShowAll: total > numberOfWorkflowsShown ? false : true });
  }

  showAll = () => {
    this.setState({ isShowAll: true });
  };

  openDropdownMenu = () => {
    this.setState({ isShowDropdownMenu: !this.state.isShowDropdownMenu });
  };

  openAddFolderDialog = () => {
    this.props.onToggleAddFolderDialog(MANAGED_WORKFLOW_FOLDER);
  };

  getDisplayItems = () => {
    const { workflows, managedWorkflowFolders, numberOfWorkflowsShown } = this.props;
    const { isShowAll } = this.state;
    const workflowsCount = workflows.length;
    const foldersCount = managedWorkflowFolders.length;
    if (isShowAll) {
      return { displayFolders: managedWorkflowFolders, displayWorkflows: workflows, displayCount: workflowsCount + foldersCount };
    }

    // not show all folders and workflows
    let displayWorkflows = [];
    let displayFolders = managedWorkflowFolders;

    // The number of folders is less than the number that can fit on each row
    if (foldersCount < numberOfWorkflowsShown) {
      displayWorkflows = workflows.slice(0, numberOfWorkflowsShown - foldersCount);
    } else {
      // The number of folders is more than or  equal to the number that can fit on each row
      displayFolders = managedWorkflowFolders.slice(0, numberOfWorkflowsShown);
    }
    return { displayWorkflows, displayFolders, displayCount: numberOfWorkflowsShown };
  };

  renderWorkflows = () => {
    const { managedWorkflowFolders } = this.props;
    const { isShowAll } = this.state;
    const { displayFolders, displayWorkflows, displayCount } = this.getDisplayItems();
    if (displayCount === 0) {
      return (
        <div className="my-8">
          <DTableEmptyTip src={emptyWorkflowImageSrc} text={gettext('No workflow have been added yet')} />
        </div>
      );
    }
    const loadMoreStyle = this.props.getLoadMoreStyle();
    const foldersCount = managedWorkflowFolders.length;
    return (
      <div className="workflow-group-content d-flex">
        {displayFolders.map((folder, index) => {
          const { className, style } = this.props.getWorkflowItemClassAndStyle(index, displayCount);
          const { id } = folder;
          return (
            <WorkflowFolder
              key={`workflow-folder-${id}`}
              style={style}
              className={className}
              folderItem={folder}
              folderType={MANAGED_WORKFLOW_FOLDER}
              onDeleteFolder={this.props.onDeleteFolder}
              onRenameFolder={this.props.onRenameFolder}
              onToggleCurrentFolderView={this.props.onToggleCurrentFolderView}
              onToggleCurrentFolderDialog={this.props.onToggleCurrentFolderDialog}
            />
          );
        })
        }
        {displayWorkflows.map((workflowItem, index) => {
          const { id, group_id } = workflowItem;
          const { className, style } = this.props.getWorkflowItemClassAndStyle(index + foldersCount, displayCount);
          return (
            <WorkflowItem
              key={`workflow-item-${group_id}-${id}`}
              style={style}
              className={className}
              workflowItem={workflowItem}
              folders={managedWorkflowFolders}
              isManaged={true}
              onMoveWorkflowToFolder={this.props.onMoveWorkflowToFolder}
              onUpdateWorkflowProperties={this.props.onUpdateWorkflowProperties}
              onDeleteWorkflow={this.props.onDeleteWorkflow}
              refreshPendingtasksCount={this.props.refreshPendingtasksCount}
            />
          );
        })}
        {!isShowAll && (
          <div className="load-more-workflows d-flex align-items-center" style={loadMoreStyle}>
            <div className="load-more-workflows-line"></div>
            <div className="load-more-workflows-tip" onClick={this.showAll}>
              {gettext('Show more')}
            </div>
            <div className="load-more-workflows-line"></div>
          </div>
        )}
      </div>
    );
  };

  render() {
    const { isShowDropdownMenu } = this.state;
    return (
      <div className="workflow-group-container">
        <div className="workflow-group-name">
          <span className="text-truncate">{gettext('My managed workflows')}</span>
          <Dropdown isOpen={isShowDropdownMenu} toggle={this.openDropdownMenu} className="workflows-dropdown">
            <DropdownToggle
              tag="i"
              role="button"
              className="toggle-icon dtable-font dtable-icon-down3"
              data-toggle="dropdown"
              aria-expanded={isShowDropdownMenu}
              title={gettext('More operations')}
              aria-label={gettext('More operations')}
              aria-haspopup={true}
            />
            <DropdownMenu>
              <DropdownItem className="create-workflow-folder-item" onClick={this.openAddFolderDialog}>
                <span aria-hidden="true">
                  <i className="item-icon dtable-font dtable-icon-folders" />
                </span>
                <span>{gettext('Create a folder')}</span>
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
        {this.renderWorkflows()}
      </div>
    );
  }
}

MyManagedWorkflows.propTypes = {
  workflows: PropTypes.array,
  managedWorkflowFolders: PropTypes.array,
  numberOfWorkflowsShown: PropTypes.number,
  getWorkflowItemClassAndStyle: PropTypes.func,
  onUpdateWorkflowProperties: PropTypes.func.isRequired,
  onDeleteWorkflow: PropTypes.func.isRequired,
  refreshPendingtasksCount: PropTypes.func.isRequired,
  getLoadMoreStyle: PropTypes.func.isRequired,
  onRenameFolder: PropTypes.func,
  onDeleteFolder: PropTypes.func,
  onToggleAddFolderDialog: PropTypes.func,
  onToggleCurrentFolderDialog: PropTypes.func,
  onToggleCurrentFolderView: PropTypes.func,
  onMoveWorkflowToFolder: PropTypes.func,
};

export default MyManagedWorkflows;
