"use client"
import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { useMapEvents } from 'react-leaflet/hooks';
import { VictorianSuburbs } from '../data/victorian-suburbs';
import { GreaterVictoria } from '@/data/greater-victoria';
import  fetchEnergyConsumption from '../api/energyConsumption';
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import { LatLngBounds } from 'leaflet';
  

interface DataItem {
    [suburb: string]: number;
}

interface MyComponentProps {
    zoomLevel: number;
    setZoomLevel: (zoom: number) => void
}

function MyComponent(props: MyComponentProps) {
    const { zoomLevel, setZoomLevel } = props;
    const mapEvents = useMapEvents({
        zoomend: () => {
            let newZoomValue = mapEvents.getZoom();
            setZoomLevel(newZoomValue)
            console.log(zoomLevel)
        },
    });

    console.log(zoomLevel);

    return null
}

export default function Map() {    
    const [data, setData] = useState<DataItem>({});
    const [geoJSONKey, setGeoJSONKey] = useState(0); // Add key state
    const [zoomLevel, setZoomLevel] = useState(5)
    const bounds = new LatLngBounds(
        { lat: -37.5, lng: 140 }, // Southwest corner
        { lat: -39, lng: 148 } // Northeast corner
    );

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await fetchEnergyConsumption();
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

        fetchData();

        const intervalId = setInterval(fetchData, 10000000000000000);

        return () => clearInterval(intervalId);
    }, [data]);

    useEffect(() => {
        setGeoJSONKey((prevKey) => prevKey + 1);
    }, [data]);

    return (
            <MapContainer style={{height:'100%'}} scrollWheelZoom={true} bounds={bounds}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    
                />
                <MyComponent zoomLevel={zoomLevel} setZoomLevel={setZoomLevel}/>
                <GeoJSON
                    key = {geoJSONKey}
                    data={zoomLevel <= 7 ? GreaterVictoria : VictorianSuburbs}
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
                    }}
                />              
            </MapContainer>
    )
}