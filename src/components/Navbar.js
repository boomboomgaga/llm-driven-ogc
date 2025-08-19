import React from 'react';
import { NavLink } from 'react-router-dom';

const Navbar = () => {
    return (
        <nav className="navbar">
            <h1>OGC Frontend Client</h1>
            <div className="nav-links">
                <NavLink to="/wms">WMS</NavLink>
                <NavLink to="/wfs">WFS</NavLink>
                <NavLink to="/sos">SOS</NavLink>
            </div>
        </nav>
    );
};

export default Navbar;