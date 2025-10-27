import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import MainPanelTopbar from '../main-panel-topbar';
import Nav from './user-nav';
import { Utils } from '@/utils/utils';
import Dirent from '@/models/system-admin/dirent';
import { siteRoot } from '@/constants';
import DirPathBar from '@/components/storage/storage-dir-path-bar';
import DirContent from '@/components/storage/storage-dir-content';
import sysAdminAPI from '@/sys-admin/api';

const storagePropTypes = {
  email: PropTypes.string,
  onCloseSidePanel: PropTypes.func
};

class UserStorage extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      userInfo: {},
      path: '',
      direntList: [],
      repo_id: '',
    };
  }

  componentDidMount() {
    const email = decodeURIComponent(this.props.email);
    sysAdminAPI.sysAdminGetUser(email).then((res) => {
      this.setState({
        userInfo: res.data
      }, () => {
        this.loadDirentList('/');
      });
    });
  }

  loadDirentList = (path) => {
    const email = decodeURIComponent(this.props.email);
    sysAdminAPI.sysAdminListUserRepoDirents(email, path).then(res => {
      let direntList = [];
      let repo_id = res.data.repo_id;
      res.data.dirent_list.forEach(dirent => {
        direntList.push(new Dirent(dirent));
      });

      this.setState({
        loading: false,
        direntList: direntList,
        path: path,
        repo_id: repo_id,
      }, () => {
        let url = siteRoot + 'sys/users/' + encodeURIComponent(email) + '/storage' + Utils.encodePath(path);
        window.history.replaceState({ url: url, path: path }, path, url);
      });
    }).catch((error) => {
      this.setState({
        loading: false,
        errorMsg: Utils.getErrorMsg(error, true) // true: show login tip if 403
      });
    });
  };

  openFolder = (dirent) => {
    let direntPath = Utils.joinPath(this.state.path, dirent.name);
    if (!dirent.is_file) {
      this.loadDirentList(direntPath);
    }
  };

  onPathClick = (path) => {
    this.loadDirentList(path);
  };

  setNewName = (dirent, newName) => {
    const email = decodeURIComponent(this.props.email);
    let direntPath = Utils.joinPath(this.state.path, dirent.name);
    sysAdminAPI.sysAdminRenameUserFile(email, direntPath, newName).then(() => {
      let newDirentList = this.state.direntList.slice();
      newDirentList = newDirentList.map((item) => {
        if (dirent.obj_id === item.obj_id) {
          item.name = newName;
        }
        return item;
      });
      this.setState({ direntList: newDirentList });
    }).catch((error) => {
      this.setState({
        loading: false,
        errorMsg: Utils.getErrorMsg(error, true) // true: show login tip if 403
      });
    });
  };

  render() {
    const { loading, errorMsg, userInfo, direntList, path } = this.state;
    return (
      <Fragment>
        <MainPanelTopbar/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <Nav currentItem="storage" email={this.props.email} userName={userInfo.name} />
            <div className="cur-view-content">
              <div className="cur-view-path align-items-center">
                <DirPathBar
                  rootName={userInfo.name ? userInfo.name : ''}
                  currentPath={path}
                  onPathClick={this.onPathClick}
                />
              </div>
              <DirContent
                loading={loading}
                errorMsg={errorMsg}
                direntList={direntList}
                openFolder={this.openFolder}
                setNewName={this.setNewName}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

UserStorage.propTypes = storagePropTypes;

export default UserStorage;
