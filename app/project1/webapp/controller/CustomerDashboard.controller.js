sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("project1.controller.CustomerDashboard", {
        onInit: function () {
            var oData = {
                shipments: [
                    { id: "SHP-2024-8847", material: "Steel Coils", destination: "Mumbai Hub", status: "In Transit", statusClass: "in-transit", eta: "2h 34m" },
                    { id: "SHP-2024-8846", material: "Auto Parts", destination: "Chennai Factory", status: "Loading", statusClass: "loading", eta: "4h 12m" },
                    { id: "SHP-2024-8845", material: "Electronics", destination: "Delivered", statusClass: "delivered", eta: "Arrived" }
                ]
            };
            this.getView().setModel(new JSONModel(oData));
        },

        onSideNavButtonPress: function () {
            var oToolPage = this.byId("toolPage");
            oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
        },

        onItemSelect: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            var sKey = oItem.getKey();
            var oNavContainer = this.byId("pageNavContainer");

            // Switch content based on key
            if (sKey === "dash") {
                oNavContainer.to(this.byId("dashPage"));
            } else if (sKey === "booking") {
                oNavContainer.to(this.byId("bookingPage"));
            } else {
                // Default fallback for Track/History
                sap.m.MessageToast.show("Page for " + sKey + " coming soon!");
            }
        }
    });
});