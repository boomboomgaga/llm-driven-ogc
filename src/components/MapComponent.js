import React, { useRef, useEffect } from 'react';

const MapComponent = ({ layers, viewState }) => {
    const mapRef = useRef();
    const mapInstance = useRef(null);

    useEffect(() => {
        // Initialize map on first render
        if (!mapInstance.current) {
            mapInstance.current = new window.ol.Map({
                target: mapRef.current,
                layers: [
                    new window.ol.layer.Tile({
                        source: new window.ol.source.OSM(),
                    }),
                ],
                view: new window.ol.View({
                    center: window.ol.proj.fromLonLat([0, 0]),
                    zoom: 2,
                }),
            });
        }
    }, []);

    // Update layers when the layers prop changes
    useEffect(() => {
        if (!mapInstance.current) return;

        // Clear existing overlay layers (keep the base OSM layer)
        const currentLayers = mapInstance.current.getLayers().getArray();
        for (let i = currentLayers.length - 1; i > 0; i--) {
            mapInstance.current.removeLayer(currentLayers[i]);
        }

        // Add new layers
        layers.forEach(layer => mapInstance.current.addLayer(layer));

    }, [layers]);

    // Update map view when viewState changes
    useEffect(() => {
        if (viewState && mapInstance.current) {
            mapInstance.current.getView().fit(viewState.extent, {
                duration: 1000,
                padding: [50, 50, 50, 50],
            });
        }
    }, [viewState]);

    return <div ref={mapRef} className="map"></div>;
};

export default MapComponent;