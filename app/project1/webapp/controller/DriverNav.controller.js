sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, JSONModel) {
    "use strict";

    return Controller.extend("project1.controller.DriverNav", {

        onInit: function () {
            this._loadPerformanceData();
            this._loadActiveMission();
            this._startLocationTracking();
            
            // Real-time updates every 10 seconds
            this._updateInterval = setInterval(() => {
                this._loadActiveMission();
                this._updateCurrentLocation();
            }, 10000);
        },

        onAfterRendering: function() {
            this._initializeMap();
        },

        onExit: function() {
            if (this._updateInterval) clearInterval(this._updateInterval);
            if (this._locationWatchId) navigator.geolocation.clearWatch(this._locationWatchId);
        },

        _initializeMap: function() {
            if (this._map) return;
            
            this._map = L.map('map').setView([20.5937, 78.9629], 5); // India center
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this._map);
            
            this._truckMarker = null;
            this._pickupMarker = null;
            this._dropMarker = null;
            this._routeControl = null;
            this._driverRouteControl = null;
            this._pickupCoords = null;
        },

        _geocodeAddress: function(address) {
            return new Promise((resolve, reject) => {
                // Try multiple geocoding strategies
                const queries = [
                    address + ", India",
                    address.replace(/plant|factory|warehouse/gi, "").trim() + ", India",
                    address.split(" ")[0] + ", India" // First word only
                ];
                
                this._tryGeocoding(queries, 0, resolve, reject);
            });
        },

        _tryGeocoding: function(queries, index, resolve, reject) {
            if (index >= queries.length) {
                reject(new Error('All geocoding attempts failed'));
                return;
            }

            const query = queries[index];
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=in`;
            
            fetch(url)
                .then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        resolve({
                            lat: parseFloat(data[0].lat),
                            lng: parseFloat(data[0].lon)
                        });
                    } else {
                        // Try next query
                        this._tryGeocoding(queries, index + 1, resolve, reject);
                    }
                })
                .catch(() => {
                    // Try next query on error
                    this._tryGeocoding(queries, index + 1, resolve, reject);
                });
        },

        _setupRouteNavigation: function(pickupLocation, dropLocation) {
            var that = this;
            
            console.log("Setting up route:", pickupLocation, "to", dropLocation);
            
            Promise.all([
                this._geocodeAddress(pickupLocation),
                this._geocodeAddress(dropLocation)
            ]).then(function(results) {
                const pickupCoords = results[0];
                const dropCoords = results[1];
                
                console.log('Route coordinates found:', pickupCoords, dropCoords);
                that._createRoute(pickupCoords, dropCoords, pickupLocation, dropLocation);
                
            }).catch(function(error) {
                console.error('Geocoding failed:', error);
                MessageToast.show("Could not find locations. Please check address format.");
            });
        },

        _createRoute: function(pickupCoords, dropCoords, pickupName, dropName) {
            // Clear existing elements
            if (this._pickupMarker) this._map.removeLayer(this._pickupMarker);
            if (this._dropMarker) this._map.removeLayer(this._dropMarker);
            if (this._routeControl) this._map.removeControl(this._routeControl);
            if (this._driverRouteControl) this._map.removeControl(this._driverRouteControl);
            
            // Create markers
            this._pickupMarker = L.marker([pickupCoords.lat, pickupCoords.lng], {
                icon: L.divIcon({
                    className: 'pickup-marker',
                    html: '<div class="marker-pin pickup-pin">📍</div>',
                    iconSize: [40, 40],
                    iconAnchor: [20, 40]
                })
            }).addTo(this._map).bindPopup('Pickup: ' + pickupName);
            
            this._dropMarker = L.marker([dropCoords.lat, dropCoords.lng], {
                icon: L.divIcon({
                    className: 'drop-marker',
                    html: '<div class="marker-pin drop-pin">🏁</div>',
                    iconSize: [40, 40],
                    iconAnchor: [20, 40]
                })
            }).addTo(this._map).bindPopup('Drop: ' + dropName);
            
            // Create main route (Pickup to Drop)
            this._routeControl = L.Routing.control({
                waypoints: [
                    L.latLng(pickupCoords.lat, pickupCoords.lng),
                    L.latLng(dropCoords.lat, dropCoords.lng)
                ],
                routeWhileDragging: false,
                addWaypoints: false,
                createMarker: function() { return null; },
                lineOptions: {
                    styles: [{
                        color: '#6366f1',
                        weight: 6,
                        opacity: 0.8
                    }]
                },
                show: false
            }).addTo(this._map);
            
            // Store pickup coordinates for driver route
            this._pickupCoords = pickupCoords;
            
            // Create driver to pickup route if truck location available
            this._createDriverToPickupRoute();
            
            // Fit map to show route
            const group = new L.featureGroup([this._pickupMarker, this._dropMarker]);
            this._map.fitBounds(group.getBounds().pad(0.1));
        },

        _createDriverToPickupRoute: function() {
            if (!this._truckMarker || !this._pickupCoords) return;
            
            var truckLatLng = this._truckMarker.getLatLng();
            
            // Remove existing driver route
            if (this._driverRouteControl) {
                this._map.removeControl(this._driverRouteControl);
            }
            
            // Create driver to pickup route (Green dashed line)
            this._driverRouteControl = L.Routing.control({
                waypoints: [
                    L.latLng(truckLatLng.lat, truckLatLng.lng),
                    L.latLng(this._pickupCoords.lat, this._pickupCoords.lng)
                ],
                routeWhileDragging: false,
                addWaypoints: false,
                createMarker: function() { return null; },
                lineOptions: {
                    styles: [{
                        color: '#10b981',
                        weight: 4,
                        opacity: 0.7,
                        dashArray: '10, 10'
                    }]
                },
                show: false
            }).addTo(this._map);
        },

        _updateTruckOnMap: function(lat, lng) {
            if (!this._map) return;
            
            if (this._truckMarker) {
                this._truckMarker.setLatLng([lat, lng]);
                this._truckMarker.bringToFront();
                
                // Update driver to pickup route when truck moves
                this._createDriverToPickupRoute();
            } else {
                this._truckMarker = L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: 'truck-marker',
                        html: '<div class="truck-icon">🚛</div>',
                        iconSize: [50, 50],
                        iconAnchor: [25, 25]
                    })
                }).addTo(this._map).bindPopup('Live Truck Location');
                
                // Create initial driver to pickup route
                this._createDriverToPickupRoute();
            }
        },

        _startLocationTracking: function() {
            if (!navigator.geolocation) return;
            
            var that = this;
            this._locationWatchId = navigator.geolocation.watchPosition(
                function(position) {
                    var lat = position.coords.latitude;
                    var lng = position.coords.longitude;
                    that._updateTruckOnMap(lat, lng);
                    that._updateLocationInBackend(lat, lng);
                },
                function(error) {
                    console.error("Geolocation error:", error.message);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            );
        },

        _updateLocationInBackend: function(lat, lng) {
            var sDriverID = localStorage.getItem("loggedDriverID");
            if (!sDriverID) return;
            
            var oModel = this.getOwnerComponent().getModel();
            var oAction = oModel.bindContext("/updateDriverLocation(...)");
            
            oAction.setParameter("driverID", sDriverID);
            oAction.setParameter("latitude", parseFloat(parseFloat(lat).toFixed(6)));
            oAction.setParameter("longitude", parseFloat(parseFloat(lng).toFixed(6)));
            
            oAction.execute().catch(function(error) {
                console.error("Failed to update location:", error.message);
            });
        },

        _updateCurrentLocation: function() {
            if (navigator.geolocation) {
                var that = this;
                navigator.geolocation.getCurrentPosition(function(position) {
                    that._updateLocationInBackend(position.coords.latitude, position.coords.longitude);
                });
            }
        },

        _loadActiveMission: function() {
            var sDriverID = localStorage.getItem("loggedDriverID");
            var oModel = this.getOwnerComponent().getModel();
            var that = this;

            if (!sDriverID) return;

            var oListBinding = oModel.bindList("/ActiveMission", null, null, [], {
                "$filter": "driverID eq '" + sDriverID + "'"
            });

            oListBinding.requestContexts(0, 1).then(function (aContexts) {
                if (aContexts && aContexts.length > 0) {
                    var oData = aContexts[0].getObject();
                    console.log("Mission Data:", oData);
                    
                    // Setup route if locations available
                    if (oData.pickupLocation && oData.dropLocation) {
                        that._setupRouteNavigation(oData.pickupLocation, oData.dropLocation);
                    }
                    
                    // Update truck location
                    if (oData.currentLat && oData.currentLong && oData.currentLat !== 0 && oData.currentLong !== 0) {
                        that._updateTruckOnMap(oData.currentLat, oData.currentLong);
                    } else {
                        that._updateCurrentLocation();
                    }
                    
                    that.getView().setModel(new JSONModel(oData), "missionData");
                }
            }).catch(function(oError) {
                console.error("Mission load error:", oError.message);
            });
        },

        _loadPerformanceData: function() {
            var sDriverID = localStorage.getItem("loggedDriverID");
            var oModel = this.getOwnerComponent().getModel();
            var that = this;

            if (!sDriverID) return;

            var oAction = oModel.bindContext("/getDriverPerformance(...)");
            oAction.setParameter("driverID", sDriverID);

            oAction.execute().then(function () {
                oAction.requestObject().then(function(oData) {
                    var oFinalData = oData.value ? oData.value : oData;
                    that.getView().setModel(new JSONModel(oFinalData), "perfModel");
                });
            }).catch(function (oError) {
                console.error("Performance data failed:", oError.message);
                that.getView().setModel(new JSONModel({
                    totalDistance: 0,
                    truckType: "Loading...",
                    totalFare: 0
                }), "perfModel");
            });
        },

        onUpdateLocation: function() {
            var that = this;
            if (navigator.geolocation) {
                MessageToast.show("Getting current location...");
                navigator.geolocation.getCurrentPosition(
                    function(position) {
                        that._updateTruckOnMap(position.coords.latitude, position.coords.longitude);
                        that._updateLocationInBackend(position.coords.latitude, position.coords.longitude);
                        MessageToast.show("Location updated successfully!");
                    },
                    function(error) {
                        MessageToast.show("Failed to get location: " + error.message);
                    }
                );
            } else {
                MessageToast.show("Geolocation not supported");
            }
        },

        onConfirmPickup: function () {
            var oMissionModel = this.getView().getModel("missionData");
            var oModel = this.getOwnerComponent().getModel();
            var that = this;
            
            if (!oMissionModel) {
                MessageToast.show("No active mission found");
                return;
            }
            
            var sShipmentID = oMissionModel.getProperty("/ID");
            var oAction = oModel.bindContext("/confirmPickup(...)");
            oAction.setParameter("shipmentID", sShipmentID);
            
            oAction.execute().then(function() {
                oMissionModel.setProperty("/status", "ConfirmPickup");
                MessageToast.show("Pickup confirmed successfully!");
                that._loadActiveMission();
            }).catch(function(oError) {
                console.error("Confirm pickup failed:", oError.message);
                MessageToast.show("Failed to confirm pickup");
            });
        },

        onReportDelay: function () {
            MessageToast.show("Delay report functionality will be implemented");
        }
    });
});