import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import { orgID, gettext, siteRoot, mediaUrl } from '../../utils/constants';
import { Utils } from '../../utils/utils';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import Paginator from '../../components/paginator';
import CommonOperationConfirmationDialog from '../../components/dialog/common-operation-confirmation-dialog';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';


const ItemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteExternalLink: PropTypes.func.isRequired,
};


class Item extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      isItemMenuShow: false,
      highlight: false,
      isDeleteDialogOpen: false,
    };
  }

  handleMouseOver = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: true,
        highlight: true
      });
    }
  };

  handleMouseOut = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: false,
        highlight: false
      });
    }
  };

  onUnfreezedItem = () => {
    this.setState({
      highlight: false,
      isOpIconShown: false
    });
    this.props.onUnfreezedItem();
  };

  deleteExternalLink = () => {
    const item = this.props.item;
    let linkToken = item.token;

    orgAdminServiceApi.orgAdminDeleteDTableExternalLink(orgID, linkToken).then(() => {
      this.props.deleteExternalLink(item);
      const msg = gettext('Successfully deleted 1 item.');
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });

    this.toggleDeleteDialog();
  };

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  onMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isOpIconShown: true, highlight: true });
    }
  };

  onMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isOpIconShown: false, highlight: false });
    }
  };

  toggleOperationMenu = () => {
    this.setState({
      isItemMenuShow: !this.state.isItemMenuShow
    }, () => {
      if (this.state.isItemMenuShow) {
        this.props.onFreezedItem();
      } else {
        this.setState({ highlight: false });
        this.props.onUnfreezedItem();
      }
    });
  };

  visitExternalLink = () => {
    window.open(siteRoot + 'dtable/external-links/' + this.props.item.token + '/');
  };

  render() {
    const item = this.props.item;
    let { isOpIconShown } = this.state;
    let deleteDialogMsg = gettext('Are you sure you want to delete external link?');
    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
          <td>{item.from_dtable}</td>
          <td>{item.creator_name}</td>
          <td>
            {item.create_at ? dayjs(item.create_at).format('YYYY-MM-DD HH:mm:ss') : '--'}
          </td>
          <td>{item.view_cnt}</td>
          <td>
            {isOpIconShown &&
              <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
                <DropdownToggle
                  tag="a"
                  role="button"
                  className="attr-action-icon dtable-font dtable-icon-more-vertical"
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                  data-toggle="dropdown"
                  aria-expanded={this.state.isItemMenuShow}
                />
                <DropdownMenu className="dtable-dropdown-menu dropdown-menu">
                  <DropdownItem onClick={this.visitExternalLink}>{gettext('Visit')}</DropdownItem>
                  <DropdownItem onClick={this.toggleDeleteDialog}>{gettext('Delete')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            }
          </td>
        </tr>
        {this.state.isDeleteDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete external link')}
            message={deleteDialogMsg}
            executeOperation={this.deleteExternalLink}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteDialog}
          />
        }
      </Fragment>
    );
  }
}

Item.propTypes = ItemPropTypes;

const OrgDTableExternalLinksPropTypes = {

};

class OrgDTableExternalLinks extends React.Component {
  constructor(props) {
    super(props);
    this.state = ({
      isItemFreezed: false,
      dtableExternalLinkList: [],
      page: 1,
      perPage: 25,
    });
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { page, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      page: parseInt(urlParams.get('page') || page)
    }, () => {
      this.loadDTableExternalLinks(this.state.page);
    });
  }

  loadDTableExternalLinks(page) {
    orgAdminServiceApi.orgAdminListDTableExternalLinks(orgID, page, this.state.perPage).then((res) => {
      this.setState({
        dtableExternalLinkList: res.data.external_link_list,
        count: res.data.count
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  deleteExternalLink = (item) => {
    let dtableExternalLinkList = this.state.dtableExternalLinkList.slice();
    dtableExternalLinkList = dtableExternalLinkList.filter((link) => {return link.id !== item.id;});
    this.setState({ dtableExternalLinkList: dtableExternalLinkList });
  };

  getPreviousPageList = () => {
    this.setState({
      page: this.state.page - 1
    }, () => {
      this.loadDTableExternalLinks(this.state.page);
    });
  };

  getNextPageList = () => {
    this.setState({
      page: this.state.page + 1
    }, () => {
      this.loadDTableExternalLinks(this.state.page);
    });
  };

  resetPerPage = (per_page) => {
    this.setState({
      perPage: per_page
    }, () => {
      this.loadDTableExternalLinks(1);
    });
  };

  render() {
    let { dtableExternalLinkList, page, perPage, count } = this.state;
    const emptyTip = (
      <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No base external links')} />
    );
    const linkList = (
      <div className='cur-view-content'>
        <table>
          <thead>
            <tr>
              <th width="35%">{gettext('Base')}</th>
              <th width="30%">{gettext('Creator')}</th>
              <th width="20%">{gettext('Created at')}</th>
              <th width='10%'>{gettext('Count')}</th>
              <th width="5%">{/* operation */}</th>
            </tr>
          </thead>
          <tbody>
            {dtableExternalLinkList.map((item, index) => {
              return (
                <Item
                  key={index}
                  item={item}
                  isItemFreezed={this.state.isItemFreezed}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                  deleteExternalLink={this.deleteExternalLink}
                />
              );
            })}
          </tbody>
        </table>
        <Paginator
          gotoPreviousPage={this.getPreviousPageList}
          gotoNextPage={this.getNextPageList}
          currentPage={page}
          hasNextPage={Utils.hasNextPage(page, perPage, count)}
          canResetPerPage={true}
          curPerPage={perPage}
          resetPerPage={this.resetPerPage}
        />
      </div>
    );

    return dtableExternalLinkList.length ? linkList : emptyTip;
  }
}

OrgDTableExternalLinks.propTypes = OrgDTableExternalLinksPropTypes;

export default OrgDTableExternalLinks;
