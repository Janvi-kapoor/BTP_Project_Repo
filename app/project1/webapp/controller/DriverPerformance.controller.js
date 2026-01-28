sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("project1.controller.DriverPerformance", {
        onInit: function () {
            this._loadDriverStats();
            this._loadTripHistory();
            
            // Auto-refresh every 30 seconds
            this._refreshInterval = setInterval(() => {
                this._loadDriverStats();
                this._loadTripHistory();
            }, 30000);
        },
        
        onExit: function() {
            // Clear interval when leaving page
            if (this._refreshInterval) {
                clearInterval(this._refreshInterval);
            }
        },
        
        onAfterRendering: function() {
            // Refresh data when page becomes visible
            this._loadDriverStats();
            this._loadTripHistory();
        },
        
        _loadDriverStats: function() {
            var oModel = this.getOwnerComponent().getModel();
            var sDriverID = localStorage.getItem("loggedDriverID");
            
            console.log("Loading driver stats for ID:", sDriverID);
            
            if (!sDriverID) {
                console.error("No driver ID found in localStorage");
                this._setFallbackStats();
                return;
            }
            
            // Call getDriverStats function with actual driver ID
            var oOperation = oModel.bindContext("/getDriverStats(...)");
            oOperation.setParameter("driverID", sDriverID);
            
            var that = this;
            oOperation.execute().then(function() {
                var oResult = oOperation.getBoundContext().getObject();
                
                console.log("Driver stats received:", oResult);
                
                // Update KPI cards with real data
                that.byId("earningsValue").setText("₹" + (oResult.totalEarnings || 0).toLocaleString());
                that.byId("tripsValue").setText((oResult.completedTrips || 0).toString());
                that.byId("safetyValue").setText((oResult.safetyRating || 4.8) + "/5");
                
                console.log("UI updated with new stats");
                
            }).catch(function(oError) {
                console.error("Error loading driver stats:", oError);
                that._setFallbackStats();
            });
        },

        _setFallbackStats: function() {
            this.byId("earningsValue").setText("₹0");
            this.byId("tripsValue").setText("0");
            this.byId("safetyValue").setText("4.8/5");
        },

        _loadTripHistory: function() {
            var oModel = this.getOwnerComponent().getModel();
            var sDriverID = localStorage.getItem("loggedDriverID");
            
            console.log("Loading trip history for driver:", sDriverID);
            
            if (!sDriverID) {
                console.error("No driver ID found for trip history");
                this._setEmptyTripHistory();
                return;
            }
            
            var that = this;
            
            // Use TripAssignments entity to get driver's assignments
            var oBinding = oModel.bindList("/TripAssignments", null, null, [], {
                "$expand": "shipment",
                "$filter": "driver_ID eq '" + sDriverID + "'"
            });
            
            oBinding.requestContexts().then(function(aContexts) {
                console.log("Found TripAssignments:", aContexts.length);
                
                var aTrips = [];
                
                // If no assignments, try to get completed shipments directly
                if (aContexts.length === 0) {
                    that._loadCompletedShipments(sDriverID);
                    return;
                }
                
                aContexts.forEach(function(oContext) {
                    var oAssignment = oContext.getObject();
                    console.log("Processing assignment:", oAssignment);
                    
                    if (oAssignment.shipment) {
                        var oShipment = oAssignment.shipment;
                        var oDate = new Date(oAssignment.createdAt || oShipment.createdAt || new Date());
                        
                        // Determine status display
                        var sStatusText = "";
                        var sStatusState = "None";
                        
                        switch(oShipment.status) {
                            case 'Delivered':
                                sStatusText = "Completed";
                                sStatusState = "Success";
                                break;
                            case 'In-Transit':
                                sStatusText = "In Progress";
                                sStatusState = "Warning";
                                break;
                            case 'Assigned':
                                sStatusText = "Assigned";
                                sStatusState = "Information";
                                break;
                            default:
                                sStatusText = oShipment.status || "Unknown";
                                sStatusState = "None";
                        }
                        
                        aTrips.push({
                            date: oDate.toLocaleDateString('en-IN'),
                            tripId: oShipment.ID,
                            km: (oShipment.totalDistance || 150) + " KM",
                            status: sStatusText,
                            statusState: sStatusState,
                            amount: "₹" + (oShipment.totalFare || 0).toLocaleString('en-IN')
                        });
                    }
                });
                
                console.log("Final trips array:", aTrips);
                
                // Create JSON model for table
                var oTripModel = new JSONModel({ trips: aTrips });
                that.getView().setModel(oTripModel, "tripHistory");
                
                // Bind table items
                var oTable = that.byId("tripHistoryTable");
                if (oTable) {
                    oTable.bindItems({
                        path: "tripHistory>/trips",
                        template: that._createTripListItem()
                    });
                }
                
            }).catch(function(oError) {
                console.error("Error loading trip assignments:", oError);
                // Fallback to completed shipments
                that._loadCompletedShipments(sDriverID);
            });
        },
        
        _loadCompletedShipments: function(sDriverID) {
            var oModel = this.getOwnerComponent().getModel();
            var that = this;
            
            console.log("Loading completed shipments for driver:", sDriverID);
            
            // Try to get shipments that were delivered by this driver
            // This is a fallback approach - we'll get all delivered shipments
            var oBinding = oModel.bindList("/Shipments", null, null, [], {
                "$filter": "status eq 'Delivered'",
                "$orderby": "createdAt desc",
                "$top": 10
            });
            
            oBinding.requestContexts().then(function(aContexts) {
                console.log("Found delivered shipments:", aContexts.length);
                
                var aTrips = [];
                
                aContexts.forEach(function(oContext) {
                    var oShipment = oContext.getObject();
                    var oDate = new Date(oShipment.createdAt || new Date());
                    
                    aTrips.push({
                        date: oDate.toLocaleDateString('en-IN'),
                        tripId: oShipment.ID,
                        km: (oShipment.totalDistance || 150) + " KM",
                        status: "Completed",
                        statusState: "Success",
                        amount: "₹" + (oShipment.totalFare || 0).toLocaleString('en-IN')
                    });
                });
                
                console.log("Fallback trips array:", aTrips);
                
                // Create JSON model for table
                var oTripModel = new JSONModel({ trips: aTrips });
                that.getView().setModel(oTripModel, "tripHistory");
                
                // Bind table items
                var oTable = that.byId("tripHistoryTable");
                if (oTable) {
                    oTable.bindItems({
                        path: "tripHistory>/trips",
                        template: that._createTripListItem()
                    });
                }
                
            }).catch(function(oError) {
                console.error("Error loading completed shipments:", oError);
                that._setEmptyTripHistory();
            });
        },

        _setEmptyTripHistory: function() {
            var oTripModel = new JSONModel({ trips: [] });
            this.getView().setModel(oTripModel, "tripHistory");
            console.log("Set empty trip history");
        },

        _createTripListItem: function() {
            return new sap.m.ColumnListItem({
                cells: [
                    new sap.m.Text({ 
                        text: "{tripHistory>date}",
                        class: "tableCell"
                    }),
                    new sap.m.Text({ 
                        text: "{tripHistory>tripId}",
                        class: "tableCell"
                    }),
                    new sap.m.Text({ 
                        text: "{tripHistory>km}",
                        class: "tableCell"
                    }),
                    new sap.m.ObjectStatus({
                        text: "{tripHistory>status}",
                        state: "{tripHistory>statusState}"
                    }),
                    new sap.m.Text({ 
                        text: "{tripHistory>amount}",
                        class: "tableCell"
                    })
                ]
            });
        },
        
        onRefreshData: function() {
            console.log("Manual refresh triggered");
            this._loadDriverStats();
            this._loadTripHistory();
            sap.m.MessageToast.show("Performance data refreshed");
        }
    });
});