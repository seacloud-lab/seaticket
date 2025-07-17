import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { DropdownMenu, Dropdown, DropdownToggle, DropdownItem } from 'reactstrap';
import { navigate } from '@gatsbyjs/reach-router';
import { gettext } from '../../constants';
import Icon from '../icon';
import IconBtn from '../icon-button';

import './index.css';

const propTypes = {
  currentPage: PropTypes.number.isRequired,
  goPreviousPage: PropTypes.func.isRequired,
  goNextPage: PropTypes.func.isRequired,
  hasNextPage: PropTypes.bool.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  curPerPage: PropTypes.number.isRequired
};

const PAGES = [25, 50, 100];

class Paginator extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isMenuShow: false
    };
  }

  resetPerPage = (perPage) => {
    this.updateURL(1, perPage);
    this.props.resetPerPage(perPage);
  };

  goToPrevious = () => {
    const { currentPage, curPerPage } = this.props;
    this.updateURL(currentPage - 1, curPerPage);
    this.props.goPreviousPage();
  };

  goToNext = () => {
    const { currentPage, curPerPage } = this.props;
    this.updateURL(currentPage + 1, curPerPage);
    this.props.goNextPage();
  };

  updateURL = (page, perPage) => {
    let url = new URL(location.href);
    let searchParams = new URLSearchParams(url.search);
    searchParams.set('page', page);
    searchParams.set('per_page', perPage);
    url.search = searchParams.toString();
    navigate(url.toString());
  };

  getPerPageText = (perPage) => {
    return gettext('{number_placeholder} / Page').replace('{number_placeholder}', perPage);
  };

  toggleOperationMenu = (e) => {
    e.stopPropagation();
    this.setState({ isMenuShow: !this.state.isMenuShow });
  };

  renderDropdownItem = (curPerPage, perPage) => {
    return (
      <DropdownItem onClick={() => this.resetPerPage(perPage)} key={perPage}>
        <span className='paginator-dropdown-tick'>
          {curPerPage === perPage && (<Icon symbol="check" />)}
        </span>
        <span>
          {this.getPerPageText(perPage)}
        </span>
      </DropdownItem>
    );
  };

  render() {
    const { curPerPage, currentPage } = this.props;
    let leftDisabled = currentPage === 1;
    let rightDisabled = !this.props.hasNextPage;
    return (
      <div className="my-6 paginator d-flex align-items-center justify-content-center">
        <IconBtn icon="left" disabled={leftDisabled} className="btn btn-secondary paginator-btn" onClick={this.goToPrevious} />
        <div className="btn btn-primary mx-4 paginator-btn">{currentPage}</div>
        <IconBtn icon="right" disabled={rightDisabled} className="btn btn-secondary paginator-btn" onClick={this.goToNext} />
        <Dropdown isOpen={this.state.isMenuShow} toggle={this.toggleOperationMenu} direction="up" className="paginator-dropdown">
          <DropdownToggle
            className="ml-6"
            data-toggle="dropdown"
            aria-expanded={this.state.isMenuShow}
            onClick={this.toggleOperationMenu}
          >
            <span className="pr-3">{this.getPerPageText(curPerPage)}</span>
            <Icon symbol="down" className={classnames('d-inline-block', { 'rotate-180': this.state.isMenuShow })} />
          </DropdownToggle>
          <DropdownMenu>
            {PAGES.map(perPage => {
              return this.renderDropdownItem(curPerPage, perPage);
            })}
          </DropdownMenu>
        </Dropdown>
      </div>
    );
  }
}

Paginator.propTypes = propTypes;

export default Paginator;
