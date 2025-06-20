import React, { Component } from 'react';
import PropTypes from 'prop-types';
import className from 'classnames';
import { DropdownMenu, Dropdown, DropdownToggle, DropdownItem } from 'reactstrap';
import { navigate } from '@gatsbyjs/reach-router';
import { gettext } from '../constants';

import '../css/pagination.css';

const propTypes = {
  currentPage: PropTypes.number.isRequired,
  gotoPreviousPage: PropTypes.func.isRequired,
  gotoNextPage: PropTypes.func.isRequired,
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
    this.props.gotoPreviousPage();
  };

  goToNext = () => {
    const { currentPage, curPerPage } = this.props;
    this.updateURL(currentPage + 1, curPerPage);
    this.props.gotoNextPage();
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
      <DropdownItem onClick={() => {this.resetPerPage(perPage);}} key={perPage}>
        <span className='paginator-dropdown-tick'>
          {curPerPage === perPage && <i className="dtable-font dtable-icon-check-mark"></i>}
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
        <button
          className="btn btn-secondary"
          disabled={leftDisabled}
          onClick={this.goToPrevious}
        >
          <span className={`dtable-font dtable-icon-left ${leftDisabled ? 'paginator-disabled-btn' : ''}`} aria-hidden="true"></span>
        </button>
        <span className="btn btn-primary mx-4">{currentPage}</span>
        <button
          className="btn btn-secondary"
          disabled={rightDisabled}
          onClick={this.goToNext}
        >
          <span className={`dtable-font dtable-icon-right ${rightDisabled ? 'paginator-disabled-btn' : ''}`} aria-hidden="true"></span>
        </button>

        <Dropdown isOpen={this.state.isMenuShow} toggle={this.toggleOperationMenu} direction="up" className="paginator-dropdown">
          <DropdownToggle
            className="ml-6"
            data-toggle="dropdown"
            aria-expanded={this.state.isMenuShow}
            onClick={this.toggleOperationMenu}
          >
            <span className='pr-3'>{this.getPerPageText(curPerPage)}</span>
            <span className={className('dtable-font dtable-icon-down3 d-inline-block', { 'rotate-180': this.state.isMenuShow })}></span>
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
