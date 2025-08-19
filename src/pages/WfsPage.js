import React, { useState } from 'react';
import axios from 'axios';

// Helper to parse WFS Capabilities
const parseWFSCapabilities = (xmlText) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    const featureTypes = Array.from(xmlDoc.getElementsByTagName('FeatureType')).map(node => ({
        name: node.querySelector('Name')?.textContent || '',
        title: node.querySelector('Title')?.textContent || '',
    })).filter(ft => ft.name);

    const formatNodes = xmlDoc.querySelectorAll("ows\\:Operation[name='GetFeature'] ows\\:Parameter[name='outputFormat'] ows\\:Value");
    const formats = Array.from(formatNodes).map(node => node.textContent);
    
    return { featureTypes, formats };
};

const WfsPage = ({ setMapLayers, setViewState }) => {
    const [serverUrl, setServerUrl] = useState('http://localhost:8080/geoserver/ne/ows');
    const [featureTypes, setFeatureTypes] = useState([]);
    const [formats, setFormats] = useState([]);
    const [xml, setXml] = useState('');
    const [formData, setFormData] = useState({
        typeName: '',
        outputFormat: 'application/json',
        crs: 'EPSG:4326',
        bbox: '',
        featureID: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGetCapabilities = async () => {
        setLoading(true);
        setError('');
        
        // Build the direct URL to the WFS server
        const finalUrl = `${serverUrl}?service=WFS&request=GetCapabilities`;

        try {
            // Call the final URL directly
            const res = await axios.get(finalUrl);

            setXml(res.data);
            const { featureTypes, formats } = parseWFSCapabilities(res.data);
            setFeatureTypes(featureTypes);
            setFormats(formats);
        } catch (err) {
            setError('Failed to fetch WFS capabilities. This may be a CORS issue.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        const { typeName, crs, bbox, featureID } = formData;
        if (!typeName) {
            setError('Please select a feature type.');
            return;
        }

        // Build the direct GetFeature URL. No proxy is needed.
        let finalUrl = `${serverUrl}?service=WFS&version=1.0.0&request=GetFeature&typeName=${typeName}&outputFormat=application/json&srsName=EPSG:4326`;

        if (featureID) {
            finalUrl += `&featureID=${featureID}`;
        } else if (bbox) {
            finalUrl += `&bbox=${bbox},${crs}`;
        } else {
            setError('Please provide either a Bounding Box or a Feature ID.');
            return;
        }
        
        try {
            // Call the final URL directly
            const res = await axios.get(finalUrl);

            // Create a vector source from the GeoJSON response
            const vectorSource = new window.ol.source.Vector({
                features: new window.ol.format.GeoJSON().readFeatures(res.data, {
                    dataProjection: 'EPSG:4326', // Data is in WGS84
                    featureProjection: 'EPSG:3857' // Map view is in Web Mercator
                }),
            });

            const vectorLayer = new window.ol.layer.Vector({
                source: vectorSource,
                style: new window.ol.style.Style({
                    stroke: new window.ol.style.Stroke({ color: '#3399CC', width: 3 }),
                    fill: new window.ol.style.Fill({ color: 'rgba(0, 0, 255, 0.1)' }),
                    image: new window.ol.style.Circle({
                        radius: 7,
                        fill: new window.ol.style.Fill({color: '#3399CC'})
                    })
                }),
            });
            
            // Update the map layer and zoom to the new features
            setMapLayers([vectorLayer]);
            setViewState({ extent: vectorSource.getExtent() });

        } catch (err) {
            setError('Failed to fetch features. This may be a CORS issue.');
            console.error(err);
        }
    };

    return (
        <div className="form-container">
            <h3>WFS Client</h3>
            <label>Server URL</label>
            <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
            <button onClick={handleGetCapabilities} disabled={loading}>{loading ? 'Loading...' : 'Get Capabilities'}</button>
            
            {error && <p style={{color: 'red'}}>{error}</p>}
            
            <label>Feature Type</label>
            <select name="typeName" value={formData.typeName} onChange={handleChange}>
                <option value="">Select Feature Type</option>
                {featureTypes.map(ft => <option key={ft.name} value={ft.name}>{ft.title || ft.name}</option>)}
            </select>
            
            <label>Output Format (for download)</label>
            <select name="outputFormat" value={formData.outputFormat} onChange={handleChange}>
                {formats.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            <label>Bounding Box (minX,minY,maxX,maxY)</label>
            <input name="bbox" placeholder="e.g., -10,40,0,50" value={formData.bbox} onChange={handleChange} />

            <label>Feature ID</label>
            <input name="featureID" placeholder="e.g., countries.1" value={formData.featureID} onChange={handleChange} />

            <button onClick={handleSubmit}>Get Feature</button>
            
            <div className="xml-container">
                <h4>XML Response</h4>
                <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>{xml || 'XML will be displayed here...'}</pre>
            </div>
        </div>
    );
};

export default WfsPage;