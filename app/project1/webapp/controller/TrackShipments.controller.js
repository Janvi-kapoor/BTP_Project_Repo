sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("project1.controller.TrackShipments", {
        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("CustomerTracking").attachMatched(this._onRouteMatched, this);
            
            jQuery.sap.includeStyleSheet("css/track.css");
            
            this._loadLeafletResources().then(() => {
                this._initializeMap();
                this._loadShipmentData();
            });
        },
        
        _onRouteMatched: function() {
            if (!this.map) {
                this._loadLeafletResources().then(() => {
                    this._initializeMap();
                    setTimeout(() => {
                        this._loadShipmentData();
                    }, 1000);
                });
            } else {
                this._loadShipmentData();
            }
        },
        
        _loadShipmentData: function() {
            const savedShipmentId = localStorage.getItem("selectedShipmentId");
            
            if (savedShipmentId) {
                const oModel = this.getOwnerComponent().getModel();
                
                const oBinding = oModel.bindList("/AdminShipments", null, [], [
                    new sap.ui.model.Filter("ID", sap.ui.model.FilterOperator.EQ, savedShipmentId)
                ], {
                    $expand: "assignment"
                });

                oBinding.requestContexts().then((aContexts) => {
                    if (aContexts.length > 0) {
                        const oData = aContexts[0].getObject();
                        this._updateUIWithShipmentData(oData);
                        
                        if (oData.assignment && oData.assignment.ID) {
                            this._getTrackingLogs(oData.assignment.ID);
                            this._loadTripAssignment(savedShipmentId);
                        }
                    }
                }).catch((error) => {
                    console.error("Error loading shipment:", error);
                });
            }
        },
        
        _getTrackingLogs: function(tripAssignmentId) {
            const oModel = this.getOwnerComponent().getModel();
            let oBinding = oModel.bindList("/TrackingHistory");
            
            oBinding.requestContexts().then((aContexts) => {
                const matchingLogs = aContexts.filter(context => {
                    const logData = context.getObject();
                    return logData.trip_ID === tripAssignmentId || (logData.trip && logData.trip.ID === tripAssignmentId);
                });
                
                if (matchingLogs.length > 0) {
                    const latestLog = matchingLogs[matchingLogs.length - 1].getObject();
                    if (latestLog.lat && latestLog.long && this.map) {
                        this._addTruckMarker(latestLog.lat, latestLog.long);
                    }
                }
            }).catch((error) => {
                console.error("Error loading tracking logs:", error);
            });
        },
        
        _addTruckMarker: function(lat, lng) {
            if (this.truckMarker) {
                this.map.removeLayer(this.truckMarker);
            }
            
            const truckIcon = L.divIcon({
                html: '🚛',
                iconSize: [30, 30],
                className: 'truck-marker'
            });
            
            this.truckMarker = L.marker([lat, lng], { icon: truckIcon }).addTo(this.map);
            this.truckMarker.bindPopup('<b>Current Truck Location</b>');
        },
        
        _updateUIWithShipmentData: function(shipmentData) {
            this.byId("shipmentTitle").setText(shipmentData.ID);
            
            const pickup = this._extractCityFromAddress(shipmentData.pickupLocation);
            const drop = this._extractCityFromAddress(shipmentData.dropLocation);
            this.byId("routeInfo").setText(`${pickup} → ${drop}`);
            
            this.currentShipmentData = shipmentData;
            this._updateTimeline(shipmentData.status);
            
            if (this.map) {
                this._loadRouteOnMap(shipmentData.pickupLocation, shipmentData.dropLocation);
            }
        },
        
        _loadTripAssignment: function(shipmentId) {
            const oModel = this.getOwnerComponent().getModel();
            const oBinding = oModel.bindList("/ActiveTrips", null, [], [
                new sap.ui.model.Filter("shipment/ID", sap.ui.model.FilterOperator.EQ, shipmentId)
            ]);
            
            oBinding.requestContexts().then((aContexts) => {
                if (aContexts.length > 0) {
                    const tripData = aContexts[0].getObject();
                    this._updateDriverInfo(tripData);
                }
            }).catch((error) => {
                console.error("Error loading trip assignment:", error);
            });
        },
        
        _updateDriverInfo: function(tripData) {
            if (tripData && tripData.driver) {
                this.byId("driverName").setText(tripData.driver.name || "Driver Name");
                this.byId("driverPhone").setText(tripData.driver.phone || "Phone not available");
                this.byId("driverRating").setText((tripData.driver.rating || 4.0).toFixed(1));
                this.byId("driverAvatar").setInitials(this._getInitials(tripData.driver.name || "Driver Name"));
            } else if (tripData && tripData.driver_ID) {
                this._getActualDriverDetails(tripData.driver_ID);
            }
        },
        
        _getActualDriverDetails: function(sDriverId) {
            const oModel = this.getOwnerComponent().getModel();
            const sDriverPath = "/Fleet_Drivers('" + sDriverId + "')";
            
            oModel.bindContext(sDriverPath).requestObject().then(function(oDriver) {
                this.byId("driverName").setText(oDriver.name || "Driver Name");
                this.byId("driverPhone").setText(oDriver.phone || "Phone not available");
                
                const rating = parseFloat(oDriver.rating) || 4.9;
                this.byId("driverRating").setText(rating.toFixed(1));
                this.byId("driverAvatar").setInitials(this._getInitials(oDriver.name || "Driver Name"));
                
            }.bind(this)).catch(function(err) {
                console.error("Driver details fetch error:", err);
            });
        },
        
        _updateTimeline: function(status) {
            const steps = ["step1", "step2", "step3", "step4", "step5", "step6"];
            const icons = ["icon1", "icon2", "icon3", "icon4", "icon5", "icon6"];
            const times = ["step1Time", "step2Time", "step3Time", "step4Time", "step5Time", "step6Time"];
            
            steps.forEach((stepId, index) => {
                const step = this.byId(stepId);
                const icon = this.byId(icons[index]);
                const timeText = this.byId(times[index]);
                
                if (step && icon && timeText) {
                    step.removeStyleClass("completed current pending").addStyleClass("pending");
                    icon.removeStyleClass("completed current pending").addStyleClass("pending");
                    timeText.setText("");
                }
            });
            
            const currentDate = new Date();
            const formatTime = (date) => {
                return date.toLocaleDateString('en-US', { 
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                });
            };
            
            switch(status) {
                case "Pending":
                    this.byId("step1").removeStyleClass("pending").addStyleClass("completed");
                    this.byId("icon1").removeStyleClass("pending").addStyleClass("completed");
                    this.byId("step1Time").setText("Order received and processing");
                    break;
                    
                case "Assigned":
                    this.byId("step1").removeStyleClass("pending").addStyleClass("completed");
                    this.byId("icon1").removeStyleClass("pending").addStyleClass("completed");
                    this.byId("step1Time").setText("✓ Order confirmed");
                    
                    this.byId("step2").removeStyleClass("pending").addStyleClass("current");
                    this.byId("icon2").removeStyleClass("pending").addStyleClass("current");
                    this.byId("step2Time").setText("Driver assigned and notified");
                    break;
                    
                case "ConfirmPickup":
                    ["step1", "step2"].forEach((stepId, index) => {
                        this.byId(stepId).removeStyleClass("pending").addStyleClass("completed");
                        this.byId(icons[index]).removeStyleClass("pending").addStyleClass("completed");
                    });
                    
                    this.byId("step1Time").setText("✓ Order confirmed");
                    this.byId("step2Time").setText("✓ Driver assigned");
                    
                    this.byId("step3").removeStyleClass("pending").addStyleClass("current");
                    this.byId("icon3").removeStyleClass("pending").addStyleClass("current");
                    this.byId("step3Time").setText("Pickup confirmed by driver");
                    break;
                    
                case "In-Transit":
                    ["step1", "step2", "step3"].forEach((stepId, index) => {
                        this.byId(stepId).removeStyleClass("pending").addStyleClass("completed");
                        this.byId(icons[index]).removeStyleClass("pending").addStyleClass("completed");
                    });
                    
                    this.byId("step1Time").setText("✓ Order confirmed");
                    this.byId("step2Time").setText("✓ Driver assigned");
                    this.byId("step3Time").setText("✓ Goods loaded");
                    
                    this.byId("step4").removeStyleClass("pending").addStyleClass("current");
                    this.byId("icon4").removeStyleClass("pending").addStyleClass("current");
                    this.byId("step4Time").setText("Vehicle is on the way");
                    break;
                    
                case "Delivered":
                    ["step1", "step2", "step3", "step4", "step5"].forEach((stepId, index) => {
                        this.byId(stepId).removeStyleClass("pending current").addStyleClass("completed");
                        this.byId(icons[index]).removeStyleClass("pending current").addStyleClass("completed");
                    });
                    
                    this.byId("step1Time").setText("✓ Order confirmed");
                    this.byId("step2Time").setText("✓ Driver assigned");
                    this.byId("step3Time").setText("✓ Goods loaded");
                    this.byId("step4Time").setText("✓ In transit");
                    this.byId("step5Time").setText("✓ Successfully delivered");
                    break;
                    
                case "Cancelled":
                    this.byId("step1").removeStyleClass("pending").addStyleClass("completed");
                    this.byId("icon1").removeStyleClass("pending").addStyleClass("completed");
                    this.byId("step1Time").setText("Order received");
                    
                    this.byId("step6").removeStyleClass("pending").addStyleClass("current");
                    this.byId("icon6").removeStyleClass("pending").addStyleClass("current");
                    this.byId("step6Time").setText("❌ Shipment cancelled");
                    break;
            }
            
            const driverCard = this.byId("driverCard");
            const noDriverCard = this.byId("noDriverCard");
            
            if (status === "Pending" || status === "Cancelled") {
                driverCard.setVisible(false);
                noDriverCard.setVisible(true);
            } else {
                driverCard.setVisible(true);
                noDriverCard.setVisible(false);
            }
        },
        
        _loadRouteOnMap: function(pickupLocation, dropLocation) {
            if (!this.map) {
                setTimeout(() => {
                    this._loadRouteOnMap(pickupLocation, dropLocation);
                }, 2000);
                return;
            }
            
            this._getCoordinatesAsync(pickupLocation, dropLocation).then((coordinates) => {
                if (coordinates.pickup && coordinates.drop && this.map) {
                    this.map.eachLayer((layer) => {
                        if ((layer instanceof L.Marker && layer !== this.truckMarker) || layer instanceof L.Polyline) {
                            this.map.removeLayer(layer);
                        }
                    });
                    
                    const pickupMarker = L.marker([coordinates.pickup.lat, coordinates.pickup.lng]).addTo(this.map);
                    pickupMarker.bindPopup(`<b>Pickup Location</b><br>${pickupLocation}`);
                    
                    const dropMarker = L.marker([coordinates.drop.lat, coordinates.drop.lng]).addTo(this.map);
                    dropMarker.bindPopup(`<b>Drop Location</b><br>${dropLocation}`);
                    
                    this._getBackendRoute(coordinates.pickup, coordinates.drop).then((routeData) => {
                        if (routeData && routeData.coordinates && routeData.coordinates.length > 0) {
                            const routeCoordinates = routeData.coordinates.map(coord => [coord.lat, coord.lng]);
                            L.polyline(routeCoordinates, {
                                color: '#6366f1', weight: 4, opacity: 0.8
                            }).addTo(this.map);
                            
                            if (routeData.distance && routeData.duration) {
                                const distanceKm = routeData.distance;
                                const durationMin = routeData.duration;
                                const durationHours = Math.floor(durationMin / 60);
                                const remainingMin = Math.round(durationMin % 60);
                                
                                const pickup = this._extractCityFromAddress(this.currentShipmentData.pickupLocation);
                                const drop = this._extractCityFromAddress(this.currentShipmentData.dropLocation);
                                this.byId("routeInfo").setText(`${pickup} → ${drop} (${distanceKm} km, ${durationHours}h ${remainingMin}m)`);
                            }
                        } else {
                            this._drawFallbackRoute(coordinates.pickup, coordinates.drop);
                        }
                    }).catch((error) => {
                        this._drawFallbackRoute(coordinates.pickup, coordinates.drop);
                    });
                    
                    const group = new L.featureGroup([pickupMarker, dropMarker]);
                    this.map.fitBounds(group.getBounds().pad(0.1));
                }
            }).catch((error) => {
                console.error("Geocoding failed:", error);
            });
        },
        
        _loadLeafletResources: function () {
            return new Promise((resolve) => {
                if (!document.querySelector('link[href*="leaflet.css"]')) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                    document.head.appendChild(link);
                }

                if (!window.L) {
                    const script = document.createElement('script');
                    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                    script.onload = resolve;
                    document.head.appendChild(script);
                } else {
                    resolve();
                }
            });
        },

        _initializeMap: function () {
            setTimeout(() => {
                const mapDiv = document.getElementById('leafletMap');
                
                if (mapDiv && window.L) {
                    if (this.map) {
                        this.map.remove();
                    }
                    
                    mapDiv.innerHTML = '';
                    this.map = L.map('leafletMap').setView([20.5937, 78.9629], 5);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap contributors'
                    }).addTo(this.map);
                    
                    setTimeout(() => {
                        if (this.map) {
                            this.map.invalidateSize();
                        }
                    }, 500);
                }
            }, 500);
        },
        
        _getCoordinatesAsync: function(pickupLocation, dropLocation) {
            return Promise.all([
                this._geocodeAddress(pickupLocation),
                this._geocodeAddress(dropLocation)
            ]).then(([pickup, drop]) => {
                return { pickup, drop };
            });
        },
        
        _geocodeAddress: function(address) {
            return new Promise((resolve) => {
                if (!address) {
                    resolve(null);
                    return;
                }
                
                const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=in&limit=1`;
                
                fetch(geocodeUrl, {
                    headers: { 'User-Agent': 'RouteOptimizer/1.0' }
                }).then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const coords = {
                            lat: parseFloat(data[0].lat),
                            lng: parseFloat(data[0].lon)
                        };
                        resolve(coords);
                    } else {
                        resolve(this._getStaticFallback(address));
                    }
                }).catch((error) => {
                    resolve(this._getStaticFallback(address));
                });
            });
        },
        
        _getStaticFallback: function(address) {
            const addr = address.toLowerCase();
            
            if (addr.includes('mumbai') || addr.includes('bombay')) return { lat: 19.0760, lng: 72.8777 };
            if (addr.includes('delhi') || addr.includes('new delhi')) return { lat: 28.6139, lng: 77.2090 };
            if (addr.includes('bangalore') || addr.includes('bengaluru')) return { lat: 12.9716, lng: 77.5946 };
            if (addr.includes('hyderabad')) return { lat: 17.3850, lng: 78.4867 };
            if (addr.includes('chennai') || addr.includes('madras')) return { lat: 13.0827, lng: 80.2707 };
            if (addr.includes('kolkata') || addr.includes('calcutta')) return { lat: 22.5726, lng: 88.3639 };
            if (addr.includes('pune')) return { lat: 18.5204, lng: 73.8567 };
            if (addr.includes('ahmedabad')) return { lat: 23.0225, lng: 72.5714 };
            if (addr.includes('jaipur')) return { lat: 26.9124, lng: 75.7873 };
            if (addr.includes('surat')) return { lat: 21.1702, lng: 72.8311 };
            if (addr.includes('nashik')) return { lat: 19.9975, lng: 73.7898 };
            
            return { lat: 20.5937, lng: 78.9629 };
        },
        
        _getBackendRoute: function(startCoord, endCoord) {
            return new Promise((resolve, reject) => {
                const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startCoord.lng},${startCoord.lat};${endCoord.lng},${endCoord.lat}?overview=full&geometries=geojson`;
                
                fetch(osrmUrl)
                    .then(response => response.json())
                    .then(data => {
                        if (data.routes && data.routes.length > 0) {
                            const route = data.routes[0];
                            const coordinates = route.geometry.coordinates.map(coord => ({
                                lat: coord[1],
                                lng: coord[0]
                            }));
                            
                            const distance = Math.round(route.distance / 1000);
                            const realisticDuration = Math.round((distance / 40) * 60);
                            
                            resolve({
                                coordinates: coordinates,
                                distance: distance,
                                duration: realisticDuration
                            });
                        } else {
                            reject(new Error('No route found'));
                        }
                    })
                    .catch(error => {
                        reject(error);
                    });
            });
        },
        
        _drawFallbackRoute: function(startCoord, endCoord) {
            const midLat = (startCoord.lat + endCoord.lat) / 2;
            const midLng = (startCoord.lng + endCoord.lng) / 2;
            
            const routeLine = L.polyline([
                [startCoord.lat, startCoord.lng],
                [midLat + 0.3, midLng],
                [endCoord.lat, endCoord.lng]
            ], {
                color: '#6366f1', weight: 4, opacity: 0.8
            }).addTo(this.map);
        },
        
        _extractCityFromAddress: function(address) {
            if (!address) return "Unknown";
            const parts = address.split(",");
            if (parts.length >= 2) {
                return parts[parts.length - 3]?.trim() || parts[0].trim();
            }
            return address.split(" ")[0];
        },
        
        _getInitials: function(name) {
            if (!name) return "UN";
            const parts = name.split(" ");
            if (parts.length >= 2) {
                return (parts[0][0] + parts[1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        },
        
        onCallDriver: function() {
            sap.m.MessageToast.show("Calling driver...");
        },
        
        onMessageDriver: function() {
            sap.m.MessageToast.show("Opening message...");
        }
    });
});