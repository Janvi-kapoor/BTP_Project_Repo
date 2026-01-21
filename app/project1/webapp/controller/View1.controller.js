sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (Controller, Fragment, JSONModel, MessageToast) {
    "use strict";

    return Controller.extend("project1.controller.View1", {
        onInit: function () {
            // Login Model banayein popup ki details control karne ke liye
            var oLoginModel = new JSONModel({
                portalTitle: "",
                portalIcon: "",
                portalType: ""
            });
            this.getView().setModel(oLoginModel, "loginModel");
        },

        // Ye function tab chalega jab koi bhi "Launch Workspace" button press karega
        onLaunchWorkspace: function (oEvent) {
            var oView = this.getView();
            var oButton = oEvent.getSource();
            var oLoginModel = oView.getModel("loginModel");

            // Hum button ki class ya parent se portal type pata kar sakte hain
            // Lekin sabse best hai ki hum Title check kar lein jo uske upar hai
            var sCardTitle = oButton.getParent().getItems().find(function (item) {
                return item.getMetadata().getName() === "sap.m.Title";
            }).getText();

            // Popup ke content ko Card ke hisab se update karein
            if (sCardTitle.includes("Corporate")) {
                oLoginModel.setProperty("/portalTitle", "Corporate Client Login");
                oLoginModel.setProperty("/portalIcon", "sap-icon://building");
                oLoginModel.setProperty("/portalType", "CUSTOMER");
            } else if (sCardTitle.includes("Operations")) {
                oLoginModel.setProperty("/portalTitle", "Operations Admin Login");
                oLoginModel.setProperty("/portalIcon", "sap-icon://BusinessSuiteInAppSymbols/signal");
                oLoginModel.setProperty("/portalType", "ADMIN");
            } else {
                oLoginModel.setProperty("/portalTitle", "Fleet Driver Login");
                oLoginModel.setProperty("/portalIcon", "sap-icon://shipping-status");
                oLoginModel.setProperty("/portalType", "DRIVER");
            }

            // Fragment (Popup) load karne ka logic
            if (!this._pDialog) {
                this._pDialog = Fragment.load({
                    id: oView.getId(),
                    name: "project1.view.LoginDialog", // <--- Yahan apna sahi path check karein
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pDialog.then(function (oDialog) {
                oDialog.open();
            });
        },

        onCloseLogin: function () {
            // Dialog ki ID fragment mein 'loginDialog' hai, isliye wahi use karni hogi
            var oDialog = this.byId("loginDialog");
            if (oDialog) {
                oDialog.close();
                // Input fields clear karein safely
                var oEmail = this.byId("emailInput");
                var oPass = this.byId("passwordInput");

                if (oEmail) oEmail.setValue("");
                if (oPass) oPass.setValue("");
            }
        },
        onLoginSubmit: function () {
            var oView = this.getView();
            var sEmail = oView.byId("emailInput").getValue();
            var sPass = oView.byId("passwordInput").getValue();
            var oLoginModel = oView.getModel("loginModel");
            var sType = oLoginModel.getProperty("/portalType"); // ADMIN, CUSTOMER, or DRIVER

            if (!sEmail || !sPass) {
                sap.m.MessageToast.show("Please enter Email and Password");
                return;
            }

            // OData V4 Model
            var oModel = this.getOwnerComponent().getModel();
            var sEntitySet = (sType === "DRIVER") ? "/Fleet_Drivers" : "/Users";

            // Filters taiyar karein
            var aFilters = [
                new sap.ui.model.Filter("email", sap.ui.model.FilterOperator.EQ, sEmail),
                new sap.ui.model.Filter("password", sap.ui.model.FilterOperator.EQ, sPass)
            ];

            // Agar Admin ya Customer hai toh Role filter bhi lagayein
            if (sType !== "DRIVER") {
                aFilters.push(new sap.ui.model.Filter("role", sap.ui.model.FilterOperator.EQ, sType));
            }

            // Busy Indicator start
            sap.ui.core.BusyIndicator.show(0);

            // OData V4 List Binding for Validation
            var oListBinding = oModel.bindList(sEntitySet, null, null, aFilters);

            oListBinding.requestContexts().then(function (aContexts) {
                sap.ui.core.BusyIndicator.hide();

                if (aContexts.length > 0) {
                    localStorage.clear();
                    localStorage.setItem("userEmail", sEmail);
                    var oUserData = aContexts[0].getObject();
                    sap.m.MessageToast.show("Welcome " + (oUserData.name || oUserData.companyName));

                    // Login successful actions
                    this.onCloseLogin();
                    this._navigateToDashboard(sType);
                } else {
                    // Data nahi mila
                    sap.m.MessageToast.show("Invalid Credentials or Role. Please try again.");
                }
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Database connection failed.");
            });
        },

        _navigateToDashboard: function (sType) {
            var oRouter = this.getOwnerComponent().getRouter();
            // Manifest routes ke names matching hone chahiye
            if (sType === "CUSTOMER") oRouter.navTo("CustomerDashboard");
            else if (sType === "ADMIN") oRouter.navTo("AdminDashboard");
            else if (sType === "DRIVER") oRouter.navTo("DriverDashboard");
        }
    });
});