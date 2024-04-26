"use client"
import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { Victoria } from '../data/victorian-suburbs'
import  fetchEnergyConsumption from '../api/energyConsumption';
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import { LatLngBounds } from 'leaflet';
  

interface DataItem {
    [suburb: string]: number;
}

export default function Map() {    
    const [hoveredSuburb, setHoveredSuburb] = useState('')
    const [data, setData] = useState<DataItem>({});
    const [geoJSONKey, setGeoJSONKey] = useState(0); // Add key state
    const bounds = new LatLngBounds(
        { lat: -37.5, lng: 140 }, // Southwest corner
        { lat: -39, lng: 148 } // Northeast corner
    )

    // This useEffect will update our 'data' by fetching from the backend api every 5 seconds
    useEffect(() => {
        const fetchData = async () => {
            try {
                console.log('5 seconds')
                const result = await fetchEnergyConsumption(); // update this later to match backend API
                if (result) {
                    const body = result;
                    setData(body);
                } else {
                    console.error('Failed to fetch data:', result);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        // initial fetch to data
        fetchData();

        // fetch data every 5 seconds
        const intervalId = setInterval(fetchData, 5000)

        // clear the interval when  component is unmounted
        return () => clearInterval(intervalId)

    }, [data]);

    // This makes sure that our geoJSON re-renders appropriately
    useEffect(() => {
        setGeoJSONKey((prevKey) => prevKey + 1);
    }, [data]);

    return (
            <MapContainer style={{height:'100%'}} scrollWheelZoom={true} bounds={bounds}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    
                />
                <GeoJSON
                    key = {geoJSONKey}
                    data={Victoria}
                    onEachFeature={async (feature, layer: any) => {
                        // use suburb name to fetch energy consumption data
                        const suburbName = feature.properties["vic_loca_2"]
                        const energyConsumption = data[suburbName]

                        if (energyConsumption !== undefined) {
                            layer.setStyle({
                                fillColor: 'red',
                                weight: 1,
                                opacity: 1,
                                color: 'red',
                                fillOpacity: 0.7,
                            });
                        } else {
                            layer.setStyle({
                                fillColor: 'blue',
                                weight: 1,
                                opacity: 1,
                                color: 'blue',
                                fillOpacity: 0.7,
                            });
                        }
                        
                        layer.on({
                            mouseover: () => setHoveredSuburb(feature.properties["vic_loca_2"]),
                            mouseout: () => setHoveredSuburb('')
                        });
                    }}
                />              
            </MapContainer>
    )
}