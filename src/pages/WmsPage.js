import React, { useState } from 'react';
import axios from 'axios';

const WmsPage = ({ setMapLayers, setViewState }) => {
    const [serverUrl, setServerUrl] = useState('http://localhost:8080/geoserver/wms');
    const [layers, setLayers] = useState([]);
    const [crss, setCrss] = useState([]);
    const [formats, setFormats] = useState([]);
    const [xml, setXml] = useState('');
    const [formData, setFormData] = useState({
        layer: '',
        crs: '',
        format: 'image/png',
        bbox: {
            minX: '',
            minY: '',
            maxX: '',
            maxY: ''
        }
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGetCapabilities = async () => {
        setLoading(true);
        setError('');
        const capabilitiesUrl = `${serverUrl}?service=WMS&request=GetCapabilities`;

        try {
            const proxyRequestUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(capabilitiesUrl)}`;
            const res = await axios.get(proxyRequestUrl);
            setXml(res.data);
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(res.data, "text/xml");
            
            const layerNodes = xmlDoc.getElementsByTagName('Layer');
            const availableLayers = Array.from(layerNodes).slice(1).map(node => node.querySelector('Name')?.textContent).filter(Boolean);
            setLayers(availableLayers);

            let crsNodes = xmlDoc.getElementsByTagName('CRS');
            if (crsNodes.length === 0) {
                crsNodes = xmlDoc.getElementsByTagName('SRS');
            }
            const availableCrss = [...new Set(Array.from(crsNodes).map(node => node.textContent))];
            setCrss(availableCrss);
            
            if (availableCrss.length > 0) {
                setFormData(prev => ({ ...prev, crs: availableCrss[0] }));
            }
            
            const formatNodes = xmlDoc.querySelectorAll("Capability > Request > GetMap > Format");
            const availableFormats = Array.from(formatNodes).map(node => node.textContent);
            setFormats(availableFormats);

        } catch (error) {
            console.error("Error fetching WMS capabilities:", error);
            setError('Failed to load capabilities. Is the proxy server and GeoServer running?');
            setXml('Failed to load capabilities.');
        } finally {
            setLoading(false);
        }
    };

    const handleBboxChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            bbox: {
                ...prev.bbox,
                [name]: value
            }
        }));
    };

    // THIS FUNCTION IS NOW CORRECTED
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = () => {
        const { layer, crs, bbox } = formData;
        
        const { minX, minY, maxX, maxY } = bbox;
        if (!layer || !crs || !minX || !minY || !maxX || !maxY) {
            setError('Please fill all fields: Layer, CRS, and all Bounding Box values.');
            return;
        }
        const bboxString = `${minX},${minY},${maxX},${maxY}`;
        setError('');

        const wmsSource = new window.ol.source.ImageWMS({
            url: serverUrl,
            params: { 'LAYERS': layer },
            serverType: 'geoserver',
        });

        const wmsLayer = new window.ol.layer.Image({ source: wmsSource });
        setMapLayers([wmsLayer]);

        const extent = bboxString.split(',').map(Number);
        const transformedExtent = window.ol.proj.transformExtent(extent, crs, 'EPSG:3857');
        setViewState({ extent: transformedExtent });
    };

    return (
        <div className="form-container">
            <h3>WMS Client</h3>
            <label>Server URL</label>
            <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
            <button onClick={handleGetCapabilities} disabled={loading}>
                {loading ? 'Loading...' : 'Get Capabilities'}
            </button>
            
            {error && <p style={{ color: 'red' }}>{error}</p>}
            
            <label>Layers</label>
            <select name="layer" value={formData.layer} onChange={handleChange}>
                <option value="">Select Layer</option>
                {layers.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            
            <label>CRS (Coordinate Reference System)</label>
            <select name="crs" value={formData.crs} onChange={handleChange}>
                <option value="">Select CRS</option>
                {crss.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <label>Output Format</label>
            <select name="format" value={formData.format} onChange={handleChange}>
                {formats.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            <label>Bounding Box</label>
            <div className="bbox-inputs">
                <input type="number" name="minX" placeholder="Min X / West" value={formData.bbox.minX} onChange={handleBboxChange} />
                <input type="number" name="minY" placeholder="Min Y / South" value={formData.bbox.minY} onChange={handleBboxChange} />
                <input type="number" name="maxX" placeholder="Max X / East" value={formData.bbox.maxX} onChange={handleBboxChange} />
                <input type="number" name="maxY" placeholder="Max Y / North" value={formData.bbox.maxY} onChange={handleBboxChange} />
            </div>

            <button onClick={handleSubmit}>Get Map</button>
            
            <div className="xml-container">
                <h4>XML Response</h4>
                <pre>{xml || 'XML will be displayed here...'}</pre>
            </div>
        </div>
    );
};

export default WmsPage;