import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MapComponent from './components/MapComponent';
import Navbar from './components/Navbar';
import WmsPage from './pages/WmsPage';
import WfsPage from './pages/WfsPage';
import SosPage from './pages/SosPage';

import './App.css';

function App() {
    const [mapLayers, setMapLayers] = useState([]);
    const [viewState, setViewState] = useState(null);

    return (
        <Router>
            <div className="app-container">
                <Navbar />
                <main className="main-content">
                    <div className="left-panel">
                        <Routes>
                            <Route 
                                path="/wms" 
                                element={<WmsPage setMapLayers={setMapLayers} setViewState={setViewState} />} 
                            />
                            <Route 
                                path="/wfs" 
                                element={<WfsPage setMapLayers={setMapLayers} setViewState={setViewState} />} 
                            />
                            <Route 
                                path="/sos" 
                                element={<SosPage setMapLayers={setMapLayers} setViewState={setViewState} />} 
                            />
                            <Route path="/" element={<Navigate to="/wms" />} />
                        </Routes>
                    </div>
                    <div className="right-panel">
                        <div className="map-container">
                            <MapComponent layers={mapLayers} viewState={viewState} />
                        </div>
                    </div>
                </main>
            </div>
        </Router>
    );
}

export default App;