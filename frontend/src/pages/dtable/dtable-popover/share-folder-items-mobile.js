import React from 'react';
import DTableItemShared from '../dtable-item-shared';
import DTableItemViewShared from '../dtable-item-view-shared';
import MobileCommonHeader from '../mobile/mobile-common-header';
import eventBus from '../../../utils/event-bus';
import { FolderItemsPropTypes } from './folder-items-constants';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import Loading from '../../../components/loading';

class ShareFolderItemsMobile extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      tableList: [],
      viewList: [],
    };
    this.eventBus = eventBus;
  }

  componentDidMount() {
    this.getTableList(this.props);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.getTableList(nextProps);
  }

  getTableList = (props) => {
    let { folder } = props;
    // In a folder, get share folder content from server
    if (folder) {
      this.setState({ isLoading: true });
      dtableWebAPI.getShareFolderContent(folder.id).then((res) => {
        const { shared_table_list, shared_view_list } = res.data;
        this.setState({
          tableList: shared_table_list,
          viewList: shared_view_list,
          isLoading: false,
        });
      });
    }
  };

  onFolderToggle = () => {
    this.eventBus.dispatch('folder-close');
    this.props.onFolderToggle(null);
  };

  render() {
    const { folder } = this.props;
    let { tableList, viewList, isLoading } = this.state;
    return (
      <div className="add-blank-table dtable-folder-view">
        <MobileCommonHeader
          title={folder.name}
          leftName={<i className="dtable-font dtable-icon-return"></i>}
          onLeftClick={this.onFolderToggle}
        />
        <div className='folder'>
          <div className='folder-items table-mobile-item-container'>
            {isLoading && <Loading />}
            {!isLoading && tableList.length === 0 && viewList.length === 0 &&
              <div className="my-8 text-center">{window.gettext('No shared bases or views in this folder')}</div>
            }
            {!isLoading && tableList.map((table, index) => {
              return (
                <DTableItemShared
                  key={index}
                  sharedItemIndex={index}
                  table={table}
                  leaveShareTable={this.props.leaveShareTable}
                  onCopyDTableToggle={this.props.onCopyDTableToggle}
                  onMoveFolderItemToggle={this.props.onMoveFolderItemToggle}
                />
              );
            })}
            {!isLoading && viewList.map((view, index) => {
              return (
                <DTableItemViewShared
                  key={index}
                  view={view}
                  leaveSharedView={this.props.leaveSharedView}
                  sharedViewItemIndex={index}
                  onMoveFolderItemToggle={this.props.onMoveFolderItemToggle}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }
}

ShareFolderItemsMobile.propTypes = FolderItemsPropTypes;

export default ShareFolderItemsMobile;
