sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",         // <--- Ye add karna hai
    "sap/ui/model/FilterOperator"
], function (Controller, MessageToast, JSONModel,Filter, FilterOperator) {
    "use strict";

    return Controller.extend("project1.controller.DriverDashboard", {
       
        onInit: function () {
            // JSON Model initialize karein
            var oDriverModel = new JSONModel({
                ID: "",
                pickupLocation: "Loading...",
                dropLocation: "Loading...",
                truckNo: "...",
                driverName: "...",
                status: "Offline",
                loadWeightTons: "0",
                materialCategory: "..."
            });
            this.getView().setModel(oDriverModel, "driverData");

            // Refresh main model to ensure fresh data
            var oMainModel = this.getOwnerComponent().getModel();
            if (oMainModel && oMainModel.refresh) {
                oMainModel.refresh();
            }

            // Database se real data uthayein
            this._loadActiveMission();
            this._loadPerformanceData();
        },

_loadActiveMission: function() {
    var oModel = this.getOwnerComponent().getModel();
    var oDriverModel = this.getView().getModel("driverData");
    var sDriverID = localStorage.getItem("loggedDriverID"); 

    if (!sDriverID) {
        console.error("No loggedDriverID found in localStorage");
        return;
    }

    // YAHAN HAI FIX: sDriverID ko single quotes ('') mein wrap karna hai
    var sFilterWithQuotes = "driverID eq '" + sDriverID + "'";

    var oListBinding = oModel.bindList("/ActiveMission", null, null, [], {
        "$filter": sFilterWithQuotes 
    });

    var that = this;
    oListBinding.requestContexts(0, 1).then(function (aContexts) {
        if (aContexts && aContexts.length > 0) {
            var oData = aContexts[0].getObject();
            console.log("Mission Data Loaded:", oData);
            
            // Ensure ETA has a proper value
            if (!oData.eta || oData.eta === 'undefined' || oData.eta === '') {
                oData.eta = '2-3 hours';
            }
            
            oDriverModel.setData(oData);
            
            // Update performance data after mission data is loaded
            that._loadPerformanceData();
        } else {
            // Agar trip nahi hai, toh purana card reset karo aur naam login wala dikhao
            oDriverModel.setProperty("/driverName", localStorage.getItem("loggedDriverName"));
            oDriverModel.setProperty("/status", "No Active Mission");
            oDriverModel.setProperty("/pickupLocation", "N/A");
            oDriverModel.setProperty("/dropLocation", "N/A");
        }
    }).catch(function(oError) {
        console.error("Binding Error (400 check):", oError.message);
        sap.m.MessageToast.show("Data load failed. Check console.");
    });
},

onStartTrip: function () {
    var oModel = this.getOwnerComponent().getModel();
    var oDriverModel = this.getView().getModel("driverData");
    var sShipmentID = oDriverModel.getProperty("/ID");

    if (!sShipmentID) {
        sap.m.MessageToast.show("Error: No Shipment ID found.");
        return;
    }

    // FIX: Bind context directly to the action name defined in your service
    // Note: 'logichain.LogiChainService' agar tumhara service namespace hai toh use karein
    var oAction = oModel.bindContext("/startMission(...)"); 

    oAction.setParameter("shipmentID", sShipmentID);

    var that = this;
    oAction.execute().then(function () {
        sap.m.MessageToast.show("Mission Started!");
        that._loadActiveMission();
    }).catch(function (oError) {
        // Agar yahan 'Unknown operation' aaye, toh backend metadata check karna hoga
        console.error("Action Error:", oError.message);
    });
},

        // Updated onItemSelect to match Admin functionality
        onItemSelect: function(oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            var oRouter = this.getOwnerComponent().getRouter();
            var oNavContainer = this.byId("driverNavContainer");
            var oToolPage = this.byId("toolPage");
            
            // Desktop: Agar sidebar band hai to pehle expand karo
            if (!sap.ui.Device.system.phone && window.innerWidth >= 600) {
                if (!oToolPage.getSideExpanded()) {
                    oToolPage.setSideExpanded(true);
                }
            }
            
            // Mobile Optimization: Item click karte hi Sidebar band hona chahiye
            if (sap.ui.Device.system.phone || window.innerWidth < 600) {
                var $sideNav = this.byId("sideNavigation").$();
                
                // Sidebar class hatao (Band karo)
                $sideNav.removeClass("mobile-open");
                
                // Button wapas 'Menu' icon ban jaye
                this.byId("sideNavBtn").setIcon("sap-icon://menu2");
            }
            
            switch(sKey) {
                case "mission":
                    // Navigate to mission page within NavContainer
                    var oMissionPage = this.byId("missionPage");
                    if (oMissionPage) {
                        oNavContainer.to(oMissionPage);
                    }
                    break;
                case "navigation":
                    oRouter.navTo("DriverNav");
                    break;
                case "secure":
                    oRouter.navTo("DriverSecure");
                    break;
                case "performance":
                    oRouter.navTo("DriverPerformance");
                    break;
            }
        },

        // Updated onSideNavButtonPress to match Admin functionality
        onSideNavButtonPress: function() {
            var oBtn = this.byId("sideNavBtn");
            var oSideNav = this.byId("sideNavigation");
            var $sideNav = oSideNav.$(); // jQuery Access

            // Mobile Specific Logic
            if (sap.ui.Device.system.phone || window.innerWidth < 600) {
                
                // Check karo agar class already lagi hai
                if ($sideNav.hasClass("mobile-open")) {
                    // Agar khula hai -> Band karo
                    $sideNav.removeClass("mobile-open");
                    oBtn.setIcon("sap-icon://menu2"); // Menu Icon wapas lao
                } else {
                    // Agar band hai -> Kholo
                    $sideNav.addClass("mobile-open");
                    oBtn.setIcon("sap-icon://decline"); // Cross Icon lao
                }
            } else {
                // Desktop Standard Logic
                var oToolPage = this.byId("toolPage");
                oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
                
                // Desktop Icon Change Logic
                var bExpanded = oToolPage.getSideExpanded();
                oBtn.setIcon(bExpanded ? "sap-icon://menu2" : "sap-icon://menu2"); 
            }
        },

        onLogout: function() {
            // Clear all localStorage data
            localStorage.removeItem("userEmail");
            localStorage.removeItem("userRole");
            localStorage.removeItem("loggedDriverID");
            localStorage.removeItem("loggedDriverName");
            localStorage.clear();
            
            // Navigate to main landing page (3 tiles)
            this.getOwnerComponent().getRouter().navTo("RouteView1");
            
            // Show confirmation message
            sap.m.MessageToast.show("Logged out successfully");
        },

  
_loadPerformanceData: function() {
    var sDriverID = localStorage.getItem("loggedDriverID");
    var oDriverModel = this.getView().getModel("driverData");
    
    // Use data from driverData model instead of separate action
    if (oDriverModel) {
        var oData = oDriverModel.getData();
        var oPerfModel = new sap.ui.model.json.JSONModel({
            totalDistance: Math.round(oData.totalDistance || 0),
            truckType: oData.truckType || "N/A",
            totalFare: oData.totalFare || 0
        });
        this.getOwnerComponent().setModel(oPerfModel, "perfModel");
    }
}
    });
});