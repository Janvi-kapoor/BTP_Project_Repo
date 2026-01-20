sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("project1.controller.CustomerDashboard", {

        onInit: function () {
            // 1. Data Model Set karna (Tumhara purana code)
            var oData = {
                shipments: [
                    { id: "SHP-2024-8847", material: "Steel Coils", destination: "Mumbai Hub", status: "In Transit", statusClass: "in-transit", eta: "2h 34m" },
                    { id: "SHP-2024-8846", material: "Auto Parts", destination: "Chennai Factory", status: "Loading", statusClass: "loading", eta: "4h 12m" },
                    { id: "SHP-2024-8845", material: "Electronics", destination: "Delivered", statusClass: "delivered", eta: "Arrived" }
                ]
            };
            this.getView().setModel(new JSONModel(oData));

            // 2. Router Attach karna (URL detect karne ke liye)
            var oRouter = this.getOwnerComponent().getRouter();
            
            // In chaaro routes par nazar rakho
            oRouter.getRoute("CustomerDashboard").attachMatched(this._onRouteMatched, this);
            oRouter.getRoute("CustomerBooking").attachMatched(this._onRouteMatched, this);
            oRouter.getRoute("CustomerTracking").attachMatched(this._onRouteMatched, this);
            oRouter.getRoute("CustomerHistory").attachMatched(this._onRouteMatched, this);
        },

        // Ye function tab chalega jab URL change hoga
        _onRouteMatched: function (oEvent) {
            var sRouteName = oEvent.getParameter("name");
            var oNavContainer = this.byId("pageNavContainer");
            var oSideNav = this.byId("_IDGenSideNavigation");

            // URL check karke sahi page dikhao
            if (sRouteName === "CustomerBooking") {
                oNavContainer.to(this.byId("bookingPage"));
                oSideNav.setSelectedKey("booking"); // Sidebar button highlight karo
            } 
            else if (sRouteName === "CustomerTracking") {
                oNavContainer.to(this.byId("trackPage"));
                oSideNav.setSelectedKey("track");
            } 
            else if (sRouteName === "CustomerHistory") {
                oNavContainer.to(this.byId("historyPage"));
                oSideNav.setSelectedKey("history");
            }
            else {
                // Default: Dashboard
                oNavContainer.to(this.byId("dashPage"));
                oSideNav.setSelectedKey("dash");
            }
        },

        // Sidebar Menu Button Toggle
        onSideNavButtonPress: function () {
            var oToolPage = this.byId("toolPage");
            oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
        },

        // Jab user Sidebar Item par Click kare
        onItemSelect: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            var oRouter = this.getOwnerComponent().getRouter();

            // Yahan hum page change nahi karenge, hum sirf URL badlenge.
            // URL badalne par _onRouteMatched chalega aur wo page badlega.
            
            if (sKey === "booking") {
                oRouter.navTo("CustomerBooking");
            } else if (sKey === "track") {
                oRouter.navTo("CustomerTracking");
            } else if (sKey === "history") {
                oRouter.navTo("CustomerHistory");
            } else {
                oRouter.navTo("CustomerDashboard");
            }
        }
    });
});