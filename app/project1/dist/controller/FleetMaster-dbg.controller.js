sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (Controller, Fragment, JSONModel, MessageToast) {
    "use strict";

    return Controller.extend("project1.controller.FleetMaster", {
        onInit: function () {
            // Default model auto-binded from manifest
        },
        

        // 1. Popup Kholne ka Function
        onAddDriver: function () {
            var oView = this.getView();

            // Ek naya local model banate hain temporary data ke liye
            var oNewDriverModel = new JSONModel({
                name: "",
                licenseNo: "",
                phone: "",
                email: "",
                password: "",
                rating: 5,
                status: "AVAILABLE"
            });
            oView.setModel(oNewDriverModel, "newDriver");

            if (!this._pDialog) {
                this._pDialog = Fragment.load({
                    id: oView.getId(),
                    name: "project1.view.fragments.AddDriver",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pDialog.then(function(oDialog) {
                oDialog.open();
            });
        },

        // 2. Cancel Button ka Function
        onCancelDriver: function () {
            this.byId("addDriverDialog").close();
        },

        // 3. Save Button (Actual OData Create)
        onSaveDriver: function () {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel(); // OData V4 Model
            var oNewDriverData = oView.getModel("newDriver").getData();

            // Validation
            if (!oNewDriverData.name || !oNewDriverData.licenseNo) {
                MessageToast.show("Please fill mandatory fields!");
                return;
            }

            // OData V4 List Binding se connect karna
            var oListBinding = this.byId("_IDGenTable").getBinding("items");

            // Create proper driver data structure
            var oDriverPayload = {
                name: oNewDriverData.name,
                licenseNo: oNewDriverData.licenseNo,
                phone: oNewDriverData.phone || "",
                email: oNewDriverData.email || "",
                password: oNewDriverData.password || "",
                rating: oNewDriverData.rating || 5,
                status: "AVAILABLE",
                totalEarning: 0,
                currentLat: 0,
                currentLong: 0
            };

            // Data insert karna
            var oContext = oListBinding.create(oDriverPayload);

            oView.setBusy(true);
            oContext.created().then(function () {
                oView.setBusy(false);
                MessageToast.show("Driver Added Successfully!");
                oView.byId("addDriverDialog").close();
            }).catch(function (oError) {
                oView.setBusy(false);
                MessageToast.show("Error: " + oError.message);
            });
        },


        // 1. Truck Popup kholne ke liye
onAddTruck: function () {
    var oView = this.getView();
    var oNewTruckModel = new JSONModel({
        truckNo: "",
        vehicleType: "Open Bed",
        maxCapacityTons: 10,
        odometerKM: 0,
        status: "AVAILABLE"
    });
    oView.setModel(oNewTruckModel, "newTruck");

    if (!this._pTruckDialog) {
        this._pTruckDialog = Fragment.load({
            id: oView.getId(),
            name: "project1.view.fragments.AddTruck",
            controller: this
        }).then(function (oDialog) {
            oView.addDependent(oDialog);
            return oDialog;
        });
    }
    this._pTruckDialog.then(function(oDialog) {
        oDialog.open();
    });
},
// Formatter to convert "Vikram Singh" -> "VS"
        formatInitials: function(sFullName) {
            if (!sFullName) {
                return "?";
            }

            // Split name by spaces and remove empty strings
            var aParts = sFullName.trim().split(/\s+/);
            var sInitials = "";

            if (aParts.length > 0) {
                // First letter of first name
                sInitials += aParts[0].charAt(0).toUpperCase();
                
                if (aParts.length > 1) {
                    // First letter of last name
                    sInitials += aParts[aParts.length - 1].charAt(0).toUpperCase();
                }
            }
            
            return sInitials;
        },

// 2. Truck Save karne ke liye
onSaveTruck: function () {
    var oView = this.getView();
    var oTable = this.byId("_IDGenTable1"); // <--- Truck waali Table ki sahi ID check kar lena
    var oListBinding = oTable.getBinding("items");
    var oNewTruckData = oView.getModel("newTruck").getData();

    var oContext = oListBinding.create({
        "truckNo": oNewTruckData.truckNo,
        "vehicleType": oNewTruckData.vehicleType,
        "maxCapacityTons": parseFloat(oNewTruckData.maxCapacityTons),
        "odometerKM": parseFloat(oNewTruckData.odometerKM),
        "status": oNewTruckData.status
    });

    oView.setBusy(true);
    oContext.created().then(function () {
        oView.setBusy(false);
        sap.m.MessageToast.show("Truck Added Successfully!");
        this.byId("addTruckDialog").close();
    }.bind(this)).catch(function (oError) {
        oView.setBusy(false);
        sap.m.MessageToast.show("Error: " + oError.message);
    });
},

onCancelTruck: function () {
    this.byId("addTruckDialog").close();
},
onViewLocation: function (oEvent) {
    var oBindingContext = oEvent.getSource().getBindingContext();
    var sDriverID = oBindingContext.getProperty("ID");
    var sDriverName = oBindingContext.getProperty("name");
    var sDriverStatus = oBindingContext.getProperty("status");
    
    console.log("=== DEBUGGING DRIVER LOCATION ===");
    console.log("Driver ID:", sDriverID);
    console.log("Driver Name:", sDriverName);
    console.log("Driver Status:", sDriverStatus);
    
    if (!sDriverID) {
        sap.m.MessageToast.show("Driver ID not found");
        return;
    }
    
    // Check if driver is off-duty
    if (sDriverStatus === 'OFF_DUTY') {
        sap.m.MessageToast.show(`${sDriverName} is currently off-duty. Location not available.`);
        return;
    }
    
    // Get OData model and make direct call to fetch coordinates
    var oModel = this.getOwnerComponent().getModel();
    var sPath = "/Drivers('" + sDriverID + "')";
    
    console.log("Fetching driver data from path:", sPath);
    
    oModel.bindContext(sPath, null, {
        $select: "ID,name,currentLat,currentLong"
    }).requestObject().then((oDriverData) => {
        console.log("Driver data received:", oDriverData);
        
        // Handle coordinates
        var lat = oDriverData.currentLat;
        var lng = oDriverData.currentLong;
        
        console.log("Raw coordinates - Lat:", lat, "(type:", typeof lat, ") Lng:", lng, "(type:", typeof lng, ")");
        
        // Convert to number if needed
        if (typeof lat === 'string') lat = parseFloat(lat);
        if (typeof lng === 'string') lng = parseFloat(lng);
        
        console.log("Processed coordinates - Lat:", lat, "Lng:", lng);
        
        // Validate coordinates
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
            console.error("VALIDATION FAILED - Lat:", lat, "Lng:", lng);
            sap.m.MessageToast.show(`Invalid coordinates for ${sDriverName}: Lat=${lat}, Lng=${lng}`);
            return;
        }
        
        console.log("VALIDATION PASSED - Using coordinates:", lat, lng);
        
        // Store driver data for reference
        this._currentDriverID = sDriverID;
        this._currentDriverData = {
            driverID: sDriverID,
            driverName: sDriverName,
            latitude: lat,
            longitude: lng
        };
        
        // Clear any existing timer
        if (this._locationTimer) {
            clearInterval(this._locationTimer);
            this._locationTimer = null;
        }

        // Load and open fragment
        if (!this._pLocationDialog) {
            this._pLocationDialog = Fragment.load({
                id: this.getView().getId(),
                name: "project1.view.fragments.ViewLocation",
                controller: this
            }).then(function (oDialog) {
                this.getView().addDependent(oDialog);
                return oDialog;
            }.bind(this));
        }

        this._pLocationDialog.then(function(oDialog) {
            oDialog.open();
            
            // Initialize map after dialog is rendered
            setTimeout(() => {
                console.log("Initializing map with:", this._currentDriverData.latitude, this._currentDriverData.longitude);
                this._initDriverMap(
                    this._currentDriverData.latitude, 
                    this._currentDriverData.longitude, 
                    this._currentDriverData.driverName
                );
            }, 300);

            // Start real-time updates every 5 seconds
            this._locationTimer = setInterval(() => {
                var sRefreshPath = "/Drivers('" + this._currentDriverID + "')";
                oModel.bindContext(sRefreshPath, null, {
                    $select: "currentLat,currentLong"
                }).requestObject().then((oUpdatedData) => {
                    console.log("Updated coordinates:", oUpdatedData);
                    
                    var updatedLat = oUpdatedData.currentLat;
                    var updatedLng = oUpdatedData.currentLong;
                    
                    if (typeof updatedLat === 'string') updatedLat = parseFloat(updatedLat);
                    if (typeof updatedLng === 'string') updatedLng = parseFloat(updatedLng);
                    
                    if (updatedLat && updatedLng && !isNaN(updatedLat) && !isNaN(updatedLng)) {
                        this._currentDriverData.latitude = updatedLat;
                        this._currentDriverData.longitude = updatedLng;
                        
                        this._initDriverMap(
                            this._currentDriverData.latitude,
                            this._currentDriverData.longitude,
                            this._currentDriverData.driverName
                        );
                        console.log("Location updated:", updatedLat, updatedLng);
                    }
                }).catch(err => {
                    console.error("Location refresh failed:", err);
                });
            }, 5000);
        }.bind(this));
        
    }).catch((oError) => {
        console.error("Failed to load driver data:", oError);
        sap.m.MessageToast.show("Failed to load driver location: " + oError.message);
    });
},

_initDriverMap: function (lat, lng, driverName) {
    var sMapId = this.getView().getId() + "--liveDriverMap";
    
    // Initialize map if it doesn't exist
    if (!this._oDriverMap) {
        this._oDriverMap = L.map(sMapId).setView([lat, lng], 15);
        
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this._oDriverMap);
        
        // Ensure map renders correctly after dialog opens
        setTimeout(() => {
            this._oDriverMap.invalidateSize();
        }, 100);
    } else {
        // Update existing map view
        this._oDriverMap.setView([lat, lng], 15);
        this._oDriverMap.invalidateSize();
    }

    // Remove existing marker if present
    if (this._driverMarker) {
        this._oDriverMap.removeLayer(this._driverMarker);
    }

    // Create custom truck icon
    var truckIcon = L.divIcon({
        className: 'custom-truck-icon',
        html: '<div style="font-size: 32px; text-align: center; line-height: 1;">🚛</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });

    // Add marker with loading popup first
    this._driverMarker = L.marker([lat, lng], { icon: truckIcon })
        .addTo(this._oDriverMap)
        .bindPopup(`<b>${driverName}</b><br>📍 Loading location...`)
        .openPopup();

    // Fetch city name using reverse geocoding
    this._getCityName(lat, lng, driverName);

    // Update coordinates text
    var oCoordText = this.byId("liveDriverCoordText");
    if (oCoordText) {
        oCoordText.setText(`${driverName} - Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
    }
},

_getCityName: function(lat, lng, driverName) {
    // Use Nominatim reverse geocoding service (free OpenStreetMap service)
    var sUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
    
    fetch(sUrl)
        .then(response => response.json())
        .then(data => {
            console.log("Geocoding response:", data);
            
            var sCityName = "Unknown Location";
            
            if (data && data.address) {
                // Try to get city name from various possible fields
                sCityName = data.address.city || 
                           data.address.town || 
                           data.address.village || 
                           data.address.county || 
                           data.address.state_district || 
                           data.address.state || 
                           "Unknown Location";
            }
            
            console.log("City name found:", sCityName);
            
            // Update marker popup with city name
            if (this._driverMarker) {
                this._driverMarker.setPopupContent(
                    `<div style="text-align: center; min-width: 150px;">
                        <b>🚛 ${driverName}</b><br>
                        <span style="color: #666; font-size: 12px;">📍 ${sCityName}</span><br>
                        <small style="color: #999;">Live Location</small>
                    </div>`
                );
            }
            
            // Update coordinates text with city name
            var oCoordText = this.byId("liveDriverCoordText");
            if (oCoordText) {
                oCoordText.setText(`${driverName} - 📍 ${sCityName}`);
            }
        })
        .catch(error => {
            console.error("Geocoding failed:", error);
            
            // Fallback to coordinates if geocoding fails
            if (this._driverMarker) {
                this._driverMarker.setPopupContent(
                    `<div style="text-align: center; min-width: 150px;">
                        <b>🚛 ${driverName}</b><br>
                        <span style="color: #666; font-size: 12px;">📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}</span><br>
                        <small style="color: #999;">Live Location</small>
                    </div>`
                );
            }
        });
},

onCloseLocationDialog: function () {
    // Critical: Clear the interval to prevent memory leaks
    if (this._locationTimer) {
        clearInterval(this._locationTimer);
        this._locationTimer = null;
    }
    
    // Clean up map reference
    if (this._oDriverMap) {
        this._oDriverMap.remove();
        this._oDriverMap = null;
    }
    
    // Clean up marker reference
    this._driverMarker = null;
    
    // Clear driver context
    this._currentDriverContext = null;
    this._currentDriverData = null;
    
    // Close dialog
    if (this._pLocationDialog) {
        this._pLocationDialog.then(function(oDialog) {
            oDialog.close();
        });
    }
}
    });
    
});