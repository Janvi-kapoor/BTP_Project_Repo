sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("project1.controller.ControlTower", {
        
        onInit: function () {
            console.log("Control Tower Controller Loaded!");
            
            var oDashboardModel = new JSONModel({
                stats: { revenue: 0, commission: 0, activeDrivers: 0 }
            });
            this.getView().setModel(oDashboardModel, "dashboard");

            this._loadDashboardStats();
        },

        _loadDashboardStats: function() {
            var oModel = this.getOwnerComponent().getModel(); 
            var oDashboardModel = this.getView().getModel("dashboard");
            
            console.log("Attempting to call getDashboardStats...");
            
            // OData V4 function binding
            var oFunction = oModel.bindContext("/getDashboardStats(...)");

            oFunction.execute().then(function () {
                console.log("Backend successfully hit!");

                // 1. Data context se nikaalein
                var oContext = oFunction.getBoundContext();
                var oData = oContext.getObject();

                console.log("Actual Data from HANA:", oData);

                // 2. Local JSON Model update karein (Paths must match XML)
                oDashboardModel.setProperty("/stats/revenue", oData.totalRevenue);
                oDashboardModel.setProperty("/stats/commission", oData.totalCommission);
                oDashboardModel.setProperty("/stats/activeDrivers", oData.activeDrivers);
                
            }).catch(function(err) {
                console.error("Request fail ho gayi:", err);
            });
        }
    });
});