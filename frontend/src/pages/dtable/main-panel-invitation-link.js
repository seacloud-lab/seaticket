import React, { Fragment } from 'react';
import copy from 'copy-to-clipboard';
import { Button, Modal, ModalBody } from 'reactstrap';
import { QRCodeCanvas } from 'qrcode.react';
import { toaster, DTableModalHeader } from 'dtable-ui-component';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { Utils } from '../../utils/utils';
import Loading from '../../components/loading';
import { server, mediaUrl } from '../../utils/constants';

const linkTip = 'SeaTable 是一款新型的在线协同表格和信息管理工具。它支持“文件”、“图片”、“单选项”、“协作人”、“计算公式”等丰富的数据类型，帮助你用表格的形式来方便的组织和管理各类信息。赶快来体验一下吧！';

class MainPanelInvitationLink extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      invitationLink: '',
      isLoading: true,
      isShowQRCode: false,
      posterLink: '',
    };
  }

  componentDidMount() {
    dtableWebAPI.getInvitationLink().then(res => {
      let invitationLink = res.data.invitation_link;
      this.setState({
        invitationLink: invitationLink,
        isLoading: false
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }

  onCopyLink = () => {
    copy(this.state.invitationLink + '\n' + linkTip);
    toaster.success('已经复制到粘贴板，你可以使用 Ctrl+V 粘到需要的地方去了');
  };

  onGenInvPosterToggle = () => {
    let { invitationLink } = this.state;
    let parts = invitationLink.split('/');
    let posterLink = server.replace(/\/$/, '') + '/invite/poster-link/' + parts[parts.length - 2] + '/';
    if (Utils.isDesktop()) {
      this.setState({
        isShowQRCode: !this.state.isShowQRCode,
        posterLink: posterLink
      });
    } else {
      window.open(posterLink);
    }
  };

  onCloseQRCode = () => {
    this.setState({ isShowQRCode: false });
  };

  render() {
    const { isLoading, invitationLink, isShowQRCode, posterLink } = this.state;
    if (isLoading) {
      return <Loading />;
    }

    const title = '赶快复制此链接邀请好友加入 SeaTable 吧，每个好友注册你都可以获得 10 元代金币';
    const favicon = {
      src: `${mediaUrl}img/seatable-invitation.ico`,
      x: null,
      y: null,
      height: 16,
      width: 16,
      excavate: true,
    };
    return (
      <Fragment>
        <div className="main-panel-center main-panel-invitation-link">
          <h3 className="invitation-link-title">{title}</h3>
          <div className="invitation-link-content">
            <p><a href={invitationLink}>{invitationLink}</a></p>
            <p>{linkTip}</p>
          </div>
          <div className="buttons">
            <Button color="outline-primary mr-4" onClick={this.onCopyLink}>{'复制链接'}</Button>
            <Button color="primary" onClick={this.onGenInvPosterToggle}>{'生成邀请海报'}</Button>
          </div>
        </div>
        {Utils.isDesktop() && isShowQRCode && (
          <Modal isOpen={true} toggle={this.onCloseQRCode} style={{ width: '350px', height: '350px' }} contentClassName="h-100">
            <DTableModalHeader toggle={this.onCloseQRCode}>生成邀请海报</DTableModalHeader>
            <ModalBody className="d-flex align-items-center justify-content-center">
              <div className="d-flex flex-column align-items-center">
                <QRCodeCanvas
                  value={posterLink}
                  size={160}
                  imageSettings={favicon}
                />
                <div className="d-flex flex-column mt-4" style={{ color: '#666' }}>
                  <span>打开手机，扫一扫</span>
                  <span>生成邀请注册海报</span>
                </div>
              </div>
            </ModalBody>
          </Modal>
        )}
      </Fragment>
    );
  }
}

export default MainPanelInvitationLink;
