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
            var sCardTitle = oButton.getParent().getItems().find(function(item){
                return item.getMetadata().getName() === "sap.m.Title";
            }).getText();

            // Popup ke content ko Card ke hisab se update karein
            if (sCardTitle.includes("Corporate")) {
                oLoginModel.setProperty("/portalTitle", "Corporate Client Login");
                oLoginModel.setProperty("/portalIcon", "sap-icon://building");
            } else if (sCardTitle.includes("Operations")) {
                oLoginModel.setProperty("/portalTitle", "Operations Admin Login");
                oLoginModel.setProperty("/portalIcon", "sap-icon://BusinessSuiteInAppSymbols/signal");
            } else {
                oLoginModel.setProperty("/portalTitle", "Fleet Driver Login");
                oLoginModel.setProperty("/portalIcon", "sap-icon://shipping-status");
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
    var sEmail = this.byId("emailInput").getValue();
    var sPass = this.byId("passwordInput").getValue();

    if (sEmail && sPass) {
        // Yahan 'Authenticating' dikha rahe hain
        sap.m.MessageToast.show("Welcome " + sEmail + "! Loading your data...");
        
        // Success hone par popup band karein
        this.onCloseLogin();
        // Agla step: Yahan hum navigation logic likhenge dashboard ke liye
    } else {
        sap.m.MessageToast.show("Please enter both email and password");
    }
}
    });
});