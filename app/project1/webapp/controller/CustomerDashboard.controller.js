sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("project1.controller.CustomerDashboard", {

        onInit: function () {

            // 2. Router Attach karna (URL detect karne ke liye)
            var oRouter = this.getOwnerComponent().getRouter();

            // In chaaro routes par nazar rakho
            oRouter.getRoute("CustomerDashboard").attachMatched(this._onRouteMatched, this);
            oRouter.getRoute("CustomerBooking").attachMatched(this._onRouteMatched, this);
            oRouter.getRoute("CustomerTracking").attachMatched(this._onRouteMatched, this);
            oRouter.getRoute("CustomerHistory").attachMatched(this._onRouteMatched, this);
        },
        // CustomerDashboard.controller.js

        _onObjectMatched: function () {
            var sUserEmail = localStorage.getItem("userEmail"); // dist.ops@hul.com
            var oModel = this.getOwnerComponent().getModel();

            var sPath = "/Users('" + sUserEmail + "')"; // Agar Email Key hai toh
            // Agar Email Key nahi hai, toh filter aise hi rahega:
            var oListBinding = oModel.bindList("/Users", null, [], [
                new sap.ui.model.Filter("email", sap.ui.model.FilterOperator.EQ, sUserEmail)
            ]);

            oListBinding.requestContexts(0, 1).then(function (aContexts) {
                if (aContexts.length > 0) {
                    var oUserData = aContexts[0].getObject();
                    console.log("SUCCESS: Client Found -> " + oUserData.email);

                    this.getView().setBindingContext(aContexts[0]);
                    this._loadDashboardMetrics(oUserData.email);
                    this._loadCustomerShipments(oUserData.email);
                }
            }.bind(this));

        },
        // CustomerDashboard.controller.js

        _loadCustomerShipments: function (sEmail) {
            var oTable = this.byId("recentShipmentsTable");
            var oModel = this.getOwnerComponent().getModel();

            // OData V4 Dynamic Filtering
            var oFilter = new sap.ui.model.Filter("customer/email", sap.ui.model.FilterOperator.EQ, sEmail);

            // Binding update karna
            var oBinding = oTable.getBinding("items");

            if (oBinding) {
                oBinding.filter([oFilter]);
                // Expand lagana zaroori hai agar customer details chahiye
                oBinding.changeParameters({ "$expand": "customer,assignment" });
            }
        },
        // Ye function tab chalega jab URL change hoga
        _onRouteMatched: function (oEvent) {
            var sRouteName = oEvent.getParameter("name");
            var oNavContainer = this.byId("pageNavContainer");
            var oSideNav = this.byId("_IDGenSideNavigation");
            if (sRouteName === "CustomerDashboard") {
                this._onObjectMatched();
            }
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
        _loadDashboardMetrics: function (sEmail) {
            var oModel = this.getOwnerComponent().getModel();
            console.log("fhir error kyu " + sEmail);
            // OData V4 mein functions ke liye binding parameters zaroori hote hain
            var oContextBinding = oModel.bindContext("/getDashboardMetrics(...)", null, {
                "userEmail": sEmail
            });

            // Ab execute call karein
            oContextBinding.execute().then(function () {
                var oData = oContextBinding.getBoundContext().getObject();

                // JSON Model mein data set karein
                var oMetricsModel = new sap.ui.model.json.JSONModel({
                    active: oData.activeShipments || 0,
                    pending: oData.pendingDispatch || 0,
                    spend: oData.monthlySpend || 0
                });

                this.getView().setModel(oMetricsModel, "metrics");
                console.log("Metrics data successfully loaded!");
            }.bind(this)).catch(function (oError) {
                console.error("Metrics load failed:", oError);
            });
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