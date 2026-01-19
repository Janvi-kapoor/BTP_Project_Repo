sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("project1.controller.CustomerDashboard", {
        onInit: function () {
            // Dashboard load hote hi agar kuch check karna ho
        },

        onLogout: function() {
            // Wapas login page par bhejne ke liye
            this.getOwnerComponent().getRouter().navTo("RouteView1");
        }
    });
});