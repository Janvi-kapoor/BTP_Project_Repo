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
            oDriverModel.setData(oData);
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

        onItemSelect: function(oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            var oRouter = this.getOwnerComponent().getRouter();
            var oNavContainer = this.byId("driverNavContainer");
            
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

        onSideNavButtonPress: function() {
            var oToolPage = this.byId("toolPage");
            oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
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
    var oModel = this.getOwnerComponent().getModel();
    var that = this;

    // 1. Action Context Bind karo
    var oActionContext = oModel.bindContext("/getDriverPerformance(...)");
    oActionContext.setParameter("driverID", sDriverID);

    // 2. Execute karo
    oActionContext.execute().then(function () {
        // V4 mein requestObject use karne se clean JSON milta hai
        oActionContext.requestObject().then(function(oData) {
            console.log("SUCCESS! Data reached UI5:", oData);

            // 3. Agar pehle se model nahi hai toh banao, warna update karo
            var oPerfModel = that.getOwnerComponent().getModel("perfModel");
            if (!oPerfModel) {
                oPerfModel = new sap.ui.model.json.JSONModel(oData);
                that.getOwnerComponent().setModel(oPerfModel, "perfModel");
                oPerfModel.refresh(true);
            } else {
                oPerfModel.setData(oData);
            }
            
            // 4. Forceful UI update
            oPerfModel.refresh(true);
            console.log("UI Model Updated!");
        });
    }).catch(function (oError) {
        console.error("Action Failed:", oError.message);
    });
}
    });
});