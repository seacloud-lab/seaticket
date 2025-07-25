import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Button, Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

import './index.css';

const Header = ({ title, btns }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const toggleDropdown = () => setDropdownOpen(prevState => !prevState);

  const btnsCount = useMemo(() => btns.length, [btns]);
  const btn0 = useMemo(() => btns[0], [btns]);

  return (
    <div className="sea-qa-project-table-header">
      <div className="sea-qa-project-table-header-left">{title && title}</div>
      <div className="sea-qa-project-table-header-right">
        {btnsCount === 1 && (<Button color="primary" className="sea-qa-project-table-btn" onClick={btn0.func}>{btn0.name}</Button>)}
        {btnsCount > 1 && (
          <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown}>
            <DropdownToggle color="primary" className="sea-qa-project-table-btn">
              {btn0.name}
            </DropdownToggle>
            <DropdownMenu end>
              {btns.slice(1).map(btn => (<DropdownItem onClick={btn.func}>{btn.name}</DropdownItem>))}
            </DropdownMenu>
          </Dropdown>
        )}
      </div>
    </div>
  );
};

Header.propTypes = {
  title: PropTypes.string,
  btns: PropTypes.array,
};

export default Header;
