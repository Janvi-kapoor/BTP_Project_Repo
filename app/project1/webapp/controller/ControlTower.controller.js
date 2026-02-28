sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("project1.controller.ControlTower", {
        
        onInit: function () {
            var oDashboardModel = new JSONModel({
                stats: { revenue: "0", commission: "0", activeDrivers: 0 }
            });
            this.getView().setModel(oDashboardModel, "dashboard");
            
            var oFleetModel = new JSONModel({
                activeFleet: []
            });
            this.getView().setModel(oFleetModel, "fleet");

            // Load stats after a delay to avoid blocking fleet data
            setTimeout(() => {
                this._loadDashboardStats();
            }, 1000);
            
            this._loadLeafletResources().then(() => {
                this._initializeAdminMap();
                this._loadFleetData();
                this._startLocationPolling();
            });
        },
        
        onExit: function() {
            this._stopLocationPolling();
        },
        
        _startLocationPolling: function() {
            this._locationPollingInterval = setInterval(() => {
                this._loadFleetData();
            }, 30000); // 30 seconds
        },
        
        _stopLocationPolling: function() {
            if (this._locationPollingInterval) {
                clearInterval(this._locationPollingInterval);
                this._locationPollingInterval = null;
            }
        },

        _loadDashboardStats: function() {
            var oModel = this.getOwnerComponent().getModel(); 
            var oDashboardModel = this.getView().getModel("dashboard");
            
            var oFunction = oModel.bindContext("/getDashboardStats(...)");

            oFunction.execute().then(function () {
                var oContext = oFunction.getBoundContext();
                var oData = oContext.getObject();

                oDashboardModel.setProperty("/stats/revenue", parseFloat(oData.totalRevenue || 0).toLocaleString("en-IN"));
                oDashboardModel.setProperty("/stats/commission", Math.round(oData.totalCommission || 0).toLocaleString("en-IN"));
                oDashboardModel.setProperty("/stats/activeDrivers", oData.activeDrivers);
                
            }).catch(function(err) {
                console.error("Dashboard stats failed:", err);
                // Set default values on error
                oDashboardModel.setProperty("/stats/revenue", "0");
                oDashboardModel.setProperty("/stats/commission", "0");
                oDashboardModel.setProperty("/stats/activeDrivers", 0);
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

        _initializeAdminMap: function () {
            setTimeout(() => {
                const mapDiv = document.getElementById('adminLeafletMap');
                
                if (mapDiv && window.L) {
                    if (this.adminMap) {
                        this.adminMap.remove();
                    }
                    
                    mapDiv.innerHTML = '';
                    this.adminMap = L.map('adminLeafletMap').setView([20.5937, 78.9629], 6);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap contributors'
                    }).addTo(this.adminMap);
                    
                    setTimeout(() => {
                        if (this.adminMap) {
                            this.adminMap.invalidateSize();
                        }
                    }, 500);
                }
            }, 500);
        },

        _loadFleetData: function() {
            const oModel = this.getOwnerComponent().getModel();
            const oFleetModel = this.getView().getModel("fleet");
            
            console.log("=== STEP 1: LOADING ACTIVE SHIPMENTS ===");
            
            // First get shipments with In-Transit and ConfirmPickup status
            const oShipmentBinding = oModel.bindList("/AdminShipments", null, [], [
                new sap.ui.model.Filter({
                    filters: [
                        new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "In-Transit"),
                        new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "ConfirmPickup")
                    ],
                    and: false
                })
            ], {
                $expand: "assignment"
            });
            
            oShipmentBinding.requestContexts().then((aShipmentContexts) => {
                console.log("Total active shipments found:", aShipmentContexts.length);
                
                const aFleetData = [];
                let processedCount = 0;
                
                if (aShipmentContexts.length === 0) {
                    console.log("No active shipments found (In-Transit or ConfirmPickup)");
                    oFleetModel.setProperty("/activeFleet", []);
                    return;
                }
                
                aShipmentContexts.forEach((context, index) => {
                    const shipment = context.getObject();
                    console.log(`\n=== SHIPMENT ${index + 1} DETAILS ===`);
                    console.log("Shipment ID:", shipment.ID);
                    console.log("Status:", shipment.status);
                    console.log("Pickup:", shipment.pickupLocation);
                    console.log("Drop:", shipment.dropLocation);
                    
                    if (shipment.assignment && shipment.assignment.ID) {
                        console.log("\n--- TRIP ASSIGNMENT FOUND ---");
                        console.log("Assignment ID:", shipment.assignment.ID);
                        console.log("ETA:", shipment.assignment.eta);
                        console.log("Driver ID:", shipment.assignment.driver_ID);
                        console.log("Truck ID:", shipment.assignment.truck_ID);
                        
                        // Get driver details
                        if (shipment.assignment.driver_ID) {
                            this._getDriverDetails(shipment.assignment.driver_ID).then((driverData) => {
                                // Skip if driver not found
                                if (!driverData) {
                                    console.log("Driver not found - skipping shipment", shipment.ID);
                                    processedCount++;
                                    if (processedCount === aShipmentContexts.length) {
                                        console.log("All shipments processed. Total fleet:", aFleetData.length);
                                        oFleetModel.setProperty("/activeFleet", aFleetData);
                                        this._addTruckMarkersToMap(aFleetData);
                                    }
                                    return;
                                }
                                
                                // Check if driver is off-duty
                                if (driverData.status === 'OFF_DUTY') {
                                    console.log(`Driver ${driverData.name} is OFF_DUTY - not showing location`);
                                    // Add to fleet data but without location coordinates
                                    aFleetData.push({
                                        shipmentId: shipment.ID,
                                        truckId: "TRK-" + (shipment.assignment.truck_ID ? shipment.assignment.truck_ID.slice(-4) : "XXXX"),
                                        driverName: driverData.name,
                                        driverInitials: this._getDriverInitials(driverData.name),
                                        driverContact: driverData.phone,
                                        pickupLocation: shipment.pickupLocation,
                                        dropLocation: shipment.dropLocation,
                                        currentLocation: "Driver is Off-Duty",
                                        eta: shipment.assignment.eta,
                                        currentLat: null,
                                        currentLong: null,
                                        isOffDuty: true
                                    });
                                    
                                    processedCount++;
                                    if (processedCount === aShipmentContexts.length) {
                                        oFleetModel.setProperty("/activeFleet", aFleetData);
                                        this._addTruckMarkersToMap(aFleetData);
                                    }
                                } else {
                                    // Add to fleet data with driver's current location (without truck details)
                                    aFleetData.push({
                                        shipmentId: shipment.ID,
                                        truckId: shipment.assignment.truck_ID ? "TRK-" + shipment.assignment.truck_ID.slice(-4) : "TRK-XXXX",
                                        driverName: driverData.name,
                                        driverInitials: this._getDriverInitials(driverData.name),
                                        driverContact: driverData.phone,
                                        pickupLocation: shipment.pickupLocation,
                                        dropLocation: shipment.dropLocation,
                                        currentLocation: "En Route",
                                        eta: shipment.assignment.eta,
                                        currentLat: driverData.currentLat,
                                        currentLong: driverData.currentLong,
                                        isOffDuty: false
                                    });
                                    
                                    console.log("Fleet data added:", aFleetData[aFleetData.length - 1]);
                                    
                                    processedCount++;
                                    if (processedCount === aShipmentContexts.length) {
                                        console.log("All shipments processed. Total fleet:", aFleetData.length);
                                        oFleetModel.setProperty("/activeFleet", aFleetData);
                                        this._addTruckMarkersToMap(aFleetData);
                                    }
                                }
                            });
                        } else {
                            processedCount++;
                        }
                    } else {
                        processedCount++;
                    }
                });
                
            }).catch((error) => {
                console.error("In-Transit shipments loading failed:", error);
            });
        },
        
        _getDriverDetails: function(driverId) {
            const oModel = this.getOwnerComponent().getModel();
            const sDriverPath = "/Fleet_Drivers('" + driverId + "')";
            
            return oModel.bindContext(sDriverPath).requestObject().then((driverData) => {
                console.log("Driver details fetched:", {
                    name: driverData.name,
                    status: driverData.status,
                    currentLat: driverData.currentLat,
                    currentLong: driverData.currentLong
                });
                return driverData;
            }).catch((error) => {
                console.error("Driver fetch failed for ID:", driverId, "- Skipping this shipment");
                return null; // Return null instead of throwing error
            });
        },
        
        _getTruckDetails: function(truckId) {
            const oModel = this.getOwnerComponent().getModel();
            const sTruckPath = "/Fleet_Trucks('" + truckId + "')";
            
            return oModel.bindContext(sTruckPath).requestObject().catch((error) => {
                console.error("Truck details fetch failed for ID:", truckId, error);
                // Return default truck data if fetch fails
                return {
                    ID: truckId,
                    truckNo: "TRK-" + truckId.slice(-4)
                };
            });
        },
        
        _getDriverInitials: function(driverName) {
            if (!driverName) return "??";
            const names = driverName.trim().split(" ");
            if (names.length === 1) {
                return names[0].substring(0, 2).toUpperCase();
            }
            return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
        },
        

        
        _addTruckMarkersToMap: function(fleetData) {
            if (!this.adminMap || !window.L) return;
            
            if (this.truckMarkers && this.adminMap) {
                this.truckMarkers.forEach(marker => {
                    if (marker && this.adminMap.hasLayer(marker)) {
                        this.adminMap.removeLayer(marker);
                    }
                });
            }
            this.truckMarkers = [];
            this.truckMarkersMap = {};
            
            fleetData.forEach(fleet => {
                // Only add markers for drivers who are not off-duty and have valid coordinates
                if (!fleet.isOffDuty && fleet.currentLat && fleet.currentLong) {
                    const truckMarker = L.marker([fleet.currentLat, fleet.currentLong], {
                        icon: L.divIcon({
                            html: '🚛',
                            iconSize: [20, 20],
                            className: 'truck-marker'
                        })
                    }).addTo(this.adminMap);
                    
                    truckMarker.bindPopup(`
                        <b>${fleet.truckId}</b><br>
                        Driver: ${fleet.driverName}<br>
                        Contact: ${fleet.driverContact}<br>
                        Drop: ${fleet.dropLocation}
                    `);
                    
                    this.truckMarkers.push(truckMarker);
                    this.truckMarkersMap[fleet.truckId] = truckMarker;
                }
            });
        },
        
        onViewFleetDetails: function(oEvent) {
            const oButton = oEvent.getSource();
            const oBindingContext = oButton.getBindingContext("fleet");
            if (!oBindingContext) return;
            
            const oFleetData = oBindingContext.getObject();
            this._highlightTruckOnMap(oFleetData.truckId);
        },
        

        
        _highlightTruckOnMap: function(truckId) {
            if (!this.adminMap || !this.truckMarkersMap || !this.truckMarkersMap[truckId]) return;
            
            const marker = this.truckMarkersMap[truckId];
            const latLng = marker.getLatLng();
            
            this.adminMap.setView(latLng, 15, { animate: true });
            marker.openPopup();
            
            marker.setIcon(L.divIcon({
                html: '🚛',
                iconSize: [35, 35],
                className: 'truck-marker truck-marker-highlight'
            }));
            
            setTimeout(() => {
                marker.setIcon(L.divIcon({
                    html: '🚛',
                    iconSize: [20, 20],
                    className: 'truck-marker'
                }));
            }, 3000);
        },
        

    });
});