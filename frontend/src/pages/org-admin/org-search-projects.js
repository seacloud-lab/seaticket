import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Link } from '@gatsbyjs/reach-router';
import { Col, Form, FormGroup, Input, Dropdown, DropdownMenu, DropdownItem } from 'reactstrap';
import { toaster, EmptyTip, Loading, Paginator, ModalPortal, CommonOperationConfirmationDialog, ProjectIcon, CustomizeDropdownMoreToggle } from '../../components';
import { Utils } from '../../utils/utils';
import { gettext, siteRoot, loginUrl, mediaUrl } from '../../constants';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import MainPanelTopbar from './main-panel-topbar';

const { orgID } = window.org.pageOptions;

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  deleteProject: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
      isOpIconShown: false,
      isDeleteDialogOpen: false,
      isExternalLinkDialogOpen: false,
    };
  }

  handleMouseOver = () => {
    if (!this.state.isItemFreezed) {
      this.setState({
        isOpIconShown: true,
        highlight: true
      });
    }
  };

  handleMouseOut = () => {
    if (!this.state.isItemFreezed) {
      this.setState({
        isItemMenuShow: false,
        isOpIconShown: false,
        highlight: false
      });
    }
  };

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  toggleOperationMenu = () => {
    this.setState({
      isItemMenuShow: !this.state.isItemMenuShow
    }, () => {
      if (this.state.isItemMenuShow) {
        this.onFreezedItem();
      } else {
        this.setState({ highlight: false });
        this.onUnfreezedItem();
      }
    });
  };

  onDeleteProject = () => {
    const { item } = this.props;
    this.props.deleteProject(item);
    this.toggleDeleteDialog();
  };

  linkedTo = (item) => {
    if (item.group_id === -1) {
      return `${siteRoot}org/useradmin/info/${encodeURIComponent(item.email)}/`;
    }
    return `${siteRoot}org/groupadmin/${encodeURIComponent(item.group_id)}/projects/`;
  };

  render() {
    let { item } = this.props;
    let { isOpIconShown } = this.state;

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver}
          onMouseLeave={this.handleMouseOut}>
          <td className="org-project-icon">
            <ProjectIcon size="small" bgColor={item.color} icon={item.icon} />
          </td>
          <td>{item.name}</td>
          <td>{item.uuid}</td>
          <td>
            <Link to={this.linkedTo(item)}>{item.owner}</Link>
          </td>
          <td>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>
            {isOpIconShown && (
              <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
                <CustomizeDropdownMoreToggle isOpen={this.state.isItemMenuShow} />
                <DropdownMenu className="sea-qa-dropdown-menu dropdown-menu">
                  <DropdownItem onClick={this.toggleDeleteDialog}>{gettext('Delete')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </td>
        </tr>
        {this.state.isDeleteDialogOpen &&
          <ModalPortal>
            <CommonOperationConfirmationDialog
              title={gettext('Delete project')}
              message={gettext('Are you sure you want to delete the base {placeholder} ?').replace('{placeholder}', `<b>${item.name}</b>`)}
              executeOperation={this.onDeleteProject}
              confirmBtnText={gettext('Delete')}
              toggleDialog={this.toggleDeleteDialog}
            />
          </ModalPortal>
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const contentPropTypes = {
  loading: PropTypes.bool,
  errorMsg: PropTypes.string,
  items: PropTypes.array,
  currentPage: PropTypes.number,
  hasNextPage: PropTypes.bool,
  curPerPage: PropTypes.number,
  resetPerPage: PropTypes.func,
  getListByPage: PropTypes.func,
  deleteProject: PropTypes.func.isRequired,
};

class Content extends Component {

  constructor(props) {
    super(props);
  }

  getPreviousPage = () => {
    this.props.getListByPage(this.props.currentPage - 1);
  };

  getNextPage = () => {
    this.props.getListByPage(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items, deleteProject } = this.props;
    if (loading) {
      return <Loading/>;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      if (items.length === 0) {
        return (
          <EmptyTip text={gettext('No projects')} src={`${mediaUrl}img/no-items-tip.png`} />
        );
      } else {
        return (
          <Fragment>
            <table>
              <thead>
                <tr>
                  <th width="5%">{/* icon*/}</th>
                  <th width="25%">{gettext('Name')}</th>
                  <th width="30%">ID</th>
                  <th width="20%">{gettext('Owner')}</th>
                  <th width="15%">{gettext('Created At')}</th>
                  <th width="5%">{/* Operations*/}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  return (<Item
                    key={index}
                    item={item}
                    deleteProject={deleteProject}
                  />);
                })}
              </tbody>
            </table>
            <Paginator
              goPreviousPage={this.getPreviousPage}
              goNextPage={this.getNextPage}
              currentPage={this.props.currentPage}
              hasNextPage={this.props.hasNextPage}
              curPerPage={this.props.curPerPage}
              resetPerPage={this.props.resetPerPage}
            />
          </Fragment>
        );
      }
    }
  }
}

Content.propTypes = contentPropTypes;

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

class OrgSearchProjects extends Component {

  constructor(props) {
    super(props);
    this.state = {
      query: '',
      loading: true,
      errorMsg: '',
      currentPage: 1,
      perPage: 25,
      hasNextPage: false,
      projects: [],
      isSubmitBtnActive: false,
    };
  }

  componentDidMount() {
    let params = (new URL(document.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      query: params.get('query') || '',
      perPage: parseInt(params.get('per_page') || perPage),
      currentPage: parseInt(params.get('page') || currentPage),
    }, () => {
      this.getItems(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.getItems(1);
    });
  };

  getSearchProjects = (e) => {
    e.preventDefault();
    this.getItems(1);
  };

  getItems = (page) => {
    let { query, perPage } = this.state;
    orgAdminServiceApi.orgAdminSearchProjects(orgID, query.trim(), page, perPage).then(res => {
      this.setState({
        projects: res.data.results,
        loading: false,
        hasNextPage: res.data.results.length >= perPage,
        currentPage: page
      });
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
        } else {
          this.setState({
            loading: false,
            errorMsg: gettext('Error')
          });
        }
      } else {
        this.setState({
          loading: false,
          errorMsg: gettext('Please check the network.')
        });
      }
    });
  };

  handleInputChange = (e) => {
    this.setState({
      query: e.target.value
    }, this.checkSubmitBtnActive);
  };

  checkSubmitBtnActive = () => {
    const { query } = this.state;
    this.setState({
      isSubmitBtnActive: query.trim()
    });
  };

  deleteProject = (project) => {
    orgAdminServiceApi.orgAdminDeleteProject(orgID, project.id).then(res => {
      let newTableList = this.state.projects.filter(item => {
        return item.id !== project.id;
      });
      this.setState({
        projects: newTableList
      });
      const msg = gettext('Successfully delete base {placeholder}')
        .replace('{placeholder}', project.name);
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    const { query, isSubmitBtnActive } = this.state;

    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('Bases')}</h2>
            <div className="cur-view-content">
              <div className="mt-4 mb-6">
                <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Search projects')}</h4>
                <Form>
                  <FormGroup row>
                    <Col sm={5}>
                      <Input type="text" name="query" value={query} placeholder={gettext('Search projects')}
                        onChange={this.handleInputChange}/>
                    </Col>
                  </FormGroup>
                  <FormGroup row>
                    <Col sm={{ size: 5 }}>
                      <button
                        className="btn btn-outline-primary" disabled={!isSubmitBtnActive}
                        onClick={this.getSearchProjects}>{gettext('Submit')}
                      </button>
                    </Col>
                  </FormGroup>
                </Form>
              </div>
              <div className="mt-4 mb-6">
                <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Result')}</h4>
                <Content
                  loading={this.state.loading}
                  errorMsg={this.state.errorMsg}
                  items={this.state.projects}
                  deleteProject={this.deleteProject}
                  currentPage={this.state.currentPage}
                  hasNextPage={this.state.hasNextPage}
                  curPerPage={this.state.perPage}
                  resetPerPage={this.resetPerPage}
                  getListByPage={this.getItems}
                />
              </div>
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

OrgSearchProjects.propTypes = propTypes;

export default OrgSearchProjects;
