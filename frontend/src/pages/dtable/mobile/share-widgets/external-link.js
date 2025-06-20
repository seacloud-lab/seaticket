import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import copy from 'copy-to-clipboard';
import { List, Icon, ActionSheet } from 'antd-mobile';
import { toaster } from 'dtable-ui-component';
import { Utils } from '../../../../utils/utils';
import AddExternalLink from './add-external-link';
import ShareAddedBtn from './share-add-btn';
import { gettext } from '../../../../utils/constants';
import { seaQAAPI } from '../../../../api/web-api';

const Item = List.Item;
const Brief = Item.Brief;

const propTypes = {
  currentTable: PropTypes.object
};

class ExternalLink extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowAddExternalLink: false,
      externalLinks: []
    };
  }

  componentDidMount() {
    const { workspace_id, name } = this.props.currentTable;
    seaQAAPI.getDTableExternalLink(workspace_id, name).then(res => {
      let externalLinks = res.data.links;
      this.setState({
        externalLinks: externalLinks,
      });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      toaster.danger(errMsg);
    });
  }

  onAddExternalLink = () => {
    this.setState({ isShowAddExternalLink: !this.state.isShowAddExternalLink });
  };

  addExternalLink = (externalLink) => {
    let externalLinks = this.state.externalLinks.slice();
    externalLinks.push(externalLink);
    this.setState({ externalLinks: externalLinks });
  };

  showActionSheet = (externalItem) => {
    let BUTTONS = [
      (<div className="my-am-action"><i className="dtable-font dtable-icon-copy-link"></i>{gettext('Copy link')}</div>),
      (<div className="my-am-action"><i className="dtable-font dtable-icon-delete"></i>{gettext('Delete link')}</div>),
    ];
    ActionSheet.showActionSheetWithOptions({
      options: BUTTONS,
      maskClosable: true,
      className: 'dtable-antd-mobile-action-sheet'
    }, (buttonIndex) => {
      if (buttonIndex === 0) this.onCopyExternalLink(externalItem.url);
      if (buttonIndex === 1) this.deleteExternalLink(externalItem);
    });
  };

  deleteExternalLink = (externalLink) => {
    const { workspace_id, name } = this.props.currentTable;
    seaQAAPI.deleteDTableExternalLink(workspace_id, name, externalLink.token).then(() => {
      let { externalLinks } = this.state;
      externalLinks = externalLinks.filter((item) => {
        return item.token !== externalLink.token;
      });
      this.setState({
        externalLinks: externalLinks
      });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  onCopyExternalLink = (url) => {
    copy(url);
    toaster.success(gettext('copied external link'));
  };

  render() {
    const { isShowAddExternalLink, externalLinks } = this.state;
    return (
      <Fragment>
        <ShareAddedBtn callback={this.onAddExternalLink} addedName={gettext('Add external link')} />
        {externalLinks.length > 0 &&
          <List className="mt-4">
            {externalLinks.map((item) => {
              const url = item.url.slice(0, 10) + '...' + item.url.slice(length - 10);
              return (
                <Item
                  key={item.token}
                  multipleLine
                  extra={<Icon type="ellipsis" onClick={() => {this.showActionSheet(item);}}/>}
                >
                  {url}
                  <Brief>{gettext('Expire date')}: {item.expire_date ? dayjs(item.expire_date).format('YYYY-MM-DD HH:mm') : '-'}</Brief>
                </Item>
              );
            })}
          </List>
        }

        {isShowAddExternalLink &&
          <AddExternalLink
            toggle={this.onAddExternalLink}
            addExternalLink={this.addExternalLink}
            currentTable={this.props.currentTable}
          />
        }
      </Fragment>
    );
  }
}

ExternalLink.propTypes = propTypes;

export default ExternalLink;
