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
            // Add delay to ensure DOM is fully rendered
            setTimeout(() => {
                this._initializeMap();
            }, 100);
        },

        onExit: function() {
            if (this._updateInterval) clearInterval(this._updateInterval);
            if (this._locationWatchId) navigator.geolocation.clearWatch(this._locationWatchId);
        },

        _initializeMap: function() {
            if (this._map) return;
            
            // Check if map container exists
            var mapContainer = document.getElementById('map');
            if (!mapContainer) {
                console.warn('Map container not found, retrying in 500ms...');
                setTimeout(() => {
                    this._initializeMap();
                }, 500);
                return;
            }
            
            try {
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
                
                console.log('Map initialized successfully');
            } catch (error) {
                console.error('Failed to initialize map:', error.message);
            }
        },

        _geocodeAddress: function(address) {
            return new Promise((resolve, reject) => {
                // Enhanced geocoding with better address parsing
                const cleanAddress = this._cleanAddress(address);
                const queries = this._generateGeocodingQueries(cleanAddress);
                
                console.log('Geocoding queries for:', address, queries);
                this._tryGeocodingWithFallback(queries, 0, resolve, reject);
            });
        },

        _cleanAddress: function(address) {
            // Remove common noise words and normalize
            return address
                .replace(/\b(plant|factory|warehouse|depot|hub|center|centre)\b/gi, '')
                .replace(/\b(road|rd|street|st|avenue|ave|lane|ln)\b/gi, '')
                .replace(/\s+/g, ' ')
                .trim();
        },

        _generateGeocodingQueries: function(address) {
            const parts = address.split(',').map(part => part.trim());
            const queries = [];
            
            // Strategy 1: Full address
            queries.push(address);
            
            // Strategy 2: City + State + Country (most reliable)
            if (parts.length >= 3) {
                const city = parts.find(part => 
                    /\b(bhopal|jamshedpur|delhi|mumbai|bangalore|chennai|kolkata|hyderabad|pune|ahmedabad)\b/i.test(part)
                );
                const state = parts.find(part => 
                    /\b(madhya pradesh|jharkhand|delhi|maharashtra|karnataka|tamil nadu|west bengal|telangana|gujarat)\b/i.test(part)
                );
                
                if (city && state) {
                    queries.push(`${city}, ${state}, India`);
                }
            }
            
            // Strategy 3: Major city extraction
            const cityMatch = address.match(/\b(bhopal|jamshedpur|delhi|mumbai|bangalore|chennai|kolkata|hyderabad|pune|ahmedabad)\b/i);
            if (cityMatch) {
                queries.push(`${cityMatch[0]}, India`);
            }
            
            // Strategy 4: Pincode based (if available)
            const pincodeMatch = address.match(/\b(\d{6})\b/);
            if (pincodeMatch) {
                queries.push(`${pincodeMatch[0]}, India`);
            }
            
            // Strategy 5: First significant location word
            const locationWords = address.split(/[,\s]+/).filter(word => 
                word.length > 3 && !/\d/.test(word) && 
                !/\b(area|gate|road|street|sector|block|phase)\b/i.test(word)
            );
            if (locationWords.length > 0) {
                queries.push(`${locationWords[0]}, India`);
            }
            
            return [...new Set(queries)]; // Remove duplicates
        },

        _tryGeocodingWithFallback: function(queries, index, resolve, reject) {
            if (index >= queries.length) {
                reject(new Error('All geocoding attempts failed'));
                return;
            }

            const query = queries[index];
            console.log(`Trying geocoding query ${index + 1}/${queries.length}:`, query);
            
            // Use multiple geocoding services for better accuracy
            this._geocodeWithNominatim(query)
                .then(result => {
                    console.log('Geocoding success:', query, result);
                    resolve(result);
                })
                .catch(() => {
                    console.log('Geocoding failed for:', query);
                    // Try next query
                    this._tryGeocodingWithFallback(queries, index + 1, resolve, reject);
                });
        },

        _geocodeWithNominatim: function(query) {
            return new Promise((resolve, reject) => {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in&addressdetails=1`;
                
                fetch(url)
                    .then(response => response.json())
                    .then(data => {
                        if (data && data.length > 0) {
                            // Find best match based on importance and type
                            const bestMatch = this._selectBestGeocodingMatch(data, query);
                            if (bestMatch) {
                                resolve({
                                    lat: parseFloat(bestMatch.lat),
                                    lng: parseFloat(bestMatch.lon),
                                    display_name: bestMatch.display_name
                                });
                            } else {
                                reject(new Error('No suitable match found'));
                            }
                        } else {
                            reject(new Error('No results found'));
                        }
                    })
                    .catch(error => {
                        console.error('Nominatim API error:', error);
                        reject(error);
                    });
            });
        },

        _selectBestGeocodingMatch: function(results, originalQuery) {
            // Prioritize results by type and relevance
            const priorities = {
                'city': 10,
                'town': 9,
                'village': 8,
                'suburb': 7,
                'neighbourhood': 6,
                'administrative': 5
            };
            
            let bestMatch = results[0]; // Default to first result
            let bestScore = 0;
            
            results.forEach(result => {
                let score = 0;
                
                // Score based on place type
                if (result.type && priorities[result.type]) {
                    score += priorities[result.type];
                }
                
                // Score based on importance
                if (result.importance) {
                    score += result.importance * 10;
                }
                
                // Bonus for exact city name match
                const queryLower = originalQuery.toLowerCase();
                if (result.display_name && result.display_name.toLowerCase().includes(queryLower)) {
                    score += 5;
                }
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = result;
                }
            });
            
            return bestMatch;
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
                // Remove bringToFront() as it doesn't exist on Leaflet markers
                
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
            
            console.log("Updating driver location:", lat, lng, "for driver:", sDriverID);
            
            var oModel = this.getOwnerComponent().getModel();
            var oAction = oModel.bindContext("/updateDriverLocation(...)");
            
            oAction.setParameter("driverID", sDriverID);
            oAction.setParameter("latitude", parseFloat(parseFloat(lat).toFixed(6)));
            oAction.setParameter("longitude", parseFloat(parseFloat(lng).toFixed(6)));
            
            oAction.execute().then(function() {
                console.log("Location updated successfully in backend");
            }).catch(function(error) {
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
                    
                    // Ensure ETA has a proper value
                    if (!oData.eta || oData.eta === 'undefined' || oData.eta === '') {
                        oData.eta = '2-3 hours';
                    }
                    
                    // Show mission content
                    that._showMissionContent();
                    
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
                } else {
                    // No active mission found
                    that._showNoMissionState();
                }
            }).catch(function(oError) {
                console.error("Mission load error:", oError.message);
                that._showNoMissionState();
            });
        },

        _showMissionContent: function() {
            this.byId("missionContent").setVisible(true);
            this.byId("noMissionContent").setVisible(false);
        },

        _showNoMissionState: function() {
            this.byId("missionContent").setVisible(false);
            this.byId("noMissionContent").setVisible(true);
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
            var that = this;
            
            if (!oMissionModel) {
                MessageToast.show("No active mission found");
                return;
            }
            
            var sShipmentID = oMissionModel.getProperty("/ID");
            var sStatus = oMissionModel.getProperty("/status");
            
            // Check if shipment is in correct status for pickup
            if (sStatus !== 'In-Transit') {
                MessageToast.show("Pickup can only be confirmed for In-Transit shipments");
                return;
            }
            
            console.log("Requesting pickup OTP for shipment:", sShipmentID);
            
            // Request pickup OTP (matches delivery pattern)
            var oModel = this.getOwnerComponent().getModel();
            var oAction = oModel.bindContext("/sendPickupOTP(...)");
            oAction.setParameter("shipmentID", sShipmentID);
            
            oAction.execute().then(function() {
                oAction.requestObject().then(function(oData) {
                    var oResult = oData.value || oData;
                    if (oResult.success) {
                        MessageToast.show(oResult.message);
                        that._showPickupOTPDialog(sShipmentID);
                    } else {
                        MessageToast.show("Failed to send pickup OTP: " + oResult.message);
                    }
                }).catch(function(oError) {
                    console.error("Send pickup OTP failed:", oError.message);
                    MessageToast.show("Failed to request pickup OTP");
                });
            }).catch(function(oError) {
                console.error("Send pickup OTP failed:", oError.message);
                MessageToast.show("Failed to request pickup OTP");
            });
        },
        
        _showPickupOTPDialog: function(sShipmentID) {
            var that = this;
            
            if (!this._pickupOTPDialog) {
                this._pickupOTPDialog = new sap.m.Dialog({
                    title: "🚛 Pickup Confirmation",
                    contentWidth: "420px",
                    contentHeight: "300px",
                    draggable: true,
                    resizable: false,
                    class: "otpDialog",
                    content: [
                        new sap.m.VBox({
                            class: "otpDialogContent",
                            alignItems: "Center",
                            items: [
                                new sap.m.VBox({
                                    class: "otpTitleSection",
                                    alignItems: "Center",
                                    items: [
                                        new sap.ui.core.Icon({
                                            src: "sap-icon://email",
                                            size: "2rem",
                                            color: "#6366f1",
                                            class: "otpSuccessIcon"
                                        }),
                                        new sap.m.Text({
                                            text: "Enter OTP Code",
                                            class: "otpMainTitle"
                                        }),
                                        new sap.m.Text({
                                            text: "OTP sent to company email. Enter the 4-digit code to confirm pickup:",
                                            class: "otpSubTitle",
                                            textAlign: "Center"
                                        })
                                    ]
                                }),
                                new sap.m.Input(this.createId("pickupOtpInput"), {
                                    placeholder: "Enter 4-digit OTP",
                                    maxLength: 4,
                                    type: "Number",
                                    class: "otpDigitInput",
                                    textAlign: "Center",
                                    liveChange: function(oEvent) {
                                        var sValue = oEvent.getParameter("value");
                                        if (sValue.length === 4) {
                                            that.byId("verifyPickupBtn").setEnabled(true);
                                        } else {
                                            that.byId("verifyPickupBtn").setEnabled(false);
                                        }
                                    }
                                }),
                                new sap.m.VBox({
                                    class: "otpActionButtons",
                                    alignItems: "Center",
                                    items: [
                                        new sap.m.Button(this.createId("verifyPickupBtn"), {
                                            text: "✓ Verify & Confirm Pickup",
                                            type: "Emphasized",
                                            enabled: false,
                                            class: "otpVerifyBtn",
                                            press: function() {
                                                that._verifyPickupOTP(sShipmentID);
                                            }
                                        }),
                                        new sap.m.Button({
                                            text: "Cancel",
                                            class: "otpCancelBtn",
                                            press: function() {
                                                that._pickupOTPDialog.close();
                                            }
                                        })
                                    ]
                                }),
                                new sap.m.HBox({
                                    alignItems: "Center",
                                    justifyContent: "Center",
                                    class: "otpLoadingSpinner",
                                    items: [
                                        new sap.ui.core.Icon({
                                            src: "sap-icon://information",
                                            size: "1rem",
                                            color: "#6b7280"
                                        }),
                                        new sap.m.Text({
                                            text: "Valid for 10 minutes",
                                            class: "otpLoadingText"
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                });
                this.getView().addDependent(this._pickupOTPDialog);
            }
            
            // Reset dialog state
            this.byId("pickupOtpInput").setValue("");
            this.byId("verifyPickupBtn").setEnabled(false);
            this._pickupOTPDialog.open();
        },
        
        _verifyPickupOTP: function(sShipmentID) {
            var sEnteredOTP = this.byId("pickupOtpInput").getValue();
            var that = this;
            
            if (!sEnteredOTP || sEnteredOTP.length !== 4) {
                MessageToast.show("Please enter a valid 4-digit OTP");
                return;
            }
            
            console.log("Verifying pickup OTP for shipment:", sShipmentID, "OTP:", sEnteredOTP);
            
            var oModel = this.getOwnerComponent().getModel();
            var oAction = oModel.bindContext("/verifyPickupOTP(...)");
            oAction.setParameter("shipmentID", sShipmentID);
            oAction.setParameter("enteredOTP", sEnteredOTP);
            
            oAction.execute().then(function() {
                oAction.requestObject().then(function(oData) {
                    var oResult = oData.value || oData;
                    
                    if (oResult.success) {
                        MessageToast.show(oResult.message);
                        that._pickupOTPDialog.close();
                        
                        // Refresh mission data to show updated status
                        setTimeout(() => {
                            that._loadActiveMission();
                        }, 500);
                    } else {
                        MessageToast.show(oResult.message);
                    }
                }).catch(function(oError) {
                    console.error("Verify pickup OTP failed:", oError.message);
                    MessageToast.show("Failed to verify pickup OTP");
                });
            }).catch(function(oError) {
                console.error("Verify pickup OTP failed:", oError.message);
                MessageToast.show("Failed to verify pickup OTP");
            });
        },

        onReportDelay: function () {
            if (!this._reportDelayDialog) {
                this._reportDelayDialog = sap.ui.xmlfragment(this.getView().getId(), "project1.fragment.ReportDelayDialog", this);
                this.getView().addDependent(this._reportDelayDialog);
            }
            this._reportDelayDialog.open();
        },

        onSendDelayReport: function() {
            var oMissionModel = this.getView().getModel("missionData");
            var sDriverID = localStorage.getItem("loggedDriverID");
            var oSelect = this.byId("delayReasonSelect");
            var sDelayReason = oSelect ? oSelect.getSelectedKey() : null;
            
            console.log("Debug - Selected reason:", sDelayReason);
            
            if (!oMissionModel || !sDelayReason) {
                MessageToast.show("Please select a delay reason");
                return;
            }
            
            var sShipmentID = oMissionModel.getProperty("/ID");
            var oModel = this.getOwnerComponent().getModel();
            var oAction = oModel.bindContext("/reportDelay(...)");
            
            oAction.setParameter("shipmentID", sShipmentID);
            oAction.setParameter("driverID", sDriverID);
            oAction.setParameter("delayReason", sDelayReason);
            
            var that = this;
            oAction.execute().then(function() {
                MessageToast.show("Delay reported successfully!");
                that._reportDelayDialog.close();
            }).catch(function(oError) {
                console.error("Delay report failed:", oError.message);
                MessageToast.show("Failed to report delay");
            });
        },

        onCancelDelayReport: function() {
            this._reportDelayDialog.close();
        }
    });
});